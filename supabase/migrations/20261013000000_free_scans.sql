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
