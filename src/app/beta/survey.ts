// Le questionnaire de la bêta (maquette de Hugo, 26 octobre) : quand le proposer, et l'envoi des réponses.
// Proposé sur l'accueil à partir du 5e jour, si la personne a déjà scanné ou cuisiné au moins deux fois.
// Toujours accessible depuis Mon profil (« Donner mon avis »). BETA à false au lancement public.
import { supabase } from "../../supabase";
import type { User } from "../../lib/types";

export const BETA = true;

const DAY_MS = 86_400_000;
const FROM_DAY = 5;
const SNOOZE_DAYS = 2;
// « Plus tard » deux fois : la carte ne revient plus (la ligne de Mon profil reste)
const MAX_SNOOZES = 2;

type Seen = { done?: boolean; until?: number; n?: number };
const key = (userId: string) => `frigia.avis.${userId}`;
const read = (userId: string): Seen => { try { return JSON.parse(localStorage.getItem(key(userId)) ?? "{}") as Seen; } catch { return {}; } };
const write = (userId: string, s: Seen) => { try { localStorage.setItem(key(userId), JSON.stringify(s)); } catch { /* navigation privée */ } };

export function shouldAskFeedback(user: User | null | undefined, uses: number, now = Date.now()): boolean {
  if (!BETA || !user?.created_at || uses < 2) return false;
  if (now - new Date(user.created_at).getTime() < FROM_DAY * DAY_MS) return false;
  const s = read(user.id);
  return !s.done && (s.n ?? 0) < MAX_SNOOZES && now >= (s.until ?? 0);
}

export function snoozeFeedback(userId: string, now = Date.now()) {
  const s = read(userId);
  write(userId, { ...s, until: now + SNOOZE_DAYS * DAY_MS, n: (s.n ?? 0) + 1 });
}

export type Answers = Record<string, string | string[]>;

export async function sendFeedback(userId: string, answers: Answers, source: string) {
  const { error } = await supabase.from("beta_feedback").insert({ user_id: userId, answers, source });
  if (error) throw error;
  write(userId, { ...read(userId), done: true });
}
