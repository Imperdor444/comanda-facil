-- Sabor de Mae - Security Hardening
-- Run this in Supabase SQL Editor to tighten RLS policies.
-- IMPORTANT: This drops old permissive policies that bypass validation.

-- ============================================================
-- 1. Drop ALL old insert policies on orders (including permissive ones)
-- ============================================================

drop policy if exists "Public anonymous insert orders" on public.orders;
drop policy if exists "Public anonymous view own orders" on public.orders;
drop policy if exists "Public can create orders" on public.orders;

-- ============================================================
-- 2. Create strict insert policy: force status = 'novo'
--    and validate delivery_type / payment_method values.
-- ============================================================

create policy "Public can create orders"
on public.orders
for insert
to anon, authenticated
with check (
  status = 'novo'
  AND total >= 0
  AND delivery_type IN ('Entrega', 'Retirada')
  AND payment_method IN ('Pix', 'Dinheiro', 'Cartao')
  AND char_length(customer_name) <= 100
  AND char_length(coalesce(customer_address, '')) <= 300
  AND char_length(coalesce(note, '')) <= 500
);

-- ============================================================
-- 3. Restrict public order_items inserts: validate quantities
-- ============================================================

drop policy if exists "Public can create order items" on public.order_items;
create policy "Public can create order items"
on public.order_items
for insert
to anon, authenticated
with check (
  quantity > 0
  AND unit_price >= 0
  AND subtotal >= 0
);

-- ============================================================
-- NOTES:
-- - Self-signup MUST be disabled in Supabase Dashboard:
--   Authentication → Settings → Enable sign ups = OFF
-- - The anon key is public and expected in the frontend.
-- - The service_role key must NEVER be in frontend code.
-- - PostgreSQL RLS policies are ORed together, so old permissive
--   policies MUST be dropped before creating new restrictive ones.
-- ============================================================
