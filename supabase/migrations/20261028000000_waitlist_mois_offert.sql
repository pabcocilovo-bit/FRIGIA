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
