begin;
create function public.manage_staff(p_pharmacy uuid,p_user uuid,p_role text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$ declare target public.pharmacy_memberships; seats integer; begin
 if public.member_role(p_pharmacy) is distinct from 'owner' or not public.can_write(p_pharmacy) or p_user=auth.uid() or p_role not in ('pharmacist','technician') then raise exception 'Forbidden'; end if;
 perform 1 from public.pharmacies where id=p_pharmacy for update;
 select * into target from public.pharmacy_memberships where pharmacy_id=p_pharmacy and user_id=p_user for update;
 if not found or target.role='owner' then raise exception 'Membership unavailable'; end if;
 if p_active and not target.active then
 select staff_limit into seats from public.subscriptions where pharmacy_id=p_pharmacy;
 if (select count(*) from public.pharmacy_memberships where pharmacy_id=p_pharmacy and active)+(select count(*) from public.pharmacy_invitations where pharmacy_id=p_pharmacy and status in ('pending','sent','failed') and expires_at>now())>=seats then raise exception 'Seat limit reached'; end if;
 end if;
 update public.pharmacy_memberships set role=p_role,active=p_active where id=target.id;
 end $$;
revoke all on function public.manage_staff(uuid,uuid,text,boolean) from public;
grant execute on function public.manage_staff(uuid,uuid,text,boolean) to authenticated;
commit;
