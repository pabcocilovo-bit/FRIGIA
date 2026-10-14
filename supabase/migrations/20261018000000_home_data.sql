-- Famille, semaine et courses (étape 10) : une ligne par compte, trois colonnes enregistrées chacune de son côté.
--   members  : le foyer (prénom, adulte ou enfant, âge, allergies, ce qu'il n'aime pas)
--   week     : les repas prévus, jour par jour, midi et soir
--   shopping : la liste de courses, rangée par rayon
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Sans elle : le foyer, la semaine et la liste restent sur le téléphone, et partent sur le compte au prochain chargement qui réussit.

create table if not exists public.home_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  members jsonb not null default '[]'::jsonb check (jsonb_typeof(members) = 'array' and pg_column_size(members) < 100000),
  week jsonb not null default '{}'::jsonb check (jsonb_typeof(week) = 'object' and pg_column_size(week) < 400000),
  shopping jsonb not null default '[]'::jsonb check (jsonb_typeof(shopping) = 'array' and pg_column_size(shopping) < 100000),
  updated_at timestamptz not null default now()
);

-- Chacun lit et écrit seulement sa propre ligne
alter table public.home_data enable row level security;

drop policy if exists "foyer : lecture" on public.home_data;
create policy "foyer : lecture" on public.home_data
  for select using (auth.uid() = user_id);

drop policy if exists "foyer : ajout" on public.home_data;
create policy "foyer : ajout" on public.home_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "foyer : modification" on public.home_data;
create policy "foyer : modification" on public.home_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
