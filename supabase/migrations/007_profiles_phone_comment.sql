-- Phone for staff already lives on public.profiles.phone
-- (see 001_initial_schema.sql). No schema change required.
-- This file documents the mapping for invites / staff CRM.

comment on column public.profiles.phone is
  'Contact phone for the auth user. Used by staff invite/CRM UI.';
