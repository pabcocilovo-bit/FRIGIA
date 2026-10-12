// Dates et libellés de l'appli, en français.
import type { User } from "../lib/types";
import type { Profile } from "../lib/profile";
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

// Libellés des réponses aux questions de l'inscription (prototype V3, écrans B à D)
export const DIET_NAMES: Record<string, string> = {
  tout: "De tout", vege: "Végétarien", vegan: "Vegan", pesce: "Pescétarien", gluten: "Sans gluten", lactose: "Sans lactose",
};
const TIMES: Record<string, string> = { "15": "15 minutes maximum", "30": "30 minutes maximum", any: "Ça dépend des soirs" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « Végétarien, sans gluten » */
export const dietLabel = (diet: string[]) => diet.map((d, i) => i ? (DIET_NAMES[d] ?? d).toLowerCase() : DIET_NAMES[d] ?? d).join(", ");

/** Les goûts du compte, comme sur la page Famille : Régime, Ustensiles, Temps en semaine. */
export function tasteRows(p: Profile) {
  const allergies = p.allergies.length ? ` · allergies : ${p.allergies.join(", ")}` : "";
  return {
    diet: dietLabel(p.diet.length ? p.diet : ["tout"]) + allergies,
    equipment: cap(p.equipment.join(", ")),
    time: (p.weeknight_time && TIMES[p.weeknight_time]) ?? "",
  };
}

const SHORT_DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/** Les 7 jours de la semaine affichée, à partir d'aujourd'hui. */
export function weekDays(now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    return { key: d.toDateString(), short: SHORT_DAYS[d.getDay()], date: d };
  });
}

/** « Mardi 6 → lundi 12 octobre » (le mois de début n'est écrit que s'il change). */
export function weekRange(now = new Date()) {
  const days = weekDays(now);
  const a = days[0].date, b = days[6].date;
  const start = `${DAYS[a.getDay()]} ${a.getDate()}${a.getMonth() !== b.getMonth() ? " " + MONTHS[a.getMonth()] : ""}`;
  return `${start} → ${DAYS[b.getDay()].toLowerCase()} ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

/** « Depuis ton scan d'hier », « Depuis ton scan de jeudi »… d'après le dernier scan. */
export function sinceScan(date: Date, now = new Date()): string {
  const n = daysAgo(date, now);
  if (n <= 0) return "Depuis ton scan d'aujourd'hui";
  if (n === 1) return "Depuis ton scan d'hier";
  if (n < 7) return `Depuis ton scan de ${DAYS[date.getDay()].toLowerCase()}`;
  return `Depuis ton scan du ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
