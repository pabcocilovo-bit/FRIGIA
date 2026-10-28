-- Les photos des recettes du catalogue, générées par l'IA (api/_images.ts, Hugo le 27 octobre).
-- Un espace de stockage public en lecture : l'appli affiche les images par leur adresse.
-- Seul le serveur y écrit (clé service_role, qui passe outre les règles) : aucune règle d'écriture à ajouter.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
