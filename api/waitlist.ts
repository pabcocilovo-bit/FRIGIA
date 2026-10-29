// La liste d'attente du site (avant l'ouverture à tous) : prénom + email, gardés dans waitlist (migration 20261026000000).
// Sans compte. Une adresse ne s'inscrit qu'une fois (« already »). Un email de confirmation part (sans RESEND_API_KEY : rien).
// website : un champ caché du formulaire. Un robot le remplit, une personne non : on répond « ok » sans rien garder.
import { waitlistEmail } from "./_email.js";
import { adminClient, errorMessage, preflight, type Req, type Res } from "./_shared.js";

const PER_MINUTE = 30;
const PER_IP_HOUR = 5;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export default async function handler(req: Req, res: Res) {
  if (preflight(req, res)) return;
  const body = (req.body ?? {}) as { firstName?: unknown; email?: unknown; source?: unknown; website?: unknown };
  if (text(body.website, 200)) return res.json({ status: "ok" });
  const email = text(body.email, 254).toLowerCase();
  const firstName = text(body.firstName, 40);
  if (!EMAIL.test(email)) return res.status(400).json({ error: "Cette adresse email n'a pas l'air valide." });
  if (!firstName) return res.status(400).json({ error: "Ton prénom manque." });
  const source = text(body.source, 60) || null;

  const admin = adminClient();
  try {
    // Par adresse IP aussi : sinon un robot remplit les 30 places de la minute et envoie des emails à n'importe qui
    const ip = String(req.headers["x-real-ip"] ?? req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || "?";
    const { data: allowed } = await admin.rpc("check_code_attempt", { p_key: `liste:${ip}`, p_limit: PER_IP_HOUR, p_window_seconds: 3600 });
    if (allowed === false) return res.status(429).json({ error: "Trop d'inscriptions depuis cette connexion. Réessaie plus tard." });
    // Pas d'email jetable (migration 20261103000000) : le mois offert irait à n'importe qui
    const { data: jetable } = await admin.rpc("email_jetable", { p_email: email });
    if (jetable === true) return res.status(400).json({ error: "Les adresses email jetables ne sont pas acceptées. Prends ton adresse habituelle." });
    const { count } = await admin.from("waitlist").select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 60e3).toISOString());
    if ((count ?? 0) >= PER_MINUTE) return res.status(429).json({ error: "Beaucoup d'inscriptions en ce moment. Réessaie dans une minute." });
    const { error } = await admin.from("waitlist").insert({ email, first_name: firstName, source });
    if (error?.code === "23505") return res.json({ status: "already" });
    if (error) throw error;
    await waitlistEmail(email, firstName);
    return res.json({ status: "ok" });
  } catch (e) {
    console.error("waitlist:", errorMessage(e));
    return res.status(500).json({ error: "L'inscription n'a pas marché. Réessaie." });
  }
}
