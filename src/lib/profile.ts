// Profil du compte (table profiles) : prénom et goûts. Une copie reste dans le téléphone
// pour s'ouvrir tout de suite et marcher sans réseau.
import { supabase } from "../supabase";
import type { Prefs } from "./types";

export type Profile = {
  first_name: string | null;
  goals: string[];
  diet: string[];
  allergies: string[];
  weeknight_time: string | null;
  equipment: string[];
};

export const EMPTY_PROFILE: Profile = { first_name: null, goals: [], diet: ["tout"], allergies: [], weeknight_time: null, equipment: [] };

const cacheKey = (userId: string) => `frigia_profile_${userId}`;

export function getCachedProfile(userId: string): Profile | null {
  try { return JSON.parse(localStorage.getItem(cacheKey(userId)) || "null"); } catch { return null; }
}
const setCachedProfile = (userId: string, p: Profile) => localStorage.setItem(cacheKey(userId), JSON.stringify(p));

/** Profil enregistré sur le compte. null : pas encore de profil ; undefined : la base n'a pas répondu. */
export async function fetchProfile(userId: string): Promise<Profile | null | undefined> {
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, goals, diet, allergies, weeknight_time, equipment")
    .eq("id", userId)
    .maybeSingle();
  if (error) return undefined;
  if (data) setCachedProfile(userId, data as Profile);
  return (data as Profile | null) ?? null;
}

/** Enregistre le profil sur le compte (et dans le téléphone). Renvoie false si la base n'a pas pu l'enregistrer. */
export async function saveProfile(userId: string, p: Profile): Promise<boolean> {
  setCachedProfile(userId, p);
  // Seulement le prénom et les goûts : les compteurs de scans ne s'écrivent que côté serveur
  const { first_name, goals, diet, allergies, weeknight_time, equipment } = p;
  const { error } = await supabase.from("profiles").upsert({
    id: userId, first_name, goals, diet, allergies, weeknight_time, equipment, updated_at: new Date().toISOString(),
  });
  return !error;
}

/** Goûts de l'ancien questionnaire (gardés dans le téléphone) traduits vers le profil. */
export function fromOldPrefs(prefs: Prefs, firstName: string | null): Profile {
  const goals: Record<string, string> = { healthy: "sain", nogaspi: "gaspi", quick: "temps" };
  const diets: Record<string, string> = { all: "tout", veggie: "vege", vegan: "vegan", glutenfree: "gluten" };
  const times: Record<string, string> = { "15min": "15", "30min": "30", any: "any" };
  const equipment: Record<string, string> = { airfryer: "airfryer", thermomix: "Thermomix", moulinex: "Moulinex" };
  const diet = prefs.diet.map(d => diets[d]).filter(Boolean);
  return {
    first_name: firstName,
    goals: goals[prefs.goal] ? [goals[prefs.goal]] : [],
    diet: diet.length ? diet : ["tout"],
    allergies: [],
    weeknight_time: times[prefs.time] ?? null,
    equipment: prefs.equipment.map(e => equipment[e]).filter(Boolean),
  };
}

/** Ce que l'analyse du frigo reçoit pour adapter les recettes. */
export const apiPrefs = (p: Profile | null) => p && ({
  goals: p.goals, diet: p.diet, allergies: p.allergies, time: p.weeknight_time ?? undefined, equipment: p.equipment,
});

// Réponses données avant la création du compte : gardées le temps de l'inscription (et du passage par Google)
const PENDING = "frigia_pending_profile";
export const setPendingProfile = (p: Profile) => localStorage.setItem(PENDING, JSON.stringify(p));
export const hasPendingProfile = () => !!localStorage.getItem(PENDING);
export const clearPendingProfile = () => localStorage.removeItem(PENDING);
export function takePendingProfile(): Profile | null {
  try { return JSON.parse(localStorage.getItem(PENDING) || "null"); } catch { return null; } finally { clearPendingProfile(); }
}
