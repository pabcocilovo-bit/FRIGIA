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
  /** Photo à recadrer (prise ou choisie dans la galerie) */
  pick: Blob | null;
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
  /** « Tes placards » : ce qui est rangé aux placards dans Ma cuisine mais décoché pour ces recettes (fini, ou pas envie) */
  off: string[];
  /** « Scanner mes placards » depuis « Tes placards » : la photo s'ajoute aux placards de Ma cuisine, puis on y revient */
  forPlacards: boolean;
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
  off: [], forPlacards: false, envies: ["rapide"], noShop: false, servings: savedServings(), guests: 0, away: [], made: null,
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
  s.off, s.empty, s.servings, s.guests, s.away]);

/** « Ce midi », « ce soir », « la semaine » dans les phrases. */
export const MEAL_WORDS: Record<Meal, { pour: string; qui: string; feat: string }> = {
  m: { pour: "pour ce midi", qui: "Qui mange ce midi ?", feat: "Idéal ce midi" },
  s: { pour: "pour ce soir", qui: "Qui mange ce soir ?", feat: "Idéal ce soir" },
  w: { pour: "pour la semaine", qui: "Qui mange cette semaine ?", feat: "À cuisiner en premier" },
  d: { pour: "pour le dessert", qui: "Qui prend un dessert ?", feat: "Idéal en dessert" },
};

/** « Tes placards » : ce qu'on a presque toujours, en pastilles « + Riz » [nom rangé dans Ma cuisine, nom affiché]. Les plats :
 *  les accompagnements ; les desserts : de quoi pâtisser. Demandé par Hugo les 22 et 23 octobre (une étape à part). */
const IDEAS_PLATS: [string, string][] = [["Pâtes", "Pâtes"], ["Riz", "Riz"], ["Pommes de terre", "Pommes de terre"], ["Semoule", "Semoule"],
  ["Pain", "Pain"], ["Quinoa", "Quinoa"], ["Lentilles", "Lentilles"], ["Huile d'olive", "Huile d'olive"], ["Tomates en conserve", "Tomates en conserve"]];
const IDEAS_DESSERTS: [string, string][] = [["Farine", "Farine"], ["Sucre", "Sucre"], ["Chocolat", "Chocolat"], ["Levure chimique", "Levure"],
  ["Flocons d'avoine", "Flocons d'avoine"], ["Poudre d'amande", "Poudre d'amande"], ["Miel", "Miel"]];
/** Les pastilles à ajouter : selon le menu (des desserts dedans : de quoi pâtisser aussi), sans ce qui est déjà aux placards ou dans la liste */
export function placardIdeas(kitchen: Fridge, s: ScanState): [string, string][] {
  const m = menuOf(s.menu);
  const list = m.desserts === m.n ? IDEAS_DESSERTS : m.desserts ? [...IDEAS_PLATS.slice(0, 5), ...IDEAS_DESSERTS.slice(0, 4)] : IDEAS_PLATS;
  const have = [...pantryOf(kitchen).map(x => x.name), ...s.ingredients.map(i => i.name)];
  return list.filter(([n]) => !have.some(h => same(h, n))).slice(0, 8);
}
/** L'étape « Tes placards » : pas après un scan des placards (ils sont déjà dans la liste), ni frigo vide (tous partent) */
export const placardStep = (s: ScanState) => s.source !== "placard" && !(s.empty && !s.ingredients.length);

/** Les placards qui partent avec les ingrédients : ce que Ma cuisine range aux placards, moins ce qui est décoché
 *  dans « Tes placards ». Un scan des placards les montre déjà : rien de plus. Frigo vide : tous. */
export function pantryFor(kitchen: Fridge, s: ScanState, list: { name: string }[] = s.ingredients): { name: string; qty: string }[] {
  if (s.empty) return pantryOf(kitchen, list);
  if (s.source === "placard") return [];
  return pantryOf(kitchen, list).filter(x => !s.off.some(o => same(o, x.name)));
}
