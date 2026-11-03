-- L'alpha (Hugo, 3 novembre) : les inscriptions s'ouvrent à tout le monde, sans passer par la liste d'attente.
-- Beaucoup d'inscrits de la liste n'ouvraient pas le mail avec leur lien d'accès.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run, AVANT de mettre la nouvelle version en ligne
-- (dans l'autre ordre, le site proposerait de créer un compte que la base refuserait).
--
-- Ce qui change : la règle « un compte seulement pour un email de la liste avec un accès » (liste_attente_seule) est retirée.
-- Ce qui reste :
--   - essai_unique : les emails jetables sont refusés, et un email qui a déjà eu l'essai ne le reprend pas après l'alpha ;
--   - waitlist_mois_offert : les inscrits de la liste d'attente gardent leur mois de Plus offert.
-- Le gratuit jusqu'au 30 novembre ne passe pas par la base : il est dans le code (ALPHA_END).
--
-- Pour refermer un jour : relancer le create trigger de la migration 20261104000000.

drop trigger if exists liste_attente_seule on auth.users;

-- Vérification : liste_attente_seule n'apparaît plus, essai_unique et waitlist_mois_offert sont là
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal order by tgname;
