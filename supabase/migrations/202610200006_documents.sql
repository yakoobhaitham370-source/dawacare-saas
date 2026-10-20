begin;
create function public.register_document(p_pharmacy uuid,p_patient uuid,p_path text,p_mime text,p_size integer,p_category text) returns uuid language plpgsql security definer set search_path='' as $$ declare result uuid;begin
 if not public.can_write(p_pharmacy) then raise exception 'Forbidden'; end if;
 if not exists(select 1 from public.patients where pharmacy_id=p_pharmacy and id=p_patient) then raise exception 'Patient unavailable'; end if;
 insert into public.patient_documents(pharmacy_id,patient_id,object_path,mime_type,size_bytes,category) values(p_pharmacy,p_patient,p_path,p_mime,p_size,p_category) returning id into result;return result;end $$;
create function public.archive_document(p_pharmacy uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.can_write(p_pharmacy) or public.member_role(p_pharmacy) not in ('owner','pharmacist') then raise exception 'Forbidden'; end if;
 update public.patient_documents set archived_at=now() where pharmacy_id=p_pharmacy and id=p_id;
 end $$;
create function public.audit_document_access(p_pharmacy uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.can_read(p_pharmacy) or not exists(select 1 from public.patient_documents where pharmacy_id=p_pharmacy and id=p_id and archived_at is null) then raise exception 'Forbidden'; end if;
 insert into public.clinical_audit_logs(pharmacy_id,actor_id,action,record_id) values(p_pharmacy,auth.uid(),'access:patient_documents',p_id);end $$;
revoke all on function public.register_document(uuid,uuid,text,text,integer,text),public.archive_document(uuid,uuid),public.audit_document_access(uuid,uuid) from public;
grant execute on function public.register_document(uuid,uuid,text,text,integer,text),public.archive_document(uuid,uuid),public.audit_document_access(uuid,uuid) to authenticated;
commit;
