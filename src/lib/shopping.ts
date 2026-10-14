// Liste de courses : les manquants d'une recette arrivent rangés par rayon, sans doublon.
import type { ShopItem } from "./home";

export const AISLES = ["Fruits et légumes", "Boucherie", "Poissonnerie", "Crèmerie", "Boulangerie", "Épicerie"] as const;

const norm = (s: string) => s.toLowerCase().replace(/œ/g, "oe").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ")
  .split(" ").filter(w => w.length > 2).map(w => w.replace(/[sx]$/, ""));

// Le premier rayon qui reconnaît un mot l'emporte (« blanc de poulet » : boucherie ; « crème » : crèmerie)
const WORDS: [typeof AISLES[number], string[]][] = [
  ["Poissonnerie", ["saumon", "thon", "cabillaud", "poisson", "crevette", "colin", "sardine", "maquereau", "truite", "lieu", "merlu", "moule", "gambas", "calamar"]],
  ["Boucherie", ["poulet", "boeuf", "porc", "veau", "agneau", "dinde", "lardon", "jambon", "saucisse", "merguez", "steak", "bacon", "chorizo",
    "viande", "hache", "escalope", "canard", "magret", "cuisse", "volaille", "filet", "rotie"]],
  ["Crèmerie", ["lait", "creme", "yaourt", "skyr", "beurre", "oeuf", "fromage", "parmesan", "emmental", "comte", "mozzarella", "feta", "chevre",
    "gruyere", "cheddar", "ricotta", "mascarpone", "raclette", "reblochon", "camembert", "brie", "roquefort", "burrata", "halloumi", "faisselle"]],
  ["Boulangerie", ["pain", "baguette", "brioche", "burger", "pita", "naan"]],
  ["Fruits et légumes", ["tomate", "courgette", "oignon", "echalote", "carotte", "pomme", "terre", "poivron", "aubergine", "avocat", "citron",
    "banane", "concombre", "poireau", "champignon", "brocoli", "chou", "salade", "laitue", "epinard", "haricot", "radi", "navet", "fenouil",
    "potiron", "courge", "butternut", "betterave", "celeri", "legume", "fruit", "mangue", "orange", "poire", "peche", "abricot", "fraise",
    "framboise", "persil", "basilic", "coriandre", "menthe", "ciboulette", "aneth", "patate", "ail", "gingembre", "citronnelle", "endive",
    "artichaut", "asperge", "blette", "roquette", "mache", "kiwi", "raisin", "melon", "cerise", "clementine", "pousse", "thym", "romarin"]],
];

export function aisleOf(name: string): string {
  const w = norm(name);
  return WORDS.find(([, list]) => w.some(x => list.includes(x)))?.[0] ?? "Épicerie";
}

const same = (a: string, b: string) => norm(a).join(" ") === norm(b).join(" ");

/** Déjà dans la liste, pas encore acheté */
export const inList = (list: ShopItem[], name: string) => list.some(x => !x.done && same(x.name, name));

/** Ajoute des articles à la liste. Déjà là et pas encore acheté : on ne le remet pas (la recette s'ajoute à « pour »). */
export function addToList(list: ShopItem[], add: { name: string; qty: string }[], from: string): { list: ShopItem[]; added: string[] } {
  const next = [...list];
  const added: string[] = [];
  for (const a of add) {
    const name = a.name.charAt(0).toUpperCase() + a.name.slice(1);
    const i = next.findIndex(x => !x.done && same(x.name, name));
    if (i >= 0) {
      if (!next[i].from.includes(from)) next[i] = { ...next[i], from: `${next[i].from}, ${from}` };
      continue;
    }
    next.push({ id: crypto.randomUUID(), name, qty: a.qty, aisle: aisleOf(name), from, done: false, at: Date.now() });
    added.push(name);
  }
  return { list: next, added };
}

/** Les articles par rayon, dans l'ordre des rayons. */
export function byAisle(list: ShopItem[]): [string, ShopItem[]][] {
  return AISLES.map(a => [a, list.filter(x => x.aisle === a)] as [string, ShopItem[]])
    .concat([...new Set(list.map(x => x.aisle))].filter(a => !(AISLES as readonly string[]).includes(a)).map(a => [a, list.filter(x => x.aisle === a)]))
    .filter(([, items]) => items.length > 0);
}

/** Le texte envoyé par WhatsApp, SMS ou copié : ce qui reste à acheter, par rayon. */
export function listText(list: ShopItem[]): string {
  const left = list.filter(x => !x.done);
  return ["Ma liste de courses Frigia", ...byAisle(left).map(([a, items]) => `\n${a}\n${items.map(x => `- ${x.name}${x.qty ? ` (${x.qty})` : ""}`).join("\n")}`)].join("\n");
}

/** « Parmesan, citron et basilic » */
export function joinNames(a: string[]): string {
  const l = a.map((x, i) => (i ? x.toLowerCase() : x));
  return l.length > 1 ? `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}` : l[0] ?? "";
}
