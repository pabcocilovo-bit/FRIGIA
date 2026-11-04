// Les emails de Frigia, envoyés par Resend (le « _ » au début : Vercel n'en fait pas une route).
// Sans RESEND_API_KEY, rien ne part : on le note dans les logs et le reste continue.

import { type Lang, say } from "./_shared.js";

const FROM = "Frigia <contact@frigia.fr>";
const SITE = "https://frigia.fr";

// Couleurs de design/frigia-tokens.json (thème clair : les messageries gèrent mal le sombre)
const C = { bg: "#F6F3EC", raised: "#FFFDF8", line: "#DDD6C8", text: "#17231D", muted: "#5E6A62", brand: "#12493A", onBrand: "#F6F3EC" };

const esc = (s: string) => s.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

type Mail = {
  /** La langue de la personne (l'appli en anglais) : le gabarit suit */
  lang?: Lang;
  title: string;
  paragraphs: string[];
  button?: { label: string; href: string };
  /** La petite ligne grise sous le bouton. */
  note?: string;
};

/** Le gabarit commun : le nom, un titre, quelques phrases, un bouton vert.
 *  Volontairement sobre (pas d'image) : Gmail range moins vite en « Promotions » un email transactionnel léger. */
function layout({ lang = "fr", title, paragraphs, button, note }: Mail): string {
  const p = (t: string, color = C.text, size = 16) =>
    `<p style="margin:0 0 16px;font-size:${size}px;line-height:1.5;color:${color}">${esc(t).replace(/\n/g, "<br>")}</p>`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
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
<p style="margin:16px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${C.muted}">Frigia · <a href="${SITE}" style="color:${C.muted}">frigia.fr</a> · ${say(lang)("une question ? Réponds simplement à cet email.", "a question? Just reply to this email.")}</p>
</td></tr></table></body></html>`;
}

/** La version texte, pour les messageries qui n'affichent pas le HTML. */
function plain({ lang = "fr", title, paragraphs, button, note }: Mail): string {
  return [title, ...paragraphs, button && `${button.label}${lang === "en" ? ":" : " :"} ${button.href}`, note, "Frigia · frigia.fr"].filter(Boolean).join("\n\n");
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

const DAY_YEAR = (lang: Lang) => new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

// ─── Les emails ──────────────────────────────────────────────────────────────

/** Confirmation de résiliation (obligatoire depuis la résiliation en 3 clics : la date de fin, sur un support durable). */
export function cancelEmail(to: string, endsAt: number, idempotencyKey: string, lang: Lang = "fr") {
  const end = DAY_YEAR(lang).format(new Date(endsAt * 1000)), x = say(lang);
  return sendEmail(to, x("Ta résiliation de Frigia Plus est confirmée", "Your Frigia Plus cancellation is confirmed"), {
    lang,
    title: x("C'est noté, ta résiliation est confirmée", "Done, your cancellation is confirmed"),
    paragraphs: [
      x(`Ton abonnement Frigia Plus ne sera pas renouvelé. Il reste actif jusqu'au ${end}. Ensuite, il faudra te réabonner pour scanner et créer des recettes.`,
        `Your Frigia Plus subscription won't renew. It stays active until ${end}. After that, you'll need to subscribe again to scan and create recipes.`),
      x("Aucun autre paiement ne sera prélevé.", "No further payment will be taken."),
      x("Rien ne disparaît : tes favoris, ta liste et tes scans restent sur ton compte.", "Nothing disappears: your favourites, your list and your scans stay on your account."),
    ],
    button: { label: x("Je change d'avis", "I've changed my mind"), href: `${SITE}/resilier` },
    note: x(`Tu peux reprendre Plus jusqu'au ${end}, en un clic, au même prix.`, `You can restart Plus until ${end}, in one tap, at the same price.`),
  }, idempotencyKey);
}

const euros = (cents: number, lang: Lang = "fr") => (lang === "en" ? "€" + (cents / 100).toFixed(2) : (cents / 100).toFixed(2).replace(".", ",") + " €");

/** Renouvellement refusé : changer de carte avant que Plus s'arrête. */
export function payFailedEmail(to: string, amount: number, idempotencyKey: string, lang: Lang = "fr") {
  const x = say(lang);
  return sendEmail(to, x("Ton paiement Frigia Plus n'est pas passé", "Your Frigia Plus payment didn't go through"), {
    lang,
    title: x("Ton paiement n'est pas passé", "Your payment didn't go through"),
    paragraphs: [
      x(`Ta banque a refusé le renouvellement de Frigia Plus (${euros(amount)}). Ça arrive souvent quand une carte expire.`,
        `Your bank declined the Frigia Plus renewal (${euros(amount, lang)}). This often happens when a card expires.`),
      x("Mets à jour ta carte en deux minutes pour garder ta semaine, ta famille et tes scans sans limite.",
        "Update your card in two minutes to keep your week, your family and unlimited scans."),
    ],
    button: { label: x("Mettre à jour ma carte", "Update my card"), href: `${SITE}/plus/paiement?refus=1` },
    note: x("On réessaiera automatiquement dans quelques jours. Sans paiement, Plus s'arrête, mais tu ne perds rien : tout reste sur ton compte.",
      "We'll try again automatically in a few days. Without payment, Plus stops, but you lose nothing: everything stays on your account."),
  }, idempotencyKey);
}

/** Rappel avant la reconduction d'un abonnement annuel, avec la possibilité de ne pas le renouveler. */
export function renewalEmail(to: string, renewsAt: number, amount: number, idempotencyKey: string, lang: Lang = "fr") {
  const date = DAY_YEAR(lang).format(new Date(renewsAt * 1000)), x = say(lang);
  return sendEmail(to, x(`Frigia Plus se renouvelle le ${date}`, `Frigia Plus renews on ${date}`), {
    lang,
    title: x("Ton année Plus se renouvelle bientôt", "Your year of Plus renews soon"),
    paragraphs: [
      x(`Ton abonnement annuel Frigia Plus sera renouvelé automatiquement le ${date}, pour ${euros(amount)}.`,
        `Your annual Frigia Plus subscription will renew automatically on ${date}, for ${euros(amount, lang)}.`),
      x("Tu n'as rien à faire pour continuer.", "You don't need to do anything to keep going."),
      x(`Si tu ne veux pas le renouveler, tu peux le résilier en trois clics jusqu'au ${date}. Plus reste alors actif jusqu'à cette date.`,
        `If you don't want to renew, you can cancel in three taps until ${date}. Plus then stays active until that date.`),
    ],
    button: { label: x("Gérer mon abonnement", "Manage my subscription"), href: `${SITE}/resilier` },
  }, idempotencyKey);
}

const DAY = (lang: Lang) => new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

/** La veille de la fin d'une pause (promis sur l'écran « Bonne pause »). */
export function pauseEndEmail(to: string, until: number, idempotencyKey: string, lang: Lang = "fr") {
  const day = DAY(lang).format(new Date(until * 1000)), x = say(lang);
  return sendEmail(to, x(`Frigia Plus reprend ${day}`, `Frigia Plus restarts on ${day}`), {
    lang,
    title: x("Ta pause se termine bientôt", "Your pause ends soon"),
    paragraphs: [
      x(`Frigia Plus reprend tout seul ${day}.`, `Frigia Plus restarts on its own on ${day}.`),
      x("Ta semaine, ta famille et tes favoris t'attendent, rien n'a bougé.", "Your week, your family and your favourites are waiting, nothing has changed."),
    ],
    button: { label: x("Ouvrir Frigia", "Open Frigia"), href: SITE },
    note: x("Tu ne veux pas reprendre ? Tu peux résilier depuis ton compte, en trois clics.", "Don't want to restart? You can cancel from your account, in three taps."),
  }, idempotencyKey);
}

/** Le compte est supprimé : la confirmation, avec la fin de l'abonnement. */
export function deletedEmail(to: string, idempotencyKey: string, lang: Lang = "fr") {
  const x = say(lang);
  return sendEmail(to, x("Ton compte Frigia est supprimé", "Your Frigia account is deleted"), {
    lang,
    title: x("Ton compte est supprimé", "Your account is deleted"),
    paragraphs: [
      x("Ton compte Frigia et tes données sont effacés : tes scans, tes favoris, ta semaine, ta liste et ta famille.",
        "Your Frigia account and your data are erased: your scans, your favourites, your week, your list and your family."),
      x("Si tu avais Frigia Plus, l'abonnement est arrêté. Aucun autre paiement ne sera prélevé.", "If you had Frigia Plus, the subscription is stopped. No further payment will be taken."),
      x("Merci d'avoir cuisiné avec nous. Tu peux revenir quand tu veux avec la même adresse.", "Thanks for cooking with us. You can come back whenever you like with the same address."),
    ],
    button: { label: x("Revenir sur Frigia", "Back to Frigia"), href: SITE },
    note: x("Ce n'est pas toi ? Réponds à cet email, on regarde tout de suite.", "Wasn't you? Reply to this email and we'll look straight away."),
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
export function waitlistEmail(to: string, firstName: string, link?: string, key = "", lang: Lang = "fr") {
  const x = say(lang);
  const title = x(`C'est noté${firstName ? `, ${firstName}` : ""} !`, `You're in${firstName ? `, ${firstName}` : ""}!`);
  const what = x("Tu es sur la liste d'attente de Frigia : tu photographies ton frigo, et Frigia te propose des recettes avec ce que tu as déjà.",
    "You're on the Frigia waiting list: you take a photo of your fridge, and Frigia suggests recipes with what you already have.");
  const note = x("Tu ne t'es pas inscrit ? Ignore cet email : on ne t'écrira pas d'autre message.", "Didn't sign up? Ignore this email: we won't write to you again.");
  // Avec le lien : l'accès tout de suite (api/waitlist.ts). Sans : les accès partent par vagues
  if (link) return sendEmail(to, x("Ton accès à Frigia", "Your access to Frigia"), {
    lang, title,
    paragraphs: [
      what,
      x("Ton accès est prêt, avec ton mois offert. Crée ton compte avec cette adresse email ou avec le compte Google qui a la même adresse.",
        "Your access is ready, with your free month. Create your account with this email address or with the Google account that has the same address."),
    ],
    button: { label: x("Créer mon compte", "Create my account"), href: link },
    note,
  }, `waitlist-link-${to}${key ? `-${key}` : ""}`);
  return sendEmail(to, x("Tu es sur la liste d'attente de Frigia", "You're on the Frigia waiting list"), {
    lang, title,
    paragraphs: [
      what,
      x("On ouvre l'appli par petits groupes. Quand c'est ton tour, tu reçois un email avec ton lien d'accès personnel.",
        "We're opening the app in small groups. When it's your turn, you'll get an email with your personal access link."),
    ],
    note,
  }, `waitlist-${to}`);
}
