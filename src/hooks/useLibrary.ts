// Historique des scans et favoris de la personne connectée.
import { useCallback, useState } from "react";
import type { GeneratedRecipe, HistoryEntry } from "../lib/types";
import {
  MAX_FAVORITES, MAX_HISTORY, dbDeleteFavorite, dbDeleteHistoryEntry, dbInsertFavorite, dbInsertHistoryEntry, dbUpdateHistoryRecipes,
  loadLibrary, setCachedFavorites, setCachedHistory,
} from "../lib/library";

export function useLibrary(userId: string | undefined) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<GeneratedRecipe[]>([]);

  const load = useCallback((id: string) => loadLibrary(
    id,
    (h, f) => { setHistory(h); setFavorites(f); },
    (lists) => {
      if (lists.history) setHistory(lists.history);
      if (lists.favorites) setFavorites(lists.favorites);
    },
  ), []);

  const clear = useCallback(() => { setHistory([]); setFavorites([]); }, []);

  const toggleFavorite = (recipe: GeneratedRecipe) => {
    setFavorites(prev => {
      const isFav = prev.some(f => f.title === recipe.title);
      if (isFav) {
        const next = prev.filter(f => f.title !== recipe.title);
        if (userId) { setCachedFavorites(userId, next); dbDeleteFavorite(userId, recipe.title); }
        return next;
      }
      const full = [recipe, ...prev];
      const evicted = full.slice(MAX_FAVORITES);
      const next = full.slice(0, MAX_FAVORITES);
      if (userId) {
        setCachedFavorites(userId, next);
        dbInsertFavorite(userId, recipe);
        evicted.forEach(e => dbDeleteFavorite(userId, e.title));
      }
      return next;
    });
  };

  const isFavorite = (recipe: GeneratedRecipe) => favorites.some(f => f.title === recipe.title);

  /** Ajoute un scan en tête de l'historique (50 au plus). */
  const addScan = (entry: HistoryEntry) => {
    const full = [entry, ...history];
    const evicted = full.slice(MAX_HISTORY);
    const next = full.slice(0, MAX_HISTORY);
    setHistory(next);
    if (userId) {
      setCachedHistory(userId, next);
      dbInsertHistoryEntry(userId, entry);
      evicted.forEach(e => dbDeleteHistoryEntry(e.id));
    }
  };

  /** Remplace les recettes d'un scan (« D'autres idées »). */
  const updateScanRecipes = (entryId: string, recipes: GeneratedRecipe[]) => {
    setHistory(prev => {
      const next = prev.map(e => (e.id === entryId ? { ...e, recipes } : e));
      if (userId) { setCachedHistory(userId, next); dbUpdateHistoryRecipes(entryId, recipes); }
      return next;
    });
  };

  const deleteScan = (entryId: string) => {
    setHistory((prev) => {
      const next = prev.filter((entry) => entry.id !== entryId);
      if (userId) {
        setCachedHistory(userId, next);
        dbDeleteHistoryEntry(entryId);
      }
      return next;
    });
  };

  return { history, favorites, load, clear, toggleFavorite, isFavorite, addScan, updateScanRecipes, deleteScan };
}
