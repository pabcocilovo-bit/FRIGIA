// Repas cuisinés (« J'ai cuisiné ça ») : copie sur le téléphone + table Supabase cooked_meals.
// Deux chiffres par repas : sauvé (kg, eur : ce qui était « À finir ») et cuisiné de ton frigo (used_kg, used_eur).
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
  /** Sauvé : les produits frais marqués « À finir » au scan */
  kg: number;
  eur: number;
  /** Cuisiné de ton frigo : tous les produits frais déjà là */
  usedKg: number;
  usedEur: number;
  date: Date;
  /** Pas encore sur le compte */
  pending?: boolean;
};

type Row = {
  id: string; scan_id: string | null; recipe_title: string; recipe_image: string | null; servings: number;
  kg: number | string; eur: number | string; used_kg?: number | string | null; used_eur?: number | string | null; cooked_at: string;
};
type Stored = Omit<CookedMeal, "date"> & { date: string };

const key = (userId: string) => `frigia_cooked_${userId}`;

export function getCachedCooked(userId: string): CookedMeal[] {
  try {
    // Repas gardés avant les deux chiffres : pas de « cuisiné »
  return (JSON.parse(localStorage.getItem(key(userId)) || "[]") as Stored[]).map(m => ({ ...m, usedKg: m.usedKg ?? 0, usedEur: m.usedEur ?? 0, date: new Date(m.date) }));
  } catch { return []; }
}
export function setCachedCooked(userId: string, meals: CookedMeal[]) {
  try { localStorage.setItem(key(userId), JSON.stringify(meals)); } catch { /* navigation privée */ }
}

const fromRow = (r: Row): CookedMeal => ({
  id: r.id, scanId: r.scan_id, title: r.recipe_title, image: r.recipe_image, servings: r.servings,
  kg: Number(r.kg), eur: Number(r.eur), usedKg: Number(r.used_kg ?? 0), usedEur: Number(r.used_eur ?? 0), date: new Date(r.cooked_at),
});

/** undefined : la table ne répond pas (pas encore créée, hors ligne). */
async function fetchCooked(userId: string): Promise<CookedMeal[] | undefined> {
  const { data, error } = await supabase.from("cooked_meals").select("*").eq("user_id", userId).order("cooked_at", { ascending: false });
  return error || !data ? undefined : (data as Row[]).map(fromRow);
}

/** true : le repas est sur le compte. */
export async function dbInsertCooked(userId: string, m: CookedMeal): Promise<boolean> {
  const row = {
    id: m.id, user_id: userId, scan_id: m.scanId, recipe_title: m.title, recipe_image: m.image,
    servings: m.servings, kg: m.kg, eur: m.eur, cooked_at: m.date.toISOString(),
  };
  const { error } = await supabase.from("cooked_meals").insert({ ...row, used_kg: m.usedKg, used_eur: m.usedEur });
  if (!error) return true;
  // Colonnes used_kg / used_eur pas encore ajoutées (migration 20261017000000) : le repas est gardé sans elles
  return !(await supabase.from("cooked_meals").insert(row)).error;
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

/** Totaux d'une liste de repas : sauvé (kg, eur) et cuisiné de ton frigo (usedKg, usedEur) */
export const totalSaved = (meals: CookedMeal[]) => meals.reduce(
  (t, m) => ({ kg: t.kg + m.kg, eur: t.eur + m.eur, usedKg: t.usedKg + m.usedKg, usedEur: t.usedEur + m.usedEur }),
  { kg: 0, eur: 0, usedKg: 0, usedEur: 0 });

/** Les repas du mois en cours */
export const thisMonth = (meals: CookedMeal[], now = new Date()) =>
  meals.filter(m => m.date.getFullYear() === now.getFullYear() && m.date.getMonth() === now.getMonth());
