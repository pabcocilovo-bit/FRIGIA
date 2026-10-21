import source from "./pages-legales.md?raw";

// Les 4 pages légales, lues dans pages-legales.md (la même source que les Réglages de l'appli).
// Le fichier n'utilise que : ## titre, _date_, **L'essentiel**, ### intertitre, - liste, paragraphes et **gras**.
// Elles servent deux fois : la feuille ouverte depuis l'inscription, et les vraies pages /cgu, /confidentialite…
// écrites en HTML au build (scripts/prerender.mjs).
export type Block =
  | { t: "date"; text: string }
  | { t: "h"; text: string }
  | { t: "p"; text: string }
  | { t: "ul"; items: string[]; essentiel: boolean };

export type LegalKey = "cgu" | "confidentialite" | "mentions" | "cookies";
export type LegalPage = { key: LegalKey; slug: string; tab: string; title: string; description: string; blocks: Block[] };

// Dans l'ordre du fichier Markdown
const META: { key: LegalKey; slug: string; tab: string }[] = [
  { key: "cgu", slug: "cgu", tab: "Conditions" },
  { key: "confidentialite", slug: "confidentialite", tab: "Confidentialité" },
  { key: "mentions", slug: "mentions-legales", tab: "Mentions légales" },
  { key: "cookies", slug: "cookies", tab: "Cookies" },
];

function parse(md: string): { title: string; blocks: Block[] }[] {
  return md.split(/\n---\n/).map(chunk => {
    const page = { title: "", blocks: [] as Block[] };
    let essentiel = false;
    for (const raw of chunk.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const last = page.blocks[page.blocks.length - 1];
      if (line.startsWith("## ")) page.title = line.slice(3);
      else if (line.startsWith("### ")) { page.blocks.push({ t: "h", text: line.slice(4) }); essentiel = false; }
      else if (/^_.*_$/.test(line)) page.blocks.push({ t: "date", text: line.slice(1, -1) });
      else if (line === "**L'essentiel**") essentiel = true;
      else if (line.startsWith("- ")) {
        if (last?.t === "ul") last.items.push(line.slice(2));
        else page.blocks.push({ t: "ul", items: [line.slice(2)], essentiel });
      } else { page.blocks.push({ t: "p", text: line }); essentiel = false; }
    }
    return page;
  });
}

// La description (balise meta) reprend l'encadré « L'essentiel », sans le gras
const summary = (blocks: Block[]) => {
  const ess = blocks.find((b): b is Extract<Block, { t: "ul" }> => b.t === "ul" && b.essentiel);
  return (ess?.items ?? []).join(" ").replace(/\*\*/g, "");
};

export const LEGAL: LegalPage[] = parse(source).map((p, i) => ({ ...META[i], ...p, description: summary(p.blocks) }));
export const legalPage = (key: LegalKey) => LEGAL.find(p => p.key === key)!;
