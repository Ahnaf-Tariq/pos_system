-- ============================================================
-- ENUMS
-- ============================================================

-- Status of a SHOP (business) account. Every shop starts PENDING
-- and cannot be used until a super-admin flips it to APPROVED.
create type account_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- Staff roles within a shop
create type staff_role as enum ('owner', 'manager', 'cashier', 'waiter', 'kitchen');

create type order_type as enum ('dine_in', 'takeaway', 'delivery');
create type order_status as enum ('open', 'sent_to_kitchen', 'ready', 'served', 'paid', 'void');

-- ============================================================
-- CORE: SHOP ACCOUNTS ("users" table = the business, NOT auth.users)
-- ============================================================

create table public.users (
  user_id uuid primary key default gen_random_uuid(),
  owner_auth_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  slug text unique not null,
  business_type text not null default 'restaurant', -- 'restaurant' | 'retail'
  status account_status not null default 'PENDING',  -- <-- THE APPROVAL GATE
  subscription_plan text not null default 'starter',
  timezone text not null default 'Asia/Karachi',
  currency text not null default 'PKR',
  created_at timestamptz not null default now()
);

comment on table public.users is
  'A shop/business account (the SaaS customer). Not to be confused with auth.users, which stores login credentials for individual people.';
comment on column public.users.status is
  'PENDING on signup. A shop cannot be used by anyone until a super-admin manually sets this to APPROVED.';

-- Locations/branches under a shop (multi-location support)
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Extra profile info for a logged-in person (name, phone)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- Which person works at which shop, and with what role
create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,   -- the shop
  auth_id uuid not null references auth.users(id) on delete cascade,          -- the person
  location_id uuid references public.locations(id) on delete set null,       -- null = access to all locations
  role staff_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, auth_id, location_id)
);

-- Platform super-admins (you, the SaaS owner). Not tied to any shop.
create table public.platform_admins (
  auth_id uuid primary key references auth.users(id) on delete cascade
);

-- ============================================================
-- MENU / PRODUCTS
-- ============================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(12,2) not null,
  image_url text,
  is_active boolean not null default true,
  track_inventory boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  is_required boolean not null default false,
  min_select int not null default 0,
  max_select int not null default 1
);

create table public.modifiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  modifier_group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0
);

-- ============================================================
-- INVENTORY (ingredient-level + recipe costing)
-- ============================================================

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  unit text not null,
  quantity_on_hand numeric(14,3) not null default 0,
  reorder_threshold numeric(14,3) not null default 0,
  cost_per_unit numeric(12,4) not null default 0,
  created_at timestamptz not null default now()
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity_required numeric(14,3) not null
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  change_qty numeric(14,3) not null,
  reason text not null, -- 'sale' | 'restock' | 'waste' | 'adjustment'
  reference_order_id uuid,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TABLES (dine-in floor plan)
-- ============================================================

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  label text not null,
  seats int not null default 4,
  status text not null default 'available' -- available | occupied | reserved | dirty
);

-- ============================================================
-- ORDERS
-- ============================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  table_id uuid references public.restaurant_tables(id) on delete set null,
  order_type order_type not null default 'dine_in',
  status order_status not null default 'open',
  opened_by uuid references auth.users(id),
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  payment_method text,
  client_generated_id uuid, -- offline-first idempotency key, see frontend section
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id),
  quantity int not null default 1,
  unit_price numeric(12,2) not null,
  selected_modifiers jsonb not null default '[]',
  notes text,
  kds_status text not null default 'pending' -- pending | preparing | ready | served
);

-- ============================================================
-- INDEXES — user_id always first
-- ============================================================

create index idx_orders_user_created on public.orders (user_id, created_at desc);
create index idx_orders_user_location_status on public.orders (user_id, location_id, status);
create index idx_order_items_user_order on public.order_items (user_id, order_id);
create index idx_inventory_user_location on public.inventory_items (user_id, location_id);
create index idx_staff_members_auth on public.staff_members (auth_id);

-- Unique index so offline upserts never duplicate orders
create unique index idx_orders_client_generated_id
  on public.orders (user_id, client_generated_id)
  where client_generated_id is not null;

-- ============================================================
-- HELPER FUNCTIONS FOR RLS
-- ============================================================

-- Is the currently logged-in person an active staff member of this shop,
-- AND is that shop's status APPROVED? (This second check is the actual
-- login-lock: even correct staff credentials are useless on a PENDING shop.)
create or replace function public.is_approved_staff(check_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.staff_members sm
    join public.users u on u.user_id = sm.user_id
    where sm.user_id = check_user_id
      and sm.auth_id = auth.uid()
      and sm.is_active = true
      and u.status = 'APPROVED'
  );
$$;

-- Is the currently logged-in person a platform super-admin?
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.platform_admins
    where auth_id = auth.uid()
  );
$$;

-- ============================================================
-- ENABLE RLS + STRICT POLICIES ON EVERY SHOP-SCOPED TABLE
-- ============================================================

-- public.users itself: a person can see the shop row they own or work at;
-- super-admins see every shop (needed for the approval dashboard).
alter table public.users enable row level security;

create policy "select_own_shop_or_admin" on public.users
  for select
  using (
    owner_auth_id = auth.uid()
    or exists (select 1 from public.staff_members where user_id = users.user_id and auth_id = auth.uid())
    or public.is_super_admin()
  );

-- Only the owner can update their own shop's basic info; only a
-- super-admin can change `status` (approve/reject). We enforce the
-- "only admin changes status" rule at the application layer (API route)
-- for clarity, but you can additionally lock it down with a trigger —
-- see note below the SQL block.
create policy "update_own_shop_or_admin" on public.users
  for update
  using (owner_auth_id = auth.uid() or public.is_super_admin())
  with check (owner_auth_id = auth.uid() or public.is_super_admin());

-- Anyone authenticated can INSERT their own shop row during signup
-- (status defaults to PENDING regardless of what they submit — the
-- column has no client-writable path around that default because we
-- never let the client set `status` in the insert payload).
create policy "insert_own_shop" on public.users
  for insert
  with check (owner_auth_id = auth.uid());

-- Reusable pattern for every remaining shop-scoped table below:
-- SELECT/INSERT/UPDATE/DELETE all gated by is_approved_staff(user_id),
-- with super-admins able to SELECT across everything for the global
-- metrics dashboard.

alter table public.locations enable row level security;
create policy "locations_all" on public.locations
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

alter table public.staff_members enable row level security;
create policy "staff_members_select" on public.staff_members
  for select
  using (public.is_approved_staff(user_id) or auth_id = auth.uid() or public.is_super_admin());
create policy "staff_members_write" on public.staff_members
  for all
  using (public.is_approved_staff(user_id))
  with check (public.is_approved_staff(user_id));

alter table public.categories enable row level security;
create policy "categories_all" on public.categories
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

alter table public.menu_items enable row level security;
create policy "menu_items_all" on public.menu_items
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

alter table public.modifier_groups enable row level security;
create policy "modifier_groups_all" on public.modifier_groups
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

alter table public.modifiers enable row level security;
create policy "modifiers_all" on public.modifiers
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

alter table public.inventory_items enable row level security;
create policy "inventory_items_all" on public.inventory_items
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

alter table public.recipe_items enable row level security;
create policy "recipe_items_all" on public.recipe_items
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

alter table public.inventory_movements enable row level security;
create policy "inventory_movements_all" on public.inventory_movements
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

alter table public.restaurant_tables enable row level security;
create policy "restaurant_tables_all" on public.restaurant_tables
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

alter table public.orders enable row level security;
create policy "orders_all" on public.orders
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

alter table public.order_items enable row level security;
create policy "order_items_all" on public.order_items
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

alter table public.profiles enable row level security;
create policy "profiles_own" on public.profiles
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

alter table public.platform_admins enable row level security;
create policy "platform_admins_self_read" on public.platform_admins
  for select
  using (auth_id = auth.uid());
-- Deliberately no insert/update/delete policy for platform_admins from
-- the client — add/remove super-admins manually from the Supabase
-- dashboard's table editor, or via the service_role key in a secure
-- server-only script. Never let the client app grant itself admin.

-- ============================================================
-- STATUS LOCK TRIGGER — owners cannot self-approve
-- ============================================================

create or replace function public.prevent_status_self_approval()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status is distinct from old.status and not public.is_super_admin() then
    raise exception 'Only a platform admin can change account status';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_status_self_approval
before update on public.users
for each row
execute function public.prevent_status_self_approval();
