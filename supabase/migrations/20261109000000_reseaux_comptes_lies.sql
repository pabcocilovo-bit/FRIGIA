-- Le dashboard de suivi > Réseaux : les comptes liés (TikTok d'abord, Hugo, 2 novembre).
-- Le propriétaire du compte clique sur « Connecter TikTok » (ou sur le lien envoyé à un créateur) et autorise Frigia :
-- le serveur garde les jetons ici et relève les chiffres chaque matin (api/_tiktok.ts, cron de api/subscription.ts).
-- À lancer une fois dans Supabase (prod et frigia-test), après 20261108000000_reseaux.sql.

-- Les jetons : lus et écrits par le serveur seulement (pas de règle RLS, donc rien pour les comptes connectés)
create table if not exists public.social_tokens (
  account_id uuid primary key references public.social_accounts(id) on delete cascade,
  -- L'identifiant du compte chez le réseau (open_id chez TikTok)
  external_id text not null,
  access_token text not null,
  refresh_token text,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  scopes text,
  linked_at timestamptz not null default now(),
  last_sync_at timestamptz,
  -- La dernière erreur de relevé (jeton retiré par le propriétaire…), null si tout va bien
  last_error text
);
alter table public.social_tokens enable row level security;
revoke all on public.social_tokens from anon, authenticated;

-- admin_reseaux() avec, pour chaque compte, s'il est lié et son dernier relevé automatique
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
        'lie', (select jsonb_build_object('le', t.linked_at, 'synchro', t.last_sync_at, 'erreur', t.last_error)
                from social_tokens t where t.account_id = a.id),
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
