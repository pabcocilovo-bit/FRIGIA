-- Frigia : structure de la base de test (projet Supabase « frigia-test »), à coller UNE FOIS dans un projet neuf :
-- SQL Editor > New query > coller tout le fichier > Run. Aucune donnée réelle : seulement les tables, règles et fonctions.
-- Ensuite : les 8 fichiers catalogue-0X.sql (les recettes d'Explorer), un par un.
-- Préparé le 29 octobre 2026 d'après supabase/migrations (branche main) et les tables créées à la main en prod.

-- ─── Tables créées à la main en prod (pas dans les migrations) ───────────────

create table if not exists public.user_history (
  id text not null,
  user_id uuid not null,
  scan_date timestamp with time zone not null,
  ingredients jsonb not null default '[]'::jsonb,
  recipes jsonb not null default '[]'::jsonb,
  servings numeric(4, 1) not null default 2,
  created_at timestamp with time zone not null default now(),
  meal text null,
  constraint user_history_pkey primary key (id),
  constraint user_history_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  constraint user_history_meal_check check (meal = any (array['m'::text, 's'::text, 'w'::text, 'd'::text]))
);

create table if not exists public.user_favorites (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  recipe jsonb not null,
  recipe_title text not null,
  created_at timestamp with time zone not null default now(),
  constraint user_favorites_pkey primary key (id),
  constraint user_favorites_user_id_recipe_title_key unique (user_id, recipe_title),
  constraint user_favorites_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

-- Chacun ne voit et ne change que ses propres lignes
alter table public.user_history enable row level security;
alter table public.user_favorites enable row level security;

drop policy if exists "historique : le sien" on public.user_history;
create policy "historique : le sien" on public.user_history
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "favoris : les siens" on public.user_favorites;
create policy "favoris : les siens" on public.user_favorites
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ─── 20261006000000_scan_rate_limit.sql ───

-- Persistent rate limit for /api/analyze (the old in-memory counter reset on every serverless instance).
-- Run once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.scan_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

-- No policies: only the server (service role) can read or write this table
alter table public.scan_rate_limits enable row level security;

-- Counts one scan and returns true while the user is under p_limit scans per window
create or replace function public.check_scan_rate_limit(p_user_id uuid, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into scan_rate_limits as r (user_id, window_start, count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update set
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end,
    count        = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_scan_rate_limit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.check_scan_rate_limit(uuid, integer, integer) to service_role;


-- ─── 20261012000000_profiles.sql ───

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


-- ─── 20261013000000_free_scans.sql ───

-- Formule Gratuit : 15 scans au total (+ les bonus des codes, étape 11), comptés sur le compte.
-- Seul le serveur (/api/analyze) change ces compteurs : le compte peut les lire, pas les modifier.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run (après 20261012000000_profiles.sql).

alter table public.profiles add column if not exists scans_used integer not null default 0;
alter table public.profiles add column if not exists bonus_scans integer not null default 0;

-- Le compte n'écrit que son prénom et ses goûts, jamais ses compteurs
revoke insert, update on public.profiles from authenticated, anon;
grant insert (id, first_name, goals, diet, allergies, weeknight_time, equipment, updated_at) on public.profiles to authenticated;
grant update (id, first_name, goals, diet, allergies, weeknight_time, equipment, updated_at) on public.profiles to authenticated;

-- Compte un scan gratuit. Renvoie les scans qui restent après celui-ci, ou -1 si les 15 (+ bonus) sont utilisés.
create or replace function public.use_free_scan(p_user_id uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_left integer;
begin
  insert into profiles (id) values (p_user_id) on conflict (id) do nothing;
  update profiles set scans_used = scans_used + 1
    where id = p_user_id and scans_used < p_limit + bonus_scans
    returning p_limit + bonus_scans - scans_used into v_left;
  return coalesce(v_left, -1);
end;
$$;

-- Rend le scan si l'analyse a échoué (photo illisible, service indisponible…)
create or replace function public.refund_free_scan(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set scans_used = greatest(scans_used - 1, 0) where id = p_user_id;
$$;

revoke all on function public.use_free_scan(uuid, integer) from public, anon, authenticated;
revoke all on function public.refund_free_scan(uuid) from public, anon, authenticated;
grant execute on function public.use_free_scan(uuid, integer) to service_role;
grant execute on function public.refund_free_scan(uuid) to service_role;


-- ─── 20261014000000_scan_meal.sql ───

-- Le repas choisi au scan (ce midi, ce soir, la semaine) : « Scan de 18 h 42 · pour ce soir », et Tes scans (étape 7).
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run. Sans elle, les scans sont gardés sans le repas.

alter table public.user_history add column if not exists meal text check (meal in ('m', 's', 'w'));


-- ─── 20261015000000_settings.sql ───

-- Réglages (étape 8) : la photo de profil suit le compte, et « Nous écrire » arrive dans une table.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Sans elle : la photo reste sur le téléphone seulement, et « Nous écrire » ne part pas.

-- Photo de profil : une petite image (256 px) ou l'adresse d'une photo de plat
alter table public.profiles add column if not exists avatar text;

-- Messages envoyés depuis l'appli (Nous écrire, Signaler un problème, Donner ton avis).
-- À lire dans Table Editor > support_messages, et répondre à l'email du message.
create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  kind text not null check (kind in ('contact', 'bug', 'idea')),
  topic text,
  message text not null check (char_length(message) between 1 and 5000),
  app_info text,
  created_at timestamptz not null default now()
);

-- Chacun peut seulement envoyer ses propres messages (pas les relire ni les changer)
alter table public.support_messages enable row level security;

drop policy if exists "message : envoi" on public.support_messages;
create policy "message : envoi" on public.support_messages
  for insert with check (auth.uid() = user_id);


-- ─── 20261016000000_cooked_meals.sql ───

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


-- ─── 20261017000000_cooked_meals_used.sql ───

-- Repas cuisinés, deux chiffres (étape 9) : kg / eur deviennent « sauvé » (les produits marqués « À finir » au scan),
-- used_kg / used_eur « cuisiné de ton frigo » (tous les produits frais déjà là).
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run. Sans elle, seul « sauvé » est gardé sur le compte.
-- Les repas déjà gardés comptaient tout le frigo comme sauvé : ce chiffre passe en « cuisiné », et leur « sauvé » repart de 0.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cooked_meals' and column_name = 'used_kg'
  ) then
    alter table public.cooked_meals
      add column used_kg numeric(6, 2) not null default 0 check (used_kg >= 0),
      add column used_eur numeric(7, 2) not null default 0 check (used_eur >= 0);
    update public.cooked_meals set used_kg = kg, used_eur = eur, kg = 0, eur = 0;
  end if;
end $$;


-- ─── 20261018000000_home_data.sql ───

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


-- ─── 20261019000000_bilan.sql ───

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


-- ─── 20261020000000_codes.sql ───

-- Codes ami et créateur, parrainage (étape 11).
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run (après 20261013000000_free_scans.sql).
-- Sans elle : le champ code répond « introuvable » et l'écran Parrainage ne montre pas de lien.
--
-- Un code ami : créé tout seul pour chaque compte (CAMI-R7Q4). Il donne 10 scans gratuits à l'ami ;
-- quand l'ami paie Plus pour la première fois, celui qui l'a invité gagne un mois de Plus (api/stripe-webhook.ts).
-- Un code créateur : ajouté à la main, par exemple :
--   insert into public.codes (code, kind, creator, plus_days, expires_at)
--   values ('MARIE', 'creator', 'Marie', 30, '2026-12-31 23:59:59+01');
-- plus_days > 0 : l'offre de lancement au premier abonnement mensuel, 1 mois offert = 3 mois pour 13,98 € payés d'avance,
-- puis 6,99 €/mois (0 : seulement les scans). expires_at : null = sans fin.
-- Un seul code par compte. Seul le serveur lit et écrit ces tables (pas de lecture de la liste des codes).

create table if not exists public.codes (
  code text primary key check (code ~ '^[A-Z0-9-]{3,20}$'),
  kind text not null check (kind in ('friend', 'creator')),
  -- Le compte du code ami
  owner uuid references auth.users(id) on delete cascade,
  -- Le nom affiché du créateur
  creator text check (char_length(creator) <= 60),
  bonus_scans integer not null default 10 check (bonus_scans between 0 and 100),
  plus_days integer not null default 0 check (plus_days between 0 and 92),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'friend') = (owner is not null))
);
create unique index if not exists codes_one_friend_code on public.codes (owner) where kind = 'friend';
alter table public.codes enable row level security;

create table if not exists public.code_uses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null,
  kind text not null,
  -- Celui qui a invité (code ami). Gardé même si son compte est supprimé : null alors.
  referrer uuid references auth.users(id) on delete set null,
  plus_days integer not null default 0,
  used_at timestamptz not null default now(),
  -- Premier paiement de Plus (pour le mois gagné et les chiffres des créateurs)
  subscribed_at timestamptz,
  rewarded_at timestamptz
);
create index if not exists code_uses_referrer on public.code_uses (referrer);
create index if not exists code_uses_code on public.code_uses (code);
alter table public.code_uses enable row level security;

-- Essais de codes : 20 par heure (par compte ou par adresse), pour qu'on ne devine pas les codes des autres
create table if not exists public.code_attempts (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);
alter table public.code_attempts enable row level security;

create or replace function public.check_code_attempt(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into code_attempts as a (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when a.window_start < now() - make_interval(secs => p_window_seconds) then now() else a.window_start end,
    count        = case when a.window_start < now() - make_interval(secs => p_window_seconds) then 1 else a.count + 1 end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

-- Utilise un code : 'ok', 'unknown', 'expired', 'own' (son propre code) ou 'already' (déjà un code sur ce compte).
-- Ajoute les scans offerts d'un coup avec l'utilisation, pour qu'un code ne serve jamais deux fois.
create or replace function public.redeem_code(p_user_id uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c codes%rowtype;
begin
  select * into c from codes where code = upper(p_code);
  if not found then return 'unknown'; end if;
  if c.expires_at is not null and c.expires_at < now() then return 'expired'; end if;
  if c.owner = p_user_id then return 'own'; end if;
  insert into code_uses (user_id, code, kind, referrer, plus_days)
    values (p_user_id, c.code, c.kind, c.owner, c.plus_days)
    on conflict (user_id) do nothing;
  if not found then return 'already'; end if;
  insert into profiles (id) values (p_user_id) on conflict (id) do nothing;
  update profiles set bonus_scans = bonus_scans + c.bonus_scans where id = p_user_id;
  return 'ok';
end;
$$;

revoke all on function public.check_code_attempt(text, integer, integer) from public, anon, authenticated;
revoke all on function public.redeem_code(uuid, text) from public, anon, authenticated;
grant execute on function public.check_code_attempt(text, integer, integer) to service_role;
grant execute on function public.redeem_code(uuid, text) to service_role;


-- ─── 20261021000000_notifications.sql ───

-- Notifications (étape 12) : le centre de notifications, les réglages, les téléphones qui reçoivent.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Sans elle : la cloche ouvre un centre vide, les réglages ne sont pas gardés, et rien n'est envoyé.
--
-- Qui écrit quoi :
--   notifications : le serveur (api/notify.ts, api/code.ts, api/stripe-webhook.ts, api/_ai.ts).
--     Le compte lit les siennes, les marque lues, les supprime. Il ne peut ajouter que « Bienvenue ».
--   notif_settings : le compte (les interrupteurs des réglages).
--   push_subscriptions : le serveur seulement (un téléphone peut changer de compte).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- evening (l'idée du soir), week (ta semaine), referral (parrainage), scans, report (bilan), welcome
  kind text not null check (kind in ('evening', 'week', 'referral', 'scans', 'report', 'welcome', 'list')),
  title text not null check (char_length(title) between 1 and 140),
  body text not null default '' check (char_length(body) <= 300),
  -- L'écran qui s'ouvre (/recettes/…, /planning/creer, /parrainage…) et le bouton de la notif
  url text check (url ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  action text check (char_length(action) <= 40),
  image text check (char_length(image) <= 500),
  -- Une seule par événement : « evening:2026-10-14 », « ref-join:<compte> »…
  key text not null check (char_length(key) <= 80),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, key)
);
create index if not exists notifications_user_date on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

drop policy if exists "notif : lecture" on public.notifications;
create policy "notif : lecture" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "notif : lue" on public.notifications;
create policy "notif : lue" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notif : suppression" on public.notifications;
create policy "notif : suppression" on public.notifications
  for delete using (auth.uid() = user_id);

drop policy if exists "notif : bienvenue" on public.notifications;
create policy "notif : bienvenue" on public.notifications
  for insert with check (auth.uid() = user_id and kind = 'welcome' and key = 'welcome');

-- Seule la date de lecture se change (pas le texte)
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create table if not exists public.notif_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  evening boolean not null default true,
  week boolean not null default true,
  news boolean not null default false,
  -- Le fuseau du téléphone (Europe/Paris…), pour 18 h chez soi
  tz text not null default 'Europe/Paris' check (char_length(tz) <= 60),
  updated_at timestamptz not null default now()
);
alter table public.notif_settings enable row level security;

drop policy if exists "réglages notif : lecture" on public.notif_settings;
create policy "réglages notif : lecture" on public.notif_settings
  for select using (auth.uid() = user_id);

drop policy if exists "réglages notif : création" on public.notif_settings;
create policy "réglages notif : création" on public.notif_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "réglages notif : modification" on public.notif_settings;
create policy "réglages notif : modification" on public.notif_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) <= 1000),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
-- Pas de politique : seul le serveur lit et écrit
alter table public.push_subscriptions enable row level security;


-- ─── 20261022000000_history_servings.sql ───

-- Les portions d'un scan peuvent valoir 1,5 (en Plus, un enfant compte pour une demi-portion).
-- Avant : colonne en nombre entier, l'enregistrement du scan était refusé et il manquait à l'historique.
alter table public.user_history alter column servings type numeric(4,1) using servings::numeric(4,1);


-- ─── 20261023000000_fridge.sql ───

-- Mon frigo (devenu Ma cuisine le 19 octobre : frigo et placards) : ce qu'il y a dedans (ce que le dernier scan a vu, les courses cochées, ce qu'on ajoute à la main).
-- Une colonne de plus dans home_data, enregistrée de son côté comme le foyer, la semaine et les courses.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Sans elle : le frigo reste sur le téléphone, et part sur le compte au prochain chargement qui réussit.

alter table public.home_data add column if not exists fridge jsonb not null default '{"items":[],"seen":null}'::jsonb;

alter table public.home_data drop constraint if exists home_data_fridge_check;
alter table public.home_data add constraint home_data_fridge_check
  check (jsonb_typeof(fridge) = 'object' and pg_column_size(fridge) < 100000);


-- ─── 20261024000000_scan_meal_dessert.sql ───

-- Le dessert au scan (« Dessert », à côté de Ce midi, Ce soir, La semaine) : le repas « d » est accepté.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run. Sans elle, un scan dessert est gardé sans le repas.

alter table public.user_history drop constraint if exists user_history_meal_check;
alter table public.user_history add constraint user_history_meal_check check (meal in ('m', 's', 'w', 'd'));


-- ─── 20261025000000_community_ingredients.sql ───

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


-- ─── 20261026000000_waitlist.sql ───

-- La liste d'attente du site, avant l'ouverture à tous (api/waitlist.ts).
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run. Sans elle, le formulaire répond « ça n'a pas marché ».
-- Seul le serveur lit et écrit cette table. Pour voir les inscrits : select * from public.waitlist order by created_at;
-- invited_at / invite_code : remplis quand la personne reçoit son accès à l'alpha.

create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null check (char_length(email) <= 254 and email = lower(email)),
  first_name text not null check (char_length(first_name) between 1 and 40),
  source text check (char_length(source) <= 60),
  created_at timestamptz not null default now(),
  invited_at timestamptz,
  invite_code text
);
create unique index if not exists waitlist_email on public.waitlist (email);
create index if not exists waitlist_created on public.waitlist (created_at);
alter table public.waitlist enable row level security;


-- ─── 20261027000000_budget.sql ───

-- Budget courses (Frigia Plus, onglet Famille) : le budget du mois et les dépenses (tickets scannés, ajouts à la main).
-- Une colonne de plus dans home_data, enregistrée de son côté comme le frigo.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Sans elle : le budget reste sur le téléphone, et part sur le compte au prochain chargement qui réussit.

alter table public.home_data add column if not exists budget jsonb not null default '{"monthly":null,"spends":[]}'::jsonb;

alter table public.home_data drop constraint if exists home_data_budget_check;
alter table public.home_data add constraint home_data_budget_check
  check (jsonb_typeof(budget) = 'object' and pg_column_size(budget) < 100000);


-- ─── 20261028000000_waitlist_mois_offert.sql ───

-- Un mois d'essai offert aux inscrits de la liste d'attente (demandé par Hugo le 26 octobre), au lieu de 7 jours.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
--
-- Quand un compte est créé avec un email présent dans public.waitlist, il reçoit Plus pour 1 mois
-- (app_metadata.plus_until, en secondes). L'appli et le serveur lisent déjà plus_until : rien d'autre à changer.
-- Les comptes qui existent déjà le jour de l'ouverture : supabase/lancement/essai-comptes-existants.sql.

create or replace function public.waitlist_mois_offert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and exists (select 1 from public.waitlist w where w.email = lower(new.email)) then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('plus_until', extract(epoch from now() + interval '1 month')::bigint);
  end if;
  return new;
exception when others then
  -- Jamais bloquer une inscription pour ça : sans le mois offert, le compte a ses 7 jours habituels
  return new;
end $$;

revoke execute on function public.waitlist_mois_offert() from public, anon, authenticated;

drop trigger if exists waitlist_mois_offert on auth.users;
create trigger waitlist_mois_offert before insert on auth.users
  for each row execute function public.waitlist_mois_offert();


-- ─── 20261029000000_avis_beta.sql ───

-- Les réponses au questionnaire de la bêta (« Ton avis compte », page /avis de l'appli).
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Pour lire les réponses : select created_at, answers from public.beta_feedback order by created_at desc;
--
-- answers : les réponses telles qu'affichées (ex. {"manque": "Beaucoup", "utilise": ["Les recettes proposées"], …}).
-- source : d'où vient la personne (« accueil » : la carte du 5e jour ; « profil » : Mon profil).

create table if not exists public.beta_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  answers jsonb not null check (pg_column_size(answers) <= 16000),
  source text check (char_length(source) <= 20),
  created_at timestamptz not null default now()
);
create index if not exists beta_feedback_user on public.beta_feedback (user_id);

alter table public.beta_feedback enable row level security;

-- Chacun envoie ses propres réponses et peut les relire ; personne ne lit celles des autres.
drop policy if exists "beta_feedback: insert own" on public.beta_feedback;
create policy "beta_feedback: insert own" on public.beta_feedback
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "beta_feedback: read own" on public.beta_feedback;
create policy "beta_feedback: read own" on public.beta_feedback
  for select to authenticated using (user_id = auth.uid());


-- ─── 20261030000000_catalogue_recettes.sql ───

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


-- ─── 20261031000000_images_recettes.sql ───

-- Les photos des recettes du catalogue, générées par l'IA (api/_images.ts, Hugo le 27 octobre).
-- Un espace de stockage public en lecture : l'appli affiche les images par leur adresse.
-- Seul le serveur y écrit (clé service_role, qui passe outre les règles) : aucune règle d'écriture à ajouter.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;


-- ─── 20261105000000_dashboard_admin.sql ───
-- Le dashboard de suivi (page /admin, demandé par Hugo le 30 octobre) : une vue globale de l'appli et des problèmes.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run. Lecture seule : rien n'est modifié.
--
-- Une seule fonction renvoie tous les chiffres d'un coup. Elle passe par Supabase directement (pas de route /api :
-- Vercel en a déjà 12, le maximum). Seul un compte avec app_metadata.admin = true peut l'appeler : app_metadata
-- est écrit par le serveur, le compte ne peut pas se le donner.
--
-- Pour te donner l'accès (déjà fait si explorer?invitations=1 marche pour toi) :
--   update auth.users set raw_app_meta_data = raw_app_meta_data || '{"admin": true}' where email = 'ton@email.fr';
-- puis déconnecte-toi et reconnecte-toi (le jeton garde l'ancien app_metadata jusque-là).

create or replace function public.admin_dashboard(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  d integer := least(greatest(coalesce(p_days, 30), 7), 180);
  since timestamptz := date_trunc('day', now()) - make_interval(days => d - 1);
  week timestamptz := now() - interval '7 days';
  result jsonb;
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false) then
    raise exception 'admin_seulement' using errcode = '42501';
  end if;

  with u as (
    select id, email, created_at, last_sign_in_at,
      raw_app_meta_data ->> 'subscription_status' as status,
      coalesce((raw_app_meta_data ->> 'is_whitelisted')::boolean, false) as offert,
      coalesce((raw_app_meta_data ->> 'no_trial')::boolean, false) as no_trial,
      to_timestamp(nullif(raw_app_meta_data ->> 'plus_until', '')::bigint) as plus_until
    from auth.users
  ),
  -- Même règle que api/_shared.ts (isPlus), sans la pause
  etat as (
    select *,
      case
        when offert then 'offert'
        when status = 'active' then 'abonne'
        when status = 'trialing' then 'abonne_essai'
        when status in ('past_due', 'unpaid') then 'refuse'
        when not no_trial and created_at > now() - interval '7 days' then 'essai'
        when plus_until > now() then 'essai'
        else 'fini'
      end as etat
    from u
  ),
  jours as (select generate_series(since, date_trunc('day', now()), interval '1 day') as jour)
  select jsonb_build_object(
    'jours', d,
    'genere_le', now(),
    'comptes', (select jsonb_build_object(
      'total', count(*),
      'nouveaux_7j', count(*) filter (where created_at > week),
      'nouveaux_jour', count(*) filter (where created_at > date_trunc('day', now())),
      'connectes_7j', count(*) filter (where last_sign_in_at > week),
      'essai', count(*) filter (where etat = 'essai'),
      'abonnes', count(*) filter (where etat = 'abonne'),
      'abonnes_essai', count(*) filter (where etat = 'abonne_essai'),
      'paiement_refuse', count(*) filter (where etat = 'refuse'),
      'offerts', count(*) filter (where etat = 'offert'),
      'essai_fini_sans_payer', count(*) filter (where etat = 'fini'),
      'recrees_sans_essai', count(*) filter (where no_trial)
    ) from etat),
    -- Comptes qui ont scanné ou cuisiné sur 7 jours
    'actifs_7j', (select count(distinct user_id) from (
      select user_id from user_history where created_at > week
      union select user_id from cooked_meals where cooked_at > week
    ) a),
    'usage', jsonb_build_object(
      'scans', (select count(*) from user_history),
      'scans_7j', (select count(*) from user_history where created_at > week),
      'cuisines', (select count(*) from cooked_meals),
      'cuisines_7j', (select count(*) from cooked_meals where cooked_at > week),
      'kg_sauves', (select coalesce(round(sum(kg)::numeric, 1), 0) from cooked_meals),
      'eur_sauves', (select coalesce(round(sum(eur)::numeric, 0), 0) from cooked_meals),
      'favoris', (select count(*) from user_favorites),
      'avis_beta', (select count(*) from beta_feedback),
      'notifs_actives', (select count(distinct user_id) from push_subscriptions)
    ),
    'liste_attente', (select jsonb_build_object(
      'total', count(*),
      'invites', count(*) filter (where invited_at is not null),
      'nouveaux_7j', count(*) filter (where created_at > week)
    ) from waitlist),
    -- Une ligne par jour sur la période
    'par_jour', (select jsonb_agg(jsonb_build_object(
        'jour', to_char(j.jour, 'YYYY-MM-DD'),
        'inscriptions', (select count(*) from auth.users x where x.created_at >= j.jour and x.created_at < j.jour + interval '1 day'),
        'scans', (select count(*) from user_history x where x.created_at >= j.jour and x.created_at < j.jour + interval '1 day'),
        'cuisines', (select count(*) from cooked_meals x where x.cooked_at >= j.jour and x.cooked_at < j.jour + interval '1 day'),
        'liste_attente', (select count(*) from waitlist x where x.created_at >= j.jour and x.created_at < j.jour + interval '1 day')
      ) order by j.jour) from jours j),
    -- Les problèmes remontés (Aide > Nous écrire)
    'support_7j', (select jsonb_build_object(
      'bug', count(*) filter (where kind = 'bug'),
      'contact', count(*) filter (where kind = 'contact'),
      'idea', count(*) filter (where kind = 'idea')
    ) from support_messages where created_at > week),
    'support', (select coalesce(jsonb_agg(s order by s.created_at desc), '[]'::jsonb) from (
      select id, kind, topic, left(message, 400) as message, email, created_at
      from support_messages order by created_at desc limit 15
    ) s),
    -- Abus de l'essai (requête abus-essai.sql) : comptes recréés, et connexions (IP + appareil) partagées par 3 comptes ou plus
    'abus', jsonb_build_object(
      'recrees', (select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb) from (
        select email, created_at, raw_app_meta_data ->> 'subscription_status' as status
        from auth.users where coalesce((raw_app_meta_data ->> 'no_trial')::boolean, false)
        order by created_at desc limit 20
      ) r),
      'connexions', (select coalesce(jsonb_agg(c order by c.comptes desc), '[]'::jsonb) from (
        select host(s.ip) as ip, s.user_agent,
          count(distinct s.user_id) as comptes,
          count(distinct s.user_id) filter (where uu.raw_app_meta_data ->> 'subscription_status' in ('active', 'trialing')) as abonnes,
          string_agg(distinct uu.email, ', ') as emails,
          max(uu.created_at) as dernier
        from auth.sessions s join auth.users uu on uu.id = s.user_id
        where s.ip is not null
        group by s.ip, s.user_agent
        having count(distinct s.user_id) >= 3
        order by comptes desc limit 20
      ) c)
    )
  ) into result;
  return result;
end $$;

revoke execute on function public.admin_dashboard(integer) from public, anon;
grant execute on function public.admin_dashboard(integer) to authenticated;


-- ─── 20261106000000_cout_ia.sql ───
-- Le coût de Claude dans le dashboard (/admin), sans clé admin Anthropic (Hugo, 30 octobre) : chaque appel à Claude
-- (api/_ai.ts, askClaude) note ses tokens ici, et le dashboard calcule le coût avec les prix d'Anthropic (api/_finances.ts).
-- Quand Frigia aura une organisation chez Anthropic (la SAS), ANTHROPIC_ADMIN_KEY dans Vercel donne le coût réel à la place.
-- À lancer une fois dans Supabase (prod et frigia-test) : SQL Editor > New query > coller > Run.

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens integer not null default 0
);
create index if not exists ai_usage_created_at on public.ai_usage (created_at);
-- Lu et écrit par le serveur seulement (clé service) : aucune règle pour les comptes
alter table public.ai_usage enable row level security;
