// Messages d'erreur de Supabase (en anglais) traduits pour les écrans de connexion.
import { t } from "../../lib/i18n";
export const JETABLE = t("Les adresses email jetables ne sont pas acceptées. Prends ton adresse habituelle.", "Disposable email addresses aren't accepted. Use your usual address.");

export const NOT_INVITED = t("Cette adresse n'est pas sur la liste d'attente. Utilise celle qui a reçu le lien, ou inscris-toi sur la liste.", "This address isn't on the waitlist. Use the one that got the link, or join the list.");

export function authMessage(e: unknown): string {
  const raw = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
  const m = (code + " " + raw).toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid_credentials")) return t("Email ou mot de passe incorrect.", "Wrong email or password.");
  if (m.includes("already registered") || m.includes("user_already_exists")) return t("Un compte existe déjà avec cet email. Connecte-toi.", "An account already exists with this email. Sign in.");
  if (m.includes("expired") || m.includes("invalid") && m.includes("token") || m.includes("otp")) return t("Ce code ne marche pas. Vérifie-le ou demande un nouveau code.", "This code doesn't work. Check it or ask for a new one.");
  if (m.includes("rate limit") || m.includes("over_email_send_rate_limit") || m.includes("too many")) return t("Trop d'essais. Réessaie dans quelques minutes.", "Too many attempts. Try again in a few minutes.");
  // Refusé par la base (migrations 20261103000000 et 20261104000000) : Supabase ne transmet que « Database error saving new user ».
  // Un email jetable est déjà repéré avant (email_jetable) : il reste un email sans accès de la liste d'attente.
  if (m.includes("email_jetable")) return JETABLE;
  if (m.includes("pas_invite") || m.includes("database error saving new user")) return NOT_INVITED;
  if (m.includes("captcha")) return t("La vérification anti-robot n'a pas marché. Réessaie.", "The anti-robot check didn't work. Try again.");
  if (m.includes("password") && (m.includes("weak") || m.includes("characters") || m.includes("short"))) return t("8 caractères minimum", "8 characters minimum");
  if (m.includes("email") && m.includes("invalid")) return t("Cet email n'a pas l'air complet.", "This email doesn't look complete.");
  if (m.includes("fetch") || m.includes("network")) return t("Pas de réseau. Réessaie dans un instant.", "No connection. Try again in a moment.");
  return t("Ça n'a pas marché. Réessaie.", "That didn't work. Try again.");
}

export const isEmailNotConfirmed = (e: unknown) =>
  !!e && typeof e === "object" && /not.confirmed/i.test(String((e as { message?: unknown; code?: unknown }).code ?? "") + " " + String((e as { message?: unknown }).message ?? ""));

export const looksLikeEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());
