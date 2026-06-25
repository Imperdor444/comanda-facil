-- Sabor de Mae - Supabase schema
-- Run this in Supabase SQL Editor after creating the project.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default 'marmitex',
  price numeric(10, 2) not null check (price >= 0),
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  delivery_type text not null check (delivery_type in ('Entrega', 'Retirada')),
  customer_address text,
  payment_method text not null check (payment_method in ('Pix', 'Dinheiro', 'Cartao')),
  change_for text,
  note text,
  total numeric(10, 2) not null check (total >= 0),
  status text not null default 'novo' check (status in ('novo', 'aceito', 'preparando', 'finalizado', 'cancelado')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_name text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  subtotal numeric(10, 2) not null check (subtotal >= 0)
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant insert on public.order_items to anon, authenticated;
grant select, insert, update on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
on public.products
for select
to anon, authenticated
using (active = true);

drop policy if exists "Authenticated admins manage products" on public.products;
create policy "Authenticated admins manage products"
on public.products
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can create orders" on public.orders;
create policy "Public can create orders"
on public.orders
for insert
to anon, authenticated
with check (true);

drop policy if exists "Authenticated admins view orders" on public.orders;
create policy "Authenticated admins view orders"
on public.orders
for select
to authenticated
using (true);

drop policy if exists "Authenticated admins update orders" on public.orders;
create policy "Authenticated admins update orders"
on public.orders
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Public can create order items" on public.order_items;
create policy "Public can create order items"
on public.order_items
for insert
to anon, authenticated
with check (true);

drop policy if exists "Authenticated admins view order items" on public.order_items;
create policy "Authenticated admins view order items"
on public.order_items
for select
to authenticated
using (true);

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

insert into public.products (name, description, category, price, image_url, sort_order)
values
  ('Marmitex pequena', 'Arroz, feijao, mistura do dia, salada e acompanhamento.', 'marmitex', 16.00, 'assets/marmitex-menu.png', 10),
  ('Marmitex grande', 'Porcao reforcada para quem quer uma refeicao completa.', 'marmitex', 22.00, 'assets/marmitex-menu.png', 20),
  ('Prato feito', 'Refeicao servida no restaurante, ideal para comer no local.', 'local', 18.00, 'assets/prato-feito-menu.png', 30),
  ('Refrigerante lata', 'Bebida gelada para acompanhar sua refeicao.', 'bebidas', 6.00, 'assets/refrigerante-menu.png', 40)
on conflict do nothing;
