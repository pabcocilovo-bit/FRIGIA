-- Le dashboard de suivi > Courses (Hugo, 5 novembre) : ce que les gens font de leur liste de courses.
-- L'appli note chaque action (ajout, coche, décoche, retrait) avec la source de l'article (recette ou à la main) ;
-- on n'a pas d'historique avant cette table : les chiffres partent du jour où elle est lancée.
-- À lancer une fois dans Supabase (prod et frigia-test).

create table if not exists public.shop_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ajout', 'coche', 'decoche', 'retrait')),
  source text not null default 'main' check (source in ('recette', 'main')),
  -- Le nom de l'article, en minuscules (pour le top des produits, compté tous comptes confondus)
  item text not null check (char_length(item) between 1 and 80),
  at timestamptz not null default now()
);
create index if not exists shop_events_at on public.shop_events (at);
create index if not exists shop_events_user_at on public.shop_events (user_id, at);

-- Chacun ajoute ses propres actions ; personne ne les relit (seulement admin_courses())
alter table public.shop_events enable row level security;
revoke all on public.shop_events from anon, authenticated;
grant insert on public.shop_events to authenticated;
drop policy if exists "courses : ajout" on public.shop_events;
create policy "courses : ajout" on public.shop_events for insert to authenticated with check (user_id = auth.uid());

-- Les chiffres de la période (jours de Paris) :
--   une « course » = un compte qui coche au moins 2 articles différents le même jour ;
--   « refont des courses » = une course suivie d'une autre du même compte dans les 7 jours (courses d'il y a 7 jours ou plus)
create or replace function public.admin_courses(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  since date := (now() at time zone 'Europe/Paris')::date - (greatest(1, least(p_days, 365)) - 1);
  today date := (now() at time zone 'Europe/Paris')::date;
begin
  if not coalesce((auth.jwt() -> 'app_metadata' ->> 'admin')::boolean, false) then
    raise exception 'admin_seulement' using errcode = '42501';
  end if;
  return (
    with e as (
      select user_id, kind, source, item, (at at time zone 'Europe/Paris')::date as day
      from shop_events where at >= (since::timestamp at time zone 'Europe/Paris')
    ),
    trips as (
      select user_id, day, count(distinct item) as articles from e where kind = 'coche' group by user_id, day having count(distinct item) >= 2
    ),
    suivies as (
      select t.user_id, t.day, exists (
        select 1 from trips n where n.user_id = t.user_id and n.day > t.day and n.day <= t.day + 7
      ) as revenu
      from trips t where t.day <= today - 7
    )
    select jsonb_build_object(
      'depuis', (select min(at) from shop_events),
      'ajouts', (select count(*) from e where kind = 'ajout'),
      'ajouts_recette', (select count(*) from e where kind = 'ajout' and source = 'recette'),
      'coches', (select count(*) from e where kind = 'coche'),
      'decoches', (select count(*) from e where kind = 'decoche'),
      'retraits', (select count(*) from e where kind = 'retrait'),
      'utilisateurs', (select count(distinct user_id) from e),
      'actifs_30j', (select count(distinct user_id) from (
        select user_id from user_history where created_at > now() - interval '30 days'
        union select user_id from cooked_meals where cooked_at > now() - interval '30 days'
        union select user_id from shop_events where at > now() - interval '30 days'
      ) a),
      'courses', (select count(*) from trips),
      'articles_par_course', (select round(avg(articles)::numeric, 1) from trips),
      'fidelite', jsonb_build_object(
        'courses', (select count(*) from suivies),
        'revenus', (select count(*) from suivies where revenu)
      ),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object('item', item, 'ajouts', nb, 'comptes', comptes, 'coches', coches) order by nb desc, item)
        from (
          select item, count(*) filter (where kind = 'ajout') as nb, count(distinct user_id) filter (where kind = 'ajout') as comptes,
                 count(*) filter (where kind = 'coche') as coches
          from e group by item having count(*) filter (where kind = 'ajout') > 0
          order by nb desc, item limit 20
        ) t
      ), '[]'::jsonb),
      'par_jour', coalesce((
        select jsonb_agg(jsonb_build_object(
          'jour', d::date,
          'ajouts', (select count(*) from e where e.day = d::date and kind = 'ajout'),
          'coches', (select count(*) from e where e.day = d::date and kind = 'coche'),
          'courses', (select count(*) from trips where trips.day = d::date)
        ) order by d)
        from generate_series(since, today, interval '1 day') d
      ), '[]'::jsonb)
    )
  );
end $$;

revoke execute on function public.admin_courses(int) from public, anon;
grant execute on function public.admin_courses(int) to authenticated;
