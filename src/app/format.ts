// Dates et libellés de l'appli, en français.
import type { Prefs, User } from "../lib/types";
import { displayName } from "../lib/account";

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Prénom affiché : le nom du compte, sinon le début de l'email. */
export function firstName(u: User): string {
  const name = displayName(u).trim() || (u.email ?? "").split("@")[0];
  const first = name.split(/\s+/)[0] ?? "";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export const initial = (u: User) => firstName(u).charAt(0).toUpperCase() || "?";

/** « Mardi · 18 h 42 · Bonsoir Camille » */
export function bandLabel(u: User, now = new Date()): string {
  const hello = now.getHours() >= 18 ? "Bonsoir" : "Bonjour";
  const name = firstName(u);
  return `${DAYS[now.getDay()]} · ${now.getHours()} h ${String(now.getMinutes()).padStart(2, "0")} · ${hello}${name ? " " + name : ""}`;
}

/** « Membre depuis septembre 2026 » */
export function memberSince(u: User): string {
  const d = new Date(u.created_at);
  return `Membre depuis ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export const daysAgo = (d: Date, now = new Date()) => Math.round((dayStart(now) - dayStart(d)) / 86_400_000);

/** « Hier soir », « Jeudi », « Il y a 9 jours » */
export function scanWhen(date: Date, now = new Date()): string {
  const n = daysAgo(date, now);
  const evening = date.getHours() >= 18;
  if (n <= 0) return evening ? "Ce soir" : "Aujourd'hui";
  if (n === 1) return evening ? "Hier soir" : "Hier";
  if (n < 7) return DAYS[date.getDay()];
  return `Il y a ${n} jours`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

// Mêmes libellés que le questionnaire actuel (il sera refait à l'étape 4)
const DIETS: Record<string, string> = { all: "Tout", veggie: "Végétarien", vegan: "Vegan", glutenfree: "Sans gluten" };
const EQUIPMENT: Record<string, string> = { airfryer: "AirFryer", moulinex: "Moulinex", thermomix: "Thermomix", autre: "Autre" };
const TIMES: Record<string, string> = { "15min": "Moins de 15 min", "30min": "30 minutes", any: "Peu importe" };

/** Les goûts du questionnaire, comme sur la page Famille : Régime, Ustensiles, Temps en semaine. */
export function tasteRows(p: Prefs) {
  return {
    diet: p.diet.map(d => DIETS[d]).filter(Boolean).join(", "),
    equipment: p.equipment.map(e => EQUIPMENT[e]).filter(Boolean).join(", "),
    time: TIMES[p.time] ?? "",
  };
}
