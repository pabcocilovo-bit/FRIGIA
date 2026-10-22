-- Budget courses (Frigia Plus, onglet Famille) : le budget du mois et les dépenses (tickets scannés, ajouts à la main).
-- Une colonne de plus dans home_data, enregistrée de son côté comme le frigo.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Sans elle : le budget reste sur le téléphone, et part sur le compte au prochain chargement qui réussit.

alter table public.home_data add column if not exists budget jsonb not null default '{"monthly":null,"spends":[]}'::jsonb;

alter table public.home_data drop constraint if exists home_data_budget_check;
alter table public.home_data add constraint home_data_budget_check
  check (jsonb_typeof(budget) = 'object' and pg_column_size(budget) < 100000);
