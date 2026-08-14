-- ============================================================
-- Customers CRM + order link
-- ============================================================

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  loyalty_points numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.customers is
  'Shop CRM customers. Scoped by user_id (shop), not auth.users.';

create index if not exists idx_customers_user_name
  on public.customers (user_id, full_name);

create index if not exists idx_customers_user_phone
  on public.customers (user_id, phone);

alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists idx_orders_user_customer
  on public.orders (user_id, customer_id);

-- ============================================================
-- RLS
-- ============================================================

alter table public.customers enable row level security;

drop policy if exists "customers_all" on public.customers;
create policy "customers_all" on public.customers
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));
