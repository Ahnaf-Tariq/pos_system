-- Shop toggle: send POS orders to the kitchen display.

alter table public.users
  add column if not exists kds_enabled boolean not null default true;

comment on column public.users.kds_enabled is
  'When true, POS orders appear on KDS. When false, KDS is hidden and orders skip the kitchen board.';
