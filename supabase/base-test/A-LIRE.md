# Base de test (projet Supabase « frigia-test »)

Les aperçus Vercel (environnement Preview) utilisent ce projet, pas la vraie base. Strix et les tests s'y font.

Pour la recréer de zéro, dans un projet Supabase neuf : SQL Editor > coller `structure.sql` > Run,
puis les 8 fichiers de `supabase/catalogue/sql/` un par un.

`structure.sql` = les tables créées à la main en prod (`user_history`, `user_favorites`) + toutes les migrations,
dans l'ordre. Aucune donnée réelle. Après une nouvelle migration, la lancer aussi sur frigia-test.

Comptes de test : créés à la main (Authentication > Users > Add user, « Auto Confirm User »).
