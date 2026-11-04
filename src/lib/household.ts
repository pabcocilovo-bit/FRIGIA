// Le foyer en Plus : toi d'abord, puis tes proches. Qui mange, combien de portions (selon l'appétit de chacun),
// et ce que les recettes doivent respecter (allergies, ce que chacun n'aime pas).
import { ME, type Member } from "./home";
import type { Profile } from "./profile";
import type { GeneratedRecipe } from "./types";
import { allergyName } from "./allergens";
import { isEn, t } from "./i18n";

export type Person = Member & { me?: boolean };

/** Toi (prénom et allergies du compte, ce que tu n'aimes pas gardé dans le foyer), puis tes proches. */
export function people(name: string, profile: Profile | null, members: Member[]): Person[] {
  const mine = members.find(m => m.id === ME);
  const me: Person = { id: ME, name, kid: false, age: 0, allergies: profile?.allergies ?? [], dislikes: mine?.dislikes ?? [], appetite: mine?.appetite, me: true };
  return [me, ...members.filter(m => m.id !== ME)];
}

export const num = (n: number) => (isEn ? String(n) : String(n).replace(".", ","));
/** L'appétit, de 1 à 5, et ce qu'il mange en portions */
export const APPETITE: { label: string; part: number }[] = [
  { label: t("Petit appétit", "Small appetite"), part: 0.5 }, { label: t("Appétit léger", "Light appetite"), part: 0.75 },
  { label: t("Appétit normal", "Normal appetite"), part: 1 }, { label: t("Bon appétit", "Big appetite"), part: 1.25 },
  { label: t("Gros mangeur", "Very big eater"), part: 1.5 },
];
/** Sans réglage : un enfant de moins de 12 ans a un petit appétit (une demi-portion), les autres un appétit normal */
export const appetiteOf = (p: Pick<Member, "kid" | "age" | "appetite">) =>
  Math.min(5, Math.max(1, Math.round(p.appetite ?? (p.kid && p.age < 12 ? 1 : 3))));
export const partOf = (p: Pick<Member, "kid" | "age" | "appetite">) => APPETITE[appetiteOf(p) - 1].part;
/** Les portions du repas, arrondies à la demi-portion ; un invité compte pour une */
export const portionsOf = (eaters: Person[], guests: number) => Math.round(2 * eaters.reduce((s, p) => s + partOf(p), 0)) / 2 + guests || 1;
export const portTxt = (n: number) => `${num(n)} ${t("portion", "serving")}${n > 1 || (isEn && n !== 1) ? "s" : ""}`;

/** « Léo, Jade et 1 invité » */
export const names = (a: string[]) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} ${t("et", "and")} ${a[a.length - 1]}` : a[0] ?? "");

/** « 2 adultes, 2 enfants et 1 invité » */
export function whoParts(eaters: Person[], guests: number): string {
  const a = eaters.filter(p => !p.kid).length, k = eaters.length - a;
  let parts = [a && `${a} ${t("adulte", "adult")}${a > 1 ? "s" : ""}`, k && `${k} ${t(k > 1 ? "enfants" : "enfant", k > 1 ? "children" : "child")}`, guests && guestTxt(guests)].filter(Boolean) as string[];
  if (parts.length > 2) parts = [parts.slice(0, -1).join(", "), parts[parts.length - 1]];
  return parts.join(t(" et ", " and "));
}

/** « Allergie de Jade (arachides) : aucune recette n'en contient. Sans champignons pour Léo. » */
export function whoNote(eaters: Person[], when: string): string {
  const n: string[] = [];
  for (const p of eaters) {
    const al = p.allergies.map(allergyName).join(", ");
    if (p.allergies.length) n.push(t(`Allergie de ${p.name} (${al}) : aucune recette n'en contient.`, `${p.name}'s allergy (${al}): no recipe contains it.`));
    const d = p.dislikes;
    if (d.length) n.push(t(`Sans ${d.length > 1 ? `${d.slice(0, -1).join(", ")} ni ${d[d.length - 1]}` : d[0]} pour ${p.name}.`,
      `No ${d.length > 1 ? `${d.slice(0, -1).join(", ")} or ${d[d.length - 1]}` : d[0]} for ${p.name}.`));
  }
  return n.join(" ") || t(`Pas de contrainte ${when}.`, `No restrictions ${when}.`);
}

/** Ligne sous un proche dans Famille : « Allergie : arachides », « N'aime pas : champignons », « Adulte · aime tout » */
export function memberSub(p: Person): { text: string; alert: boolean } {
  if (p.allergies.length) return { text: `${t("Allergie", "Allergy")}${t(" : ", ": ")}${p.allergies.map(allergyName).join(", ")}`, alert: true };
  const likes = p.dislikes.length ? t(`N'aime pas : ${p.dislikes.join(", ")}`, `Doesn't like: ${p.dislikes.join(", ")}`) : t("aime tout", "likes everything");
  const app = p.appetite != null && appetiteOf(p) !== 3 ? `${APPETITE[appetiteOf(p) - 1].label.toLowerCase()} · ` : "";
  return { text: (p.kid ? "" : t("Adulte · ", "Adult · ")) + app + likes, alert: false };
}

/** Ce que l'IA reçoit pour adapter les recettes à ceux qui mangent. */
export type ApiEater = { name: string; kid: boolean; age?: number; allergies: string[]; dislikes: string[] };
export const apiEaters = (eaters: Person[]): ApiEater[] =>
  eaters.map(p => ({ name: p.name, kid: p.kid, age: p.kid ? p.age : undefined, allergies: p.allergies, dislikes: p.dislikes }));

/** « Pour 4 ce soir : Camille, Thomas, Léo et Jade » */
export const guestTxt = (g: number) => `${g} ${t("invité", "guest")}${g > 1 ? "s" : ""}`;

export function forTonight(eaters: Person[], guests: number, when = t("ce soir", "tonight")): string {
  const list = eaters.map(p => p.name);
  if (guests) list.push(guestTxt(guests));
  return t(`Pour ${eaters.length + guests} ${when} : ${names(list)}`, `For ${eaters.length + guests} ${when}: ${names(list)}`);
}

/** Plus : « Les enfants adorent », « Sans champignons » (ce que quelqu'un du foyer n'aime pas) */
/** Les étiquettes d'une recette : d'où elle vient (pour tous), puis le foyer (Plus) */
export const recipeBadges = (r: GeneratedRecipe, isPlus: boolean): string[] => [...(r.origin ? [r.origin] : []), ...(isPlus ? familyBadges(r) : [])];

export function familyBadges(r: GeneratedRecipe): string[] {
  return [...(r.kids ? [t("Les enfants adorent", "Kids love it")] : []), ...(r.without ?? []).slice(0, 1).map(w => t(`Sans ${w}`, `No ${w}`))];
}
