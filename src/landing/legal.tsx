import { Fragment, useState } from "react";
import { LEGAL, legalPage, type Block, type LegalKey } from "../legal/pages";
import { Sheet } from "./Sheet";

export type { LegalKey };

// **gras**, et les « [À compléter : …] » surlignés pour qu'ils sautent aux yeux avant la mise en ligne
function Inline({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (!part.startsWith("**")) return <Fragment key={i}>{part}</Fragment>;
    const inner = part.slice(2, -2);
    return inner.startsWith("[À compléter") ? <mark key={i}>{inner}</mark> : <b key={i}>{inner}</b>;
  });
}

// Le texte d'une page légale, sans son titre
export function LegalBody({ blocks }: { blocks: Block[] }) {
  return blocks.map((b, i) => {
    if (b.t === "date") return <p key={i} className="date">{b.text}</p>;
    if (b.t === "h") return <h3 key={i}>{b.text}</h3>;
    if (b.t === "p") return <p key={i}><Inline text={b.text} /></p>;
    const list = <ul>{b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</ul>;
    return b.essentiel ? <div key={i} className="essentiel"><b>L'essentiel</b>{list}</div> : <Fragment key={i}>{list}</Fragment>;
  });
}

// Feuille ouverte depuis l'inscription, pour lire les conditions sans quitter le formulaire
export function LegalSheet({ initial, onClose }: { initial: LegalKey; onClose: () => void }) {
  const [key, setKey] = useState(initial);
  const page = legalPage(key);
  return (
    <Sheet label={page.title} onClose={onClose} wide>
      <div className="lp-legal">
        <div className="tabs">
          {LEGAL.map(p => <button key={p.key} aria-pressed={p.key === key} onClick={() => setKey(p.key)}>{p.tab}</button>)}
        </div>
        <h2>{page.title}</h2>
        <LegalBody blocks={page.blocks} />
      </div>
    </Sheet>
  );
}
