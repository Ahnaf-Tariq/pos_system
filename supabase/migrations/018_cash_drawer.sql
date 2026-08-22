-- Cash drawer: daily sessions + movements + link cash POS orders.
-- Safe to re-run after the original cash_sessions / cash_movements CREATE TABLE.

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  opened_by uuid not null,
  closed_by uuid,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_balance numeric(12,2) not null default 0,
  closing_balance_expected numeric(12,2),
  closing_balance_actual numeric(12,2),
  variance numeric(12,2),
  notes text,
  status text not null default 'open' check (status in ('open', 'closed'))
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cash_sessions(id) on delete cascade,
  user_id uuid not null references public.users(user_id) on delete cascade,
  type text not null check (type in ('cash_in', 'cash_out')),
  amount numeric(12,2) not null,
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.cash_sessions is
  'One cash drawer session per location. user_id is the shop. opened_by/closed_by are auth.users ids.';

comment on table public.cash_movements is
  'Manual cash in/out for a session. user_id is the shop (same RLS pattern as vendors).';

comment on column public.cash_sessions.user_id is
  'Shop id (public.users.user_id).';

comment on column public.cash_movements.user_id is
  'Shop id (public.users.user_id), not the staff member.';

-- Staff who open/close must be auth users (cashiers), not public.users (shops).
do $$
declare
  rec record;
begin
  for rec in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.cash_sessions'::regclass
      and c.contype = 'f'
      and a.attname in ('opened_by', 'closed_by')
  loop
    execute format('alter table public.cash_sessions drop constraint %I', rec.conname);
  end loop;
end $$;

do $$
begin
  alter table public.cash_sessions
    add constraint cash_sessions_opened_by_auth_fkey
    foreign key (opened_by) references auth.users(id);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.cash_sessions
    add constraint cash_sessions_closed_by_auth_fkey
    foreign key (closed_by) references auth.users(id);
exception when duplicate_object then null;
end $$;

create unique index if not exists cash_sessions_one_open_per_location_idx
  on public.cash_sessions (location_id)
  where status = 'open';

create index if not exists cash_sessions_user_location_opened_idx
  on public.cash_sessions (user_id, location_id, opened_at desc);

create index if not exists cash_movements_session_created_idx
  on public.cash_movements (session_id, created_at desc);

create index if not exists cash_movements_user_idx
  on public.cash_movements (user_id, created_at desc);

alter table public.orders
  add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete set null;

comment on column public.orders.cash_session_id is
  'Set automatically when a cash order is paid while a drawer is open at that location. Null if no open session, or for card payments.';

create index if not exists orders_cash_session_idx
  on public.orders (cash_session_id)
  where cash_session_id is not null;

alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;

drop policy if exists "cash_sessions_all" on public.cash_sessions;
create policy "cash_sessions_all" on public.cash_sessions
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

drop policy if exists "cash_movements_all" on public.cash_movements;
create policy "cash_movements_all" on public.cash_movements
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

do $$
begin
  begin
    alter publication supabase_realtime add table public.cash_sessions;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.cash_movements;
  exception when duplicate_object then null;
  end;
end $$;
