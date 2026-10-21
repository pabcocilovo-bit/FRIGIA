// Les emails de Frigia, envoyés par Resend (le « _ » au début : Vercel n'en fait pas une route).
// Sans RESEND_API_KEY, rien ne part : on le note dans les logs et le reste continue.

const FROM = "Frigia <contact@frigia.fr>";
const SITE = "https://frigia.fr";

// Couleurs de design/frigia-tokens.json (thème clair : les messageries gèrent mal le sombre)
const C = { bg: "#F6F3EC", raised: "#FFFDF8", line: "#DDD6C8", text: "#17231D", muted: "#5E6A62", brand: "#12493A", onBrand: "#F6F3EC" };

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

type Mail = {
  title: string;
  paragraphs: string[];
  button?: { label: string; href: string };
  /** La petite ligne grise sous le bouton. */
  note?: string;
};

/** Le gabarit commun : le nom, un titre, quelques phrases, un bouton vert.
 *  Volontairement sobre (pas d'image) : Gmail range moins vite en « Promotions » un email transactionnel léger. */
function layout({ title, paragraphs, button, note }: Mail): string {
  const p = (t: string, color = C.text, size = 16) =>
    `<p style="margin:0 0 16px;font-size:${size}px;line-height:1.5;color:${color}">${esc(t).replace(/\n/g, "<br>")}</p>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.raised};border:1px solid ${C.line};border-radius:20px">
<tr><td style="padding:32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<p style="margin:0 0 20px;font-size:15px;font-weight:700;color:${C.brand}">Frigia</p>
<h1 style="margin:0 0 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:24px;line-height:1.25;color:${C.brand};font-weight:700">${esc(title)}</h1>
${paragraphs.map(t => p(t)).join("\n")}
${button ? `<a href="${esc(button.href)}" style="display:inline-block;margin:8px 0 16px;padding:14px 24px;border-radius:999px;background:${C.brand};color:${C.onBrand};font-size:16px;font-weight:600;text-decoration:none">${esc(button.label)}</a>` : ""}
${note ? p(note, C.muted, 14) : ""}
</td></tr></table>
<p style="margin:16px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${C.muted}">Frigia · <a href="${SITE}" style="color:${C.muted}">frigia.fr</a> · une question ? Réponds simplement à cet email.</p>
</td></tr></table></body></html>`;
}

/** La version texte, pour les messageries qui n'affichent pas le HTML. */
function plain({ title, paragraphs, button, note }: Mail): string {
  return [title, ...paragraphs, button && `${button.label} : ${button.href}`, note, "Frigia · frigia.fr"].filter(Boolean).join("\n\n");
}

/** Envoie un email. idempotencyKey : Resend n'envoie qu'une fois par clé (le webhook Stripe peut être rejoué).
 *  Ne lève jamais d'erreur : un email raté ne doit pas faire échouer le reste. */
export async function sendEmail(to: string, subject: string, mail: Mail, idempotencyKey?: string, replyTo = "contact@frigia.fr"): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("email non envoyé (RESEND_API_KEY absente):", subject); return false; }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: FROM, to, subject, html: layout(mail), text: plain(mail), reply_to: replyTo }),
    });
    if (!r.ok) { console.error("email:", r.status, await r.text()); return false; }
    return true;
  } catch (e) {
    console.error("email:", e instanceof Error ? e.message : String(e));
    return false;
  }
}

const DAY_YEAR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

// ─── Les emails ──────────────────────────────────────────────────────────────

/** Confirmation de résiliation (obligatoire depuis la résiliation en 3 clics : la date de fin, sur un support durable). */
export function cancelEmail(to: string, endsAt: number, idempotencyKey: string) {
  const end = DAY_YEAR.format(new Date(endsAt * 1000));
  return sendEmail(to, "Ta résiliation de Frigia Plus est confirmée", {
    title: "C'est noté, ta résiliation est confirmée",
    paragraphs: [
      `Ton abonnement Frigia Plus ne sera pas renouvelé. Il reste actif jusqu'au ${end}, puis tu passes en Gratuit.`,
      "Aucun autre paiement ne sera prélevé.",
      "Rien ne disparaît : tes favoris, ta liste et tes scans restent là.",
    ],
    button: { label: "Je change d'avis", href: `${SITE}/resilier` },
    note: `Tu peux reprendre Plus jusqu'au ${end}, en un clic, au même prix.`,
  }, idempotencyKey);
}

const euros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",") + " €";

/** Renouvellement refusé : changer de carte avant que Plus s'arrête. */
export function payFailedEmail(to: string, amount: number, idempotencyKey: string) {
  return sendEmail(to, "Ton paiement Frigia Plus n'est pas passé", {
    title: "Ton paiement n'est pas passé",
    paragraphs: [
      `Ta banque a refusé le renouvellement de Frigia Plus (${euros(amount)}). Ça arrive souvent quand une carte expire.`,
      "Mets à jour ta carte en deux minutes pour garder ta semaine, ta famille et tes scans sans limite.",
    ],
    button: { label: "Mettre à jour ma carte", href: `${SITE}/plus/paiement?refus=1` },
    note: "On réessaiera automatiquement dans quelques jours. Sans paiement, tu repasseras en Gratuit, sans rien perdre.",
  }, idempotencyKey);
}

/** Rappel avant la reconduction d'un abonnement annuel, avec la possibilité de ne pas le renouveler. */
export function renewalEmail(to: string, renewsAt: number, amount: number, idempotencyKey: string) {
  const date = DAY_YEAR.format(new Date(renewsAt * 1000));
  return sendEmail(to, `Frigia Plus se renouvelle le ${date}`, {
    title: "Ton année Plus se renouvelle bientôt",
    paragraphs: [
      `Ton abonnement annuel Frigia Plus sera renouvelé automatiquement le ${date}, pour ${euros(amount)}.`,
      "Tu n'as rien à faire pour continuer.",
      `Si tu ne veux pas le renouveler, tu peux le résilier en trois clics jusqu'au ${date}. Plus reste alors actif jusqu'à cette date.`,
    ],
    button: { label: "Gérer mon abonnement", href: `${SITE}/resilier` },
  }, idempotencyKey);
}

const DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

/** La veille de la fin d'une pause (promis sur l'écran « Bonne pause »). */
export function pauseEndEmail(to: string, until: number, idempotencyKey: string) {
  const day = DAY.format(new Date(until * 1000));
  return sendEmail(to, `Frigia Plus reprend ${day}`, {
    title: "Ta pause se termine bientôt",
    paragraphs: [
      `Frigia Plus reprend tout seul ${day}.`,
      "Ta semaine, ta famille et tes favoris t'attendent, rien n'a bougé.",
    ],
    button: { label: "Ouvrir Frigia", href: SITE },
    note: "Tu ne veux pas reprendre ? Tu peux résilier depuis ton compte, en trois clics.",
  }, idempotencyKey);
}

/** Le compte est supprimé : la confirmation, avec la fin de l'abonnement. */
export function deletedEmail(to: string, idempotencyKey: string) {
  return sendEmail(to, "Ton compte Frigia est supprimé", {
    title: "Ton compte est supprimé",
    paragraphs: [
      "Ton compte Frigia et tes données sont effacés : tes scans, tes favoris, ta semaine, ta liste et ta famille.",
      "Si tu avais Frigia Plus, l'abonnement est arrêté. Aucun autre paiement ne sera prélevé.",
      "Merci d'avoir cuisiné avec nous. Tu peux revenir quand tu veux avec la même adresse.",
    ],
    button: { label: "Revenir sur Frigia", href: SITE },
    note: "Ce n'est pas toi ? Réponds à cet email, on regarde tout de suite.",
  }, idempotencyKey);
}

const KIND = { contact: "Nous écrire", bug: "Problème signalé", idea: "Idée" } as const;

/** Un message envoyé depuis l'appli, pour l'équipe. Répondre à l'email répond à la personne. */
export function supportEmail(m: { id: number; kind: keyof typeof KIND; topic: string; message: string; appInfo: string; from: string | null; userId: string }) {
  const to = process.env.SUPPORT_EMAIL || "contact@frigia.fr";
  return sendEmail(to, `${KIND[m.kind]}${m.topic ? ` : ${m.topic}` : ""}`, {
    title: `${KIND[m.kind]}${m.topic ? ` · ${m.topic}` : ""}`,
    paragraphs: [
      ...m.message.split(/\n{2,}/),
      `De : ${m.from ?? "adresse inconnue"}`,
    ],
    note: [m.appInfo, `Compte ${m.userId} · message n° ${m.id} dans support_messages`].filter(Boolean).join(" · "),
  }, `support-${m.id}`, m.from ?? undefined);
}

/** Inscription à la liste d'attente du site : la confirmation (une seule fois par adresse). */
export function waitlistEmail(to: string, firstName: string) {
  return sendEmail(to, "Tu es sur la liste d'attente de Frigia", {
    title: `C'est noté${firstName ? `, ${firstName}` : ""} !`,
    paragraphs: [
      "Tu es sur la liste d'attente de Frigia : tu photographies ton frigo, et Frigia te propose des recettes avec ce que tu as déjà.",
      "On ouvre l'appli par petits groupes. Quand c'est ton tour, tu reçois un email avec ton lien d'accès personnel.",
    ],
    note: "Tu ne t'es pas inscrit ? Ignore cet email : on ne t'écrira pas d'autre message.",
  }, `waitlist-${to}`);
}
