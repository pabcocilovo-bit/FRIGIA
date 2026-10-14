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
