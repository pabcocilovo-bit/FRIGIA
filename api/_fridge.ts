// Le scan du frigo pioche d'abord dans le catalogue (Hugo, 27 octobre) : une recette écrite à l'avance, vérifiée,
// avec sa photo, prend une des places quand elle colle au frigo (presque tout est là). L'IA fait les autres.
// Jamais avec une allergie ou un « sans gluten » : le catalogue n'a pas de recette faite pour (fits, api/_catalog.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { type CatalogRecipe, fits } from "./_catalog.js";
import { norm } from "./_recipe.js";

type Item = { name: string; plural?: string; qty?: number | null; unit?: string; have?: boolean };
// Toujours dans les placards, ou presque : ils ne comptent ni comme « dans le frigo » ni comme « à acheter »
const STAPLES = /^(sel|poivre|huile|eau|beurre|farine|sucre|ail|herbe|epice|bouillon|vinaigre|moutarde|levure|muscade|cumin|paprika|curry|thym|laurier|persil|ciboulette|basilic|origan|cannelle|vanille|sauce soja|piment|gingembre|coriandre|romarin|fine|noix de muscade|zeste)/;

// Les recettes écrites à l'avance (source « claude »), gardées 10 minutes sur l'instance
let cache: { at: number; recipes: CatalogRecipe[] } | null = null;
async function load(admin: SupabaseClient): Promise<CatalogRecipe[]> {
  if (cache && Date.now() - cache.at < 600_000) return cache.recipes;
  const { data, error } = await admin.from("recipe_catalog").select("recipes").eq("kind", "dish").eq("source", "claude");
  if (error) { console.error("recipe_catalog:", error.message); return cache?.recipes ?? []; }
  const recipes = ((data ?? []) as { recipes: CatalogRecipe[] }[]).flatMap(r => r.recipes ?? []);
  cache = { at: Date.now(), recipes };
  return recipes;
}

const w = (s: string) => ` ${norm(s.replace(/œ/g, "oe")).replace(/[^a-z]+/g, " ").trim()} `;
// Un produit fait d'un aliment n'est pas l'aliment : « galette de riz » n'est pas du riz, « sauce tomate » pas des tomates
const PRODUCT = /^ (galette|feuille|vinaigre|sauce|bouillon|jus|pate|creme|farine|lait|huile|sirop|poudre|puree|concentre|coulis|fond|biscuit|pain) /;
/** « filet de poulet » dans la recette, « poulet » dans le frigo (ou l'inverse) : c'est là */
const inStock = (name: string, stock: string[]) => {
  const n = w(name), head = PRODUCT.exec(n)?.[1];
  return stock.some(s => {
    const m = w(s);
    if (m.trim().length < 2) return false;
    if (head && !m.includes(` ${head} `)) return false;
    return n.includes(m) || m.includes(n);
  });
};
const staple = (name: string) => STAPLES.test(w(name).trim());
// « Zéro course » : seuls sel, poivre, eau et huile sont sûrs d'être là (comme pour l'IA, api/recipes.ts)
const basic = (name: string) => /^(sel|poivre|eau|huile)\b/.test(w(name).trim());

/** La meilleure recette du catalogue pour ce frigo, prête pour l'appli (ce qu'on a est coché), ou null. */
export async function catalogForFridge(admin: SupabaseClient, o: {
  fridge: { name: string; finish: boolean }[]; pantry: string[]; constraints: string; dislikes: string[]; avoid: string[];
  noShop: boolean; quick: boolean; light: boolean; kids: boolean;
}): Promise<CatalogRecipe | null> {
  const fridge = o.fridge.map(i => i.name);
  const finish = o.fridge.filter(i => i.finish).map(i => i.name);
  const stock = [...fridge, ...o.pantry];
  const avoid = new Set(o.avoid.map(t => norm(t)));
  const scored: { r: CatalogRecipe; score: number }[] = [];
  for (const r of await load(admin)) {
    const items = (Array.isArray(r.items) ? r.items : []) as Item[];
    // Des plats salés seulement : les desserts du scan restent à l'IA
    if (!r.title || r.dessert === true || avoid.has(norm(r.title)) || (o.constraints && !fits(r, o.constraints))) continue;
    if (o.quick && Number(r.minutes) > 25) continue;
    // Repères du catalogue (scripts/catalogue.ts) : h healthy, f plaît aux enfants
    if (o.light && !String(r.tags ?? "").includes("h") && Number(r.calories) > 550) continue;
    if (o.kids && r.kids !== true) continue;
    if (o.dislikes.some(d => items.some(i => inStock(i.name, [d])))) continue;
    const main = items.filter(i => !staple(i.name));
    const used = main.filter(i => inStock(i.name, fridge));
    const missing = main.filter(i => !inStock(i.name, stock));
    if (main.length < 2 || used.length < 2 || missing.length > (o.noShop ? 0 : 1)) continue;
    if (o.noShop && items.some(i => staple(i.name) && !basic(i.name) && !inStock(i.name, stock))) continue;
    // Plus de frigo utilisé, rien à acheter, et ce qui va se perdre d'abord
    const saves = finish.filter(f => main.some(i => inStock(i.name, [f]))).length;
    scored.push({ r, score: used.length * 3 + used.length / main.length * 2 - missing.length * 4 + saves * 2 });
  }
  if (!scored.length) return null;
  // Un peu de hasard parmi les meilleures : pas toujours la même pour le même frigo
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter(s => s.score >= scored[0].score - 1).slice(0, 5);
  const r = top[Math.floor(Math.random() * top.length)].r;
  const items = ((r.items ?? []) as Item[]).map(i => ({ ...i, have: basic(i.name) || inStock(i.name, stock) || (staple(i.name) && !o.noShop) }));
  const toBuy = items.filter(i => !i.have).map(i => i.name);
  return { ...r, items, missing: toBuy.join(", "), fromCatalog: true };
}
