begin;
-- Interactive platform access requires a verified second factor.
create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$ select coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from public.platform_admins where user_id=auth.uid()) $$;
create function public.prepare_invitation(p_pharmacy uuid,p_email text,p_role text) returns uuid language plpgsql security definer set search_path='' as $$ declare seats integer; invitation_id uuid; begin
 if not public.is_platform_admin() and (public.member_role(p_pharmacy) is distinct from 'owner' or p_role='owner') then raise exception 'Forbidden'; end if;
 if p_role not in ('owner','pharmacist','technician') or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid invitation'; end if;
 if not public.is_platform_admin() and not public.can_write(p_pharmacy) then raise exception 'Subscription does not permit invitations'; end if;
 perform 1 from public.pharmacies where id=p_pharmacy for update;
 select staff_limit into seats from public.subscriptions where pharmacy_id=p_pharmacy;
 update public.pharmacy_invitations set status='revoked' where pharmacy_id=p_pharmacy and status in ('pending','sent','failed') and expires_at<=now();
 if seats is null or (select count(*) from public.pharmacy_memberships where pharmacy_id=p_pharmacy and active)+(select count(*) from public.pharmacy_invitations where pharmacy_id=p_pharmacy and status in ('pending','sent','failed') and expires_at>now())>=seats then raise exception 'Staff seat limit reached'; end if;
 insert into public.pharmacy_invitations(pharmacy_id,email,role,invited_by) values(p_pharmacy,lower(trim(p_email)),p_role,auth.uid()) returning id into invitation_id;
 return invitation_id; end $$;
create function public.provision_pharmacy(p_input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ declare pharmacy uuid; plan public.subscription_plans; invitation uuid; begin
 if not public.is_platform_admin() then raise exception 'Forbidden: administrator MFA required'; end if;
 select * into plan from public.subscription_plans where id=(p_input->>'plan_id')::uuid and active;
 if not found then raise exception 'Active plan required'; end if;
 insert into public.pharmacies(name,city,phone,owner_email) values(p_input->>'name',p_input->>'city',p_input->>'phone',p_input->>'owner_email') returning id into pharmacy;
 insert into public.subscriptions(pharmacy_id,plan_id,status,starts_on,ends_on,staff_limit,patient_limit,ai_limit) values(pharmacy,plan.id,'trial',(p_input->>'starts_on')::date,(p_input->>'ends_on')::date,plan.staff_limit,plan.patient_limit,plan.ai_limit);
 invitation=public.prepare_invitation(pharmacy,p_input->>'owner_email','owner');
 return jsonb_build_object('pharmacy_id',pharmacy,'invitation_id',invitation); end $$;
create function public.accept_pending_invitation() returns integer language plpgsql security definer set search_path='' as $$ declare invited public.pharmacy_invitations; accepted integer=0; verified_email text; begin
 select lower(email) into verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if verified_email is null then raise exception 'Verified account required'; end if;
 for invited in select * from public.pharmacy_invitations where lower(email)=verified_email and status='sent' and expires_at>now() order by created_at for update loop
 perform 1 from public.pharmacies where id=invited.pharmacy_id for update;
 if invited.provider_user_id is distinct from auth.uid() then continue; end if;
 insert into public.pharmacy_memberships(pharmacy_id,user_id,role) values(invited.pharmacy_id,auth.uid(),invited.role) on conflict(pharmacy_id,user_id) do nothing;
 update public.pharmacy_invitations set status='accepted' where id=invited.id; accepted=accepted+1;
 end loop;return accepted; end $$;
create function public.confirm_payment(p_payment uuid) returns void language plpgsql security definer set search_path='' as $$ declare payment public.subscription_payments; invoice public.subscription_invoices; begin
 if not public.is_platform_admin() then raise exception 'Forbidden'; end if;
 select * into payment from public.subscription_payments where id=p_payment for update;
 if not found or payment.confirmed_at is not null then raise exception 'Payment unavailable or already confirmed'; end if;
 select * into invoice from public.subscription_invoices where id=payment.invoice_id for update;
 if invoice.currency<>payment.currency then raise exception 'Currency mismatch'; end if;
 update public.subscription_payments set confirmed_by=auth.uid(),confirmed_at=now() where id=p_payment;
 if (select coalesce(sum(amount),0) from public.subscription_payments where invoice_id=invoice.id and confirmed_at is not null)>=invoice.amount then update public.subscription_invoices set status='paid' where id=invoice.id; end if;
 end $$;
-- Browser writes cannot manufacture payment verification.
create function public.payment_unconfirmed() returns trigger language plpgsql set search_path='' as $$ begin if new.confirmed_by is not null or new.confirmed_at is not null then raise exception 'Use audited confirmation'; end if; return new; end $$;
create trigger payment_unconfirmed before insert on public.subscription_payments for each row execute function public.payment_unconfirmed();
create function public.subscription_transition() returns trigger language plpgsql set search_path='' as $$ begin
 if old.status<>new.status and not (case old.status
 when 'trial' then new.status in ('active','expired','suspended','canceled')
 when 'active' then new.status in ('past_due','suspended','expired','canceled')
 when 'past_due' then new.status in ('active','grace_period','suspended','expired','canceled')
 when 'grace_period' then new.status in ('active','suspended','expired','canceled')
 when 'suspended' then new.status in ('active','expired','canceled')
 when 'expired' then new.status in ('active','canceled')
 when 'canceled' then new.status='active' else false end) then raise exception 'Invalid subscription transition'; end if;return new;end $$;
create trigger subscription_transition before update on public.subscriptions for each row execute function public.subscription_transition();
-- Stamp identities, regardless of client-supplied created_by fields.
create function public.stamp_actor() returns trigger language plpgsql set search_path='' as $$ begin new.created_by=auth.uid(); if to_jsonb(new) ? 'updated_by' then new.updated_by=auth.uid(); end if; return new; end $$;
do $$ declare t text; begin foreach t in array array['patient_conditions','patient_medications','medication_regimens','dispensing_events','patient_contact_events','laboratory_results','patient_documents'] loop if t<>'patient_conditions' then execute format('create trigger stamp_actor before insert on public.%I for each row execute function public.stamp_actor()',t); end if; end loop;end $$;
-- Replace globally sequential identifiers with pharmacy-scoped numbers under the same patient-limit lock.
alter table public.patients alter column display_number drop identity;
create or replace function public.limit_patients() returns trigger language plpgsql security definer set search_path='' as $$ declare max_patients integer; begin
 perform 1 from public.pharmacies where id=new.pharmacy_id for update;
 select patient_limit into max_patients from public.subscriptions where pharmacy_id=new.pharmacy_id;
 if max_patients is null or (select count(*) from public.patients where pharmacy_id=new.pharmacy_id)>=max_patients then raise exception 'Patient limit reached'; end if;
 select coalesce(max(display_number),0)+1 into new.display_number from public.patients where pharmacy_id=new.pharmacy_id;
 new.created_by=auth.uid();new.updated_by=auth.uid();return new; end $$;
-- Revoke PostgreSQL's default PUBLIC execute on all privileged routines.
revoke all on function public.prepare_invitation(uuid,text,text),public.provision_pharmacy(jsonb),public.accept_pending_invitation(),public.confirm_payment(uuid),public.payment_unconfirmed(),public.subscription_transition(),public.stamp_actor() from public;
grant execute on function public.prepare_invitation(uuid,text,text),public.provision_pharmacy(jsonb),public.accept_pending_invitation(),public.confirm_payment(uuid) to authenticated;
commit;
