-- Le catalogue de recettes d'Explorer (décidé avec Hugo le 26 octobre) : une recherche déjà faite n'appelle plus l'IA.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run. Puis les fichiers de supabase/catalogue/sql/ (les plats).
--
-- key : la recherche simplifiée (« Les Tartiflettes » devient « tartiflette »), suivie de « |vegetarien », « |allergie arachide »…
--       quand la recette a été faite pour un régime ou une allergie.
-- aliases : d'autres façons de chercher le même plat (« tartiflette savoyarde »).
-- kind : « dish » pour un plat (la classique, puis ses variantes, dans l'ordre) ; « list » pour un ingrédient ou une catégorie
--        (« saumon », « recettes rapides ») : une réserve de recettes, 3 tirées au sort à chaque recherche.
-- recipes : les recettes pour 4 portions, telles que l'appli les reçoit ; la photo (imageUrl) est trouvée à la première recherche.
-- source : « claude » (écrites à l'avance, sans l'API) ou « ia » (générées à la première recherche).
-- hits : combien de fois la recherche a servi.
--
-- Personne ne lit ni n'écrit la table depuis l'appli : seul le serveur (api/recipes.ts) y a accès.
-- Pour voir les recherches les plus fréquentes : select key, hits, source from public.recipe_catalog order by hits desc;
-- Pour retirer un plat raté : delete from public.recipe_catalog where key = 'tartiflette';

create table if not exists public.recipe_catalog (
  key text primary key check (char_length(key) between 2 and 200),
  query text not null check (char_length(query) <= 200),
  aliases text[] not null default '{}',
  kind text not null default 'dish' check (kind in ('dish', 'list')),
  recipes jsonb not null check (jsonb_typeof(recipes) = 'array' and pg_column_size(recipes) <= 400000),
  source text not null default 'ia' check (source in ('claude', 'ia')),
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recipe_catalog_aliases on public.recipe_catalog using gin (aliases);

alter table public.recipe_catalog enable row level security;
-- Aucune règle : ni les visiteurs ni les comptes n'y ont accès, seulement le serveur (clé service_role).

-- Une recherche de plus pour cette clé
create or replace function public.recipe_catalog_hit(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.recipe_catalog set hits = hits + 1 where key = p_key;
$$;
revoke all on function public.recipe_catalog_hit(text) from public, anon, authenticated;
grant execute on function public.recipe_catalog_hit(text) to service_role;
