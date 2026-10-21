// Réponses aux questions de l'inscription, gardées le temps du parcours (même si la page se recharge).
import { useSyncExternalStore } from "react";
import { EMPTY_PROFILE, type Profile } from "../../lib/profile";

const KEY = "frigia_ob_answers";
const read = (): Profile => {
  try { return { ...EMPTY_PROFILE, ...JSON.parse(sessionStorage.getItem(KEY) || "{}") }; } catch { return EMPTY_PROFILE; }
};
let state: Profile = read();
const listeners = new Set<() => void>();
const set = (next: Profile) => {
  state = next;
  try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* navigation privée : on garde en mémoire */ }
  listeners.forEach(l => l());
};

export function useAnswers(): [Profile, (patch: Partial<Profile>) => void] {
  const value = useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => state);
  return [value, patch => set({ ...state, ...patch })];
}

/** Repart de zéro (nouvelle inscription) ou des goûts du compte (« Modifier »). */
export const resetAnswers = (from: Profile = EMPTY_PROFILE) => set(from);

// Email en cours d'inscription : l'écran du code en a besoin, même après un rechargement
const MAIL = "frigia_ob_email";
export const setSignupEmail = (email: string) => { try { sessionStorage.setItem(MAIL, email); } catch { /* rien */ } };
export const getSignupEmail = () => { try { return sessionStorage.getItem(MAIL) || ""; } catch { return ""; } };
