// Le foyer en Plus : toi d'abord, puis tes proches. Qui mange, combien de portions (selon l'appétit de chacun),
// et ce que les recettes doivent respecter (allergies, ce que chacun n'aime pas).
import { ME, type Member } from "./home";
import type { Profile } from "./profile";
import type { GeneratedRecipe } from "./types";

export type Person = Member & { me?: boolean };

/** Toi (prénom et allergies du compte, ce que tu n'aimes pas gardé dans le foyer), puis tes proches. */
export function people(name: string, profile: Profile | null, members: Member[]): Person[] {
  const mine = members.find(m => m.id === ME);
  const me: Person = { id: ME, name, kid: false, age: 0, allergies: profile?.allergies ?? [], dislikes: mine?.dislikes ?? [], appetite: mine?.appetite, me: true };
  return [me, ...members.filter(m => m.id !== ME)];
}

export const num = (n: number) => String(n).replace(".", ",");
/** L'appétit, de 1 à 5, et ce qu'il mange en portions */
export const APPETITE: { label: string; part: number }[] = [
  { label: "Petit appétit", part: 0.5 }, { label: "Appétit léger", part: 0.75 }, { label: "Appétit normal", part: 1 },
  { label: "Bon appétit", part: 1.25 }, { label: "Gros mangeur", part: 1.5 },
];
/** Sans réglage : un enfant de moins de 12 ans a un petit appétit (une demi-portion), les autres un appétit normal */
export const appetiteOf = (p: Pick<Member, "kid" | "age" | "appetite">) =>
  Math.min(5, Math.max(1, Math.round(p.appetite ?? (p.kid && p.age < 12 ? 1 : 3))));
export const partOf = (p: Pick<Member, "kid" | "age" | "appetite">) => APPETITE[appetiteOf(p) - 1].part;
/** Les portions du repas, arrondies à la demi-portion ; un invité compte pour une */
export const portionsOf = (eaters: Person[], guests: number) => Math.round(2 * eaters.reduce((s, p) => s + partOf(p), 0)) / 2 + guests || 1;
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
  const app = p.appetite != null && appetiteOf(p) !== 3 ? `${APPETITE[appetiteOf(p) - 1].label.toLowerCase()} · ` : "";
  return { text: (p.kid ? "" : "Adulte · ") + app + t, alert: false };
}

/** Ce que l'IA reçoit pour adapter les recettes à ceux qui mangent. */
export type ApiEater = { name: string; kid: boolean; age?: number; allergies: string[]; dislikes: string[] };
export const apiEaters = (eaters: Person[]): ApiEater[] =>
  eaters.map(p => ({ name: p.name, kid: p.kid, age: p.kid ? p.age : undefined, allergies: p.allergies, dislikes: p.dislikes }));

/** « Pour 4 ce soir : Camille, Thomas, Léo et Jade » */
export function forTonight(eaters: Person[], guests: number, when = "ce soir"): string {
  const list = eaters.map(p => p.name);
  if (guests) list.push(`${guests} invité${guests > 1 ? "s" : ""}`);
  return `Pour ${eaters.length + guests} ${when} : ${names(list)}`;
}

/** Plus : « Les enfants adorent », « Sans champignons » (ce que quelqu'un du foyer n'aime pas) */
/** Les étiquettes d'une recette : d'où elle vient (pour tous), puis le foyer (Plus) */
export const recipeBadges = (r: GeneratedRecipe, isPlus: boolean): string[] => [...(r.origin ? [r.origin] : []), ...(isPlus ? familyBadges(r) : [])];

export function familyBadges(r: GeneratedRecipe): string[] {
  return [...(r.kids ? ["Les enfants adorent"] : []), ...(r.without ?? []).slice(0, 1).map(w => `Sans ${w}`)];
}
