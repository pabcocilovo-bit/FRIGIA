// Le scan en cours, d'un écran à l'autre : la photo, les ingrédients vérifiés, les envies et les portions.
// Gardé en mémoire le temps de la visite (un rechargement repart de la caméra).
import { useSyncExternalStore } from "react";
import type { Envie, Receipt, ScanIngredient, ScanSource } from "../../lib/scan";
import type { Meal } from "../../lib/types";
import type { Fridge } from "../../lib/home";
import { pantryOf } from "../../lib/fridge";
import { same } from "../../lib/shopping";

/** Le menu choisi après « C'est bien ça ? » : combien de recettes, et combien de desserts parmi elles */
export type MenuId = "plats" | "plats-dessert" | "plat-dessert" | "desserts" | "semaine";
export const MENUS: { id: MenuId; label: string; sub: string; n: number; desserts: number; plus?: boolean }[] = [
  { id: "plats", label: "3 plats", sub: "Trois idées de plats, au choix", n: 3, desserts: 0 },
  { id: "plats-dessert", label: "2 plats et 1 dessert", sub: "Deux idées de plats, et le dessert", n: 3, desserts: 1 },
  { id: "plat-dessert", label: "1 plat et 1 dessert", sub: "Le repas complet, sans hésiter", n: 2, desserts: 1 },
  { id: "desserts", label: "3 desserts", sub: "Trois idées sucrées", n: 3, desserts: 3 },
  { id: "semaine", label: "Pour la semaine", sub: "Batch cooking : des plats qui se gardent", n: 3, desserts: 0, plus: true },
];
export const menuOf = (id: MenuId) => MENUS.find(m => m.id === id) ?? MENUS[0];
/** Le repas qui va avec le menu : la semaine, le dessert, ou des plats pour ce midi (avant 16 h) ou ce soir */
export const mealOf = (id: MenuId, now = new Date()): Meal =>
  id === "semaine" ? "w" : id === "desserts" ? "d" : now.getHours() < 16 ? "m" : "s";

export type ScanState = {
  /** Suit le menu (mealOf) : il règle les textes (« Qui mange ce soir ? ») et l'historique */
  meal: Meal;
  menu: MenuId;
  source: ScanSource;
  /** La photo montrait autre chose que le mode choisi : source a suivi la photo, switched garde le choix de départ (pour revenir) */
  switched: ScanSource | null;
  /** La photo analysée (adresse locale), pour le fond de « C'est bien ça ? » et « Ajouter » */
  photo: string | null;
  /** Photo de la galerie à recadrer */
  pick: File | null;
  /** Photo à analyser en arrivant sur la caméra (après « Analyser » du recadrage) */
  pending: Blob | null;
  ingredients: ScanIngredient[];
  /** Jeton de la photo comptée : ses recettes ne recomptent pas de scan */
  token: string | null;
  problem: "floue" | "sombre" | "vide";
  /** Un ticket de caisse : son total, pour le budget courses (Plus). ticketOff : « Compter dans mon budget » décoché */
  ticket: Receipt | null;
  ticketOff: boolean;
  /** Frigia Plus : frigo vide, des plats quand même (sans ingrédient) */
  empty: boolean;
  /** Pas de photo lue (« Que cuisiner avec ? », ingrédients tapés) : Ma cuisine les ajoute sans rien remplacer */
  merge: boolean;
  /** « Dans tes placards ? » : les pastilles cochées (null : pas encore touchées, d'après Ma cuisine et la dernière fois) */
  sides: string[] | null;
  /** « Envie de » : une ou plusieurs (aucune : pas de contrainte) */
  envies: Envie[];
  /** « Zéro course » : des recettes avec seulement le frigo et les placards, rien à acheter */
  noShop: boolean;
  /** Formule Gratuit : « Pour combien ? » */
  servings: number;
  /** Frigia Plus : les invités, comptés comme des adultes */
  guests: number;
  /** Frigia Plus : les membres du foyer qui ne mangent pas là (« Qui mange ce soir ? ») */
  away: string[];
  /** Les recettes déjà créées pour ces choix : revenir sur le menu les rouvre sans refaire de scan */
  made: { key: string; id: string } | null;
};

const SERVINGS_KEY = "frigia_servings";
/** Invités (et personnes en Gratuit) : un plafond large, pour garder des quantités sensées (l'API accepte 60 portions) */
export const MAX_GUESTS = 50;
const savedServings = () => {
  try { const n = Number(localStorage.getItem(SERVINGS_KEY)); return n >= 1 && n <= MAX_GUESTS ? n : 4; } catch { return 4; }
};

let state: ScanState = {
  meal: "s", menu: "plats", source: "frigo", switched: null, photo: null, pick: null, pending: null, ingredients: [], token: null, ticket: null, ticketOff: false, problem: "floue", empty: false, merge: false,
  sides: null, envies: ["rapide"], noShop: false, servings: savedServings(), guests: 0, away: [], made: null,
};
const listeners = new Set<() => void>();

export function setScan(patch: Partial<ScanState>) {
  if (patch.photo !== undefined && state.photo && patch.photo !== state.photo) URL.revokeObjectURL(state.photo);
  if (patch.servings !== undefined) { try { localStorage.setItem(SERVINGS_KEY, String(patch.servings)); } catch { /* navigation privée */ } }
  state = { ...state, ...patch };
  listeners.forEach(l => l());
}

export const getScan = () => state;

export function useScan(): ScanState {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => state,
  );
}

/** Ce qui fait les recettes : mêmes choix, mêmes recettes (made). */
export const madeKey = (s: ScanState) => JSON.stringify([s.ingredients.map(i => [i.name, i.qty, !!i.finish]), s.menu, s.meal, s.envies, s.noShop,
  s.sides, s.empty, s.servings, s.guests, s.away]);

/** « Ce midi », « ce soir », « la semaine » dans les phrases. */
export const MEAL_WORDS: Record<Meal, { pour: string; qui: string; feat: string }> = {
  m: { pour: "pour ce midi", qui: "Qui mange ce midi ?", feat: "Idéal ce midi" },
  s: { pour: "pour ce soir", qui: "Qui mange ce soir ?", feat: "Idéal ce soir" },
  w: { pour: "pour la semaine", qui: "Qui mange cette semaine ?", feat: "À cuisiner en premier" },
  d: { pour: "pour le dessert", qui: "Qui prend un dessert ?", feat: "Idéal en dessert" },
};

/** « Dans tes placards ? » : ce qu'on a presque toujours, en pastilles [nom envoyé, nom affiché]. Les plats : les
 *  accompagnements ; les desserts : de quoi pâtisser. Demandé par Hugo le 22 octobre, à la place de « Inclure mes placards ». */
const SIDES_PLATS: [string, string][] = [["Pâtes", "Pâtes"], ["Riz", "Riz"], ["Pommes de terre", "Patates"], ["Semoule", "Semoule"],
  ["Pain", "Pain"], ["Quinoa", "Quinoa"], ["Lentilles", "Lentilles"]];
const SIDES_DESSERTS: [string, string][] = [["Farine", "Farine"], ["Sucre", "Sucre"], ["Chocolat", "Chocolat"], ["Levure chimique", "Levure"],
  ["Flocons d'avoine", "Avoine"], ["Poudre d'amande", "Amandes"], ["Miel", "Miel"]];
const SIDES_KEY = "frigia_sides";
const savedSides = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(SIDES_KEY) || "[]"); return Array.isArray(v) ? v.filter(x => typeof x === "string") : []; } catch { return []; }
};
/** Les pastilles du menu : six au plus, sans ce que la liste a déjà */
export const sideChoices = (s: ScanState): [string, string][] =>
  (s.menu === "desserts" ? SIDES_DESSERTS : SIDES_PLATS).filter(([n]) => !s.ingredients.some(i => same(i.name, n))).slice(0, 6);
/** Les pastilles cochées : celles touchées, sinon ce que Ma cuisine range aux placards et ce qui était coché la dernière fois */
export function sidesOf(kitchen: Fridge, s: ScanState): string[] {
  const choices = sideChoices(s).map(([n]) => n);
  if (s.sides) return choices.filter(n => s.sides!.some(x => same(x, n)));
  const had = [...pantryOf(kitchen).map(x => x.name), ...savedSides()];
  return choices.filter(n => had.some(x => same(x, n)));
}
export function toggleSide(kitchen: Fridge, s: ScanState, name: string) {
  const on = sidesOf(kitchen, s);
  const next = on.some(x => same(x, name)) ? on.filter(x => !same(x, name)) : [...on, name];
  // Hors du menu affiché, les choix d'avant restent (passer aux desserts n'oublie pas le riz)
  const keep = (s.sides ?? savedSides()).filter(x => !sideChoices(s).some(([n]) => same(n, x)));
  try { localStorage.setItem(SIDES_KEY, JSON.stringify([...keep, ...next])); } catch { /* navigation privée */ }
  setScan({ sides: [...keep, ...next] });
}

/** Les placards qui partent avec les ingrédients : Ma cuisine, et les pastilles de « Dans tes placards ? ».
 *  Une pastille décochée retire ce produit, même rangé aux placards. Le reste des placards de Ma cuisine part aussi.
 *  Un scan des placards les montre déjà (et remplace les anciens) : rien de plus. Frigo vide : toujours inclus. */
export function pantryFor(kitchen: Fridge, s: ScanState, list: { name: string }[] = s.ingredients): { name: string; qty: string }[] {
  if (s.empty) return pantryOf(kitchen, list);
  if (s.source === "placard") return [];
  const choices = sideChoices(s).map(([n]) => n), on = sidesOf(kitchen, s);
  const rest = pantryOf(kitchen, list).filter(x => !choices.some(n => same(n, x.name)) || on.some(n => same(n, x.name)));
  const added = on.filter(n => !rest.some(x => same(x.name, n)) && !list.some(w => same(w.name, n))).map(name => ({ name, qty: "" }));
  return [...rest, ...added];
}
