// Le scan en cours, d'un écran à l'autre : la photo, les ingrédients vérifiés, les envies et les portions.
// Gardé en mémoire le temps de la visite (un rechargement repart de la caméra).
import { useSyncExternalStore } from "react";
import type { Envie, ScanIngredient, ScanSource } from "../../lib/scan";
import type { Meal } from "../../lib/types";
import type { Fridge } from "../../lib/home";
import { pantryOf } from "../../lib/fridge";

export type ScanState = {
  meal: Meal;
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
  /** Frigia Plus : frigo vide, des plats quand même (sans ingrédient) */
  empty: boolean;
  /** Pas de photo lue (« Que cuisiner avec ? », ingrédients tapés) : Ma cuisine les ajoute sans rien remplacer */
  merge: boolean;
  /** « Inclure mes placards » : ce que Ma cuisine range aux placards part avec la liste */
  pantry: boolean;
  envie: Envie;
  /** Formule Gratuit : « Pour combien ? » */
  servings: number;
  /** Frigia Plus : les invités, comptés comme des adultes */
  guests: number;
  /** Frigia Plus : les membres du foyer qui ne mangent pas là (« Qui mange ce soir ? ») */
  away: string[];
};

const SERVINGS_KEY = "frigia_servings";
/** Invités (et personnes en Gratuit) : un plafond large, pour garder des quantités sensées (l'API accepte 60 portions) */
export const MAX_GUESTS = 50;
const savedServings = () => {
  try { const n = Number(localStorage.getItem(SERVINGS_KEY)); return n >= 1 && n <= MAX_GUESTS ? n : 4; } catch { return 4; }
};

let state: ScanState = {
  meal: "s", source: "frigo", switched: null, photo: null, pick: null, pending: null, ingredients: [], token: null, problem: "floue", empty: false, merge: false,
  pantry: true, envie: "rapide", servings: savedServings(), guests: 0, away: [],
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

/** « Ce midi », « ce soir », « la semaine » dans les phrases. */
export const MEAL_WORDS: Record<Meal, { pour: string; qui: string; feat: string }> = {
  m: { pour: "pour ce midi", qui: "Qui mange ce midi ?", feat: "Idéal ce midi" },
  s: { pour: "pour ce soir", qui: "Qui mange ce soir ?", feat: "Idéal ce soir" },
  w: { pour: "pour la semaine", qui: "Qui mange cette semaine ?", feat: "À cuisiner en premier" },
  d: { pour: "pour le dessert", qui: "Qui prend un dessert ?", feat: "Idéal en dessert" },
};

/** Les placards qui partent avec les ingrédients : rien d'inventé, seulement Ma cuisine.
 *  Un scan des placards les montre déjà (et remplace les anciens) : rien de plus. Frigo vide : toujours inclus. */
export function pantryFor(kitchen: Fridge, s: ScanState, list: { name: string }[] = s.ingredients): { name: string; qty: string }[] {
  if (s.empty) return pantryOf(kitchen, list);
  if (s.source === "placard" || !s.pantry) return [];
  return pantryOf(kitchen, list);
}
