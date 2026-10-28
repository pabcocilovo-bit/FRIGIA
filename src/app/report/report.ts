// Bilan du mois (prototype V3) : les repas cuisinés, mois par mois.
// Le chiffre, c'est « sauvé » : les produits frais marqués « À finir » au scan (option C, voir savings.ts).
// Tant que rien n'a jamais été marqué, le bilan montre ce qui a été cuisiné de ton frigo, sans l'appeler « sauvé ».
import { type CookedMeal, isMeal } from "../../lib/cooked";
import { MONTHS, SHORT_MONTHS } from "../format";
import { words } from "../scan/portions";

/** Au plus un an en arrière */
export const MAX_MONTHS = 12;
/** La projection « à ce rythme » arrive à partir du 5 du mois : avant, elle dirait n'importe quoi */
const PROJ_FROM_DAY = 5;

export type Mode = "saved" | "used";
export type Top = { name: string; n: number; eur: number };
export type MonthSum = { eur: number; kg: number; meals: number; ingredients: number | null; top: Top[] };
export type Bar = { off: number; label: string; eur: number };
export type Report = {
  mode: Mode;
  /** 0 : ce mois-ci, 1 : le mois dernier… */
  off: number;
  /** Mois disponibles (du premier repas à aujourd'hui) */
  months: number;
  name: string;
  sum: MonthSum;
  /** Par rapport au mois d'avant (au même jour pour le mois en cours) */
  cmp: { diff: number; vs: string } | null;
  chart: Bar[];
  avg: number | null;
  /** À ce rythme, en fin de mois (mois en cours seulement) */
  proj: number | null;
};

const monthOf = (now: Date, off: number) => new Date(now.getFullYear(), now.getMonth() - off, 1);
const sameMonth = (d: Date, m: Date) => d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
const r2 = (n: number) => Math.round(n * 100) / 100;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Les repas d'un mois ; untilDay : seulement jusqu'à ce jour du mois */
export const mealsOf = (meals: CookedMeal[], now: Date, off: number, untilDay?: number) => {
  const m = monthOf(now, off);
  return meals.filter(x => sameMonth(x.date, m) && (untilDay == null || x.date.getDate() <= untilDay));
};

/** Combien de mois montrer : du mois du premier repas à aujourd'hui */
export function monthCount(meals: CookedMeal[], now = new Date()): number {
  if (!meals.length) return 1;
  const first = meals.reduce((a, m) => (m.date < a ? m.date : a), meals[0].date);
  const n = (now.getFullYear() - first.getFullYear()) * 12 + now.getMonth() - first.getMonth() + 1;
  return Math.max(1, Math.min(MAX_MONTHS, n));
}

export const modeOf = (meals: CookedMeal[]): Mode => (meals.some(m => m.kg > 0) ? "saved" : "used");
const euroOf = (m: CookedMeal, mode: Mode) => (mode === "saved" ? m.eur : m.usedEur);
const total = (meals: CookedMeal[], mode: Mode) => r2(meals.reduce((t, m) => t + euroOf(m, mode), 0));

export function sumOf(meals: CookedMeal[], mode: Mode): MonthSum {
  const withItems = meals.filter(m => m.items);
  // Produit par produit : combien de repas, combien d'euros (le même produit, écrit autrement, compte une fois)
  const byKey = new Map<string, Top>();
  for (const m of withItems) {
    const seen = new Set<string>();
    for (const it of m.items ?? []) {
      const k = words(it.name).join(" ");
      if (!k) continue;
      const t = byKey.get(k) ?? { name: cap(it.name.trim()), n: 0, eur: 0 };
      if (!seen.has(k)) { t.n++; seen.add(k); }
      t.eur = r2(t.eur + it.eur);
      byKey.set(k, t);
    }
  }
  return {
    eur: total(meals, mode),
    kg: Math.round(meals.reduce((t, m) => t + (mode === "saved" ? m.kg : m.usedKg), 0) * 10) / 10,
    // Les produits « Mangé » dans Ma cuisine comptent dans sauvé, pas dans les repas
    meals: meals.filter(isMeal).length,
    // Les repas d'avant l'étape 11 n'ont pas le détail : pas de nombre plutôt qu'un nombre faux
    ingredients: mode === "saved" && withItems.length === meals.length ? withItems.reduce((t, m) => t + (m.items?.length ?? 0), 0) : null,
    top: [...byKey.values()].sort((a, b) => b.n - a.n || b.eur - a.eur).slice(0, 3),
  };
}

export function report(meals: CookedMeal[], off: number, now = new Date()): Report {
  const mode = modeOf(meals);
  const months = monthCount(meals, now);
  off = Math.max(0, Math.min(months - 1, off));
  const sum = sumOf(mealsOf(meals, now, off), mode);
  const m = monthOf(now, off);

  // Comparaison : le mois d'avant entier, ou jusqu'au même jour pour le mois en cours. Rien avant le premier mois.
  let cmp: Report["cmp"] = null;
  if (off + 1 < months) {
    const prev = monthOf(now, off + 1);
    const before = total(mealsOf(meals, now, off + 1, off === 0 ? now.getDate() : undefined), mode);
    cmp = { diff: r2(sum.eur - before), vs: off === 0 ? `au ${now.getDate()} ${SHORT_MONTHS[prev.getMonth()]}` : `en ${MONTHS[prev.getMonth()]}` };
  }

  // Trois mois : les trois derniers, ou le mois choisi et les deux suivants quand il est plus ancien
  const hi = off <= 2 ? Math.min(2, months - 1) : off;
  const chart: Bar[] = [hi, hi - 1, hi - 2].filter(o => o >= 0).map(o => ({
    off: o, label: cap(SHORT_MONTHS[monthOf(now, o).getMonth()]), eur: total(mealsOf(meals, now, o), mode),
  }));
  const done = chart.filter(b => b.off > 0);
  const avg = done.length && chart.length > 1 ? r2(done.reduce((t, b) => t + b.eur, 0) / done.length) : null;

  let proj: number | null = null;
  if (off === 0 && now.getDate() >= PROJ_FROM_DAY && sum.eur > 0) {
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const p = Math.round((sum.eur / now.getDate()) * dim);
    if (p > sum.eur + 1) proj = p;
  }

  return { mode, off, months, name: MONTHS[m.getMonth()], sum, cmp, chart, avg, proj };
}

/** « 22,60 € », « 22 € » sur le graphique */
export const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
export const eurShort = (n: number) => eur(n).replace(",00", "");
