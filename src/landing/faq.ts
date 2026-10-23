// Questions de la landing. Une seule source : la page les affiche, et le pré-rendu
// (scripts/prerender.mjs) en tire le bloc FAQPage lu par Google et les assistants IA.
// Chaque réponse se lit seule, sans le reste de la page : c'est ce que les IA reprennent.
export type Faq = { id: string; q: string; a: string };

export const FAQ: Faq[] = [
  {
    id: "quoi",
    q: "Frigia, c'est quoi ?",
    a: "Frigia est une application web française qui te propose trois recettes à partir d'une photo de ton frigo. Elle repère tes ingrédients, tient compte de qui mange (âges, allergies, goûts) et commence par ce qui se périme, pour moins gaspiller. Elle marche dans le navigateur et s'ajoute à l'écran d'accueil, sur iPhone comme sur Android.",
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
];
