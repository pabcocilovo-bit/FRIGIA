// Repas cuisinés de la personne connectée.
import { useCallback, useState } from "react";
import { type CookedMeal, dbInsertCooked, loadCooked, setCachedCooked } from "../lib/cooked";

export function useCooked(userId: string | undefined) {
  const [meals, setMeals] = useState<CookedMeal[]>([]);

  const load = useCallback((id: string) => loadCooked(id, setMeals, setMeals), []);
  const clear = useCallback(() => setMeals([]), []);

  /** « J'ai cuisiné ça » */
  const add = (m: Omit<CookedMeal, "id" | "date">) => {
    const meal: CookedMeal = { ...m, id: crypto.randomUUID(), date: new Date(), pending: true };
    setMeals(prev => {
      const next = [meal, ...prev];
      if (userId) setCachedCooked(userId, next);
      return next;
    });
    if (!userId) return;
    void dbInsertCooked(userId, meal).then(ok => {
      if (!ok) return;
      setMeals(prev => {
        const next = prev.map(x => (x.id === meal.id ? { ...x, pending: false } : x));
        setCachedCooked(userId, next);
        return next;
      });
    });
  };

  return { meals, load, clear, add };
}
