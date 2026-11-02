-- Le dashboard de suivi > Réseaux : les vidéos des comptes liés, une par une (Hugo, 2 novembre).
-- Chaque relevé (le matin, ou « Relever maintenant ») note les chiffres de chaque vidéo : classement, taux d'engagement
-- et de partage, vues à 24 h et à 7 jours, meilleur jour et meilleure heure pour poster.
-- À lancer une fois dans Supabase (prod et frigia-test), après 20261109000000_reseaux_comptes_lies.sql.

create table if not exists public.social_videos (
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  -- L'identifiant de la vidéo chez le réseau
  external_id text not null,
  title text,
  url text,
  -- Miniature : l'adresse donnée par TikTok expire au bout de quelques heures, elle est reprise à chaque relevé
  cover_url text,
  duration integer,
  published_at timestamptz,
  views bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (account_id, external_id)
);

-- Les chiffres de chaque vidéo, jour par jour (pour les vues à 24 h et à 7 jours)
create table if not exists public.social_video_stats (
  account_id uuid not null,
  external_id text not null,
  day date not null,
  views bigint not null default 0,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  primary key (account_id, external_id, day),
  foreign key (account_id, external_id) references public.social_videos(account_id, external_id) on delete cascade
);

-- Écrites par le serveur seulement ; lues par admin_videos()
alter table public.social_videos enable row level security;
alter table public.social_video_stats enable row level security;
revoke all on public.social_videos, public.social_video_stats from anon, authenticated;

-- Toutes les vidéos des comptes liés, avec les vues au relevé du lendemain et à celui de J+7 (null s'il n'y en a pas eu :
-- vidéo publiée avant la liaison, ou trop récente)
create or replace function public.admin_videos() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false) then
    raise exception 'admin_seulement' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'account_id', v.account_id, 'id', v.external_id, 'title', v.title, 'url', v.url, 'cover_url', v.cover_url,
      'duration', v.duration, 'published_at', v.published_at,
      'views', v.views, 'likes', v.likes, 'comments', v.comments, 'shares', v.shares,
      'views_24h', (select s.views from social_video_stats s where s.account_id = v.account_id and s.external_id = v.external_id
                    and s.day = (v.published_at at time zone 'UTC')::date + 1),
      'views_7j', (select s.views from social_video_stats s where s.account_id = v.account_id and s.external_id = v.external_id
                   and s.day = (v.published_at at time zone 'UTC')::date + 7)
    ) order by v.published_at desc nulls last)
    from social_videos v
  ), '[]'::jsonb);
end $$;

revoke execute on function public.admin_videos() from public, anon;
grant execute on function public.admin_videos() to authenticated;
