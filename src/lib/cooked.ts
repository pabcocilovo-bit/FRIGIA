// Repas cuisinés (« J'ai cuisiné ça ») : copie sur le téléphone + table Supabase cooked_meals.
// Sans la table (migration 20261016000000_cooked_meals.sql pas encore lancée), les repas restent sur le téléphone
// et partent sur le compte au prochain chargement qui réussit.
import { supabase } from "../supabase";

export type CookedMeal = {
  id: string;
  /** Le scan d'où vient la recette, s'il y en a un */
  scanId: string | null;
  title: string;
  image: string | null;
  servings: number;
  kg: number;
  eur: number;
  date: Date;
  /** Pas encore sur le compte */
  pending?: boolean;
};

type Row = { id: string; scan_id: string | null; recipe_title: string; recipe_image: string | null; servings: number; kg: number | string; eur: number | string; cooked_at: string };
type Stored = Omit<CookedMeal, "date"> & { date: string };

const key = (userId: string) => `frigia_cooked_${userId}`;

export function getCachedCooked(userId: string): CookedMeal[] {
  try {
    return (JSON.parse(localStorage.getItem(key(userId)) || "[]") as Stored[]).map(m => ({ ...m, date: new Date(m.date) }));
  } catch { return []; }
}
export function setCachedCooked(userId: string, meals: CookedMeal[]) {
  try { localStorage.setItem(key(userId), JSON.stringify(meals)); } catch { /* navigation privée */ }
}

const fromRow = (r: Row): CookedMeal => ({
  id: r.id, scanId: r.scan_id, title: r.recipe_title, image: r.recipe_image, servings: r.servings,
  kg: Number(r.kg), eur: Number(r.eur), date: new Date(r.cooked_at),
});

/** undefined : la table ne répond pas (pas encore créée, hors ligne). */
async function fetchCooked(userId: string): Promise<CookedMeal[] | undefined> {
  const { data, error } = await supabase.from("cooked_meals").select("*").eq("user_id", userId).order("cooked_at", { ascending: false });
  return error || !data ? undefined : (data as Row[]).map(fromRow);
}

/** true : le repas est sur le compte. */
export async function dbInsertCooked(userId: string, m: CookedMeal): Promise<boolean> {
  const { error } = await supabase.from("cooked_meals").insert({
    id: m.id, user_id: userId, scan_id: m.scanId, recipe_title: m.title, recipe_image: m.image,
    servings: m.servings, kg: m.kg, eur: m.eur, cooked_at: m.date.toISOString(),
  });
  return !error;
}

/** La copie du téléphone d'abord (onCached), puis le compte (onLoaded), avec les repas pas encore envoyés. */
export async function loadCooked(userId: string, onCached: (m: CookedMeal[]) => void, onLoaded: (m: CookedMeal[]) => void) {
  const cached = getCachedCooked(userId);
  onCached(cached);
  const remote = await fetchCooked(userId);
  if (!remote) return;
  const pending = cached.filter(m => m.pending && !remote.some(r => r.id === m.id));
  const sent = await Promise.all(pending.map(m => dbInsertCooked(userId, m)));
  const merged = [...pending.map((m, i) => ({ ...m, pending: !sent[i] })), ...remote]
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  setCachedCooked(userId, merged);
  onLoaded(merged);
}

/** Total d'une liste de repas */
export const totalSaved = (meals: CookedMeal[]) => meals.reduce(
  (t, m) => ({ kg: t.kg + m.kg, eur: t.eur + m.eur }), { kg: 0, eur: 0 });

/** Les repas du mois en cours */
export const thisMonth = (meals: CookedMeal[], now = new Date()) =>
  meals.filter(m => m.date.getFullYear() === now.getFullYear() && m.date.getMonth() === now.getMonth());
