// Scan du frigo : compression de la photo et appel à /api/analyze.
import { supabase } from "../supabase";
import type { DetectedIngredient, GeneratedRecipe } from "./types";
import { apiPrefs, getCachedProfile } from "./profile";
import { recentRecipeTitles } from "./library";
import { ingredientIcon, recipeIcon } from "./recipes";

/** Réduit la photo à 1200 px de côté au plus, en JPEG. */
export function compressImage(f: File): Promise<{ base64: string; type: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      resolve({ base64: dataUrl.split(",")[1], type: "image/jpeg" });
    };
    img.src = objectUrl;
  });
}

type RawIngredient = { name?: unknown; confidence?: unknown };
type RawRecipeIngredient = { name?: unknown; qty?: unknown };
type RawRecipe = {
  title?: unknown; time?: unknown; calories?: unknown; difficulty?: unknown;
  imageUrl?: unknown; imageSearch?: unknown; steps?: unknown; ingredients?: unknown;
};

export type ScanResult =
  | { status: "ok"; ingredients: DetectedIngredient[]; recipes: GeneratedRecipe[] }
  | { status: "signed-out" }        // 401 : la session n'est plus valable, on a déconnecté
  | { status: "session-refreshed" }; // 403 : accès refusé, on a rafraîchi la session (le mur de paiement suit)

/**
 * Envoie la photo à l'IA avec les goûts du compte et les dernières recettes proposées.
 * Lève une erreur « unclear_photo » si l'analyse échoue.
 */
export async function analyzeFridge(file: File, mealType: string): Promise<ScanResult> {
  const { base64: imageBase64, type: mediaType } = await compressImage(file);
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  const prefs = userId ? apiPrefs(getCachedProfile(userId)) : null;
  const recentTitles = userId ? recentRecipeTitles(userId) : [];
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
    body: JSON.stringify({ imageBase64, mediaType, prefs, recentTitles, mealType }),
  });
  const data = await response.json();
  if (response.status === 401) {
    await supabase.auth.signOut();
    return { status: "signed-out" };
  }
  if (response.status === 403) {
    await supabase.auth.refreshSession();
    return { status: "session-refreshed" };
  }
  if (!response.ok) throw new Error("unclear_photo");
  const ingredients: DetectedIngredient[] = ((data.ingredients || []) as RawIngredient[]).map((i) => ({
    name: String(i.name || "Aliment"),
    icon: ingredientIcon(String(i.name || "")),
    conf: Number(i.confidence) || 90,
  }));
  const recipes: GeneratedRecipe[] = ((data.recipes || []) as RawRecipe[]).map((r) => ({
    emoji: recipeIcon(String(r.title || "")),
    title: String(r.title || "Recette"),
    time: String(r.time || "15 min"),
    cal: Number(r.calories) || 350,
    diff: String(r.difficulty || "Facile"),
    imageSearch: String(r.imageUrl || r.imageSearch || r.title || ""),
    steps: Array.isArray(r.steps) ? r.steps.map(String) : undefined,
    recipeIngredients: Array.isArray(r.ingredients)
      ? (r.ingredients as RawRecipeIngredient[]).map((i) => ({
          name: String(i.name || ""),
          qty: String(i.qty || "1"),
        }))
      : undefined,
  }));
  return { status: "ok", ingredients, recipes };
}
