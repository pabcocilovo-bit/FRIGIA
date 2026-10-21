-- Les portions d'un scan peuvent valoir 1,5 (en Plus, un enfant compte pour une demi-portion).
-- Avant : colonne en nombre entier, l'enregistrement du scan était refusé et il manquait à l'historique.
alter table public.user_history alter column servings type numeric(4,1) using servings::numeric(4,1);
