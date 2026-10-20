begin;
create function public.reserve_ai_request(p_pharmacy uuid,p_model text) returns uuid language plpgsql security definer set search_path='' as $$ declare quota integer; job uuid; begin
 if not public.can_write(p_pharmacy) or public.member_role(p_pharmacy) not in ('owner','pharmacist') then raise exception 'Forbidden'; end if;
 perform 1 from public.pharmacies where id=p_pharmacy for update;
 select ai_limit into quota from public.subscriptions where pharmacy_id=p_pharmacy;
 if quota is null or (select count(*) from public.ai_extraction_jobs where pharmacy_id=p_pharmacy and created_at>=date_trunc('month',now() at time zone 'Asia/Baghdad') at time zone 'Asia/Baghdad')>=quota then raise exception 'Monthly AI allowance reached'; end if;
 if (select count(*) from public.ai_extraction_jobs where pharmacy_id=p_pharmacy and created_at>now()-interval '1 minute')>=5 then raise exception 'AI rate limit reached'; end if;
 insert into public.ai_extraction_jobs(pharmacy_id,status,model) values(p_pharmacy,'pending',p_model) returning id into job;return job;end $$;
create function public.commit_extraction(p_pharmacy uuid,p_job uuid,p_patient uuid,p_data jsonb,p_verified boolean) returns uuid language plpgsql security definer set search_path='' as $$ declare patient uuid; m jsonb; begin
 if not p_verified or not public.can_write(p_pharmacy) or public.member_role(p_pharmacy) not in ('owner','pharmacist') then raise exception 'Pharmacist verification required'; end if;
 perform 1 from public.ai_extraction_jobs where id=p_job and pharmacy_id=p_pharmacy and requested_by=auth.uid() and status='completed' for update;
 if not found then raise exception 'Extraction is unavailable or already reviewed'; end if;
 if p_patient is not null then select id into patient from public.patients where id=p_patient and pharmacy_id=p_pharmacy; if patient is null then raise exception 'Patient unavailable'; end if;
 else insert into public.patients(pharmacy_id,full_name,phone,city,conditions) values(p_pharmacy,p_data->'patient'->>'full_name',p_data->'patient'->>'phone',coalesce(p_data->'patient'->>'city',''),coalesce(p_data->'patient'->>'conditions','')) returning id into patient; end if;
 for m in select * from jsonb_array_elements(p_data->'medications') loop
 if coalesce(length(trim(m->>'medicine_name')),0)=0 or coalesce(length(trim(m->>'strength')),0)=0 or coalesce(length(trim(m->>'instructions')),0)=0 then raise exception 'Confirm all clinical fields'; end if;
 insert into public.patient_medications(pharmacy_id,patient_id,medicine_name,strength,form,route,instructions,status) values(p_pharmacy,patient,m->>'medicine_name',m->>'strength',m->>'form',m->>'route',m->>'instructions','active');
 end loop;
 update public.ai_extraction_jobs set status='reviewed' where id=p_job;
 return patient;end $$;
revoke all on function public.reserve_ai_request(uuid,text),public.commit_extraction(uuid,uuid,uuid,jsonb,boolean) from public;
grant execute on function public.reserve_ai_request(uuid,text),public.commit_extraction(uuid,uuid,uuid,jsonb,boolean) to authenticated;
commit;
