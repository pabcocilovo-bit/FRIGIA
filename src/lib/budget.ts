// Budget courses (Frigia Plus, onglet Famille) : le budget du mois et les dépenses. Un ticket de caisse scanné s'y ajoute
// tout seul (son total), le reste s'ajoute à la main (marché, boucher). Demandé par Hugo le 22 octobre.
// Colonne budget de home_data (migration 20261027000000_budget.sql), enregistrée de son côté comme le frigo.
import type { Person } from "./household";

/** Une dépense : le montant, le jour (du ticket, sinon de l'ajout), où (« Leclerc », « Marché »), et d'où elle vient. */
export type Spend = { id: string; eur: number; at: number; label: string; from: "ticket" | "main" };
/** monthly : le budget du mois (null : pas encore fixé) */
export type Budget = { monthly: number | null; spends: Spend[] };
export const EMPTY_BUDGET: Budget = { monthly: null, spends: [] };

const YEAR = 400 * 864e5;
/** Ce qui vient du compte ou du téléphone, remis au propre (on garde un peu plus d'un an de dépenses) */
export function cleanBudget(b: unknown, now = Date.now()): Budget {
  if (!b || typeof b !== "object") return EMPTY_BUDGET;
  const o = b as Partial<Budget>;
  const monthly = typeof o.monthly === "number" && o.monthly > 0 ? Math.round(o.monthly) : null;
  const spends = (Array.isArray(o.spends) ? o.spends : []).filter((s): s is Spend =>
    !!s && typeof s.id === "string" && typeof s.eur === "number" && s.eur > 0 && typeof s.at === "number" && now - s.at < YEAR)
    .map((s): Spend => ({ id: s.id, eur: s.eur, at: s.at, label: typeof s.label === "string" ? s.label : "", from: s.from === "ticket" ? "ticket" : "main" }));
  return { monthly, spends };
}

const sameMonth = (at: number, now: Date) => { const d = new Date(at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); };
/** Les dépenses du mois, la plus récente d'abord */
export const monthSpends = (b: Budget, now = new Date()) => b.spends.filter(s => sameMonth(s.at, now)).sort((a, z) => z.at - a.at);
export const total = (list: Spend[]) => Math.round(list.reduce((t, s) => t + s.eur, 0) * 100) / 100;

/** Ajoute une dépense. Le même ticket scanné deux fois (même jour, même montant) ne compte qu'une fois. */
export function addSpend(b: Budget, s: Omit<Spend, "id">): Budget {
  const day = new Date(s.at).toDateString();
  if (s.from === "ticket" && b.spends.some(x => x.from === "ticket" && x.eur === s.eur && new Date(x.at).toDateString() === day)) return b;
  return { ...b, spends: [...b.spends, { ...s, id: crypto.randomUUID() }] };
}

/** Un budget de départ pour le foyer : environ 190 € par adulte et 120 € par enfant (ordre de grandeur des courses
 *  alimentaires en France), arrondi à la dizaine. Une proposition, la personne le change. */
export const suggestBudget = (household: Person[]) =>
  Math.max(150, Math.round(household.reduce((t, p) => t + (p.kid ? 120 : 190), 0) / 10) * 10);

/** À ce rythme, la fin du mois (à partir du 7, avant c'est trop tôt pour le dire) */
export function projection(spent: number, now = new Date()): number | null {
  const day = now.getDate(), days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return day < 7 || !spent ? null : Math.round(spent / day * days);
}
export const daysLeft = (now = new Date()) => new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;

/** « 62,40 € », « 600 € » */
export const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} €`;
/** « octobre » */
export const monthName = (d = new Date()) => d.toLocaleDateString("fr-FR", { month: "long" });
/** « d'octobre », « de mai » */
export const ofMonth = (d = new Date()) => { const m = monthName(d); return /^[aeiou]/.test(m) ? `d'${m}` : `de ${m}`; };
/** Le jour d'un ticket (« 2026-10-21 ») : gardé seulement s'il est plausible (pas dans le futur, moins de 2 mois), sinon aujourd'hui */
export function ticketDay(date: string | null, now = Date.now()): number {
  const m = date && /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return now;
  const at = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime();
  return at <= now + 864e5 && now - at < 62 * 864e5 ? Math.min(at, now) : now;
}
