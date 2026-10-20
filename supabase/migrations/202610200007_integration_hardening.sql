begin;
-- Repair an already-created development bucket as well as fresh projects.
update storage.buckets set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','application/pdf'] where id='patient-documents';
-- Supabase projects can grant privileges through default privileges. Make the
-- DawaCare ACL explicit instead of relying on an empty-database test default.
do $$ declare t text; begin
 foreach t in array array['profiles','platform_admins','pharmacies','pharmacy_memberships','subscription_plans','subscriptions','subscription_invoices','subscription_payments','platform_settings','feature_entitlements','pharmacy_invitations','administrative_audit_logs','patients','patient_conditions','medication_catalog','patient_medications','medication_regimens','dispensing_events','refill_projections','refill_tasks','patient_contact_events','laboratory_results','patient_documents','clinical_audit_logs','ai_extraction_jobs','ai_usage_records','notification_preferences','scheduled_job_runs','application_events'] loop
  execute format('revoke all on public.%I from anon, authenticated', t);
  execute format('grant select on public.%I to authenticated', t);
  execute format('grant all on public.%I to service_role', t);
 end loop;
end $$;
grant insert, update on public.patients, public.patient_conditions, public.medication_catalog, public.patient_medications, public.laboratory_results, public.notification_preferences, public.pharmacies, public.subscription_plans, public.subscriptions, public.subscription_invoices, public.platform_settings, public.feature_entitlements to authenticated;
grant insert on public.medication_regimens, public.patient_contact_events, public.subscription_payments to authenticated;
-- In particular: no browser writes to memberships, invitations, files, events,
-- projections, audit records or payment confirmation columns.
do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('is_platform_admin','member_role','can_read','can_write','protect_context','audit_record','audit_admin','limit_patients','record_dispensing','prepare_invitation','provision_pharmacy','accept_pending_invitation','confirm_payment','payment_unconfirmed','subscription_transition','stamp_actor','reserve_ai_request','commit_extraction','manage_staff','register_document','archive_document','audit_document_access') loop
  execute format('revoke all on function %s from public, anon, authenticated',f);
 end loop;
end $$;
grant execute on function public.is_platform_admin(), public.member_role(uuid), public.can_read(uuid), public.can_write(uuid), public.record_dispensing(uuid,jsonb), public.prepare_invitation(uuid,text,text), public.provision_pharmacy(jsonb), public.accept_pending_invitation(), public.confirm_payment(uuid), public.reserve_ai_request(uuid,text), public.commit_extraction(uuid,uuid,uuid,jsonb,boolean), public.manage_staff(uuid,uuid,text,boolean), public.register_document(uuid,uuid,text,text,integer,text), public.archive_document(uuid,uuid), public.audit_document_access(uuid,uuid) to authenticated;

-- Document registration is server-only: users must not manufacture metadata to
-- turn an unregistered/orphaned storage object into an authorized download.
revoke execute on function public.register_document(uuid,uuid,text,text,integer,text) from authenticated;
create function public.register_uploaded_document(p_actor uuid,p_pharmacy uuid,p_patient uuid,p_path text,p_mime text,p_size integer,p_category text) returns uuid
language plpgsql security definer set search_path='' as $$ declare doc uuid; begin
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 -- Supabase auth.uid() reads claims.sub when a claims object is present.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::text,true);
 doc=public.register_document(p_pharmacy,p_patient,p_path,p_mime,p_size,p_category);
 return doc; end $$;
revoke all on function public.register_uploaded_document(uuid,uuid,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.register_uploaded_document(uuid,uuid,uuid,text,text,integer,text) to service_role;

-- Immutable patient numbers and self-owned notification preferences.
create function public.protect_patient_number() returns trigger language plpgsql set search_path='' as $$ begin
 if new.display_number is distinct from old.display_number then raise exception 'Immutable patient number'; end if; return new; end $$;
create trigger protect_patient_number before update on public.patients for each row execute function public.protect_patient_number();
drop policy tenant_read on public.notification_preferences;
drop policy tenant_insert on public.notification_preferences;
drop policy tenant_update on public.notification_preferences;
create policy self_preference_read on public.notification_preferences for select to authenticated using(user_id=auth.uid() and public.can_read(pharmacy_id));
create policy self_preference_insert on public.notification_preferences for insert to authenticated with check(user_id=auth.uid() and public.can_write(pharmacy_id));
create policy self_preference_update on public.notification_preferences for update to authenticated using(user_id=auth.uid() and public.can_write(pharmacy_id)) with check(user_id=auth.uid() and public.can_write(pharmacy_id));
revoke all on function public.protect_patient_number() from public,anon,authenticated;
alter table public.ai_extraction_jobs add constraint ai_job_tenant_key unique(pharmacy_id,id);
alter table public.ai_usage_records add constraint ai_usage_job_tenant_fk foreign key(pharmacy_id,job_id) references public.ai_extraction_jobs(pharmacy_id,id);

-- Enforce matching invoice currency even before a receipt is confirmed.
create function public.validate_payment_invoice() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from public.subscription_invoices i where i.id=new.invoice_id and i.pharmacy_id=new.pharmacy_id and i.currency=new.currency and i.status<>'void') then raise exception 'Invoice unavailable or currency mismatch'; end if;return new;end $$;
create trigger validate_payment_invoice before insert on public.subscription_payments for each row execute function public.validate_payment_invoice();
revoke all on function public.validate_payment_invoice() from public,anon,authenticated;
commit;
