-- Public bucket for menu item images.
-- Objects are stored under {shop_user_id}/{filename}.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can view public menu images
drop policy if exists "menu_images_public_read" on storage.objects;
create policy "menu_images_public_read"
on storage.objects for select
using (bucket_id = 'menu-images');

-- Approved staff can upload/update/delete images for their shop folder
drop policy if exists "menu_images_staff_insert" on storage.objects;
create policy "menu_images_staff_insert"
on storage.objects for insert
with check (
  bucket_id = 'menu-images'
  and public.is_approved_staff((storage.foldername(name))[1]::uuid)
);

drop policy if exists "menu_images_staff_update" on storage.objects;
create policy "menu_images_staff_update"
on storage.objects for update
using (
  bucket_id = 'menu-images'
  and public.is_approved_staff((storage.foldername(name))[1]::uuid)
);

drop policy if exists "menu_images_staff_delete" on storage.objects;
create policy "menu_images_staff_delete"
on storage.objects for delete
using (
  bucket_id = 'menu-images'
  and public.is_approved_staff((storage.foldername(name))[1]::uuid)
);
