// Messages d'erreur de Supabase (en anglais) traduits pour les écrans de connexion.
export const JETABLE = "Les adresses email jetables ne sont pas acceptées. Prends ton adresse habituelle.";

export function authMessage(e: unknown): string {
  const raw = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
  const m = (code + " " + raw).toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid_credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("already registered") || m.includes("user_already_exists")) return "Un compte existe déjà avec cet email. Connecte-toi.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token") || m.includes("otp")) return "Ce code ne marche pas. Vérifie-le ou demande un nouveau code.";
  if (m.includes("rate limit") || m.includes("over_email_send_rate_limit") || m.includes("too many")) return "Trop d'essais. Réessaie dans quelques minutes.";
  // Refusé par la base (migration 20261103000000) : Supabase ne transmet que « Database error saving new user »
  if (m.includes("email_jetable") || m.includes("database error saving new user")) return JETABLE;
  if (m.includes("captcha")) return "La vérification anti-robot n'a pas marché. Réessaie.";
  if (m.includes("password") && (m.includes("weak") || m.includes("characters") || m.includes("short"))) return "8 caractères minimum";
  if (m.includes("email") && m.includes("invalid")) return "Cet email n'a pas l'air complet.";
  if (m.includes("fetch") || m.includes("network")) return "Pas de réseau. Réessaie dans un instant.";
  return "Ça n'a pas marché. Réessaie.";
}

export const isEmailNotConfirmed = (e: unknown) =>
  !!e && typeof e === "object" && /not.confirmed/i.test(String((e as { message?: unknown; code?: unknown }).code ?? "") + " " + String((e as { message?: unknown }).message ?? ""));

export const looksLikeEmail = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());
