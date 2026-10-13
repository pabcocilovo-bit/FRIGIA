// Outils communs au scan : limite par heure, scans gratuits, goûts du compte, appel à l'IA, photos des plats.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Limite : 5 scans par heure et par compte ───
// Un scan, c'est une photo (ou des ingrédients tapés à la main). Les recettes d'une photo déjà comptée
// et « D'autres idées » ne comptent pas comme un scan : une limite plus large les protège (IDEAS_LIMIT).
const RATE_LIMIT = 5;
const IDEAS_LIMIT = 20;
const RATE_WINDOW_MS = 3600 * 1000;

const rateLimitMap = new Map<string, { count: number; reset: number }>();

function checkMemoryRateLimit(userId: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(userId, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/** Recettes d'une photo déjà comptée, « D'autres idées » : 20 demandes par heure (compteur de l'instance). */
export const checkIdeasLimit = (userId: string) => checkMemoryRateLimit(`idees:${userId}`, IDEAS_LIMIT);

// Shared counter in Supabase (see supabase/migrations), so it holds across serverless instances
export async function checkRateLimit(admin: SupabaseClient, userId: string, limit = RATE_LIMIT): Promise<boolean> {
  const { data, error } = await admin.rpc("check_scan_rate_limit", {
    p_user_id: userId,
    p_limit: limit,
    p_window_seconds: RATE_WINDOW_MS / 1000,
  });
  if (!error) return data === true;
  // Migration not applied yet: fall back to the per-instance counter instead of blocking scans
  console.error("check_scan_rate_limit failed:", error.message);
  return checkMemoryRateLimit(userId, limit);
}

// ─── Formule Gratuit : 15 scans au total, plus les bonus des codes (colonne bonus_scans) ───
export const FREE_SCANS = 15;

/** Compte un scan gratuit. Renvoie les scans qui restent, -1 s'il n'en reste plus, null si la base ne répond pas. */
export async function takeFreeScan(admin: SupabaseClient, userId: string): Promise<number | null> {
  const { data, error } = await admin.rpc("use_free_scan", { p_user_id: userId, p_limit: FREE_SCANS });
  if (error) {
    console.error("use_free_scan failed:", error.message);
    return null;
  }
  return typeof data === "number" && data >= 0 ? data : -1;
}

export async function refundFreeScan(admin: SupabaseClient, userId: string) {
  await admin.rpc("refund_free_scan", { p_user_id: userId });
}

// ─── Jeton du scan : les recettes d'une photo déjà comptée ne recomptent pas de scan ───
const TOKEN_TTL_S = 2 * 3600;
const tokenSecret = () => process.env.SCAN_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sign = (payload: string) => createHmac("sha256", tokenSecret()).update(payload).digest("base64url");

export function scanToken(userId: string): string {
  const payload = `${userId}.${Math.floor(Date.now() / 1000) + TOKEN_TTL_S}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function checkScanToken(token: unknown, userId: string): boolean {
  if (typeof token !== "string" || !tokenSecret()) return false;
  const [p, s] = token.split(".");
  if (!p || !s) return false;
  const payload = Buffer.from(p, "base64url").toString();
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(s);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  const [uid, exp] = payload.split(".");
  return uid === userId && Number(exp) * 1000 > Date.now();
}

// ─── Goûts du compte (table profiles) ───
// Old clients still send the first questionnaire's keys (goal, healthy, veggie, 15min…): both are understood.
export type Prefs = { goal?: string; goals?: string[]; diet?: string[]; allergies?: string[]; time?: string; equipment?: string[] };

export function prefLines(prefs: Prefs | null | undefined): string[] {
  const lines: string[] = [];
  if (!prefs) return lines;
  const dietMap: Record<string, string> = {
    vege: "végétarien (sans viande ni poisson)", veggie: "végétarien (sans viande ni poisson)",
    vegan: "vegan (sans aucun produit animal)", pesce: "pescétarien (poisson autorisé, sans viande)",
    gluten: "sans gluten", glutenfree: "sans gluten", lactose: "sans lactose",
  };
  const goalMap: Record<string, string> = {
    sain: "recettes saines et équilibrées", healthy: "recettes saines et équilibrées",
    gaspi: "recettes zéro gaspillage utilisant un maximum d'ingrédients visibles", nogaspi: "recettes zéro gaspillage utilisant un maximum d'ingrédients visibles",
    temps: "recettes rapides à préparer", quick: "recettes rapides à préparer",
    budget: "recettes économiques, avec ce qu'il y a déjà", idees: "recettes variées qui sortent de la routine",
  };
  const equipMap: Record<string, string> = { airfryer: "AirFryer", moulinex: "Moulinex", thermomix: "Thermomix" };
  const timeMap: Record<string, string> = { "15": "15 minutes maximum", "30": "30 minutes maximum", "15min": "15 minutes maximum", "30min": "30 minutes maximum" };

  const dietConstraints = (prefs.diet || []).map(d => dietMap[d]).filter(Boolean);
  if (dietConstraints.length > 0) lines.push(`ALIMENTATION (OBLIGATOIRE sur toutes les recettes) : ${dietConstraints.join(" et ")}.`);

  const allergies = (prefs.allergies || []).filter(a => typeof a === "string" && a.length < 40);
  if (allergies.length > 0) lines.push(`ALLERGIES (OBLIGATOIRE) : aucune recette ne doit contenir ${allergies.join(", ")}.`);

  const goals = [...(prefs.goals || []), ...(prefs.goal ? [prefs.goal] : [])].map(g => goalMap[g]).filter(Boolean);
  if (goals.length > 0) lines.push(`OBJECTIF : Privilégier des ${goals.slice(0, 2).join(" et des ")}.`);

  const timeConstraint = prefs.time ? timeMap[prefs.time] : null;
  if (timeConstraint) lines.push(`DURÉE : Au moins 2 recettes sur 3 doivent être réalisables en ${timeConstraint}. La 3ème peut être plus longue.`);

  const equipList = (prefs.equipment || []).map(e => equipMap[e.toLowerCase()] ?? e).filter(e => typeof e === "string" && e.length < 40);
  if (equipList.length > 0) lines.push(`ÉQUIPEMENT : L'utilisateur possède ${equipList.join(", ")}. Exactement 1 recette sur 3 peut suggérer d'utiliser cet équipement (les autres doivent rester classiques).`);
  return lines;
}

// ─── Appel à l'IA ───
type Content = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

/** Envoie la demande à Claude et renvoie le premier objet JSON de la réponse (null si l'IA ne répond pas ou mal). */
export async function askClaude<T>(content: Content[], maxTokens: number): Promise<{ ok: true; json: T | null } | { ok: false }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content }] }),
  }).catch(() => null);
  if (!res?.ok) {
    await res?.text();
    return { ok: false };
  }
  const data = await res.json() as { content?: { text?: string }[] };
  const text = (data.content || []).map(i => i.text || "").join("");
  const json = extractFirstJSON(text);
  if (!json) return { ok: true, json: null };
  try { return { ok: true, json: JSON.parse(json) as T }; } catch { return { ok: true, json: null }; }
}

// Extract the first balanced JSON object (avoids greedy regex cutting across braces)
function extractFirstJSON(str: string): string | null {
  const start = str.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") { depth--; if (depth === 0) return str.slice(start, i + 1); }
  }
  return null;
}

/** Photo du plat (Pexels), à partir de 2 mots en anglais. Sans clé ou sans résultat : pas de photo. */
export async function dishPhoto(imageSearch: string): Promise<string | undefined> {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey || !imageSearch) return undefined;
  try {
    const query = `${imageSearch} food photography`;
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
      { headers: { Authorization: pexelsKey } }
    );
    const d = await r.json() as { photos?: { src: { large: string } }[] };
    const photos = d.photos || [];
    return (photos[1] || photos[0])?.src.large;
  } catch {
    return undefined;
  }
}

export const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
