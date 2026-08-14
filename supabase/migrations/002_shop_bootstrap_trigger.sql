-- Auto-create owner staff_members + default location when a shop signs up.
-- Needed because RLS on those tables requires is_approved_staff(), which
-- is false while status is PENDING — so the client cannot insert them.

create or replace function public.handle_new_shop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_members (user_id, auth_id, role, is_active)
  values (new.user_id, new.owner_auth_id, 'owner', true);

  insert into public.locations (user_id, name, is_active)
  values (new.user_id, 'Main', true);

  return new;
end;
$$;

drop trigger if exists trg_handle_new_shop on public.users;

create trigger trg_handle_new_shop
after insert on public.users
for each row
execute function public.handle_new_shop();
