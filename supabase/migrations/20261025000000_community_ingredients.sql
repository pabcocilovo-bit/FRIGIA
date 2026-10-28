-- Les ingrédients de la communauté : ce que les gens tapent à la main dans « Ajouter » et qui n'est pas dans la liste.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run. Sans elle, chacun garde ses ajouts pour lui.
-- 1. ingredient_typed : un mot tapé, une fois par compte (key : le nom sans accent ni pluriel, name : tel que tapé).
--    Chacun écrit seulement ses lignes, et personne ne les lit depuis l'appli.
-- 2. ingredient_blocked : les mots à ne jamais proposer (une faute, une blague). À remplir à la main dans Table Editor.
-- 3. community_ingredients() : les mots tapés par au moins 3 comptes différents, pas bloqués. Seuls les noms sortent.
-- Pour voir ce qui monte : select * from public.ingredient_typed_top;

create table if not exists public.ingredient_typed (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 2 and 40),
  name text not null check (char_length(name) between 2 and 40),
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.ingredient_typed enable row level security;
drop policy if exists "ingredient_typed_insert_own" on public.ingredient_typed;
create policy "ingredient_typed_insert_own" on public.ingredient_typed
  for insert to authenticated with check (user_id = auth.uid());

create table if not exists public.ingredient_blocked (
  key text primary key,
  created_at timestamptz not null default now()
);
alter table public.ingredient_blocked enable row level security;

create or replace function public.community_ingredients()
returns table (name text)
language sql
stable
security definer
set search_path = public
as $$
  select mode() within group (order by t.name)
  from public.ingredient_typed t
  where not exists (select 1 from public.ingredient_blocked b where b.key = t.key)
  group by t.key
  having count(*) >= 3
  order by count(*) desc
  limit 300;
$$;

revoke all on function public.community_ingredients() from public;
grant execute on function public.community_ingredients() to authenticated;

create or replace view public.ingredient_typed_top with (security_invoker = true) as
  select key, mode() within group (order by name) as name, count(*) as comptes, max(created_at) as dernier
  from public.ingredient_typed
  group by key
  order by count(*) desc;
revoke all on public.ingredient_typed_top from anon, authenticated;
