// Scan du frigo en deux temps : la photo devient des ingrédients (/api/ingredients), puis des recettes (/api/recipes).
import { supabase } from "../supabase";
import type { DetectedIngredient, GeneratedRecipe, Meal } from "./types";
import type { ApiEater } from "./household";
import { apiPrefs, getCachedProfile } from "./profile";
import { recentRecipeTitles } from "./library";
import { ingredientIcon, recipeIcon } from "./recipes";

/** Réduit la photo à 1200 px de côté au plus, en JPEG. */
export function compressImage(f: Blob): Promise<{ base64: string; type: string }> {
  return new Promise((resolve, reject) => {
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
    // Format que le navigateur ne sait pas lire : la photo est illisible
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("unreadable")); };
    img.src = objectUrl;
  });
}

/** La limite du serveur (api/_ai.ts) : 5 scans par heure. */
export const RATE_TEXT = "Tu as fait 5 scans cette heure-ci. Réessaie un peu plus tard.";

export type ScanSource = "frigo" | "placard" | "ticket";
export type Envie = "rapide" | "healthy" | "proteine" | "gourmand" | "enfants" | "gaspi";
/** Ingrédient de « C'est bien ça ? » : trouvé sur la photo (avec sa place), ou ajouté à la main. */
/** finish : marqué « À finir » sur « C'est bien ça ? » */
export type ScanIngredient = { name: string; qty: string; x?: number; y?: number; finish?: boolean };
type Problem = "floue" | "sombre" | "vide";

type Failure =
  | { status: "signed-out" }        // 401 : la session n'est plus valable, on a déconnecté
  | { status: "quota" }             // 403 : les 15 scans gratuits sont utilisés
  | { status: "error"; rate?: boolean; /** Pas de recette possible avec ces ingrédients : la phrase à montrer */ message?: string }; // le service ne répond pas (ou trop de scans cette heure-ci)

export type IngredientsResult =
  | { status: "ok"; ingredients: ScanIngredient[]; token: string | null; scansLeft: number | null; /** La photo montre autre chose que le mode choisi */ seen?: ScanSource }
  | { status: "unclear"; problem: Problem; seen?: ScanSource }   // photo illisible : le scan n'est pas décompté
  | Failure;

export type RecipesResult =
  | { status: "ok"; recipes: GeneratedRecipe[]; scansLeft: number | null }
  | { status: "plus" }              // « D'autres idées » en formule Gratuit
  | Failure;

async function post(path: string, body: unknown): Promise<{ response: Response | null; data: Record<string, unknown> }> {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = response ? await response.json().catch(() => ({})) : {};
  return { response, data };
}

async function failure(response: Response | null, data: Record<string, unknown>): Promise<Failure> {
  if (response?.status === 401) {
    await supabase.auth.signOut();
    return { status: "signed-out" };
  }
  if (response?.status === 403 && data.code === "quota") {
    // Peut-être un abonnement tout juste pris : la session suit
    void supabase.auth.refreshSession();
    return { status: "quota" };
  }
  if (data.code === "none" && typeof data.error === "string") return { status: "error", message: data.error };
  return { status: "error", rate: response?.status === 429 };
}

/** La photo montre autre chose que le mode choisi (un placard pris en mode Frigo…) */
const seenOf = (v: unknown): { seen?: ScanSource } => (v === "frigo" || v === "placard" || v === "ticket" ? { seen: v } : {});

/** Scan, 1re partie : la photo devient une liste d'ingrédients. En Gratuit, c'est là que le scan est compté. */
export async function detectIngredients(file: Blob, source: ScanSource): Promise<IngredientsResult> {
  const image = await compressImage(file).catch(() => null);
  if (!image) return { status: "unclear", problem: "floue" };
  const { base64: imageBase64, type: mediaType } = image;
  const { response, data } = await post("/api/ingredients", { imageBase64, mediaType, source });
  if (response?.status === 422 && data.code === "unclear") {
    const p = data.problem;
    return { status: "unclear", problem: p === "sombre" || p === "vide" ? p : "floue", ...seenOf(data.seen) };
  }
  if (!response?.ok) return failure(response, data);
  const ingredients = (Array.isArray(data.ingredients) ? data.ingredients : []) as ScanIngredient[];
  return {
    status: "ok",
    ingredients: ingredients.map(i => ({ name: String(i.name), qty: String(i.qty ?? ""), x: i.x ?? undefined, y: i.y ?? undefined })),
    token: typeof data.token === "string" ? data.token : null,
    scansLeft: typeof data.scansLeft === "number" ? data.scansLeft : null,
    ...seenOf(data.seen),
  };
}

type RawItem = { name: string; plural: string; qty: number | null; unit: string; have: boolean };
type RawRecipe = {
  title: string; intro: string; minutes: number; calories: number; difficulty: string; imageSearch: string; imageUrl?: string;
  veg: boolean; oven: boolean; cold: boolean; missing: string; serves: number; items: RawItem[];
  kids?: boolean; without?: string[]; origin?: string; dessert?: boolean;
  steps: { text: string; timer: { label: string; min: number } | null }[];
};

/** Quantité écrite pour les anciens écrans (Tes scans, partage) : « 200 g », « 2 », « un peu ». */
const qtyLabel = (i: RawItem) => (i.qty == null ? "un peu" : `${String(i.qty).replace(".", ",")}${i.unit ? " " + i.unit : ""}`);

function toRecipe(r: RawRecipe): GeneratedRecipe {
  return {
    emoji: recipeIcon(r.title),
    title: r.title,
    time: `${r.minutes} min`,
    cal: r.calories,
    diff: r.difficulty,
    imageSearch: r.imageUrl || r.imageSearch || r.title,
    steps: r.steps.map(s => s.text),
    recipeIngredients: r.items.map(i => ({ name: i.qty != null && i.qty > 1 && !i.unit ? i.plural : i.name, qty: qtyLabel(i) })),
    intro: r.intro,
    minutes: r.minutes,
    veg: r.veg,
    oven: r.oven,
    cold: r.cold,
    missing: r.missing,
    serves: r.serves,
    items: r.items,
    timers: r.steps.map(s => s.timer),
    ...(r.kids ? { kids: true } : {}),
    ...(r.origin ? { origin: r.origin } : {}),
    ...(r.without?.length ? { without: r.without } : {}),
    ...(r.dessert ? { dessert: true } : {}),
  };
}

/** Scan, 2e partie : la liste vérifiée devient 3 recettes (ou 2 « autres idées » avec more). */
export async function makeRecipes(o: {
  ingredients: ScanIngredient[];
  /** Ce qu'il y a vraiment dans les placards (Ma cuisine et les pastilles de « Dans tes placards ? ») */
  pantry: { name: string; qty: string }[]; envies: Envie[]; meal: Meal; servings: number;
  token: string | null; avoid?: string[]; more?: boolean;
  /** « Zéro course » : rien à acheter */
  noShop?: boolean;
  /** Le menu : combien de recettes (3 par défaut), et combien de desserts parmi elles (le reste : des plats pour meal) */
  count?: number; desserts?: number;
  /** Frigia Plus : frigo vide, des plats avec les placards et une petite liste de courses */
  empty?: boolean;
  /** Frigia Plus : ceux du foyer qui mangent (allergies, ce qu'ils n'aiment pas, âge des enfants) */
  eaters?: ApiEater[];
}): Promise<RecipesResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  const { response, data } = await post("/api/recipes", {
    ingredients: o.ingredients.map(i => ({ name: i.name, qty: i.qty, finish: i.finish || undefined })),
    pantry: o.pantry, envies: o.envies, meal: o.meal, count: o.count, desserts: o.desserts || undefined, servings: o.servings, token: o.token, avoid: o.avoid, more: o.more, eaters: o.eaters,
    empty: o.empty || undefined, noShop: o.noShop || undefined,
    prefs: userId ? apiPrefs(getCachedProfile(userId)) : null,
    recentTitles: userId ? recentRecipeTitles(userId) : [],
  });
  if (response?.status === 403 && data.code === "plus") return { status: "plus" };
  if (!response?.ok) return failure(response, data);
  const recipes = (Array.isArray(data.recipes) ? data.recipes : []) as RawRecipe[];
  return { status: "ok", recipes: recipes.map(toRecipe), scansLeft: typeof data.scansLeft === "number" ? data.scansLeft : null };
}

/** Ingrédients du scan gardés dans l'historique. */
export const toDetected = (list: ScanIngredient[]): DetectedIngredient[] =>
  list.map(i => ({ name: i.name, icon: ingredientIcon(i.name), conf: 90, qty: i.qty, ...(i.finish ? { finish: true } : {}) }));
