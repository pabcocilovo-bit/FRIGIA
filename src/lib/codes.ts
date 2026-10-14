// Codes ami et créateur, parrainage (api/code.ts).
import { postApi } from "./api";

export type CodeVerdict =
  | { status: "ok"; perk: string; bonus?: number }
  | { status: "unknown" | "own" }
  | { status: "expired"; since: string }
  | { status: "already"; code: string };

export type Referral = { code: string; months: number; invites: { name: string; usedAt: string; subscribedAt: string | null }[] };

async function call<T>(body: unknown): Promise<T> {
  const r = await postApi("/api/code", body);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || "Ça n'a pas marché. Réessaie.");
  return data as T;
}

/** « cami r7q4 » → « CAMI-R7Q4 » tel quel, sans espaces */
export const cleanCode = (v: string) => v.trim().toUpperCase().replace(/\s+/g, "");

/** Le code existe-t-il ? (à l'inscription, sans compte) */
export const checkCode = (code: string) => call<CodeVerdict>({ action: "check", code: cleanCode(code) });
/** Utilise le code sur ce compte */
export const redeemCode = (code: string) => call<CodeVerdict>({ action: "redeem", code: cleanCode(code) });
/** Mon code ami et les amis venus avec */
export const fetchReferral = () => call<Referral>({ action: "mine" });

// Le code vérifié à l'inscription, utilisé dès que le compte existe (Google repart du site : il est gardé sur le téléphone)
const PENDING = "frigia_code";
// Le code d'un lien d'invitation (frigia.fr/i/cami-r7q4), pour préremplir l'inscription
const INVITE = "frigia_invite";
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string | null) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* navigation privée */ } };

export const setPendingCode = (code: string | null) => set(PENDING, code && cleanCode(code));
export const pendingCode = () => get(PENDING);
export const setInviteCode = (code: string) => set(INVITE, cleanCode(code));
export const inviteCode = () => get(INVITE);
export const clearInviteCode = () => set(INVITE, null);

/** frigia.fr/i/cami-r7q4 */
export const inviteLink = (code: string) => `${window.location.origin}/i/${code.toLowerCase()}`;
