// Types partagés de l'appli : ingrédients, recettes, scans.
import type { User } from "@supabase/supabase-js";

export type { User };
export type RecipeIngredient = { name: string; qty: string };
/** finish : « À finir » au scan, à cuisiner vite. Cuisiné, il compte comme nourriture sauvée. */
export type DetectedIngredient = { name: string; icon: string; conf: number; qty?: string; finish?: boolean };
/** Ingrédient d'une recette du nouveau scan : la quantité est un nombre, recalculé selon les portions. */
export type RecipeItem = { name: string; plural: string; qty: number | null; unit: string; have: boolean };
export type StepTimer = { label: string; min: number };
export type GeneratedRecipe = {
  emoji: string;
  title: string;
  time: string;
  cal: number;
  diff: string;
  imageSearch?: string;
  steps?: string[];
  recipeIngredients?: RecipeIngredient[];
  // Scan en deux temps (prototype V3). Les anciennes recettes ne les ont pas.
  intro?: string;
  minutes?: number;
  veg?: boolean;
  oven?: boolean;
  cold?: boolean;
  /** Ce qu'il faut acheter, avec l'article : « le parmesan et le basilic » */
  missing?: string;
  /** Portions pour lesquelles les quantités de items sont données */
  serves?: number;
  items?: RecipeItem[];
  /** Minuteur de chaque étape (même ordre que steps), null s'il n'y en a pas */
  timers?: (StepTimer | null)[];
  /** Frigia Plus, avec des enfants à table : une recette qui plaît aux petits (« Les enfants adorent ») */
  kids?: boolean;
  /** Une spécialité d'ailleurs (« Spécialité libanaise ») ; absent pour un plat courant en France */
  origin?: string;
  /** Frigia Plus : ce que quelqu'un n'aime pas et que la recette évite (« Sans champignons ») */
  without?: string[];
  // Favori : quand il a été gardé, depuis quel scan (ou depuis le planning) et pour combien
  savedAt?: string;
  fromPlan?: boolean;
  scanDate?: string;
  savedServings?: number;
};
/** Pour quel repas : ce midi, ce soir, la semaine. */
export type Meal = "m" | "s" | "w";
export type HistoryEntry = {
  id: string;
  date: Date;
  ingredients: DetectedIngredient[];
  recipes: GeneratedRecipe[];
  servings: number;
  meal?: Meal;
};
/** Réponses du questionnaire (objectif, régime, temps, équipement). */
export type Prefs = { goal: string; diet: string[]; time: string; equipment: string[] };
