-- Ensure every shop table has created_at timestamptz default now()

alter table public.categories
  add column if not exists created_at timestamptz not null default now();

alter table public.modifier_groups
  add column if not exists created_at timestamptz not null default now();

alter table public.modifiers
  add column if not exists created_at timestamptz not null default now();

alter table public.recipe_items
  add column if not exists created_at timestamptz not null default now();

alter table public.restaurant_tables
  add column if not exists created_at timestamptz not null default now();

alter table public.order_items
  add column if not exists created_at timestamptz not null default now();

alter table public.platform_admins
  add column if not exists created_at timestamptz not null default now();

-- Tables that already had created_at keep their defaults; reinforce default where present
alter table public.users alter column created_at set default now();
alter table public.locations alter column created_at set default now();
alter table public.profiles alter column created_at set default now();
alter table public.staff_members alter column created_at set default now();
alter table public.menu_items alter column created_at set default now();
alter table public.inventory_items alter column created_at set default now();
alter table public.inventory_movements alter column created_at set default now();
alter table public.orders alter column created_at set default now();

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'customers'
  ) then
    alter table public.customers alter column created_at set default now();
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'notifications'
  ) then
    alter table public.notifications alter column created_at set default now();
  end if;
end $$;

comment on column public.categories.created_at is 'Row creation time (default now()).';
comment on column public.modifier_groups.created_at is 'Row creation time (default now()).';
comment on column public.modifiers.created_at is 'Row creation time (default now()).';
comment on column public.recipe_items.created_at is 'Row creation time (default now()).';
comment on column public.restaurant_tables.created_at is 'Row creation time (default now()).';
comment on column public.order_items.created_at is 'Row creation time (default now()).';
