-- Sabor de Mae - public order policies
-- Run this if website orders are blocked by RLS.

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

grant usage on schema public to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant insert on public.order_items to anon, authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

drop policy if exists "Public can create orders" on public.orders;
create policy "Public can create orders"
on public.orders
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public can create order items" on public.order_items;
create policy "Public can create order items"
on public.order_items
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

drop policy if exists "Authenticated admins view order items" on public.order_items;
create policy "Authenticated admins view order items"
on public.order_items
for select
to authenticated
using (true);
