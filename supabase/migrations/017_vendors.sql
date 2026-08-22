-- Vendors per location + optional vendor on restock movements / items.

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now()
);

comment on table public.vendors is
  'Ingredient suppliers for a shop location. Used when restocking inventory.';

create index if not exists vendors_user_location_idx
  on public.vendors (user_id, location_id, created_at desc);

alter table public.vendors enable row level security;

create policy "vendors_all" on public.vendors
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

alter table public.inventory_items
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null;

comment on column public.inventory_items.vendor_id is
  'Preferred / last vendor used when restocking this ingredient.';

create index if not exists inventory_items_vendor_idx
  on public.inventory_items (vendor_id);

alter table public.inventory_movements
  add column if not exists vendor_id uuid references public.vendors(id) on delete set null;

comment on column public.inventory_movements.vendor_id is
  'Vendor this restock (or purchase) came from. Null for sale/waste/adjustment.';

create index if not exists inventory_movements_vendor_idx
  on public.inventory_movements (vendor_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.vendors;
  exception when duplicate_object then null;
  end;
end $$;
