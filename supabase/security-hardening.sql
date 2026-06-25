-- Sabor de Mae - Security Hardening
-- Run this in Supabase SQL Editor to tighten RLS policies.
-- These changes restrict what anonymous users can insert.

-- ============================================================
-- 1. Restrict public order inserts: force status = 'novo'
--    and validate delivery_type / payment_method values.
-- ============================================================

drop policy if exists "Public can create orders" on public.orders;
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
-- 2. Restrict public order_items inserts: validate quantities
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
-- 3. Prevent anon from reading orders (only authenticated)
--    Already enforced by existing policies, just verify.
-- ============================================================

-- These policies already exist but we ensure they are correct:
-- "Authenticated admins view orders" → select for authenticated only
-- "Authenticated admins update orders" → update for authenticated only

-- ============================================================
-- 4. Prevent anon from modifying products
--    The "Public can view active products" policy already limits
--    anon to SELECT with active=true. The "Authenticated admins
--    manage products" policy is for authenticated only.
-- ============================================================

-- No changes needed — existing policies are correct.

-- ============================================================
-- 5. Prevent anon from deleting orders or order_items
--    No DELETE policy exists for anon, so this is already blocked.
-- ============================================================

-- ============================================================
-- NOTES:
-- - Self-signup MUST be disabled in Supabase Dashboard:
--   Authentication → Settings → Enable sign ups = OFF
-- - The anon key is public and expected in the frontend.
-- - The service_role key must NEVER be in frontend code.
-- ============================================================
