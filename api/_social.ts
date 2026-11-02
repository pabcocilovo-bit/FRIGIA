// Le dashboard de suivi (/admin) > Réseaux : Claude lit une capture d'écran d'un profil Instagram, TikTok ou YouTube
// et en sort les chiffres. Le dashboard les montre avant de les enregistrer : l'admin vérifie.
// Appelé par api/subscription.ts (action « social_capture », compte admin seulement) : Vercel n'accepte pas plus de 12 routes.
import { askClaude } from "./_ai.js";

export type CaptureRead = {
  platform: "instagram" | "tiktok" | "youtube" | "autre" | null;
  handle: string | null;
  followers: number | null;
  views: number | null;
  views_30d: number | null;
  likes: number | null;
  posts: number | null;
};

const MAX_IMAGES = 3;
// Une photo réduite par le dashboard (1200 px, JPEG) pèse 100 à 400 Ko ; Vercel refuse plus de 4,5 Mo en tout
const MAX_BASE64 = 1_400_000;

const PROMPT = `Ces captures d'écran viennent d'un même compte de réseau social (profil ou statistiques du compte pro).
Lis les chiffres affichés et réponds seulement en JSON, sans texte autour :
{"platform":"instagram"|"tiktok"|"youtube"|"autre","handle":"nom du compte sans @","followers":0,"views":0,"views_30d":0,"likes":0,"posts":0}
- followers : abonnés (followers, abonnés, subscribers).
- views : vues cumulées du compte. Sur une grille TikTok ou Reels, additionne les vues de toutes les vidéos visibles. Sur YouTube, les vues totales de la chaîne.
- views_30d : vues sur les 30 derniers jours, seulement si l'écran de statistiques l'affiche (« 30 derniers jours », « Last 30 days »). Si c'est une autre durée (7 jours, 90 jours), mets null.
- likes : j'aime cumulés (sur TikTok : le total « J'aime » du profil).
- posts : nombre de publications ou de vidéos.
- Convertis les abréviations : 12,3 k = 12300, 1,2 M = 1200000, 4.5K = 4500.
- Un chiffre absent ou illisible : null. N'invente rien.`;

const toInt = (v: unknown): number | null => {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[\s\u202f]/g, "").replace(",", ".")) : NaN;
  return Number.isFinite(x) && x >= 0 ? Math.round(x) : null;
};

/** null : Claude n'a pas répondu ; sinon les chiffres lus (null pour ceux qu'il n'a pas vus) */
export async function readCapture(images: unknown): Promise<CaptureRead | null | "bad_request"> {
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_IMAGES) return "bad_request";
  const list = images as { data?: unknown; type?: unknown }[];
  if (list.some(i => typeof i?.data !== "string" || i.data.length > MAX_BASE64 || !/^image\/(jpeg|png|webp)$/.test(String(i.type)))) return "bad_request";
  const r = await askClaude<Record<string, unknown>>([
    ...list.map(i => ({ type: "image" as const, source: { type: "base64" as const, media_type: String(i.type), data: String(i.data) } })),
    { type: "text", text: PROMPT },
  ], 400);
  if (!r.ok || !r.json) return null;
  const j = r.json;
  const platform = ["instagram", "tiktok", "youtube", "autre"].includes(String(j.platform)) ? j.platform as CaptureRead["platform"] : null;
  const handle = typeof j.handle === "string" ? j.handle.trim().replace(/^@/, "").replace(/\s+/g, "").slice(0, 80) || null : null;
  return {
    platform, handle,
    followers: toInt(j.followers), views: toInt(j.views), views_30d: toInt(j.views_30d), likes: toInt(j.likes), posts: toInt(j.posts),
  };
}
