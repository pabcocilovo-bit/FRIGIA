// Historique des scans et favoris : copie sur le téléphone + tables Supabase user_history / user_favorites.
import { supabase } from "../supabase";
import type { GeneratedRecipe, HistoryEntry } from "./types";

export const MAX_HISTORY = 50;
export const MAX_FAVORITES = 100;

type HistoryRow = { id: string; scan_date: string; ingredients: HistoryEntry["ingredients"] | null; recipes: GeneratedRecipe[] | null; servings: number | null; meal?: string | null };
type StoredHistoryEntry = Omit<HistoryEntry, "date"> & { date: string };

// ─── Copie sur le téléphone ──────────────────────────────────────────────────
export function getCachedHistory(userId: string): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(`frigia_history_${userId}`);
    if (!raw) return [];
    return (JSON.parse(raw) as StoredHistoryEntry[]).map((e) => ({ ...e, date: new Date(e.date) }));
  } catch { return []; }
}
export function setCachedHistory(userId: string, history: HistoryEntry[]) {
  localStorage.setItem(`frigia_history_${userId}`, JSON.stringify(history));
}
export function getCachedFavorites(userId: string): GeneratedRecipe[] {
  try { return JSON.parse(localStorage.getItem(`frigia_favorites_${userId}`) || "[]"); } catch { return []; }
}
export function setCachedFavorites(userId: string, favorites: GeneratedRecipe[]) {
  localStorage.setItem(`frigia_favorites_${userId}`, JSON.stringify(favorites));
}

/** Titres des dernières recettes proposées, pour que l'IA ne les repropose pas. */
export const recentRecipeTitles = (userId: string, max = 15) =>
  getCachedHistory(userId).flatMap(e => e.recipes.map(r => r.title)).slice(0, max);

// ─── Supabase ────────────────────────────────────────────────────────────────
export async function loadHistoryFromSupabase(userId: string): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from("user_history")
    .select("*")
    .eq("user_id", userId)
    .order("scan_date", { ascending: false });
  if (error || !data) return [];
  return (data as HistoryRow[]).map((row) => ({
    id: row.id,
    date: new Date(row.scan_date),
    ingredients: row.ingredients || [],
    recipes: row.recipes || [],
    servings: row.servings || 2,
    meal: row.meal === "m" || row.meal === "s" || row.meal === "w" ? row.meal : undefined,
  }));
}

export async function loadFavoritesFromSupabase(userId: string): Promise<GeneratedRecipe[]> {
  const { data, error } = await supabase
    .from("user_favorites")
    .select("recipe")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as { recipe: GeneratedRecipe }[]).map((row) => row.recipe);
}

export async function dbInsertHistoryEntry(userId: string, entry: HistoryEntry) {
  const row = {
    id: entry.id,
    user_id: userId,
    scan_date: entry.date.toISOString(),
    ingredients: entry.ingredients,
    recipes: entry.recipes,
    servings: entry.servings,
  };
  const { error } = await supabase.from("user_history").insert({ ...row, meal: entry.meal ?? null });
  // Colonne meal pas encore ajoutée (migration 20261014000000_scan_meal.sql) : le scan est gardé sans le repas
  if (error) await supabase.from("user_history").insert(row);
}

/** « D'autres idées » : les recettes du scan changent. */
export async function dbUpdateHistoryRecipes(entryId: string, recipes: GeneratedRecipe[]) {
  await supabase.from("user_history").update({ recipes }).eq("id", entryId);
}

export async function dbDeleteHistoryEntry(entryId: string) {
  await supabase.from("user_history").delete().eq("id", entryId);
}

export async function dbInsertFavorite(userId: string, recipe: GeneratedRecipe) {
  await supabase.from("user_favorites").upsert(
    { user_id: userId, recipe, recipe_title: recipe.title },
    { onConflict: "user_id,recipe_title" }
  );
}

export async function dbDeleteFavorite(userId: string, recipeTitle: string) {
  await supabase.from("user_favorites").delete()
    .eq("user_id", userId)
    .eq("recipe_title", recipeTitle);
}

const isValidHistoryEntry = (e: HistoryEntry) =>
  e && typeof e.id === "string" && Array.isArray(e.ingredients) && Array.isArray(e.recipes);
const isValidRecipe = (r: GeneratedRecipe) =>
  r && typeof r.title === "string" && typeof r.time === "string";

/**
 * Charge l'historique et les favoris : d'abord la copie du téléphone (onCached), puis Supabase (onLoaded).
 * Migration unique : si Supabase est vide mais le téléphone a des données, on les envoie à Supabase.
 */
export async function loadLibrary(
  userId: string,
  onCached: (history: HistoryEntry[], favorites: GeneratedRecipe[]) => void,
  onLoaded: (lists: { history?: HistoryEntry[]; favorites?: GeneratedRecipe[] }) => void,
) {
  const cachedHist = getCachedHistory(userId);
  const cachedFavs = getCachedFavorites(userId);
  onCached(cachedHist, cachedFavs);
  const [hist, favs] = await Promise.all([
    loadHistoryFromSupabase(userId),
    loadFavoritesFromSupabase(userId),
  ]);

  if (hist.length === 0 && cachedHist.length > 0) {
    const safe = cachedHist.filter(isValidHistoryEntry).slice(0, MAX_HISTORY);
    await Promise.all(safe.map((entry) => dbInsertHistoryEntry(userId, entry)));
    setCachedHistory(userId, safe);
  } else {
    onLoaded({ history: hist });
    setCachedHistory(userId, hist);
  }
  if (favs.length === 0 && cachedFavs.length > 0) {
    const safe = cachedFavs.filter(isValidRecipe).slice(0, MAX_FAVORITES);
    await Promise.all(safe.map((recipe) => dbInsertFavorite(userId, recipe)));
    setCachedFavorites(userId, safe);
  } else {
    onLoaded({ favorites: favs });
    setCachedFavorites(userId, favs);
  }
}
