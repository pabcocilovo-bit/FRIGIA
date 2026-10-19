// « Nous écrire », « Signaler un problème », « Donner ton avis » : le message est gardé dans support_messages
// (migration de l'étape 8) et part par email à SUPPORT_EMAIL (contact@frigia.fr par défaut).
// Répondre à cet email répond à la personne. Sans RESEND_API_KEY, le message est seulement gardé. 10 messages par heure.
import { supportEmail } from "./_email.js";
import { adminClient, authUser, errorMessage, preflight, type Req, type Res } from "./_shared.js";

const KINDS = ["contact", "bug", "idea"] as const;
const PER_HOUR = 10;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export default async function handler(req: Req, res: Res) {
  if (preflight(req, res)) return;
  const admin = adminClient();
  const user = await authUser(req, admin);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const body = (req.body ?? {}) as { kind?: unknown; topic?: unknown; message?: unknown; appInfo?: unknown };
  const kind = KINDS.find(k => k === body.kind);
  const message = text(body.message, 5000);
  if (!kind || !message) return res.status(400).json({ error: "Message vide" });
  const topic = text(body.topic, 60), appInfo = text(body.appInfo, 300);

  try {
    const { count } = await admin.from("support_messages").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("created_at", new Date(Date.now() - 3600e3).toISOString());
    if ((count ?? 0) >= PER_HOUR) return res.status(429).json({ error: "Trop de messages" });
    const { data, error } = await admin.from("support_messages")
      .insert({ user_id: user.id, email: user.email ?? null, kind, topic, message, app_info: appInfo || null })
      .select("id").single();
    if (error) throw error;
    await supportEmail({ id: data.id as number, kind, topic, message, appInfo, from: user.email ?? null, userId: user.id });
    return res.json({ ok: true });
  } catch (e) {
    console.error("support:", errorMessage(e));
    return res.status(500).json({ error: "Échec de l'envoi" });
  }
}
