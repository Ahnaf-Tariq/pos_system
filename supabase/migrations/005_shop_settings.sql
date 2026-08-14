-- Shop settings extensions for tax, receipts, and printers

alter table public.users
  add column if not exists tax_rate numeric(6,3) not null default 0,
  add column if not exists receipt_footer text,
  add column if not exists receipt_logo_url text;

comment on column public.users.tax_rate is
  'Sales tax percentage applied at checkout (e.g. 5.000 = 5%).';
comment on column public.users.receipt_footer is
  'Footer text printed on receipts.';
comment on column public.users.receipt_logo_url is
  'Public URL for receipt logo image.';

alter table public.locations
  add column if not exists printer_name text,
  add column if not exists printer_connection text not null default 'browser',
  add column if not exists printer_address text;

comment on column public.locations.printer_connection is
  'browser | network | usb';
