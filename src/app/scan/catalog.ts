// Les ingrédients proposés quand on en ajoute un à la main : ceux qu'on ajoute souvent d'abord, puis le reste de la liste,
// rangé par rayon. Ce qu'on tape et qui n'y est pas est gardé sur le compte (Ma cuisine, mine) et revient aux prochains ajouts.
import { aisleOf, norm as words } from "../../lib/shopping";

export type Cat = "legume" | "fruit" | "herbe" | "cremerie" | "viande" | "poisson" | "epicerie" | "libre";
/** from : tapé un jour par la personne (« toi ») ou par plusieurs comptes (« communaute »), pas dans la liste */
export type Sug = [name: string, cat: Cat, qty: string, from?: "toi" | "communaute"];

/** Souvent ajoutés : en tête quand on n'a rien tapé */
export const OFTEN: Sug[] = [
  ["Fromage râpé", "cremerie", "1 sachet"], ["Oignons", "legume", "3"], ["Pommes de terre", "legume", "1 kg"], ["Jambon", "viande", "4 tranches"],
  ["Crème fraîche", "cremerie", "1 pot"], ["Poulet", "viande", "2 filets"], ["Beurre", "cremerie", "1 plaquette"], ["Citron", "fruit", "2"],
  ["Lardons", "viande", "1 barquette"], ["Mozzarella", "cremerie", "1 boule"], ["Saumon", "poisson", "2 pavés"], ["Thon en boîte", "poisson", "1 boîte"],
  ["Épinards", "legume", "1 sachet"], ["Salade", "legume", "1"], ["Concombre", "legume", "1"], ["Poireaux", "legume", "2"], ["Pommes", "fruit", "4"],
  ["Persil", "herbe", "1 bouquet"], ["Basilic", "herbe", "1 pot"], ["Yaourts nature", "cremerie", "4"], ["Pâte feuilletée", "epicerie", "1 rouleau"],
  ["Pain de mie", "epicerie", "1 paquet"], ["Lentilles", "epicerie", "1 sachet"], ["Petits pois", "legume", "1 boîte"], ["Pâte à pizza", "epicerie", "1 rouleau"],
];

/** Le reste : on les trouve en cherchant */
const MORE: Sug[] = [
  // Légumes
  ["Tomates", "legume", "4"], ["Tomates cerises", "legume", "1 barquette"], ["Carottes", "legume", "4"], ["Courgettes", "legume", "2"],
  ["Poivrons", "legume", "2"], ["Aubergines", "legume", "2"], ["Ail", "legume", "1 tête"], ["Échalotes", "legume", "2"], ["Champignons", "legume", "1 barquette"],
  ["Brocoli", "legume", "1"], ["Chou-fleur", "legume", "1"], ["Chou", "legume", "1"], ["Haricots verts", "legume", "500 g"], ["Avocats", "legume", "2"],
  ["Patates douces", "legume", "2"], ["Potimarron", "legume", "1"], ["Butternut", "legume", "1"], ["Betteraves", "legume", "2"], ["Céleri", "legume", "1"],
  ["Fenouil", "legume", "1"], ["Radis", "legume", "1 botte"], ["Navets", "legume", "3"], ["Endives", "legume", "4"], ["Asperges", "legume", "1 botte"],
  ["Artichauts", "legume", "2"], ["Maïs", "legume", "1 boîte"], ["Roquette", "legume", "1 sachet"], ["Mâche", "legume", "1 sachet"],
  ["Gingembre", "legume", "1 morceau"], ["Pois chiches", "epicerie", "1 boîte"], ["Haricots rouges", "epicerie", "1 boîte"],
  // Fruits
  ["Bananes", "fruit", "4"], ["Oranges", "fruit", "4"], ["Poires", "fruit", "4"], ["Fraises", "fruit", "1 barquette"], ["Framboises", "fruit", "1 barquette"],
  ["Kiwis", "fruit", "4"], ["Raisin", "fruit", "1 grappe"], ["Mangue", "fruit", "1"], ["Ananas", "fruit", "1"], ["Clémentines", "fruit", "6"],
  ["Pêches", "fruit", "4"], ["Abricots", "fruit", "6"], ["Melon", "fruit", "1"], ["Citron vert", "fruit", "2"], ["Myrtilles", "fruit", "1 barquette"],
  // Herbes
  ["Coriandre", "herbe", "1 bouquet"], ["Menthe", "herbe", "1 bouquet"], ["Ciboulette", "herbe", "1 bouquet"], ["Thym", "herbe", "1 bouquet"],
  ["Romarin", "herbe", "1 branche"], ["Aneth", "herbe", "1 bouquet"],
  // Crèmerie
  ["Œufs", "cremerie", "6"], ["Lait", "cremerie", "1 l"], ["Crème liquide", "cremerie", "20 cl"], ["Emmental", "cremerie", "200 g"],
  ["Parmesan", "cremerie", "1 morceau"], ["Comté", "cremerie", "200 g"], ["Feta", "cremerie", "1 bloc"], ["Fromage de chèvre", "cremerie", "1 bûche"],
  ["Ricotta", "cremerie", "1 pot"], ["Mascarpone", "cremerie", "1 pot"], ["Camembert", "cremerie", "1"], ["Raclette", "cremerie", "400 g"],
  ["Reblochon", "cremerie", "1"], ["Skyr", "cremerie", "1 pot"], ["Fromage blanc", "cremerie", "1 pot"], ["Burrata", "cremerie", "1"],
  // Viandes
  ["Bœuf haché", "viande", "500 g"], ["Steaks hachés", "viande", "4"], ["Escalopes de dinde", "viande", "2"], ["Saucisses", "viande", "4"],
  ["Merguez", "viande", "4"], ["Chorizo", "viande", "1"], ["Bacon", "viande", "1 paquet"], ["Côtes de porc", "viande", "2"],
  ["Cuisses de poulet", "viande", "4"], ["Bœuf à braiser", "viande", "800 g"], ["Magret de canard", "viande", "1"], ["Jambon cru", "viande", "4 tranches"],
  // Poissons
  ["Cabillaud", "poisson", "2 dos"], ["Crevettes", "poisson", "1 barquette"], ["Sardines en boîte", "poisson", "1 boîte"], ["Colin", "poisson", "2 filets"],
  ["Saumon fumé", "poisson", "4 tranches"], ["Moules", "poisson", "1 kg"], ["Maquereau", "poisson", "2"], ["Surimi", "poisson", "1 paquet"],
  // Épicerie
  ["Pâtes", "epicerie", "500 g"], ["Spaghetti", "epicerie", "500 g"], ["Riz", "epicerie", "500 g"], ["Semoule", "epicerie", "500 g"],
  ["Quinoa", "epicerie", "1 sachet"], ["Boulgour", "epicerie", "1 sachet"], ["Nouilles", "epicerie", "1 paquet"], ["Lasagnes", "epicerie", "1 paquet"],
  ["Gnocchis", "epicerie", "1 paquet"], ["Farine", "epicerie", "1 kg"], ["Sucre", "epicerie", "1 kg"], ["Levure chimique", "epicerie", "1 sachet"],
  ["Huile d'olive", "epicerie", "1 bouteille"], ["Huile", "epicerie", "1 bouteille"], ["Vinaigre", "epicerie", "1 bouteille"], ["Moutarde", "epicerie", "1 pot"],
  ["Sauce tomate", "epicerie", "1 pot"], ["Tomates pelées", "epicerie", "1 boîte"], ["Concentré de tomate", "epicerie", "1 tube"],
  ["Lait de coco", "epicerie", "1 boîte"], ["Bouillon cube", "epicerie", "1 boîte"], ["Sauce soja", "epicerie", "1 bouteille"], ["Curry", "epicerie", "1 pot"],
  ["Paprika", "epicerie", "1 pot"], ["Cumin", "epicerie", "1 pot"], ["Miel", "epicerie", "1 pot"], ["Chocolat", "epicerie", "1 tablette"],
  ["Chapelure", "epicerie", "1 paquet"], ["Pâte brisée", "epicerie", "1 rouleau"], ["Galettes de blé", "epicerie", "1 paquet"], ["Pain", "epicerie", "1"],
  ["Baguette", "epicerie", "1"], ["Olives", "epicerie", "1 bocal"], ["Cornichons", "epicerie", "1 bocal"], ["Noix", "epicerie", "1 sachet"],
  ["Amandes", "epicerie", "1 sachet"], ["Flocons d'avoine", "epicerie", "1 paquet"], ["Biscuits", "epicerie", "1 paquet"], ["Confiture", "epicerie", "1 pot"],
];

export const CATALOG: Sug[] = [...OFTEN, ...MORE];

/** Même produit, à l'accent, à la casse et au pluriel près (« Pates » = « Pâtes ») */
export const same = (a: string, b: string) => {
  const x = words(a).join(" "), y = words(b).join(" ");
  return x || y ? x === y : a.trim().toLowerCase() === b.trim().toLowerCase();
};

const CAT_OF: Record<string, Cat> = { "Fruits et légumes": "legume", Boucherie: "viande", Poissonnerie: "poisson", Crèmerie: "cremerie" };
/** Un ingrédient tapé à la main, rangé au rayon deviné d'après son nom */
export const typedSug = (name: string, from: "toi" | "communaute"): Sug => [name, CAT_OF[aisleOf(name)] ?? "epicerie", "", from];

/** Garde les ingrédients tapés qui ne sont pas dans la liste : les derniers en tête, sans doublon, 80 au plus. */
export function rememberMine(mine: string[], names: string[]): string[] {
  const fresh = names.filter(n => n.trim() && !CATALOG.some(c => same(c[0], n)));
  if (!fresh.length) return mine;
  const out: string[] = [];
  for (const n of [...fresh, ...mine]) if (!out.some(x => same(x, n))) out.push(n);
  return out.slice(0, 80);
}
