-- Staff list display fields live on staff_members so the UI does not depend on
-- joining profiles (profiles_own RLS hid coworker names; selecting a missing
-- profiles.email column also broke the whole query → "Unnamed staff").

alter table public.staff_members
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists email text;

comment on column public.staff_members.full_name is
  'Display name for this shop membership (copied from invite / profile).';
comment on column public.staff_members.phone is
  'Display phone for this shop membership.';
comment on column public.staff_members.email is
  'Display email for this shop membership.';

-- Optional on profiles for session / reports; not required for staff table UI
alter table public.profiles
  add column if not exists email text;

comment on column public.profiles.email is
  'Login email denormalized for convenience (auth.users remains auth source of truth).';

-- Allow reading coworker profiles (orders/reports still join profiles)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_shop_peers_select'
  ) then
    create policy "profiles_shop_peers_select" on public.profiles
      for select
      using (
        public.is_super_admin()
        or exists (
          select 1
          from public.staff_members as me
          join public.staff_members as peer
            on peer.user_id = me.user_id
          where me.auth_id = auth.uid()
            and me.is_active = true
            and peer.auth_id = profiles.id
        )
      );
  end if;
end $$;

-- Backfill staff_members from profiles + auth.users
update public.staff_members as sm
set
  full_name = coalesce(
    nullif(trim(sm.full_name), ''),
    nullif(trim(p.full_name), ''),
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')
  ),
  phone = coalesce(
    nullif(trim(sm.phone), ''),
    nullif(trim(p.phone), ''),
    nullif(trim(u.raw_user_meta_data ->> 'phone'), '')
  ),
  email = coalesce(
    nullif(trim(sm.email), ''),
    nullif(trim(p.email), ''),
    u.email
  )
from auth.users as u
left join public.profiles as p on p.id = u.id
where sm.auth_id = u.id;

-- Keep profiles.email in sync when empty
update public.profiles as p
set email = coalesce(nullif(trim(p.email), ''), u.email)
from auth.users as u
where p.id = u.id;

-- New shops: copy owner identity onto staff_members
create or replace function public.handle_new_shop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_full_name text;
  owner_phone text;
  owner_email text;
begin
  select
    coalesce(p.full_name, nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')),
    coalesce(p.phone, nullif(trim(u.raw_user_meta_data ->> 'phone'), '')),
    coalesce(p.email, u.email)
  into owner_full_name, owner_phone, owner_email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = new.owner_auth_id;

  insert into public.staff_members (
    user_id, auth_id, role, is_active, full_name, phone, email
  )
  values (
    new.user_id,
    new.owner_auth_id,
    'owner',
    true,
    owner_full_name,
    owner_phone,
    owner_email
  );

  insert into public.locations (user_id, name, is_active)
  values (new.user_id, 'Main', true);

  return new;
end;
$$;
