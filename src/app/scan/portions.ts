// Portions et quantités : « Pour 4 personnes » (Gratuit), « 2 portions » (Plus, un enfant compte pour une demi),
// et les quantités de la recette recalculées pour ce nombre.
import type { DetectedIngredient, GeneratedRecipe, RecipeItem } from "../../lib/types";
import { type Person, portionsOf } from "../../lib/household";
import type { ScanState } from "./store";

export const num = (n: number) => String(n).replace(".", ",");

/** En Plus : ceux du foyer qui mangent là, et les invités. En Gratuit : « Pour combien ? ». */
export const portions = (isPlus: boolean, s: Pick<ScanState, "servings" | "guests">, eaters: Person[]) => (isPlus ? portionsOf(eaters, s.guests) : s.servings);

/** Ceux du foyer qui mangent là */
export const eatersOf = (household: Person[], s: Pick<ScanState, "away">) => household.filter(p => !s.away.includes(p.id));

export const srvLabel = (isPlus: boolean, n: number) =>
  isPlus ? `${num(n)} portion${n > 1 ? "s" : ""}` : `${n} personne${n > 1 ? "s" : ""}`;

const COUNTED = ["", "gousse", "gousses", "feuilles", "tranches", "tranche"];

/** « 200 g » / « 1 » / « ½ » et le nom au singulier ou au pluriel, pour n portions. */
export function itemText(it: RecipeItem, factor: number): { q: string; n: string } {
  if (it.qty == null) return { q: "", n: it.name };
  let v = it.qty * factor;
  if (it.unit === "g" || it.unit === "ml") {
    v = Math.max(5, Math.round(v / 5) * 5);
    return { q: `${v} ${it.unit}`, n: it.name };
  }
  if (COUNTED.includes(it.unit)) v = Math.max(1, Math.round(v));
  const r = Math.round(v * 2) / 2, whole = Math.floor(r), half = r - whole > 0;
  const s = (whole ? String(whole) : "") + (half ? "½" : "") || "½";
  let u = it.unit;
  if (u === "gousse" && r > 1) u = "gousses";
  if (u === "tranche" && r > 1) u = "tranches";
  return { q: u ? `${s} ${u}` : s, n: !it.unit && r > 1 ? it.plural : it.name };
}

// Anciennes recettes (avant l'étape 6) : l'IA ne disait pas ce qui était dans le frigo.
// On compare les noms avec les ingrédients trouvés sur la photo ; sel, poivre et eau comptent comme là.
const BASICS = ["sel", "poivre", "eau"];
export const words = (s: string) => s.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z ]/g, " ")
  .split(" ").filter(w => w.length > 2).map(w => w.replace(/[sx]$/, ""));
// « Inclure mon placard » : pâtes, riz, huile, ail, épices
const PANTRY = ["pate", "penne", "spaghetti", "riz", "huile", "ail", "epice", "farine", "sucre"];
export function inFridge(name: string, found: DetectedIngredient[], pantry = false): boolean {
  const w = words(name);
  if (w.some(x => BASICS.includes(x) || (pantry && PANTRY.includes(x)))) return true;
  return found.some(f => words(f.name).some(x => w.includes(x)));
}

/** « Tu as tout » : chaque ingrédient de la recette est dans ce scan (ou dans le placard). */
export function allInFridge(r: GeneratedRecipe, found: DetectedIngredient[]): boolean {
  const names = r.items?.length ? r.items.map(i => i.name) : (r.recipeIngredients ?? []).map(i => i.name);
  return found.length > 0 && names.length > 0 && names.every(n => inFridge(n, found, true));
}

/** Lignes d'ingrédients d'une recette, nouvelles (items) ou anciennes (recipeIngredients, quantités écrites).
 *  found : les ingrédients du scan, pour savoir ce qui manque dans une ancienne recette. */
export function recipeLines(r: GeneratedRecipe, servings: number, found?: DetectedIngredient[]): { q: string; n: string; have: boolean }[] {
  if (r.items?.length) {
    const factor = servings / (r.serves || servings || 1);
    return r.items.map(it => ({ ...itemText(it, factor), have: it.have }));
  }
  return (r.recipeIngredients ?? []).map(i => ({ q: i.qty, n: i.name, have: !found?.length || inFridge(i.name, found) }));
}

/** « 6 sur 8 » : ce que tu as déjà, sur le total (0 sur 0 quand on ne sait pas). */
export function haveCount(r: GeneratedRecipe, found?: DetectedIngredient[]): { have: number; total: number } {
  if (r.items?.length) return { have: r.items.filter(i => i.have).length, total: r.items.length };
  if (!found?.length || !r.recipeIngredients?.length) return { have: 0, total: 0 };
  return { have: r.recipeIngredients.filter(i => inFridge(i.name, found)).length, total: r.recipeIngredients.length };
}

export const minutesOf = (r: GeneratedRecipe) => r.minutes ?? (parseInt(r.time, 10) || 0);
