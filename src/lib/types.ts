// Types partagés de l'appli : ingrédients, recettes, scans.
import type { User } from "@supabase/supabase-js";

export type { User };
export type RecipeIngredient = { name: string; qty: string };
export type DetectedIngredient = { name: string; icon: string; conf: number };
export type GeneratedRecipe = {
  emoji: string;
  title: string;
  time: string;
  cal: number;
  diff: string;
  imageSearch?: string;
  steps?: string[];
  recipeIngredients?: RecipeIngredient[];
};
export type HistoryEntry = {
  id: string;
  date: Date;
  ingredients: DetectedIngredient[];
  recipes: GeneratedRecipe[];
  servings: number;
};
/** Réponses du questionnaire (objectif, régime, temps, équipement). */
export type Prefs = { goal: string; diet: string[]; time: string; equipment: string[] };
