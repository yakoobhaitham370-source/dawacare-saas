-- Run only in the SQL Editor of the NEW DEVELOPMENT project after inviting and
-- verifying your own Auth account. Replace the UUID, never an email or key.
begin;
select set_config('dawacare.bootstrap_user_id','REPLACE_WITH_VERIFIED_AUTH_USER_UUID',true);
do $$ declare target uuid; begin
 target=current_setting('dawacare.bootstrap_user_id')::uuid;
 if not exists(select 1 from auth.users where id=target and email_confirmed_at is not null) then raise exception 'A verified Auth user is required'; end if;
 if exists(select 1 from public.platform_admins) then raise exception 'Initial bootstrap already completed. Additional administrators require a separately reviewed operation.'; end if;
 insert into public.platform_admins(user_id) values(target);
 insert into public.administrative_audit_logs(action,record_id) values('bootstrap:platform_admin',target);
end $$;
commit;
-- The account still needs to enroll and verify TOTP. No MFA bypass is created.
