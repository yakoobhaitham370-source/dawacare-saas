begin;
alter table public.pharmacy_invitations drop constraint pharmacy_invitations_status_check;
alter table public.pharmacy_invitations add constraint pharmacy_invitations_status_check check(status in ('pending','delivering','sent','accepted','revoked','failed','expired'));
alter table public.pharmacy_invitations add column delivery_lease uuid;
alter table public.pharmacy_invitations add column delivery_lease_until timestamptz;
alter table public.pharmacy_invitations add column last_delivery_at timestamptz;
alter table public.pharmacy_invitations add column delivery_attempts integer not null default 0 check(delivery_attempts>=0);
drop index public.invitation_pending_email;
create unique index invitation_pending_email on public.pharmacy_invitations(pharmacy_id,lower(email)) where status in ('pending','delivering','sent','failed');
create index invitation_recipient_lookup on public.pharmacy_invitations(lower(email),expires_at);

create function public.can_manage_invitation(p_pharmacy uuid,p_role text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_platform_admin() or (p_role in ('pharmacist','technician') and public.member_role(p_pharmacy)='owner' and public.can_write(p_pharmacy)) $$;
revoke all on function public.can_manage_invitation(uuid,text) from public,anon;
grant execute on function public.can_manage_invitation(uuid,text) to authenticated;
create or replace function public.prepare_invitation(p_pharmacy uuid,p_email text,p_role text) returns uuid language plpgsql security definer set search_path='' as $$ declare seats integer; invitation uuid; begin
 if p_role is null or p_role not in ('owner','pharmacist','technician') or not coalesce(public.can_manage_invitation(p_pharmacy,p_role),false) then raise exception 'Forbidden'; end if;
 if p_email is null or length(p_email)>254 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid invitation'; end if;
 perform 1 from public.pharmacies where id=p_pharmacy for update;
 if not found then raise exception 'Pharmacy unavailable'; end if;
 if exists(select 1 from public.pharmacy_memberships m join auth.users u on u.id=m.user_id where m.pharmacy_id=p_pharmacy and lower(u.email)=lower(trim(p_email))) then raise exception 'Membership already exists; manage the existing staff account'; end if;
 update public.pharmacy_invitations set status='expired',delivery_lease=null,delivery_lease_until=null where pharmacy_id=p_pharmacy and status in ('pending','delivering','sent','failed') and expires_at<=now();
 select staff_limit into seats from public.subscriptions where pharmacy_id=p_pharmacy;
 if seats is null or (select count(*) from public.pharmacy_memberships where pharmacy_id=p_pharmacy and active)+(select count(*) from public.pharmacy_invitations where pharmacy_id=p_pharmacy and status in ('pending','delivering','sent','failed') and expires_at>now())>=seats then raise exception 'Staff seat limit reached'; end if;
 insert into public.pharmacy_invitations(pharmacy_id,email,role,invited_by) values(p_pharmacy,lower(trim(p_email)),p_role,auth.uid()) returning id into invitation;
 return invitation; end $$;

-- Claim is authorized with the caller's JWT, never with an unscoped service key.
create function public.claim_invitation_delivery(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare inv public.pharmacy_invitations; tenant uuid; lease uuid; begin
 select pharmacy_id into tenant from public.pharmacy_invitations where id=p_id;
 perform 1 from public.pharmacies where id=tenant for update;
 select * into inv from public.pharmacy_invitations where id=p_id for update;
 if not found or not coalesce(public.can_manage_invitation(inv.pharmacy_id,inv.role),false) then raise exception 'Invitation unavailable'; end if;
 if inv.expires_at<=now() or inv.status in ('accepted','revoked','expired') then raise exception 'Invitation expired or closed'; end if;
 if inv.status='delivering' and inv.delivery_lease_until>now() then raise exception 'Delivery already in progress'; end if;
 if inv.last_delivery_at>now()-interval '60 seconds' then raise exception 'Wait before retrying delivery'; end if;
 if inv.delivery_attempts>=10 then raise exception 'Delivery retry limit reached; revoke and create a new invitation'; end if;
 lease=gen_random_uuid();
 update public.pharmacy_invitations set invited_by=auth.uid(),status='delivering',delivery_lease=lease,delivery_lease_until=now()+interval '2 minutes',last_delivery_at=now(),delivery_attempts=delivery_attempts+1 where id=p_id;
 return jsonb_build_object('id',inv.id,'email',inv.email,'pharmacy_id',inv.pharmacy_id,'lease',lease);
 end $$;
create function public.invitation_recipient(p_id uuid,p_lease uuid) returns uuid language sql security definer set search_path='' as $$
 select u.id from public.pharmacy_invitations i join auth.users u on lower(u.email)=lower(i.email) where i.id=p_id and i.delivery_lease=p_lease and i.status='delivering' and i.delivery_lease_until>now() limit 1 $$;
create function public.finish_invitation_delivery(p_id uuid,p_lease uuid,p_user uuid,p_success boolean) returns boolean language plpgsql security definer set search_path='' as $$ begin
 if p_success and not exists(select 1 from public.pharmacy_invitations i join auth.users u on lower(u.email)=lower(i.email) where i.id=p_id and u.id=p_user) then raise exception 'Invalid recipient'; end if;
 update public.pharmacy_invitations set status=case when p_success then 'sent' else 'failed' end,provider_user_id=case when p_success then p_user else provider_user_id end,delivery_lease=null,delivery_lease_until=null where id=p_id and delivery_lease=p_lease and status='delivering';
 return found; end $$;
create function public.manage_invitation(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$ declare inv public.pharmacy_invitations; tenant uuid; seats integer; begin
 select pharmacy_id into tenant from public.pharmacy_invitations where id=p_id;
 perform 1 from public.pharmacies where id=tenant for update;
 select * into inv from public.pharmacy_invitations where id=p_id for update;
 if not found or not coalesce(public.can_manage_invitation(inv.pharmacy_id,inv.role),false) or inv.status='accepted' then raise exception 'Invitation unavailable'; end if;
 if p_action='revoke' then update public.pharmacy_invitations set status='revoked',delivery_lease=null,delivery_lease_until=null where id=p_id;
 elsif p_action='renew' then
  if inv.expires_at>now() and inv.status not in ('expired','revoked') then raise exception 'Invitation is not expired or revoked'; end if;
  if exists(select 1 from public.pharmacy_memberships m join auth.users u on u.id=m.user_id where m.pharmacy_id=tenant and lower(u.email)=lower(inv.email)) then raise exception 'Membership already exists'; end if;
  select staff_limit into seats from public.subscriptions where pharmacy_id=tenant;
  if seats is null or (select count(*) from public.pharmacy_memberships where pharmacy_id=tenant and active)+(select count(*) from public.pharmacy_invitations where pharmacy_id=tenant and id<>p_id and status in ('pending','delivering','sent','failed') and expires_at>now())>=seats then raise exception 'Staff seat limit reached'; end if;
  update public.pharmacy_invitations set status='pending',expires_at=now()+interval '48 hours',delivery_lease=null,delivery_lease_until=null,delivery_attempts=0,last_delivery_at=null,invited_by=auth.uid() where id=p_id;
 else raise exception 'Invalid invitation action'; end if;
 end $$;

create function public.my_pending_invitations() returns table(id uuid,pharmacy_name text,role text,status text,expires_at timestamptz) language sql stable security definer set search_path='' as $$
 select i.id,p.name,i.role,i.status,i.expires_at from public.pharmacy_invitations i join public.pharmacies p on p.id=i.pharmacy_id join auth.users u on lower(u.email)=lower(i.email) and u.id=auth.uid() and u.email_confirmed_at is not null where i.status in ('pending','delivering','sent','failed') and i.expires_at>now() order by i.created_at $$;
create function public.accept_pharmacy_invitation(p_id uuid) returns integer language plpgsql security definer set search_path='' as $$ declare inv public.pharmacy_invitations; tenant uuid; verified_email text; seats integer; begin
 select lower(email) into verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if verified_email is null then raise exception 'Verified account required'; end if;
 select pharmacy_id into tenant from public.pharmacy_invitations where id=p_id;
 perform 1 from public.pharmacies where id=tenant for update;
 select * into inv from public.pharmacy_invitations where id=p_id for update;
 if not found or lower(inv.email)<>verified_email then raise exception 'Invitation unavailable'; end if;
 if inv.status='accepted' and inv.provider_user_id=auth.uid() then return 0; end if;
 if inv.status not in ('pending','delivering','sent','failed') or inv.expires_at<=now() then raise exception 'Invitation expired or closed'; end if;
 if inv.provider_user_id is not null and inv.provider_user_id<>auth.uid() then raise exception 'Invitation identity mismatch'; end if;
 if not exists(select 1 from public.platform_admins where user_id=inv.invited_by) and not exists(select 1 from public.pharmacy_memberships where pharmacy_id=tenant and user_id=inv.invited_by and active and role='owner') then raise exception 'Inviter access revoked'; end if;
 if not exists(select 1 from public.subscriptions where pharmacy_id=tenant and status in ('trial','active','grace_period') and (now() at time zone 'Asia/Baghdad')::date between starts_on and ends_on+case when status='grace_period' then 7 else 0 end) then raise exception 'Subscription does not permit activation'; end if;
 select staff_limit into seats from public.subscriptions where pharmacy_id=tenant;
 if (select count(*) from public.pharmacy_memberships where pharmacy_id=tenant and active)>=seats then raise exception 'Staff seat limit reached'; end if;
 if exists(select 1 from public.pharmacy_memberships where pharmacy_id=tenant and user_id=auth.uid()) then raise exception 'Membership already exists; contact your owner'; end if;
 insert into public.pharmacy_memberships(pharmacy_id,user_id,role) values(tenant,auth.uid(),inv.role);
 update public.pharmacy_invitations set status='accepted',provider_user_id=auth.uid(),delivery_lease=null,delivery_lease_until=null where id=p_id;
 return 1; end $$;
-- Preserve the old RPC without silently joining several pharmacies at once.
create or replace function public.accept_pending_invitation() returns integer language plpgsql security definer set search_path='' as $$ declare pending uuid; total integer; begin
 select count(*),min(id::text)::uuid into total,pending from public.my_pending_invitations();
 if total=0 then return 0; end if;
 if total<>1 then raise exception 'Choose the pharmacy invitation explicitly'; end if;
 return public.accept_pharmacy_invitation(pending); end $$;

-- Staff reactivation must count delivery reservations too.
create or replace function public.manage_staff(p_pharmacy uuid,p_user uuid,p_role text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$ declare target public.pharmacy_memberships; seats integer; begin
 if public.member_role(p_pharmacy) is distinct from 'owner' or not public.can_write(p_pharmacy) or p_user is null or p_user=auth.uid() or p_role is null or p_role not in ('pharmacist','technician') or p_active is null then raise exception 'Forbidden'; end if;
 perform 1 from public.pharmacies where id=p_pharmacy for update;
 select * into target from public.pharmacy_memberships where pharmacy_id=p_pharmacy and user_id=p_user for update;
 if not found or target.role='owner' then raise exception 'Membership unavailable'; end if;
 if p_active and not target.active then
 select staff_limit into seats from public.subscriptions where pharmacy_id=p_pharmacy;
 if (select count(*) from public.pharmacy_memberships where pharmacy_id=p_pharmacy and active)+(select count(*) from public.pharmacy_invitations where pharmacy_id=p_pharmacy and status in ('pending','delivering','sent','failed') and expires_at>now())>=seats then raise exception 'Seat limit reached'; end if;
 end if;
 update public.pharmacy_memberships set role=p_role,active=p_active where id=target.id;end $$;
revoke all on function public.claim_invitation_delivery(uuid), public.invitation_recipient(uuid,uuid), public.finish_invitation_delivery(uuid,uuid,uuid,boolean), public.manage_invitation(uuid,text), public.my_pending_invitations(), public.accept_pharmacy_invitation(uuid) from public,anon,authenticated;
grant execute on function public.claim_invitation_delivery(uuid), public.manage_invitation(uuid,text), public.my_pending_invitations(), public.accept_pharmacy_invitation(uuid) to authenticated;
grant execute on function public.invitation_recipient(uuid,uuid), public.finish_invitation_delivery(uuid,uuid,uuid,boolean) to service_role;
commit;
