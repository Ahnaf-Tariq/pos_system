-- Shop expenses per location. Optional cash-drawer link when paid from till.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  recorded_by uuid not null references auth.users(id),
  vendor_id uuid references public.vendors(id) on delete set null,
  title text not null,
  amount numeric(12,2) not null check (amount > 0),
  category text not null check (
    category in (
      'rent',
      'utilities',
      'supplies',
      'payroll',
      'marketing',
      'maintenance',
      'food_cost',
      'transport',
      'other'
    )
  ),
  payment_method text not null check (
    payment_method in ('cash', 'card', 'bank_transfer')
  ),
  expense_date date not null default (timezone('utc', now())::date),
  notes text,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  cash_movement_id uuid references public.cash_movements(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.expenses is
  'Operating expenses for a shop location. Cash expenses may link to an open cash drawer session.';

comment on column public.expenses.user_id is
  'Shop id (public.users.user_id).';

comment on column public.expenses.recorded_by is
  'Auth user who recorded the expense.';

create index if not exists expenses_user_location_date_idx
  on public.expenses (user_id, location_id, expense_date desc);

create index if not exists expenses_category_idx
  on public.expenses (user_id, category);

create index if not exists expenses_vendor_idx
  on public.expenses (vendor_id)
  where vendor_id is not null;

alter table public.expenses enable row level security;

drop policy if exists "expenses_all" on public.expenses;
create policy "expenses_all" on public.expenses
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

do $$
begin
  begin
    alter publication supabase_realtime add table public.expenses;
  exception when duplicate_object then null;
  end;
end $$;
