-- Le dashboard de suivi (/admin) : cliquer sur un chiffre ouvre la liste des personnes derrière (Hugo, 30 octobre).
-- À lancer une fois dans Supabase (prod et frigia-test) : SQL Editor > New query > coller > Run. Lecture seule.
-- Même accès que admin_dashboard : seul un compte avec app_metadata.admin = true peut l'appeler.
--
-- p_liste : comptes, nouveaux_7j, abonnes, essai, essai_fini, refuse, offerts, recrees, connectes_7j, actifs_7j,
--           scans_7j, liste_attente. Au plus 500 lignes, les plus récentes d'abord.

create or replace function public.admin_liste(p_liste text) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  week timestamptz := now() - interval '7 days';
  result jsonb;
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false) then
    raise exception 'admin_seulement' using errcode = '42501';
  end if;

  -- La liste d'attente : des inscrits sans compte forcément
  if p_liste = 'liste_attente' then
    select coalesce(jsonb_agg(w order by w.created_at desc), '[]'::jsonb) into result from (
      select email, first_name as prenom, created_at, invited_at as invite_le, source,
        exists (select 1 from auth.users u where public.email_key(u.email) = public.email_key(waitlist.email)) as a_un_compte
      from waitlist order by created_at desc limit 500
    ) w;
    return result;
  end if;

  with u as (
    select u.id, u.email, u.created_at, u.last_sign_in_at,
      u.raw_app_meta_data ->> 'subscription_status' as status,
      coalesce((u.raw_app_meta_data ->> 'is_whitelisted')::boolean, false) as offert,
      coalesce((u.raw_app_meta_data ->> 'no_trial')::boolean, false) as no_trial,
      to_timestamp(nullif(u.raw_app_meta_data ->> 'plus_until', '')::bigint) as plus_until
    from auth.users u
  ),
  -- Même règle que admin_dashboard (et api/_shared.ts isPlus, sans la pause)
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
  lignes as (
    select e.*, p.first_name as prenom,
      (select count(*) from user_history h where h.user_id = e.id) as scans,
      (select count(*) from user_history h where h.user_id = e.id and h.created_at > week) as scans_7j,
      (select count(*) from cooked_meals c where c.user_id = e.id) as cuisines,
      greatest((select max(h.created_at) from user_history h where h.user_id = e.id),
               (select max(c.cooked_at) from cooked_meals c where c.user_id = e.id)) as derniere_activite
    from etat e left join profiles p on p.id = e.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'email', l.email, 'prenom', l.prenom, 'created_at', l.created_at, 'last_sign_in_at', l.last_sign_in_at,
      'etat', l.etat, 'plus_until', l.plus_until, 'scans', l.scans, 'scans_7j', l.scans_7j, 'cuisines', l.cuisines,
      'derniere_activite', l.derniere_activite, 'recree', l.no_trial
    ) order by l.created_at desc), '[]'::jsonb)
  into result
  from (
    select * from lignes l where case p_liste
      when 'comptes' then true
      when 'nouveaux_7j' then l.created_at > week
      when 'abonnes' then l.etat in ('abonne', 'abonne_essai')
      when 'essai' then l.etat = 'essai'
      when 'essai_fini' then l.etat = 'fini'
      when 'refuse' then l.etat = 'refuse'
      when 'offerts' then l.etat = 'offert'
      when 'recrees' then l.no_trial
      when 'connectes_7j' then l.last_sign_in_at > week
      when 'actifs_7j' then l.derniere_activite > week
      when 'scans_7j' then l.scans_7j > 0
      else false
    end
    order by l.created_at desc limit 500
  ) l;
  return result;
end $$;

revoke execute on function public.admin_liste(text) from public, anon;
grant execute on function public.admin_liste(text) to authenticated;
