// Dates et libellés de l'appli, en français ou en anglais (lib/i18n).
import { isEn, t } from "../lib/i18n";
import type { User } from "../lib/types";
import type { Profile } from "../lib/profile";
import { displayName } from "../lib/account";
import { dayKey } from "../lib/home";

const DAYS = t(["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"], ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
export const MONTHS = t(["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
/** Un jour en milieu de phrase : « jeudi » (en anglais, la majuscule reste : « Thursday ») */
export const dayLow = (d: string) => (isEn ? d : d.toLowerCase());
/** « 4 novembre » / « 4 November » */
export const dayMonth = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** Prénom affiché : le nom du compte, sinon le début de l'email. */
export function firstName(u: User): string {
  const name = displayName(u).trim() || (u.email ?? "").split("@")[0];
  const first = name.split(/\s+/)[0] ?? "";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export const initial = (u: User) => firstName(u).charAt(0).toUpperCase() || "?";

/** « Mardi · 18 h 42 · Bonsoir Camille » */
export function bandLabel(u: User, now = new Date()): string {
  const h = now.getHours();
  const hello = h >= 18 ? t("Bonsoir", "Good evening") : t("Bonjour", isEn && h >= 12 ? "Good afternoon" : "Good morning");
  const name = firstName(u);
  return `${DAYS[now.getDay()]} · ${hm(now)} · ${hello}${name ? (isEn ? ", " : " ") + name : ""}`;
}

/** « Membre depuis septembre 2026 » */
export function memberSince(u: User): string {
  const d = new Date(u.created_at);
  return t(`Membre depuis ${MONTHS[d.getMonth()]} ${d.getFullYear()}`, `Member since ${MONTHS[d.getMonth()]} ${d.getFullYear()}`);
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export const daysAgo = (d: Date, now = new Date()) => Math.round((dayStart(now) - dayStart(d)) / 86_400_000);

/** « Hier soir », « Jeudi », « Il y a 9 jours » */
export function scanWhen(date: Date, now = new Date()): string {
  const n = daysAgo(date, now);
  const evening = date.getHours() >= 18;
  if (n <= 0) return evening ? t("Ce soir", "Tonight") : t("Aujourd'hui", "Today");
  if (n === 1) return evening ? t("Hier soir", "Last night") : t("Hier", "Yesterday");
  if (n < 7) return DAYS[date.getDay()];
  return t(`Il y a ${n} jours`, `${n} days ago`);
}

/** « 3 articles ». En anglais, passe le mot anglais : plural(3, "article", "item"), et sa forme plurielle si elle n'est pas en -s. */
export const plural = (n: number, word: string, en?: string, enMany?: string) =>
  isEn && en ? `${n} ${n === 1 ? en : enMany ?? en + "s"}` : `${n} ${word}${n > 1 ? "s" : ""}`;

// Libellés des réponses aux questions de l'inscription (prototype V3, écrans B à D)
export const DIET_NAMES: Record<string, string> = t({
  tout: "De tout", vege: "Végétarien", vegan: "Vegan", pesce: "Pescétarien", gluten: "Sans gluten", lactose: "Sans lactose",
}, { tout: "Everything", vege: "Vegetarian", vegan: "Vegan", pesce: "Pescatarian", gluten: "Gluten-free", lactose: "Lactose-free" });
const TIMES: Record<string, string> = t({ "15": "15 minutes maximum", "30": "30 minutes maximum", any: "Ça dépend des soirs" },
  { "15": "15 minutes max", "30": "30 minutes max", any: "Depends on the evening" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « Végétarien, sans gluten » */
export const dietLabel = (diet: string[]) => diet.map((d, i) => i && !isEn ? (DIET_NAMES[d] ?? d).toLowerCase() : DIET_NAMES[d] ?? d).join(", ");

/** Les goûts du compte, comme sur la page Famille : Régime, Ustensiles, Temps en semaine. */
export function tasteRows(p: Profile) {
  const allergies = p.allergies.length ? t(` · allergies : ${p.allergies.join(", ")}`, ` · allergies: ${p.allergies.join(", ")}`) : "";
  return {
    diet: dietLabel(p.diet.length ? p.diet : ["tout"]) + allergies,
    equipment: cap(p.equipment.join(", ")),
    time: (p.weeknight_time && TIMES[p.weeknight_time]) ?? "",
  };
}

const SHORT_DAYS = t(["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"], ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

/** Les 7 jours de la semaine affichée, à partir d'aujourd'hui. key : « 2026-10-14 », comme dans la semaine enregistrée. */
export function weekDays(now = new Date()) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    return { key: dayKey(d), short: SHORT_DAYS[d.getDay()], long: DAYS[d.getDay()], date: d };
  });
}
export type WeekDay = ReturnType<typeof weekDays>[number];

/** « Mardi 6 → lundi 12 octobre » (le mois de début n'est écrit que s'il change). */
export function weekRange(now = new Date()) {
  const days = weekDays(now);
  const a = days[0].date, b = days[6].date;
  if (isEn) return `${DAYS[a.getDay()]} ${a.getDate()}${a.getMonth() !== b.getMonth() ? " " + MONTHS[a.getMonth()] : ""} → ${DAYS[b.getDay()]} ${b.getDate()} ${MONTHS[b.getMonth()]}`;
  const start = `${DAYS[a.getDay()]} ${a.getDate()}${a.getMonth() !== b.getMonth() ? " " + MONTHS[a.getMonth()] : ""}`;
  return `${start} → ${DAYS[b.getDay()].toLowerCase()} ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

/** « Depuis ton scan d'hier », « Depuis ton scan de jeudi »… d'après le dernier scan. */
export function sinceScan(date: Date, now = new Date()): string {
  const n = daysAgo(date, now);
  if (n <= 0) return t("Depuis ton scan d'aujourd'hui", "From today's scan");
  if (n === 1) return t("Depuis ton scan d'hier", "From yesterday's scan");
  if (n < 7) return t(`Depuis ton scan de ${DAYS[date.getDay()].toLowerCase()}`, `From ${DAYS[date.getDay()]}'s scan`);
  return t(`Depuis ton scan du ${date.getDate()} ${MONTHS[date.getMonth()]}`, `From your ${date.getDate()} ${MONTHS[date.getMonth()]} scan`);
}

export const SHORT_MONTHS = t(["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
/** « 18 h 42 » / « 18:42 » */
export const hm = (d: Date) => (isEn ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}` : `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`);

/** « Lundi soir », « Dimanche midi » ; un scan pour la semaine : « Lundi, pour la semaine ». */
export function scanDayTitle(date: Date, meal?: "m" | "s" | "w" | "d"): string {
  const day = DAYS[date.getDay()];
  if (meal === "w") return t(`${day}, pour la semaine`, `${day}, for the week`);
  if (meal === "d") return t(`${day}, pour le dessert`, `${day}, for dessert`);
  const lunch = meal === "m" || (!meal && date.getHours() < 15);
  return t(`${day} ${lunch ? "midi" : "soir"}`, `${day} ${lunch ? "lunch" : "dinner"}`);
}

/** « 5 oct. · 19 h 05 · 8 ingrédients » (l'année s'ajoute quand ce n'est pas cette année). */
export function scanDateLine(date: Date, ingredients: number, now = new Date()): string {
  const year = date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : "";
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}${year} · ${hm(date)} · ${ingredients ? plural(ingredients, "ingrédient", "ingredient") : t("frigo vide", "empty fridge")}`;
}

const mondayOf = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); };

/** Le groupe d'un scan dans « Tes scans » : « Cette semaine », « La semaine dernière », puis le mois. */
export function scanGroup(date: Date, now = new Date()): { key: string; label: string; month: boolean } {
  const weeks = Math.round((mondayOf(now) - mondayOf(date)) / (7 * 86_400_000));
  if (weeks <= 0) return { key: "w0", label: t("Cette semaine", "This week"), month: false };
  if (weeks === 1) return { key: "w1", label: t("La semaine dernière", "Last week"), month: false };
  const m = cap(MONTHS[date.getMonth()]);
  return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.getFullYear() !== now.getFullYear() ? `${m} ${date.getFullYear()}` : m, month: true };
}

/** « Il y a 9 jours », « Il y a 2 semaines », « Il y a 3 mois ». */
export function agoText(date: Date, now = new Date()): string {
  const n = daysAgo(date, now);
  if (n <= 0) return t("Aujourd'hui", "Today");
  if (n === 1) return t("Hier", "Yesterday");
  if (n < 14) return t(`Il y a ${n} jours`, `${n} days ago`);
  if (n < 60) return t(`Il y a ${Math.floor(n / 7)} semaines`, `${Math.floor(n / 7)} weeks ago`);
  return t(`Il y a ${Math.floor(n / 30)} mois`, `${Math.floor(n / 30)} months ago`);
}

/** D'où vient un favori : « Scan d'hier soir », « Scan de jeudi », sinon depuis quand il est gardé. */
export function favoriteOrigin(scanDate: Date | null, savedAt: Date | null, now = new Date(), fromPlan = false): { text: string; scan: boolean; plan?: boolean } {
  if (fromPlan) return { text: t("Depuis ton planning", "From your planner"), scan: false, plan: true };
  if (scanDate) {
    const n = daysAgo(scanDate, now), evening = scanDate.getHours() >= 18;
    if (n <= 0) return { text: evening ? t("Scan de ce soir", "Tonight's scan") : t("Scan d'aujourd'hui", "Today's scan"), scan: true };
    if (n === 1) return { text: evening ? t("Scan d'hier soir", "Last night's scan") : t("Scan d'hier", "Yesterday's scan"), scan: true };
    if (n < 7) return { text: t(`Scan de ${DAYS[scanDate.getDay()].toLowerCase()}`, `${DAYS[scanDate.getDay()]}'s scan`), scan: true };
    return { text: agoText(scanDate, now), scan: false };
  }
  return { text: savedAt ? agoText(savedAt, now) : t("Gardé en favori", "Saved to favourites"), scan: false };
}
