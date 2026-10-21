-- Bilan du mois (étape 11).
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- 1. saved_items : ce qui a été sauvé dans chaque repas (nom, kg, eur), pour « Ce qui a le plus servi ».
--    Sans elle : le bilan marche, sans cette liste.
-- 2. community_saved() : le compteur de la communauté (kilos sauvés par tous les foyers, nombre de foyers).
--    Seulement deux totaux sortent : ni repas, ni compte. Sans elle : le compteur ne s'affiche pas.

alter table public.cooked_meals
  add column if not exists saved_items jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cooked_meals_saved_items_check') then
    alter table public.cooked_meals add constraint cooked_meals_saved_items_check
      check (jsonb_typeof(saved_items) = 'array' and jsonb_array_length(saved_items) <= 40 and pg_column_size(saved_items) <= 8000);
  end if;
end $$;

create or replace function public.community_saved()
returns table (kg numeric, households bigint)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(m.kg), 0)::numeric(12, 1), count(distinct m.user_id) filter (where m.kg > 0)
  from public.cooked_meals m;
$$;

revoke all on function public.community_saved() from public;
grant execute on function public.community_saved() to anon, authenticated;
