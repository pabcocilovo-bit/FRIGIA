-- Le dashboard de suivi (/admin) > Réseaux : les comptes Instagram, TikTok, YouTube (Frigia et créateurs UGC),
-- leurs chiffres jour par jour, et ce que chaque créateur rapporte avec son code (Hugo, 2 novembre).
-- À lancer une fois dans Supabase (prod et frigia-test) : SQL Editor > New query > coller > Run.
-- Seul un compte avec app_metadata.admin = true peut lire ou écrire ces tables.
--
-- Les chiffres arrivent d'une capture d'écran lue par Claude (api/_social.ts), d'une saisie à la main,
-- ou plus tard des API des réseaux (comptes liés).

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'tiktok', 'youtube', 'autre')),
  -- Le nom du compte, sans @
  handle text not null check (handle ~ '^[^@\s][^\s]{0,79}$'),
  -- Le prénom du créateur ou un nom libre
  name text check (char_length(name) <= 80),
  kind text not null default 'frigia' check (kind in ('frigia', 'createur')),
  -- Le code créateur (public.codes) : les inscriptions et abonnements qu'il a rapportés
  code text check (code ~ '^[A-Z0-9-]{3,20}$'),
  -- Ce que le créateur a coûté en tout (euros)
  cost_eur numeric(10, 2) not null default 0 check (cost_eur >= 0),
  created_at timestamptz not null default now(),
  unique (platform, handle)
);

create table if not exists public.social_stats (
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  day date not null,
  followers integer check (followers >= 0),
  -- Vues cumulées du compte (ou de toutes les vidéos visibles)
  views bigint check (views >= 0),
  -- Vues des 30 derniers jours, quand le réseau les montre (statistiques du compte pro)
  views_30d bigint check (views_30d >= 0),
  likes bigint check (likes >= 0),
  posts integer check (posts >= 0),
  source text not null default 'manuel' check (source in ('capture', 'manuel', 'api')),
  updated_at timestamptz not null default now(),
  primary key (account_id, day)
);

alter table public.social_accounts enable row level security;
alter table public.social_stats enable row level security;

drop policy if exists social_accounts_admin on public.social_accounts;
create policy social_accounts_admin on public.social_accounts for all to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false));

drop policy if exists social_stats_admin on public.social_stats;
create policy social_stats_admin on public.social_stats for all to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false));

revoke all on public.social_accounts, public.social_stats from anon;
grant select, insert, update, delete on public.social_accounts, public.social_stats to authenticated;

-- Tout l'onglet en une fois : les comptes, leurs chiffres (180 derniers jours) et ce que rapporte leur code.
-- Les codes ne sont lisibles que par le serveur : d'où cette fonction.
create or replace function public.admin_reseaux() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false) then
    raise exception 'admin_seulement' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'comptes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'platform', a.platform, 'handle', a.handle, 'name', a.name, 'kind', a.kind,
        'code', a.code, 'cost_eur', a.cost_eur, 'created_at', a.created_at,
        'inscrits', (select count(*) from code_uses u where u.code = a.code),
        'abonnes', (select count(*) from code_uses u where u.code = a.code and u.subscribed_at is not null),
        'stats', coalesce((
          select jsonb_agg(jsonb_build_object(
            'day', s.day, 'followers', s.followers, 'views', s.views, 'views_30d', s.views_30d,
            'likes', s.likes, 'posts', s.posts, 'source', s.source
          ) order by s.day)
          from social_stats s where s.account_id = a.id and s.day > current_date - 180
        ), '[]'::jsonb)
      ) order by a.kind desc, a.created_at)
      from social_accounts a
    ), '[]'::jsonb),
    'codes', coalesce((
      select jsonb_agg(jsonb_build_object('code', c.code, 'creator', c.creator) order by c.code)
      from codes c where c.kind = 'creator'
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function public.admin_reseaux() from public, anon;
grant execute on function public.admin_reseaux() to authenticated;
