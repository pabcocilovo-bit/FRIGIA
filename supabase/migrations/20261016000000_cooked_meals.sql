-- Repas cuisinés (étape 9) : « J'ai cuisiné ça » garde le plat, les kilos et les euros sauvés. C'est la base du bilan (étape 11).
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Sans elle : les repas cuisinés restent sur le téléphone seulement.

create table if not exists public.cooked_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Le scan d'où vient la recette (null pour un favori ou une recette ouverte hors scan).
  -- Pas de lien vers user_history : effacer un scan ne retire pas le repas du bilan.
  scan_id text,
  recipe_title text not null check (char_length(recipe_title) between 1 and 200),
  recipe_image text,
  servings smallint not null default 1 check (servings between 1 and 20),
  kg numeric(6, 2) not null default 0 check (kg >= 0),
  eur numeric(7, 2) not null default 0 check (eur >= 0),
  cooked_at timestamptz not null default now()
);

create index if not exists cooked_meals_user_date on public.cooked_meals (user_id, cooked_at desc);

-- Chacun voit, ajoute et retire seulement ses propres repas
alter table public.cooked_meals enable row level security;

drop policy if exists "repas : lecture" on public.cooked_meals;
create policy "repas : lecture" on public.cooked_meals
  for select using (auth.uid() = user_id);

drop policy if exists "repas : ajout" on public.cooked_meals;
create policy "repas : ajout" on public.cooked_meals
  for insert with check (auth.uid() = user_id);

drop policy if exists "repas : retrait" on public.cooked_meals;
create policy "repas : retrait" on public.cooked_meals
  for delete using (auth.uid() = user_id);
