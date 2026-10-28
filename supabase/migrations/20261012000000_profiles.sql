-- Profil de chaque compte : prénom et goûts (avant : gardés dans le téléphone seulement).
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  goals text[] not null default '{}',          -- gaspi, temps, sain, budget, idees
  diet text[] not null default '{tout}',       -- tout, vege, vegan, pesce, gluten, lactose
  allergies text[] not null default '{}',      -- arachides, fruits à coque, œufs…
  weeknight_time text,                         -- 15, 30 ou any
  equipment text[] not null default '{}',      -- four, micro-ondes, airfryer, Cookeo…
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chacun ne voit et ne change que son propre profil
alter table public.profiles enable row level security;

drop policy if exists "profil : lecture" on public.profiles;
create policy "profil : lecture" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profil : création" on public.profiles;
create policy "profil : création" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profil : modification" on public.profiles;
create policy "profil : modification" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
