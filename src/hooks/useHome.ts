// Le foyer, la semaine et la liste de courses de la personne connectée.
// Chaque changement est gardé tout de suite sur le téléphone, puis envoyé sur le compte (regroupé, une fois par demi-seconde).
import { useCallback, useEffect, useRef, useState } from "react";
import { cachePart, EMPTY_HOME, type Home, loadHome, type Part, sendPart } from "../lib/home";

export type Update<T> = T | ((prev: T) => T);

export function useHome(userId: string | undefined) {
  const [home, setHome] = useState<Home>(EMPTY_HOME);
  const timers = useRef<Partial<Record<Part, ReturnType<typeof setTimeout>>>>({});

  const load = useCallback((id: string) => loadHome(id, setHome, setHome), []);
  const clear = useCallback(() => setHome(EMPTY_HOME), []);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const set = useCallback(<P extends Part>(part: P, update: Update<Home[P]>) => {
    setHome(prev => {
      const value = typeof update === "function" ? (update as (p: Home[P]) => Home[P])(prev[part]) : update;
      if (value === prev[part]) return prev;
      if (userId) {
        cachePart(userId, part, value);
        clearTimeout(timers.current[part]);
        timers.current[part] = setTimeout(() => void sendPart(userId, part, value), 500);
      }
      return { ...prev, [part]: value };
    });
  }, [userId]);

  return {
    ...home, load, clear,
    setMembers: (u: Update<Home["members"]>) => set("members", u),
    setWeek: (u: Update<Home["week"]>) => set("week", u),
    setShopping: (u: Update<Home["shopping"]>) => set("shopping", u),
  };
}
