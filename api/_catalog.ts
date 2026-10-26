// Le catalogue d'Explorer (table recipe_catalog) : une recherche déjà faite ressert ses recettes, sans appeler l'IA.
// Les plats courants sont écrits à l'avance (supabase/catalogue/), les autres sont gardés à leur première recherche.
// Les recettes y sont neutres, pour 4 portions : l'appli recalcule les portions et coche ce qu'on a dans Ma cuisine.
// Seuls l'alimentation (végé, sans gluten…), les allergies et « pas de four » changent la recette : ils ont leur propre clé.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Prefs } from "./_ai.js";

export const CATALOG_SERVES = 4;

/** Une recette telle que l'appli la reçoit (api/_recipe.ts, shape), avec sa variante */
export type CatalogRecipe = Record<string, unknown> & { title: string; imageSearch: string; imageUrl?: string; veg?: boolean; oven?: boolean };
export type CatalogRow = { key: string; kind: "dish" | "list"; recipes: CatalogRecipe[] };

// Mots en tête qu'on ignore : « la tartiflette », « recette de crêpes », « des lasagnes »
const LEADING = ["le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "recette", "recettes"];

/** « Les Tartiflettes » et « tartiflette » donnent la même clé : minuscules, sans accent ni pluriel. */
export function catalogKey(query: string): string {
  const w = query.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  while (w.length > 1 && LEADING.includes(w[0])) w.shift();
  return w.map(x => (x.length > 3 ? x.replace(/[sx]$/, "") : x)).join(" ").slice(0, 80);
}

const DIETS: Record<string, string> = {
  vege: "vegetarien", veggie: "vegetarien", vegan: "vegan", pesce: "pescetarien",
  gluten: "sans gluten", glutenfree: "sans gluten", lactose: "sans lactose",
};

/** Ce qui oblige à une recette à part : « vegetarien+allergie arachide+sans four », ou "" */
export function constraintsOf(prefs: Prefs | null | undefined, eaterAllergies: string[]): string {
  const out = new Set<string>();
  for (const d of prefs?.diet ?? []) if (DIETS[d]) out.add(DIETS[d]);
  if (out.has("vegan")) { out.delete("vegetarien"); out.delete("pescetarien"); }
  if (out.has("vegetarien")) out.delete("pescetarien");
  for (const a of [...(prefs?.allergies ?? []), ...eaterAllergies]) {
    const k = typeof a === "string" ? catalogKey(a) : "";
    if (k) out.add(`allergie ${k}`);
  }
  if ((prefs?.equipment ?? []).includes("pas de four")) out.add("sans four");
  return [...out].sort().join("+").slice(0, 110);
}

/** Une recette de la réserve commune convient-elle quand même ? Seuls végé et « sans four » se vérifient sur la recette ;
 *  une allergie ou un « sans gluten » demande toujours une recette faite pour. */
function fits(r: CatalogRecipe, constraints: string): boolean {
  return constraints.split("+").every(c => (c === "vegetarien" || c === "pescetarien" ? r.veg === true : c === "sans four" ? r.oven !== true : false));
}

/** Les 3 recettes à montrer : un plat dans l'ordre (la classique d'abord), une réserve tirée au sort. null : pas assez. */
function pick(row: CatalogRow, constraints: string): CatalogRecipe[] | null {
  const ok = constraints ? row.recipes.filter(r => fits(r, constraints)) : row.recipes;
  if (ok.length < (row.kind === "dish" ? (constraints ? 2 : 1) : Math.min(3, row.recipes.length))) return null;
  if (row.kind === "dish") return ok.slice(0, 3);
  const pool = [...ok];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}

/** Les recettes déjà gardées pour cette recherche, et la clé où garder les nouvelles.
 *  error : la table n'est pas là (migration pas lancée) ou la base ne répond pas : on cherche sans catalogue. */
export async function findInCatalog(admin: SupabaseClient, query: string, constraints: string):
  Promise<{ key: string; row?: CatalogRow; recipes?: CatalogRecipe[]; error?: boolean }> {
  // La clé n'a que des lettres, des chiffres et des espaces (catalogKey) : rien à échapper dans le filtre
  const base = catalogKey(query);
  const { data, error } = await admin.from("recipe_catalog").select("key, kind, recipes")
    .or(`key.eq."${base}",aliases.cs.{"${base}"}`).limit(1);
  if (error) { console.error("recipe_catalog:", error.message); return { key: constraints ? `${base}|${constraints}` : base, error: true }; }
  const main = data?.[0] as CatalogRow | undefined;
  // Une recherche par un autre nom (alias) va sous le nom du plat
  const key = constraints ? `${main?.key ?? base}|${constraints}` : main?.key ?? base;
  const fromMain = main ? pick(main, constraints) : null;
  if (fromMain) return { key: main!.key, row: main, recipes: fromMain };
  if (!constraints) return { key };
  const own = await admin.from("recipe_catalog").select("key, kind, recipes").eq("key", key).maybeSingle();
  const row = own.data as CatalogRow | null;
  const recipes = row ? pick(row, "") : null;
  return row && recipes ? { key, row, recipes } : { key };
}

/** Après une recherche servie par le catalogue : les photos trouvées sont gardées, et la recherche est comptée. */
export async function catalogServed(admin: SupabaseClient, row: CatalogRow, found: Map<string, string>) {
  const tasks: PromiseLike<unknown>[] = [admin.rpc("recipe_catalog_hit", { p_key: row.key })];
  if (found.size) {
    const recipes = row.recipes.map(r => (!r.imageUrl && found.has(r.title) ? { ...r, imageUrl: found.get(r.title) } : r));
    tasks.push(admin.from("recipe_catalog").update({ recipes, updated_at: new Date().toISOString() }).eq("key", row.key));
  }
  const results = await Promise.allSettled(tasks);
  for (const r of results) if (r.status === "rejected") console.error("recipe_catalog:", r.reason);
}

/** Les recettes générées par l'IA pour une recherche nouvelle, gardées pour la suivante. */
export async function keepInCatalog(admin: SupabaseClient, key: string, query: string, recipes: CatalogRecipe[]) {
  const kind = recipes.some(r => typeof r.variant === "string" && r.variant) ? "dish" : "list";
  const { error } = await admin.from("recipe_catalog").upsert({ key, query: query.slice(0, 200), kind, recipes, source: "ia" }, { onConflict: "key", ignoreDuplicates: true });
  if (error) console.error("recipe_catalog:", error.message);
}
