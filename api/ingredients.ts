// Scan, 1re partie : la photo (frigo, placard ou ticket de caisse) devient une liste d'ingrédients.
// Réservé à Frigia Plus (et aux 7 jours d'essai) : l'essai fini, le scan est refusé (code « quota »).
// Un ticket de caisse : son total, sa date et l'enseigne aussi, pour le budget courses (Frigia Plus).
// Le jeton renvoyé permet de demander les recettes de cette photo (/api/recipes) sans recompter de scan.
import { adminClient, authUser, isPlus, preflight, type Req, type Res } from "./_shared.js";
import { askClaude, checkRateLimit, scanToken, SUPPORTED_TYPES } from "./_ai.js";

type Body = { imageBase64?: string; mediaType?: string; source?: string };
type RawIngredient = { name?: unknown; qty?: unknown; x?: unknown; y?: unknown };
type Answer = { ingredients?: RawIngredient[]; problem?: unknown; seen?: unknown; total?: unknown; date?: unknown; store?: unknown };

const SOURCES: Record<string, string> = {
  frigo: "une photo de l'intérieur d'un frigo",
  placard: "une photo d'un placard de cuisine",
  ticket: "une photo d'un ticket de caisse de supermarché",
};
const PROBLEMS = ["floue", "sombre", "vide"];

const pct = (v: unknown) => (typeof v === "number" && v >= 0 && v <= 100 ? Math.round(v * 10) / 10 : undefined);

export default async function handler(req: Req, res: Res) {
  if (preflight(req, res)) return;
  const admin = adminClient();
  const user = await authUser(req, admin);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  if (!(await checkRateLimit(admin, user.id))) {
    return res.status(429).json({ error: "Limite atteinte. Réessaie dans une heure.", code: "rate" });
  }

  const { imageBase64, mediaType, source } = (req.body ?? {}) as Body;
  if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });
  if (imageBase64.length > 4 * 1024 * 1024) return res.status(400).json({ error: "Image trop lourde" });

  // Essai fini, sans Plus : « Passe à Plus »
  if (!isPlus(user)) return res.status(403).json({ error: "Ton essai est terminé.", code: "quota" });

  const chosen = source && source in SOURCES ? source : "frigo";
  const media = SUPPORTED_TYPES.includes(mediaType ?? "") ? mediaType! : "image/jpeg";
  const ask = async (src: string) => {
    const ticket = src === "ticket";
    const answer = await askClaude<Answer>([
      {
        type: "text",
        text: `Voici ${SOURCES[src]}. Liste les produits alimentaires qu'on y voit, frais ou en paquet : légumes, viandes, laitages, pâtes, conserves, mais aussi biscuits, gâteaux, chocolat, chips ou bonbons (pas les boissons alcoolisées, pas les produits ménagers).
Pour chaque aliment :
- "name" : son nom en français, court, avec une majuscule, au pluriel s'il y en a plusieurs ("Courgettes", "Tomates cerises", "Lait").
- "qty" : la quantité, très courte ("3", "2 barquettes", "1 bouteille", "500 g"). Compte ce qui se compte (fruits, légumes, œufs, pots). Sinon estime d'après la taille de l'emballage ("1 paquet", "environ 200 g"). Chaîne vide seulement si rien ne permet de le dire.
${ticket ? "" : `- "x" et "y" : la position du centre de l'aliment sur la photo, en pourcentage de la largeur et de la hauteur (0 à 100).\n`}Regroupe les doublons. 20 aliments au plus, les plus utiles pour cuisiner d'abord.
Si la photo ne permet pas de repérer d'aliment, renvoie une liste vide et "problem" : "floue" (photo floue ou bougée), "sombre" (trop sombre) ou "vide" (aucun aliment sur la photo).
${ticket ? `"total" : le montant total payé en euros, un nombre (62.4), ou null s'il est illisible ou coupé.
"date" : la date du ticket, "AAAA-MM-JJ", ou null.
"store" : l'enseigne, courte ("Leclerc", "Carrefour Market"), ou "".
` : ""}"seen" : ce que montre vraiment la photo, quoi qu'on t'ait annoncé : "frigo" (l'intérieur d'un frigo), "placard" (un placard, une étagère ou un garde-manger), "ticket" (un ticket de caisse) ou "autre".
JSON uniquement : {"ingredients":[{"name":"Courgettes","qty":"3"${ticket ? "" : ',"x":42,"y":61'}}],"problem":null,${ticket ? '"total":62.4,"date":"2026-10-21","store":"Leclerc",' : ""}"seen":"${src}"}`,
      },
      { type: "image", source: { type: "base64", media_type: media, data: imageBase64 } },
    ], 1200);
    if (!answer.ok) return null;
    const ingredients = (answer.json?.ingredients ?? [])
      .filter(i => typeof i?.name === "string" && i.name.trim())
      .slice(0, 20)
      .map(i => ({
        name: String(i.name).trim().slice(0, 60),
        qty: typeof i.qty === "string" ? i.qty.trim().slice(0, 30) : "",
        x: ticket ? undefined : pct(i.x),
        y: ticket ? undefined : pct(i.y),
      }));
    const seen = typeof answer.json?.seen === "string" && answer.json.seen in SOURCES ? answer.json.seen : null;
    const p = String(answer.json?.problem);
    // Le total d'un ticket : un montant plausible pour des courses, sinon rien (le budget ne prend pas un chiffre douteux)
    const t = answer.json?.total, eur = typeof t === "number" ? t : typeof t === "string" ? Number(t.replace(",", ".")) : NaN;
    const d = answer.json?.date, st = answer.json?.store;
    const receipt = ticket && Number.isFinite(eur) && eur > 0 && eur < 2000
      ? { eur: Math.round(eur * 100) / 100, date: typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null, store: typeof st === "string" ? st.trim().slice(0, 30) : "" }
      : undefined;
    return { ingredients, seen, problem: PROBLEMS.includes(p) ? p : "floue", receipt };
  };

  let found = await ask(chosen);
  if (!found) return res.status(502).json({ error: "Service IA temporairement indisponible." });
  // La photo ne montre pas ce qui a été choisi (un placard pris en mode Frigo…) : l'appli range au bon endroit.
  // Rien trouvé avec le mauvais mode : on relit la photo avec le bon.
  const seen = found.seen && found.seen !== chosen ? found.seen : undefined;
  if (seen && found.ingredients.length === 0) found = (await ask(seen)) ?? found;
  if (found.ingredients.length === 0) {
    return res.status(422).json({ error: "Photo illisible", code: "unclear", problem: found.problem, ...(seen ? { seen } : {}) });
  }
  res.json({ ingredients: found.ingredients, token: scanToken(user.id), ...(seen ? { seen } : {}), ...(found.receipt ? { ticket: found.receipt } : {}) });
}
