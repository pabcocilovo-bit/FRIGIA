-- Mon frigo : ce qu'il y a dedans (ce que le dernier scan a vu, les courses cochées, ce qu'on ajoute à la main).
-- Une colonne de plus dans home_data, enregistrée de son côté comme le foyer, la semaine et les courses.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Sans elle : le frigo reste sur le téléphone, et part sur le compte au prochain chargement qui réussit.

alter table public.home_data add column if not exists fridge jsonb not null default '{"items":[],"seen":null}'::jsonb;

alter table public.home_data drop constraint if exists home_data_fridge_check;
alter table public.home_data add constraint home_data_fridge_check
  check (jsonb_typeof(fridge) = 'object' and pg_column_size(fridge) < 100000);
