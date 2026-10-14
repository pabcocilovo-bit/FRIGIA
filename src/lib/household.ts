// Le foyer en Plus : toi d'abord, puis tes proches. Qui mange, combien de portions (un enfant compte pour une demi),
// et ce que les recettes doivent respecter (allergies, ce que chacun n'aime pas).
import { ME, type Member } from "./home";
import type { Profile } from "./profile";
import type { GeneratedRecipe } from "./types";

export type Person = Member & { me?: boolean };

/** Toi (prénom et allergies du compte, ce que tu n'aimes pas gardé dans le foyer), puis tes proches. */
export function people(name: string, profile: Profile | null, members: Member[]): Person[] {
  const mine = members.find(m => m.id === ME);
  const me: Person = { id: ME, name, kid: false, age: 0, allergies: profile?.allergies ?? [], dislikes: mine?.dislikes ?? [], me: true };
  return [me, ...members.filter(m => m.id !== ME)];
}

export const num = (n: number) => String(n).replace(".", ",");
export const portionsOf = (eaters: Person[], guests: number) => eaters.reduce((s, p) => s + (p.kid ? 0.5 : 1), 0) + guests || 1;
export const portTxt = (n: number) => `${num(n)} portion${n > 1 ? "s" : ""}`;

/** « Léo, Jade et 1 invité » */
export const names = (a: string[]) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} et ${a[a.length - 1]}` : a[0] ?? "");

/** « 2 adultes, 2 enfants et 1 invité » */
export function whoParts(eaters: Person[], guests: number): string {
  const a = eaters.filter(p => !p.kid).length, k = eaters.length - a;
  let parts = [a && `${a} adulte${a > 1 ? "s" : ""}`, k && `${k} enfant${k > 1 ? "s" : ""}`, guests && `${guests} invité${guests > 1 ? "s" : ""}`].filter(Boolean) as string[];
  if (parts.length > 2) parts = [parts.slice(0, -1).join(", "), parts[parts.length - 1]];
  return parts.join(" et ");
}

/** « Allergie de Jade (arachides) : aucune recette n'en contient. Sans champignons pour Léo. » */
export function whoNote(eaters: Person[], when: string): string {
  const n: string[] = [];
  for (const p of eaters) {
    if (p.allergies.length) n.push(`Allergie de ${p.name} (${p.allergies.join(", ")}) : aucune recette n'en contient.`);
    if (p.dislikes.length) n.push(`Sans ${p.dislikes.length > 1 ? `${p.dislikes.slice(0, -1).join(", ")} ni ${p.dislikes[p.dislikes.length - 1]}` : p.dislikes[0]} pour ${p.name}.`);
  }
  return n.join(" ") || `Pas de contrainte ${when}.`;
}

/** Ligne sous un proche dans Famille : « Allergie : arachides », « N'aime pas : champignons », « Adulte · aime tout » */
export function memberSub(p: Person): { text: string; alert: boolean } {
  if (p.allergies.length) return { text: `Allergie : ${p.allergies.join(", ")}`, alert: true };
  const t = p.dislikes.length ? `N'aime pas : ${p.dislikes.join(", ")}` : "aime tout";
  return { text: (p.kid ? "" : "Adulte · ") + t, alert: false };
}

/** Ce que l'IA reçoit pour adapter les recettes à ceux qui mangent. */
export type ApiEater = { name: string; kid: boolean; age?: number; allergies: string[]; dislikes: string[] };
export const apiEaters = (eaters: Person[]): ApiEater[] =>
  eaters.map(p => ({ name: p.name, kid: p.kid, age: p.kid ? p.age : undefined, allergies: p.allergies, dislikes: p.dislikes }));

/** « Pour 4 ce soir : Camille, Thomas, Léo et Jade » */
export function forTonight(eaters: Person[], guests: number): string {
  const list = eaters.map(p => p.name);
  if (guests) list.push(`${guests} invité${guests > 1 ? "s" : ""}`);
  return `Pour ${eaters.length + guests} ce soir : ${names(list)}`;
}

/** Plus : « Les enfants adorent », « Sans champignons » (ce que quelqu'un du foyer n'aime pas) */
export function familyBadges(r: GeneratedRecipe): string[] {
  return [...(r.kids ? ["Les enfants adorent"] : []), ...(r.without ?? []).slice(0, 1).map(w => `Sans ${w}`)];
}
