-- Branch-owned rows get location_id. Child rows inherit from their parent.
--
-- ADD location_id (this file):
--   customers, categories, menu_items
--   already present: inventory_items, notifications, orders, restaurant_tables, staff_members
--
-- DO NOT add location_id (inherit / not location data):
--   order_items        <- orders.location_id
--   inventory_movements <- inventory_items.location_id
--   modifier_groups    <- menu_items.location_id
--   modifiers          <- modifier_groups -> menu_items.location_id
--   recipe_items       <- menu_items.location_id
--   salary_payments    <- staff_members.location_id
--   users, profiles    <- shop / auth, not a branch

alter table public.customers
  add column if not exists location_id uuid references public.locations(id) on delete set null;

comment on column public.customers.location_id is
  'Branch this customer belongs to. Null only until backfilled.';

alter table public.categories
  add column if not exists location_id uuid references public.locations(id) on delete set null;

comment on column public.categories.location_id is
  'Branch this category belongs to. Null only until backfilled.';

alter table public.menu_items
  add column if not exists location_id uuid references public.locations(id) on delete set null;

comment on column public.menu_items.location_id is
  'Branch this menu item belongs to. Null only until backfilled.';

update public.customers as customer
set location_id = (
  select location.id
  from public.locations as location
  where location.user_id = customer.user_id
  order by
    case when lower(trim(location.name)) = 'main' then 0 else 1 end,
    location.created_at asc
  limit 1
)
where customer.location_id is null;

update public.categories as category
set location_id = (
  select location.id
  from public.locations as location
  where location.user_id = category.user_id
  order by
    case when lower(trim(location.name)) = 'main' then 0 else 1 end,
    location.created_at asc
  limit 1
)
where category.location_id is null;

update public.menu_items as item
set location_id = (
  select location.id
  from public.locations as location
  where location.user_id = item.user_id
  order by
    case when lower(trim(location.name)) = 'main' then 0 else 1 end,
    location.created_at asc
  limit 1
)
where item.location_id is null;

create index if not exists idx_customers_user_location
  on public.customers (user_id, location_id);

create index if not exists idx_categories_user_location
  on public.categories (user_id, location_id);

create index if not exists idx_menu_items_user_location
  on public.menu_items (user_id, location_id);
