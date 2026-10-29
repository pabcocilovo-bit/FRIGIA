// La liste d'attente du site (avant l'ouverture à tous) : prénom + email, gardés dans waitlist (migration 20261026000000).
// Sans compte. Une adresse ne s'inscrit qu'une fois (« already »). Un email de confirmation part (sans RESEND_API_KEY : rien).
// website : un champ caché du formulaire. Un robot le remplit, une personne non : on répond « ok » sans rien garder.
// L'accès tout de suite (Hugo, 29 octobre) : le mail contient le lien pour créer son compte, et seuls les emails de la liste
// avec un accès (invited_at) peuvent créer un compte (migration 20261104000000). WAITLIST_WAVES=true (Vercel) : pas de lien,
// les accès partent par vagues avec explorer?invitations=1.
// { invite: true } (compte admin) : le lien aux inscrits qui ne l'ont pas encore, un paquet par appel.
import { waitlistEmail } from "./_email.js";
import { adminClient, authUser, errorMessage, preflight, siteOrigin, type Req, type Res } from "./_shared.js";

const PER_MINUTE = 30;
const PER_IP_HOUR = 5;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const INSTANT = process.env.WAITLIST_WAVES !== "true";
/** Le lien du mail : l'inscription s'ouvre avec l'email déjà rempli (src/App.tsx, /acces) */
const accessLink = (origin: string, email: string) => `${origin}/acces?email=${encodeURIComponent(email)}`;
// 8 mails par appel, espacés : Resend limite le nombre d'envois par seconde, et la fonction a un temps limité
const INVITE_BATCH = 8;

export default async function handler(req: Req, res: Res) {
  if (preflight(req, res)) return;
  const body = (req.body ?? {}) as { firstName?: unknown; email?: unknown; source?: unknown; website?: unknown; invite?: unknown };
  if (body.invite === true) return invite(req, res);
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
    const origin = siteOrigin(req);
    const { error } = await admin.from("waitlist").insert({ email, first_name: firstName, source, ...(INSTANT ? { invited_at: new Date().toISOString() } : {}) });
    if (error?.code === "23505") {
      // Déjà inscrit (mail perdu) : avec un accès, le lien repart
      const { data: row } = await admin.from("waitlist").select("first_name, invited_at").eq("email", email).maybeSingle();
      if (row?.invited_at) await waitlistEmail(email, String(row.first_name ?? ""), accessLink(origin, email), `again-${Date.now()}`);
      return res.json({ status: "already" });
    }
    if (error) throw error;
    await waitlistEmail(email, firstName, INSTANT ? accessLink(origin, email) : undefined);
    return res.json({ status: "ok" });
  } catch (e) {
    console.error("waitlist:", errorMessage(e));
    return res.status(500).json({ error: "L'inscription n'a pas marché. Réessaie." });
  }
}

/** Le lien aux inscrits d'avant (ou d'une vague), les plus anciens d'abord. Réponse : { sent, left } */
async function invite(req: Req, res: Res) {
  const admin = adminClient();
  const user = await authUser(req, admin);
  if (user?.app_metadata?.admin !== true) return res.status(403).json({ error: "Réservé à l'admin" });
  try {
    const { data, error } = await admin.from("waitlist").select("id, email, first_name").is("invited_at", null)
      .order("created_at").limit(INVITE_BATCH);
    if (error) throw error;
    const origin = siteOrigin(req);
    let sent = 0;
    for (const row of data ?? []) {
      // Le mail d'abord : s'il ne part pas (Resend), on s'arrête et la personne reste à inviter
      if (!(await waitlistEmail(row.email, row.first_name ?? "", accessLink(origin, row.email), "invite"))) break;
      const up = await admin.from("waitlist").update({ invited_at: new Date().toISOString() }).eq("id", row.id);
      if (up.error) throw up.error;
      sent++;
      await new Promise(ok => setTimeout(ok, 600));
    }
    const { count } = await admin.from("waitlist").select("id", { count: "exact", head: true }).is("invited_at", null);
    return res.json({ sent, done: sent, left: count ?? 0 });
  } catch (e) {
    console.error("waitlist invite:", errorMessage(e));
    return res.status(500).json({ error: "Les invitations n'ont pas marché." });
  }
}
