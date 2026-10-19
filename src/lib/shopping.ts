// Liste de courses : les manquants d'une recette arrivent rangés par rayon, sans doublon.
import type { ShopItem } from "./home";

export const AISLES = ["Fruits et légumes", "Boucherie", "Poissonnerie", "Crèmerie", "Boulangerie", "Épicerie"] as const;

/** Les mots d'un nom, sans accent ni pluriel (« Tomates cerises » → tomate, cerise) */
export const norm = (s: string) => s.toLowerCase().replace(/œ/g, "oe").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, " ")
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

export const same = (a: string, b: string) => norm(a).join(" ") === norm(b).join(" ");

/** Déjà dans la liste, pas encore acheté */
export const inList = (list: ShopItem[], name: string) => list.some(x => !x.done && same(x.name, name));
/** Déjà dans la liste pour cette quantité (ou la ligne sert aussi à d'autres recettes) */
export const inListAs = (list: ShopItem[], a: { name: string; qty: string }, from: string) =>
  list.some(x => !x.done && same(x.name, a.name) && (x.qty === a.qty || !onlyFrom(x, from)));

/** « 12½ cl » → 12,5 et « cl ». null : pas de nombre au début (« 1 pot » oui, « un peu » non). */
function parseQty(q: string): { v: number; u: string } | null {
  const m = q.trim().match(/^(\d+(?:[.,]\d+)?)?(½)?\s*(.*)$/);
  if (!m || (!m[1] && !m[2])) return null;
  return { v: (m[1] ? parseFloat(m[1].replace(",", ".")) : 0) + (m[2] ? 0.5 : 0), u: m[3].trim() };
}
const unitKey = (u: string) => u.toLowerCase().replace(/s$/, "");
const COUNTED = ["gousse", "tranche", "feuille", "pot", "boîte", "botte", "sachet"];
function fmtQty(v: number, u: string): string {
  if (u === "g" && v >= 1000) return `${String(Math.round(v / 100) / 10).replace(".", ",")} kg`;
  const r = Math.round(v * 2) / 2;
  const n = Number.isInteger(r) ? String(r) : r % 1 === 0.5 ? `${Math.floor(r) || ""}½` : String(Math.round(v * 10) / 10).replace(".", ",");
  const unit = COUNTED.includes(unitKey(u)) ? unitKey(u) + (v > 1 ? "s" : "") : u;
  return unit ? `${n} ${unit}` : n;
}
/** Deux recettes demandent le même ingrédient : « 40 g » + « 30 g » = « 70 g ». Unités différentes : « 40 g + 2 c. à s. ». */
export function sumQty(a: string, b: string): string {
  if (!a.trim()) return b;
  if (!b.trim()) return a;
  const x = parseQty(a), y = parseQty(b);
  if (x && y && unitKey(x.u) === unitKey(y.u)) return fmtQty(x.v + y.v, x.u || y.u);
  return `${a} + ${b}`;
}
const recipeOf = (from: string) => from.split(" · ")[0];

export const BY_HAND = "Ajouté à la main";
const onlyFrom = (x: ShopItem, from: string) => x.from.split(", ").every(f => recipeOf(f) === recipeOf(from));

/** Ajoute des articles à la liste. Déjà là et pas encore acheté : une seule ligne, les quantités s'additionnent
 *  et la recette s'ajoute à « pour ». Une recette déjà comptée dans cette ligne n'est pas comptée deux fois :
 *  si la ligne ne vient que d'elle, sa quantité devient la nouvelle (des invités en plus : plus à acheter).
 *  Ajouté à la main : la quantité s'ajoute toujours. */
export function addToList(list: ShopItem[], add: { name: string; qty: string }[], from: string): { list: ShopItem[]; added: string[] } {
  const next = [...list];
  const added: string[] = [];
  for (const a of add) {
    const name = a.name.charAt(0).toUpperCase() + a.name.slice(1);
    const i = next.findIndex(x => !x.done && same(x.name, name));
    if (i >= 0) {
      const counted = next[i].from.split(", ").some(f => recipeOf(f) === recipeOf(from));
      if (from === BY_HAND) next[i] = { ...next[i], qty: sumQty(next[i].qty, a.qty), from: counted ? next[i].from : `${next[i].from}, ${from}` };
      else if (!counted) next[i] = { ...next[i], qty: sumQty(next[i].qty, a.qty), from: `${next[i].from}, ${from}` };
      else if (onlyFrom(next[i], from) && a.qty.trim()) next[i] = { ...next[i], qty: a.qty };
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

/** Ce qu'on tape à la main : « 500 g de farine » → farine, 500 g ; « 2 citrons » → citrons, 2 ; « lait » → lait. */
export function typedItem(text: string): { name: string; qty: string } {
  const t = text.trim().replace(/\s+/g, " ");
  const m = t.match(/^(\d+(?:[.,]\d+)?|½)\s*(kg|g|gr|l|cl|ml|dl|paquets?|bo[iî]tes?|pots?|sachets?|bouteilles?|bottes?|tranches?|gousses?|briques?)?\.?\s+(?:de |d'|d’)?(.+)$/i);
  if (!m) return { name: t, qty: "" };
  return { name: m[3], qty: m[2] ? `${m[1]} ${m[2].toLowerCase()}` : m[1] };
}
