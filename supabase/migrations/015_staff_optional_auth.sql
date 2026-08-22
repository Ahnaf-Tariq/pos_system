-- Staff can be added without a login (no email / no auth user yet).
alter table public.staff_members
  alter column auth_id drop not null;
