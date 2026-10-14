// La semaine (étape 10) : midi et soir des 7 prochains jours. Les repas possibles viennent des scans de la semaine
// et des favoris ; chaque carte dit ce qu'elle utilise ou ce qui manque. Les restes du soir peuvent faire le midi du lendemain.
import type { MealKey, PlanDay, Slot, Week } from "../../lib/home";
import type { DetectedIngredient, GeneratedRecipe, HistoryEntry } from "../../lib/types";
import { daysAgo, type WeekDay } from "../format";
import { haveCount, minutesOf, words } from "../scan/portions";

export const MEALS: MealKey[] = ["m", "s"];
export const MEAL_NAME: Record<MealKey, string> = { m: "midi", s: "soir" };

/** Un repas qu'on peut placer : la recette, le scan d'où elle vient (null : un favori), et ce qu'il y avait dans le frigo. */
export type Option = { recipe: GeneratedRecipe; scanId: string | null; n: number | null; found: DetectedIngredient[]; fav: boolean };

/** Les idées des scans des 7 derniers jours (le plus récent d'abord), puis les favoris. Une recette n'apparaît qu'une fois. */
export function options(history: HistoryEntry[], favorites: GeneratedRecipe[]): Option[] {
  const recent = history.filter(e => daysAgo(e.date) <= 7);
  const found = recent[0]?.ingredients ?? [];
  const all: Option[] = [
    ...recent.flatMap(e => e.recipes.map((recipe, n) => ({ recipe, scanId: e.id, n, found: e.ingredients, fav: false }))),
    ...favorites.map(recipe => ({ recipe, scanId: null, n: null, found, fav: true })),
  ];
  return all.filter((o, i) => all.findIndex(x => x.recipe.title === o.recipe.title) === i);
}

/** Le frigo d'un repas prévu : celui de son scan, sinon le dernier scan. */
export function foundOf(slot: Slot, history: HistoryEntry[]): DetectedIngredient[] {
  return history.find(e => e.id === slot.scanId)?.ingredients ?? history[0]?.ingredients ?? [];
}

const namesOf = (r: GeneratedRecipe) => (r.items?.length ? r.items.map(i => i.name) : (r.recipeIngredients ?? []).map(i => i.name));

/** Ce qui est marqué « À finir » au scan et que la recette utilise. */
export function finishes(r: GeneratedRecipe, found: DetectedIngredient[]): string[] {
  const need = namesOf(r).map(words);
  return found.filter(f => f.finish && need.some(w => words(f.name).some(x => w.includes(x)))).map(f => f.name);
}

/** Le bandeau d'une carte : « Manque la crème », « À finir : courgette », « Tu as tout ». */
export function status(r: GeneratedRecipe, found: DetectedIngredient[]): { text: string; warn: boolean; missing: number } {
  const { have, total } = haveCount(r, found);
  const missing = total - have;
  if (missing > 0) return { text: r.missing && r.missing.length <= 24 ? `Manque ${r.missing}` : `Manque ${missing} ingrédient${missing > 1 ? "s" : ""}`, warn: true, missing };
  if (!total && r.missing) return { text: `Manque ${r.missing}`, warn: true, missing: 1 };
  const fin = finishes(r, found);
  if (fin.length) return { text: `À finir : ${fin.slice(0, 2).join(", ").toLowerCase()}`, warn: false, missing: 0 };
  return { text: "Tu as tout", warn: false, missing: 0 };
}

export const dayOf = (w: Week, key: string): PlanDay => w.days[key] ?? {};
const put = (w: Week, key: string, d: PlanDay): Week => ({ ...w, days: { ...w.days, [key]: d } });
export const slotOption = (o: Option, left = false): Slot => ({ recipe: o.recipe, scanId: o.scanId, n: o.n, ...(left ? { left: true } : {}) });

/** Les restes possibles pour le midi du jour i : le soir de la veille (pas un jour sauté). */
export function leftFor(w: Week, days: WeekDay[], i: number): Slot | undefined {
  if (i === 0) return undefined;
  const prev = dayOf(w, days[i - 1].key);
  return prev.off ? undefined : prev.s;
}

/** Les restes ne valent que si le soir d'avant n'a pas changé. */
export function tidy(w: Week, days: WeekDay[]): Week {
  let out = w;
  days.forEach((d, i) => {
    const m = dayOf(out, d.key).m;
    if (i > 0 && m?.left && leftFor(out, days, i)?.recipe.title !== m.recipe.title) out = put(out, d.key, { ...dayOf(out, d.key), m: undefined });
  });
  return out;
}

export function setSlot(w: Week, days: WeekDay[], key: string, meal: MealKey, slot: Slot | undefined): Week {
  return tidy(put(w, key, { ...dayOf(w, key), off: slot ? false : dayOf(w, key).off, [meal]: slot }), days);
}

/** Sauter un jour (resto, chez mamie) vide ses repas ; le remettre le laisse vide. */
export function toggleOff(w: Week, days: WeekDay[], key: string): Week {
  const off = !dayOf(w, key).off;
  return tidy(put(w, key, off ? { off: true } : {}), days);
}

/** Le soir dont les restes font le midi du lendemain : on double la dose. */
export function doubled(w: Week, days: WeekDay[], i: number): boolean {
  const s = dayOf(w, days[i].key).s, next = days[i + 1] && dayOf(w, days[i + 1].key).m;
  return !!s && !!next?.left && next.recipe.title === s.recipe.title;
}

/** Les repas prévus, et combien avec les restes de la veille. */
export function count(w: Week, days: WeekDay[]): { n: number; lefts: number; last: number } {
  let n = 0, lefts = 0, last = -1;
  days.forEach((d, i) => MEALS.forEach(m => {
    const s = dayOf(w, d.key)[m];
    if (!s) return;
    n++; last = i;
    if (s.left) lefts++;
  }));
  return { n, lefts, last };
}

/** Où une recette est déjà prévue (pas comme restes). */
export function findTitle(w: Week, days: WeekDay[], title: string, skip?: [string, MealKey]): [number, MealKey] | null {
  for (let i = 0; i < days.length; i++) {
    for (const m of ["s", "m"] as MealKey[]) {
      const s = dayOf(w, days[i].key)[m];
      if (s && !s.left && s.recipe.title === title && !(skip && skip[0] === days[i].key && skip[1] === m)) return [i, m];
    }
  }
  return null;
}

/** « Remplir » : les cases vides, ce qui se garde le moins d'abord (les recettes qui utilisent du « À finir »).
 *  Un midi sur deux prend les restes de la veille. Une recette n'est prévue qu'une fois. */
export function fill(w: Week, days: WeekDay[], opts: Option[]): { week: Week; added: number; lefts: number } {
  const sorted = [...opts].sort((a, b) => Number(finishes(b.recipe, b.found).length > 0) - Number(finishes(a.recipe, a.found).length > 0));
  const used = new Set<string>();
  days.forEach(d => MEALS.forEach(m => { const s = dayOf(w, d.key)[m]; if (s && !s.left) used.add(s.recipe.title); }));
  const next = (pref?: (o: Option) => boolean) => {
    const o = (pref && sorted.find(x => !used.has(x.recipe.title) && pref(x))) || sorted.find(x => !used.has(x.recipe.title));
    if (o) used.add(o.recipe.title);
    return o;
  };
  let out = w, added = 0, lefts = 0;
  days.forEach(d => {
    const day = dayOf(out, d.key);
    if (day.off || day.s) return;
    const o = next();
    if (o) { out = put(out, d.key, { ...day, s: slotOption(o) }); added++; }
  });
  days.forEach((d, i) => {
    const day = dayOf(out, d.key);
    if (day.off || day.m) return;
    const lf = leftFor(out, days, i);
    if (lf && i % 2 === 1) { out = put(out, d.key, { ...day, m: { ...lf, left: true } }); added++; lefts++; return; }
    const o = next(x => !!x.recipe.cold);
    if (o) { out = put(out, d.key, { ...day, m: slotOption(o) }); added++; }
  });
  return { week: out, added, lefts };
}

/** Il reste des cases que « Remplir » peut garnir. */
export function canFill(w: Week, days: WeekDay[], opts: Option[]): boolean {
  return fill(w, days, opts).added > 0;
}

/** Trier les remplaçants : « Mon frigo » (le moins de manquants), « Plus rapide », « Enfants ». */
export type SwapBy = "frigo" | "vite" | "kids";
export function swapOrder(opts: Option[], by: SwapBy): Option[] {
  const key = (o: Option) => (by === "vite" ? minutesOf(o.recipe) || 99 : by === "kids" ? (o.recipe.kids ? 0 : 1) : status(o.recipe, o.found).missing);
  return [...opts].sort((a, b) => key(a) - key(b));
}

/** La recette s'ouvre depuis son scan quand il existe encore, sinon comme un favori. */
export function recipePath(slot: Slot, history: HistoryEntry[]): string {
  const e = slot.scanId ? history.find(x => x.id === slot.scanId) : undefined;
  return e && slot.n != null && e.recipes[slot.n]?.title === slot.recipe.title ? `/recettes/${e.id}/${slot.n}` : "/recette";
}

/** « Prévu jeudi soir · changer » quand la recette est déjà dans la semaine. */
export function placedText(w: Week, days: WeekDay[], title: string): string | null {
  const at = findTitle(w, days, title);
  return at ? `Prévu ${at[0] === 0 ? (at[1] === "m" ? "ce midi" : "ce soir") : `${days[at[0]].long.toLowerCase()} ${MEAL_NAME[at[1]]}`} · changer` : null;
}

/** « Frigo scanné hier » (un scan de la semaine), sinon rien. */
export function scannedText(history: HistoryEntry[]): string | null {
  const d = history[0]?.date;
  if (!d) return null;
  const n = daysAgo(d);
  if (n > 7) return null;
  return n <= 0 ? "Frigo scanné aujourd'hui" : n === 1 ? "Frigo scanné hier" : `Frigo scanné ${d.toLocaleDateString("fr-FR", { weekday: "long" })}`;
}

/** Ce qui est « À finir » dans le dernier scan de la semaine. */
export function toFinish(history: HistoryEntry[]): string[] {
  const e = history[0];
  return e && daysAgo(e.date) <= 7 ? e.ingredients.filter(i => i.finish).map(i => i.name) : [];
}

/** Ce que les écrans de la semaine reçoivent. */
export type PlanProps = {
  isPlus: boolean;
  week: Week;
  setWeek: (u: Week | ((prev: Week) => Week)) => void;
  history: HistoryEntry[];
  favorites: GeneratedRecipe[];
};
