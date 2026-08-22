-- Daily staff attendance register (independent of salary_payments).
create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  work_date date not null,
  status text not null check (status in ('present', 'absent', 'leave', 'half_day')),
  marked_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, staff_member_id, work_date)
);

comment on table public.staff_attendance is
  'One attendance mark per staff member per calendar day. Not used to auto-calculate salary.';

create index if not exists staff_attendance_user_date_idx
  on public.staff_attendance (user_id, work_date desc);

create index if not exists staff_attendance_staff_date_idx
  on public.staff_attendance (staff_member_id, work_date desc);

alter table public.staff_attendance enable row level security;

create policy "staff_attendance_all" on public.staff_attendance
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

do $$
begin
  begin
    alter publication supabase_realtime add table public.staff_attendance;
  exception when duplicate_object then null;
  end;
end $$;
