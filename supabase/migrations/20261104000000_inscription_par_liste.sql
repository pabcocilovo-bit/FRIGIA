-- Les inscriptions passent par la liste d'attente (demandé par Hugo le 29 octobre) : on rejoint la liste, et le mail
-- de confirmation contient le lien pour créer son compte (email ou Google). Le mois offert reste pour tous les inscrits
-- de la liste, tant qu'elle est ouverte.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- PUIS seulement : Authentication > Sign In / Providers > « Allow new users to sign up » rallumé.
-- (Dans l'autre ordre, n'importe qui pourrait créer un compte entre les deux.)
--
-- La règle : un compte ne se crée que si son email (ou sa forme de base : sans +alias, sans points chez Gmail)
-- est sur la liste avec un accès (waitlist.invited_at). api/waitlist.ts le remplit dès l'inscription sur la liste ;
-- les inscrits d'avant reçoivent leur lien avec explorer?invitations=1 (compte admin).
--
-- Le jour où la liste ferme et que tout le monde peut s'inscrire :
--   drop trigger if exists liste_attente_seule on auth.users;
--   drop trigger if exists waitlist_mois_offert on auth.users;

create index if not exists waitlist_email_key on public.waitlist (public.email_key(email));

create or replace function public.liste_attente_seule() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and new.email <> '' and exists (
    select 1 from public.waitlist w
    where w.invited_at is not null and public.email_key(w.email) = public.email_key(new.email)
  ) then
    return new;
  end if;
  raise exception 'pas_invite' using errcode = 'P0001';
end $$;
revoke execute on function public.liste_attente_seule() from public, anon, authenticated;

-- Après essai_unique (ordre alphabétique) : un email jetable reste refusé pour cette raison-là
drop trigger if exists liste_attente_seule on auth.users;
create trigger liste_attente_seule before insert on auth.users
  for each row execute function public.liste_attente_seule();

-- Le mois offert : la même forme de base que la règle (prenom.nom@gmail.com sur la liste, prenomnom@gmail.com chez Google)
create or replace function public.waitlist_mois_offert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and coalesce((new.raw_app_meta_data ->> 'no_trial')::boolean, false) = false
     and exists (select 1 from public.waitlist w where public.email_key(w.email) = public.email_key(new.email)) then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('plus_until', extract(epoch from now() + interval '1 month')::bigint);
  end if;
  return new;
exception when others then
  return new;
end $$;

-- Vérification : le nombre d'inscrits sur la liste, et combien ont déjà leur accès
select count(*) as inscrits, count(invited_at) as avec_acces from public.waitlist;
