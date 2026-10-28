// Dates de péremption dans Ma cuisine (demandé par Hugo le 22 octobre) : une date indicative estimée d'après le produit
// et le jour où il est entré (scan, ticket, course cochée), ou la vraie date si on l'a mise (until).
// À 2 jours de la date, le produit passe tout seul en « À finir » (sauf si on l'a décoché : finish === false).
// Prudence : une estimation dit « à finir vers jeudi », jamais « bon jusqu'à jeudi ».
import type { FridgeItem } from "./home";
import { norm } from "./shopping";
import { placeOf } from "./fridge";

const DAY = 864e5;
// Au frigo, une fois acheté : des durées prudentes. Le premier mot reconnu l'emporte (« steak haché » : 1 jour, pas 2).
const SHELF: [string[], number][] = [
  [["hache"], 1],
  [["poisson", "saumon", "cabillaud", "colin", "lieu", "merlu", "truite", "crevette", "moule", "gambas", "calamar", "sardine", "maquereau", "thon"], 2],
  [["poulet", "dinde", "boeuf", "porc", "veau", "agneau", "viande", "escalope", "saucisse", "merguez", "steak", "filet", "cuisse", "roti"], 2],
  [["reste", "restes"], 3],
  [["fraise", "framboise", "myrtille", "mure"], 3],
  [["jambon", "blanc"], 4],
  [["salade", "laitue", "roquette", "mache", "epinard", "persil", "coriandre", "basilic", "ciboulette", "menthe", "aneth", "champignon", "avocat"], 4],
  [["lait"], 5],
  [["mozzarella", "ricotta", "burrata", "frai", "chevre", "houmou", "tofu", "gnocchi", "ravioli", "tortellini", "fraiche", "ju"], 5],
  [["brocoli", "chou", "haricot", "asperge", "banane", "peche", "abricot", "nectarine", "raisin", "prune"], 5],
  [["creme", "lardon", "bacon", "compote"], 7],
  [["tomate", "courgette", "aubergine", "poivron", "concombre", "poireau", "fenouil", "radi", "betterave", "kiwi", "poire", "melon", "ananas"], 7],
  [["yaourt", "skyr", "dessert", "fromage", "emmental", "comte", "parmesan", "gruyere", "cheddar", "feta", "camembert", "brie", "raclette"], 14],
  [["carotte", "chorizo", "saucisson", "oeuf", "pomme", "orange", "citron", "clementine", "mandarine", "pamplemousse"], 21],
  [["beurre", "margarine"], 30],
];
/** Pain et viennoiseries : aux placards, mais ils sèchent vite */
const BREAD: [string[], number] = [["pain", "baguette", "brioche", "croissant"], 3];

/** Combien de jours un produit se garde, d'après son nom. null : pas d'estimation (placard, inconnu). */
export function shelfDays(x: Pick<FridgeItem, "name" | "place">): number | null {
  const w = norm(x.name);
  const has = (keys: string[]) => w.some(m => keys.includes(m));
  if (has(BREAD[0])) return BREAD[1];
  if (placeOf(x as FridgeItem) !== "frigo") return null;
  return SHELF.find(([keys]) => has(keys))?.[1] ?? null;
}

const startOf = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** La date : la vraie (until), sinon l'estimation (entré dans Ma cuisine + durée). null : pas de date. */
export function dueOf(x: FridgeItem): { at: number; exact: boolean } | null {
  if (x.until) return { at: x.until, exact: true };
  const days = shelfDays(x);
  return days == null ? null : { at: (x.since ?? x.at) + days * DAY, exact: false };
}
/** Dans combien de jours (0 : aujourd'hui, négatif : passée) */
export const daysTo = (at: number, now = Date.now()) => Math.round((startOf(at) - startOf(now)) / DAY);

/** « À finir » : coché à la main, sinon tout seul à 2 jours de la date. finish === false : décoché, ça reste décoché. */
export function finishOf(x: FridgeItem, now = Date.now()): boolean {
  if (x.finish != null) return x.finish;
  const d = dueOf(x);
  return !!d && daysTo(d.at, now) <= 2;
}

/** Proche de sa date (2 jours ou moins), sauf si on l'a décoché. Au scan, seul ceci pré-coche « À finir » : un « À finir »
 *  coché à la main une fois ne se recoche pas à chaque scan (le beurre restait « À finir » pour toujours, vu par Hugo le 23 octobre). */
export function dueSoon(x: FridgeItem, now = Date.now()): boolean {
  const d = dueOf(x);
  return x.finish !== false && !!d && daysTo(d.at, now) <= 2;
}

/** « aujourd'hui », « demain », « jeudi », « le 3 nov. » */
export function dayWord(at: number, now = Date.now()): string {
  const d = daysTo(at, now);
  if (d === 0) return "aujourd'hui";
  if (d === 1) return "demain";
  if (d > 1 && d < 7) return new Date(at).toLocaleDateString("fr-FR", { weekday: "long" });
  return `le ${new Date(at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}
/** Ce qu'on écrit sous le produit : « à finir vers jeudi », « à finir demain » (estimation), « date : demain », « date passée », « à vérifier » */
export function dueText(x: FridgeItem, now = Date.now()): { text: string; soon: boolean } | null {
  const d = dueOf(x);
  if (!d) return null;
  const n = daysTo(d.at, now);
  if (n < 0) return { text: d.exact ? "date passée" : "à vérifier", soon: true };
  return { text: d.exact ? `date : ${dayWord(d.at, now)}` : `à finir ${n <= 1 ? "" : "vers "}${dayWord(d.at, now)}`, soon: n <= 2 };
}
/** Une date choisie (« 2026-10-24 ») : à midi, pour ne pas changer de jour avec le fuseau */
export const atNoon = (t: number) => { const d = new Date(t); d.setHours(12, 0, 0, 0); return d.getTime(); };
