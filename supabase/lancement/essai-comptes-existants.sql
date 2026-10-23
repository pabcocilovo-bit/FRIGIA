-- Fin de la formule gratuite (23 octobre 2026) : 7 jours d'essai offerts aux comptes déjà inscrits.
-- À lancer UNE FOIS, le jour où la nouvelle appli part en ligne (pas avant : les 7 jours partent de maintenant).
-- Ce n'est pas une migration : à coller dans l'éditeur SQL de Supabase.
--
-- Chaque compte sans abonnement en cours reçoit Plus jusqu'à dans 7 jours (app_metadata.plus_until, en secondes),
-- sauf s'il a déjà plus (essai en cours, code, mois offert). Les abonnés et les comptes de l'équipe ne bougent pas.
-- L'appli relit la session sur l'écran « Passe à Plus » : le compte voit ses 7 jours sans se reconnecter.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('plus_until', extract(epoch from now() + interval '7 days')::bigint)
where coalesce((raw_app_meta_data->>'is_whitelisted')::boolean, false) = false
  and coalesce(raw_app_meta_data->>'subscription_status', '') not in ('active', 'trialing', 'past_due', 'unpaid')
  and coalesce((raw_app_meta_data->>'plus_until')::bigint, 0) < extract(epoch from now() + interval '7 days')::bigint
  and created_at + interval '7 days' < now() + interval '7 days';

-- Vérifier : combien de comptes ont leurs 7 jours
select count(*) from auth.users
where (raw_app_meta_data->>'plus_until')::bigint >= extract(epoch from now() + interval '7 days' - interval '1 hour')::bigint;
