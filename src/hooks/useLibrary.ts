// Historique des scans et favoris de la personne connectée.
import { useCallback, useEffect, useRef, useState } from "react";
import type { GeneratedRecipe, HistoryEntry } from "../lib/types";
import {
  MAX_FAVORITES, MAX_HISTORY, dbDeleteFavorite, dbDeleteHistoryEntry, dbInsertFavorite, dbInsertHistoryEntry, dbUpdateHistoryRecipes,
  loadLibrary, setCachedFavorites, setCachedHistory,
} from "../lib/library";
import { restylePhotos } from "../lib/scan";

// Une photo IA (bucket recipe-images) ou une photo de l'appli (/featured) : rien à refaire
const styled = (r: GeneratedRecipe) => !r.imageSearch?.startsWith("http") || r.imageSearch.includes("/recipe-images/");

export function useLibrary(userId: string | undefined) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<GeneratedRecipe[]>([]);
  // L'historique est là (copie du téléphone ou base) : avant, la page d'un scan rechargée attend au lieu de partir à l'accueil
  const [ready, setReady] = useState(false);

  const load = useCallback((id: string) => loadLibrary(
    id,
    (h, f) => { setHistory(h); setFavorites(f); if (h.length) setReady(true); },
    (lists) => {
      if (lists.history) { setHistory(lists.history); setReady(true); }
      if (lists.favorites) setFavorites(lists.favorites);
    },
  ).finally(() => setReady(true)), []);

  const clear = useCallback(() => { setHistory([]); setFavorites([]); setReady(false); }, []);

  const toggleFavorite = (recipe: GeneratedRecipe) => {
    setFavorites(prev => {
      const isFav = prev.some(f => f.title === recipe.title);
      if (isFav) {
        const next = prev.filter(f => f.title !== recipe.title);
        if (userId) { setCachedFavorites(userId, next); dbDeleteFavorite(userId, recipe.title); }
        return next;
      }
      const full = [{ ...recipe, savedAt: recipe.savedAt ?? new Date().toISOString() }, ...prev];
      const evicted = full.slice(MAX_FAVORITES);
      const next = full.slice(0, MAX_FAVORITES);
      if (userId) {
        setCachedFavorites(userId, next);
        dbInsertFavorite(userId, full[0]);
        evicted.forEach(e => dbDeleteFavorite(userId, e.title));
      }
      return next;
    });
  };

  const isFavorite = (recipe: GeneratedRecipe) => favorites.some(f => f.title === recipe.title);

  // Les anciens scans et favoris prennent les photos IA (Hugo, 27 octobre), une fois par ouverture de l'appli :
  // les 24 plus récentes d'abord, 6 par appel ; la suite à la prochaine ouverture.
  const restyled = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || !ready || restyled.current === userId) return;
    restyled.current = userId;
    const seen = new Set<string>();
    const todo = [...history.slice(0, 10).flatMap(e => e.recipes), ...favorites.slice(0, 20)]
      .filter(r => r.title && !styled(r) && !seen.has(r.title) && !!seen.add(r.title)).slice(0, 24);
    if (!todo.length) return;
    (async () => {
      const photos: Record<string, string> = {};
      for (let i = 0; i < todo.length; i += 6) {
        Object.assign(photos, await restylePhotos(todo.slice(i, i + 6).map(r => ({ title: r.title, items: (r.items ?? []).map(x => x.name) }))));
      }
      if (!Object.keys(photos).length) return;
      const swap = (r: GeneratedRecipe) => (photos[r.title] && !styled(r) ? { ...r, imageSearch: photos[r.title] } : r);
      setHistory(prev => {
        const next = prev.map(e => (e.recipes.some(r => photos[r.title] && !styled(r)) ? { ...e, recipes: e.recipes.map(swap) } : e));
        setCachedHistory(userId, next);
        next.forEach((e, i) => { if (e !== prev[i]) dbUpdateHistoryRecipes(e.id, e.recipes); });
        return next;
      });
      setFavorites(prev => {
        const next = prev.map(swap);
        setCachedFavorites(userId, next);
        next.forEach((f, i) => { if (f !== prev[i]) dbInsertFavorite(userId, f); });
        return next;
      });
    })();
  }, [userId, ready, history, favorites]);

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

  return { history, favorites, ready, load, clear, toggleFavorite, isFavorite, addScan, updateScanRecipes, deleteScan };
}
