-- Sabor de Mae - public API grants
-- Run this if public orders cannot be created from the website.

grant usage on schema public to anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant insert on public.order_items to anon, authenticated;
grant select, insert, update on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
