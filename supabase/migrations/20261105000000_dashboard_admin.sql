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

-- Vérification (dans le SQL Editor, tu n'es pas connecté : la fonction répond « admin_seulement », c'est normal)
