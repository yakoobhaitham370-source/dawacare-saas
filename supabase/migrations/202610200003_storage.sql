-- Private documents are deployed separately from core schema tests.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('patient-documents','patient-documents',false,5242880,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
-- Metadata is registered through a future validated server upload flow; no browser insert policy exists yet.
create policy document_read on storage.objects for select to authenticated using(bucket_id='patient-documents' and exists(select 1 from public.patient_documents d where d.object_path=name and d.archived_at is null and public.can_read(d.pharmacy_id)));
-- No public or direct upload/delete policy. The disabled upload UI must stay disabled until its server flow is tested.
commit;
