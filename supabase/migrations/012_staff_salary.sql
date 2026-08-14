-- Staff salary + payment records + shop pay cadence

alter table public.staff_members
  add column if not exists salary numeric(12,2) not null default 0;

comment on column public.staff_members.salary is
  'Base salary amount for this staff member (monthly or daily per shop setting).';

alter table public.users
  add column if not exists salary_pay_basis text not null default 'monthly';

comment on column public.users.salary_pay_basis is
  'How staff salaries are paid: monthly | daily. Default monthly.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_salary_pay_basis_check'
  ) then
    alter table public.users
      add constraint users_salary_pay_basis_check
      check (salary_pay_basis in ('monthly', 'daily'));
  end if;
end $$;

create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  staff_member_id uuid not null references public.staff_members(id) on delete cascade,
  amount numeric(12,2) not null,
  pay_basis text not null check (pay_basis in ('monthly', 'daily')),
  period_key text not null,
  paid_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, staff_member_id, period_key)
);

comment on table public.salary_payments is
  'One salary payout per staff member per period (month YYYY-MM or day YYYY-MM-DD).';
comment on column public.salary_payments.period_key is
  'monthly → YYYY-MM; daily → YYYY-MM-DD. Unique with staff so they cannot be paid twice for the same period.';

create index if not exists salary_payments_user_period_idx
  on public.salary_payments (user_id, period_key desc);

create index if not exists salary_payments_staff_idx
  on public.salary_payments (staff_member_id, period_key desc);

alter table public.salary_payments enable row level security;

create policy "salary_payments_all" on public.salary_payments
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

do $$
begin
  begin
    alter publication supabase_realtime add table public.salary_payments;
  exception when duplicate_object then null;
  end;
end $$;
