-- « Petit budget » dans Explorer (Hugo, 28 octobre) : le pot-au-feu (1,6 kg de bœuf et des os à moelle) et le goulash
-- (1 kg de bœuf à braiser) n'ont rien de petit budget. Ils sortent de la réserve, remplacés par le gratin de poisson
-- et le dal de lentilles corail, comme le fait npm run catalogue. Les photos déjà faites sont gardées (copiées des plats).
-- À lancer une fois : SQL Editor > New query > coller > Run. Le relancer ne change rien.
update public.recipe_catalog c
set recipes = coalesce((
    select jsonb_agg(e order by n) from jsonb_array_elements(c.recipes) with ordinality as t(e, n)
    where e->>'title' not in ('Pot-au-feu', 'Goulash', 'Gratin de poisson', 'Dal de lentilles corail')
  ), '[]'::jsonb) || coalesce((
    select jsonb_agg(x.e) from (
      select distinct on (e->>'title') e - 'variant' - 'change' as e
      from public.recipe_catalog d, jsonb_array_elements(d.recipes) e
      where d.kind = 'dish' and d.source = 'claude' and e->>'title' in ('Gratin de poisson', 'Dal de lentilles corail')
      order by e->>'title', e ? 'imageUrl' desc
    ) x
  ), '[]'::jsonb),
  updated_at = now()
where c.key = 'petit budget';

-- Pour vérifier : 30 recettes, sans pot-au-feu ni goulash
select jsonb_array_length(recipes) as recettes,
  recipes @> '[{"title":"Pot-au-feu"}]' or recipes @> '[{"title":"Goulash"}]' as encore_la
from public.recipe_catalog where key = 'petit budget';
