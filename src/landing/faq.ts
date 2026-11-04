// Questions de la landing. Une seule source : la page les affiche, et le pré-rendu
// (scripts/prerender.mjs) en tire le bloc FAQPage lu par Google et les assistants IA.
// Chaque réponse se lit seule, sans le reste de la page : c'est ce que les IA reprennent.
import { t } from "../lib/i18n";

export type Faq = { id: string; q: string; a: string };

export const FAQ: Faq[] = t<Faq[]>([
  {
    id: "quoi",
    q: "Frigia, c'est quoi ?",
    a: "Frigia est une application web française qui te propose trois recettes à partir d'une photo de ton frigo. Elle repère tes ingrédients, tient compte de qui mange (âges, allergies, goûts) et commence par ce qui se périme, pour moins gaspiller. Elle marche dans le navigateur et s'ajoute à l'écran d'accueil, sur iPhone comme sur Android.",
  },
  {
    id: "frigo-vide",
    q: "Et si mon frigo est presque vide ?",
    a: "Frigia sert aussi sans scan. Dans l'onglet Explorer, tu cherches une recette ou un ingrédient, ou tu parcours la recette du jour, le Top 10 et des catégories : rapides, healthy, petit budget, famille, desserts. Un plat précis, comme une tartiflette, arrive en trois versions : la classique et deux variantes. Sur chaque recette, tu vois ce qu'il te manque. Explorer est compris dans Frigia Plus et dans l'essai de 7 jours.",
  },
  {
    id: "prix",
    q: "Combien coûte Frigia ?",
    a: "Tu essaies 7 jours sans payer et sans carte bancaire. Ensuite, Frigia Plus coûte 6,99 € par mois ou 39,99 € par an. Plus est sans engagement.",
  },
  {
    id: "carte",
    q: "Faut-il une carte bancaire pour essayer ?",
    a: "Non. L'essai de 7 jours se lance avec ton email ou ton compte Google, sans carte. Tout Frigia Plus est compris.",
  },
  {
    id: "fin-essai",
    q: "Et à la fin des 7 jours ?",
    a: "Rien n'est débité. Pour continuer à scanner, tu choisis Frigia Plus, au mois ou à l'année. Tes recettes, tes favoris et ta cuisine restent sur ton compte.",
  },
  {
    id: "appli",
    q: "Faut-il télécharger une appli ?",
    a: "Non. Frigia s'ouvre dans ton navigateur et s'ajoute à l'écran d'accueil de ton téléphone, comme une appli, sans passer par un store.",
  },
  {
    id: "famille",
    q: "Ça marche avec des enfants et des allergies ?",
    a: "Oui. Avec Frigia Plus, chaque membre du foyer a son profil : âge, allergies et ce qu'il n'aime pas. Les recettes en tiennent compte. Vérifie quand même les étiquettes, surtout en cas d'allergie.",
  },
  {
    id: "resilier",
    q: "Je peux arrêter Plus quand je veux ?",
    a: "Oui, c'est sans engagement. Tu résilies depuis tes réglages, en quelques gestes, et Plus reste actif jusqu'à la fin de la période payée.",
  },
], [
  {
    id: "quoi",
    q: "What is Frigia?",
    a: "Frigia is a French web app that suggests three recipes from a photo of your fridge. It spots your ingredients, takes into account who's eating (ages, allergies, tastes) and starts with what goes off first, so you waste less. It works in the browser and can be added to your home screen, on iPhone and Android.",
  },
  {
    id: "frigo-vide",
    q: "What if my fridge is nearly empty?",
    a: "Frigia works without a scan too. In the Explore tab, you search for a recipe or an ingredient, or browse the recipe of the day, the Top 10 and categories: quick, healthy, budget, family, desserts. A specific dish, like a tartiflette, comes in three versions: the classic and two variations. On every recipe, you see what you're missing. Explore is included in Frigia Plus and in the 7-day trial.",
  },
  {
    id: "prix",
    q: "How much does Frigia cost?",
    a: "You try it for 7 days without paying and without a card. After that, Frigia Plus costs €6.99 a month or €39.99 a year. Plus has no commitment.",
  },
  {
    id: "carte",
    q: "Do I need a card to try it?",
    a: "No. The 7-day trial starts with your email or your Google account, no card needed. All of Frigia Plus is included.",
  },
  {
    id: "fin-essai",
    q: "What happens after the 7 days?",
    a: "Nothing is charged. To keep scanning, you choose Frigia Plus, monthly or yearly. Your recipes, your favourites and your kitchen stay on your account.",
  },
  {
    id: "appli",
    q: "Do I need to download an app?",
    a: "No. Frigia opens in your browser and can be added to your phone's home screen, like an app, without going through a store.",
  },
  {
    id: "famille",
    q: "Does it work with kids and allergies?",
    a: "Yes. With Frigia Plus, each member of the household has a profile: age, allergies and what they don't like. The recipes take them into account. Still check the labels, especially with allergies.",
  },
  {
    id: "resilier",
    q: "Can I stop Plus whenever I want?",
    a: "Yes, there's no commitment. You cancel from your settings in a few taps, and Plus stays active until the end of the paid period.",
  },
]);
