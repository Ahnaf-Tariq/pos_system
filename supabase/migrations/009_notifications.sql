-- Shop activity notifications (header bell). Scoped by shop user_id.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  type text not null,
  title text not null,
  body text,
  href text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'In-app notifications for shop staff (sales, KDS, tables, staff, low stock, etc.).';
comment on column public.notifications.type is
  'sale_completed | order_served | table_freed | staff_added | low_stock | …';
comment on column public.notifications.is_read is
  'False until the user opens the notifications dropdown (mark-all-read).';
comment on column public.notifications.entity_id is
  'Optional related row id (order, table, inventory item, staff member).';

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, is_read)
  where is_read = false;

alter table public.notifications enable row level security;

create policy "notifications_all" on public.notifications
  for all
  using (public.is_approved_staff(user_id) or public.is_super_admin())
  with check (public.is_approved_staff(user_id));

-- Live badge / list updates in the dashboard header
do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;
