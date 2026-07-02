-- Sabor de Mae - Categorias, Tags e Addons
-- Run this in Supabase SQL Editor to apply the new features.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Inserir as categorias padrões caso ainda não existam
insert into public.categories (name, slug, sort_order)
values
  ('Marmitex', 'marmitex', 10),
  ('Espetinhos', 'espetinhos', 20),
  ('Porções', 'porcoes', 30),
  ('Consumo local', 'local', 40),
  ('Bebidas', 'bebidas', 50),
  ('Sobremesas', 'sobremesas', 60)
on conflict (slug) do nothing;

-- Segurança
alter table public.categories enable row level security;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

drop policy if exists "Public can view categories" on public.categories;
create policy "Public can view categories"
on public.categories for select to anon, authenticated using (true);

drop policy if exists "Authenticated admins manage categories" on public.categories;
create policy "Authenticated admins manage categories"
on public.categories for all to authenticated using (true) with check (true);

-- Atualizar a tabela de produtos com os novos recursos
alter table public.products
add column if not exists tags jsonb default '[]'::jsonb,
add column if not exists addons jsonb default '[]'::jsonb;
