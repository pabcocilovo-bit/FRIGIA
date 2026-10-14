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
