-- Preserve inclusive calculations and history; compare every persisted field on replay.
begin;
create or replace function public.record_dispensing(p_pharmacy uuid,p_input jsonb) returns uuid language plpgsql security definer set search_path='' as $$ declare e public.dispensing_events; m public.patient_medications; begin
 if not public.can_write(p_pharmacy) or public.member_role(p_pharmacy) not in ('owner','pharmacist') then raise exception 'Forbidden'; end if;
 select * into m from public.patient_medications where pharmacy_id=p_pharmacy and id=(p_input->>'medication_id')::uuid and patient_id=(p_input->>'patient_id')::uuid and status='active' for update;
 if not found then raise exception 'Active medication unavailable'; end if;
 if p_input->>'request_id' is not null then
  select * into e from public.dispensing_events where pharmacy_id=p_pharmacy and request_id=(p_input->>'request_id')::uuid;
  if found then
   if e.patient_id is distinct from m.patient_id or e.medication_id is distinct from m.id
      or e.quantity is distinct from (p_input->>'quantity')::numeric
      or e.days_supply is distinct from (p_input->>'days_supply')::integer
      or e.dispensed_on is distinct from (p_input->>'dispensed_on')::date
      or e.lead_days is distinct from coalesce((p_input->>'lead_days')::integer,2)
      or e.carry_days is distinct from coalesce((p_input->>'carry_days')::integer,0)
      or e.carry_reviewed is distinct from coalesce((p_input->>'carry_reviewed')::boolean,false)
      or e.correction_of is distinct from (p_input->>'correction_of')::uuid
      or e.correction_reason is distinct from (p_input->>'correction_reason')
   then raise exception 'Idempotency key reused with different input'; end if;
   return e.id;
  end if;
 end if;
 if (p_input->>'dispensed_on')::date > (now() at time zone 'Asia/Baghdad')::date then raise exception 'Future dispensing not allowed'; end if;
 if p_input->>'correction_of' is not null and not exists(select 1 from public.dispensing_events where id=(p_input->>'correction_of')::uuid and pharmacy_id=p_pharmacy and medication_id=m.id) then raise exception 'Invalid correction target'; end if;
 insert into public.dispensing_events(pharmacy_id,patient_id,medication_id,request_id,dispensed_on,quantity,days_supply,lead_days,carry_days,carry_reviewed,correction_of,correction_reason)
 values(p_pharmacy,m.patient_id,m.id,coalesce((p_input->>'request_id')::uuid,gen_random_uuid()),(p_input->>'dispensed_on')::date,(p_input->>'quantity')::numeric,(p_input->>'days_supply')::integer,coalesce((p_input->>'lead_days')::integer,2),coalesce((p_input->>'carry_days')::integer,0),coalesce((p_input->>'carry_reviewed')::boolean,false),(p_input->>'correction_of')::uuid,p_input->>'correction_reason') returning * into e;
 -- Serialize on medication row. A late-entered historical event does not displace newer supply.
 if not exists(select 1 from public.refill_projections p join public.dispensing_events d on d.id=p.dispensing_event_id where p.pharmacy_id=p_pharmacy and p.medication_id=m.id and d.dispensed_on>e.dispensed_on) then
 insert into public.refill_projections(pharmacy_id,patient_id,medication_id,dispensing_event_id,last_covered_on,contact_on) values(p_pharmacy,m.patient_id,m.id,e.id,e.last_covered_on,e.contact_on)
 on conflict(pharmacy_id,medication_id) do update set dispensing_event_id=excluded.dispensing_event_id,last_covered_on=excluded.last_covered_on,contact_on=excluded.contact_on,updated_at=now();
 update public.refill_tasks set status='canceled' where pharmacy_id=p_pharmacy and medication_id=m.id and status='pending';
 insert into public.refill_tasks(pharmacy_id,patient_id,medication_id,dispensing_event_id,scheduled_on) values(p_pharmacy,m.patient_id,m.id,e.id,e.contact_on) on conflict(pharmacy_id,dispensing_event_id) do nothing;
 end if;
 return e.id; end $$;
commit;
