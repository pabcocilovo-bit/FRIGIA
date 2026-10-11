import { Fragment, useState } from "react";
import source from "../legal/pages-legales.md?raw";
import { Sheet } from "./Sheet";

// Les 4 pages viennent de src/legal/pages-legales.md, la même source que les Réglages de l'appli.
// Le fichier n'utilise que : ## titre, _date_, **L'essentiel**, ### intertitre, - liste, paragraphes et **gras**.
type Block =
  | { t: "date"; text: string }
  | { t: "h"; text: string }
  | { t: "p"; text: string }
  | { t: "ul"; items: string[]; essentiel: boolean };
type Page = { title: string; blocks: Block[] };

export type LegalKey = "cgu" | "confidentialite" | "mentions" | "cookies";
const KEYS: LegalKey[] = ["cgu", "confidentialite", "mentions", "cookies"];
const TABS: Record<LegalKey, string> = { cgu: "Conditions", confidentialite: "Confidentialité", mentions: "Mentions légales", cookies: "Cookies" };

function parse(md: string): Page[] {
  return md.split(/\n---\n/).map(chunk => {
    const page: Page = { title: "", blocks: [] };
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

const PAGES = parse(source);

// **gras**, et les « [À compléter : …] » surlignés pour qu'ils sautent aux yeux avant la mise en ligne
function Inline({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (!part.startsWith("**")) return <Fragment key={i}>{part}</Fragment>;
    const inner = part.slice(2, -2);
    return inner.startsWith("[À compléter") ? <mark key={i}>{inner}</mark> : <b key={i}>{inner}</b>;
  });
}

export function LegalSheet({ initial, onClose }: { initial: LegalKey; onClose: () => void }) {
  const [key, setKey] = useState(initial);
  const page = PAGES[KEYS.indexOf(key)];
  return (
    <Sheet label={page.title} onClose={onClose} wide>
      <div className="lp-legal">
        <div className="tabs">
          {KEYS.map(k => <button key={k} aria-pressed={k === key} onClick={() => setKey(k)}>{TABS[k]}</button>)}
        </div>
        <h2>{page.title}</h2>
        {page.blocks.map((b, i) => {
          if (b.t === "date") return <p key={i} className="date">{b.text}</p>;
          if (b.t === "h") return <h3 key={i}>{b.text}</h3>;
          if (b.t === "p") return <p key={i}><Inline text={b.text} /></p>;
          const list = <ul>{b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</ul>;
          return b.essentiel ? <div key={i} className="essentiel"><b>L'essentiel</b>{list}</div> : <Fragment key={i}>{list}</Fragment>;
        })}
      </div>
    </Sheet>
  );
}
