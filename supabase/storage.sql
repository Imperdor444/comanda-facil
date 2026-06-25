-- Sabor de Mae - product image storage
-- Run this in Supabase SQL Editor if the project already exists.

insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do update
set public = true;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'produtos');

drop policy if exists "Authenticated admins upload product images" on storage.objects;
create policy "Authenticated admins upload product images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'produtos');

drop policy if exists "Authenticated admins update product images" on storage.objects;
create policy "Authenticated admins update product images"
on storage.objects
for update
to authenticated
using (bucket_id = 'produtos')
with check (bucket_id = 'produtos');

drop policy if exists "Authenticated admins delete product images" on storage.objects;
create policy "Authenticated admins delete product images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'produtos');
