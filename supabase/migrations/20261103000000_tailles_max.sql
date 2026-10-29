-- Pentest du 29 octobre : un compte pouvait écrire des textes sans limite de taille dans sa propre ligne
-- (un prénom de 5 000 caractères passait, et il s'affiche dans la notif de parrainage d'un autre compte).
-- Des tailles max, larges pour l'usage normal. NOT VALID : les lignes déjà là ne sont pas revérifiées, seules les nouvelles écritures.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run (sur frigia-test, puis sur la prod).

alter table public.profiles drop constraint if exists profiles_tailles_check;
alter table public.profiles add constraint profiles_tailles_check check (
  coalesce(char_length(first_name), 0) <= 60
  and coalesce(char_length(weeknight_time), 0) <= 20
  and cardinality(goals) <= 10 and cardinality(diet) <= 10
  and cardinality(allergies) <= 30 and cardinality(equipment) <= 20
  and pg_column_size(allergies) < 4000 and pg_column_size(equipment) < 4000
) not valid;

alter table public.user_history drop constraint if exists user_history_tailles_check;
alter table public.user_history add constraint user_history_tailles_check check (
  pg_column_size(ingredients) < 50000 and pg_column_size(recipes) < 300000
) not valid;

alter table public.user_favorites drop constraint if exists user_favorites_tailles_check;
alter table public.user_favorites add constraint user_favorites_tailles_check check (
  char_length(recipe_title) <= 200 and pg_column_size(recipe) < 100000
) not valid;

-- community_ingredients devait être réservé aux comptes connectés : Supabase le donne aussi à anon par défaut
revoke execute on function public.community_ingredients() from anon;
