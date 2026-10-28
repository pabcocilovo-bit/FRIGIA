// 22 bis · Infos légales (prototype V3) : 4 onglets, un encadré « L'essentiel », puis le texte complet.
// Les textes viennent de src/legal/pages-legales.md, comme les pages /cgu, /confidentialite… du site.
import { Fragment } from "react";
import { useNavigate, useParams } from "react-router";
import { LEGAL, type Block, type LegalKey } from "../../legal/pages";
import { Icon, RoundButton, ScreenHeader } from "../../ui/components";
import { useBack } from "../nav";
import "./settings.css";

const TABS: Record<LegalKey, string> = { cgu: "Conditions", confidentialite: "Confidentialité", mentions: "Mentions", cookies: "Cookies" };
const TODO = "[À compléter";

// **gras**, et les « [À compléter : …] » en doré
function Inline({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (!part.startsWith("**")) return <Fragment key={i}>{part}</Fragment>;
    const inner = part.slice(2, -2);
    return inner.startsWith(TODO) ? <mark key={i} className="lg-todo">{inner}</mark> : <b key={i}>{inner}</b>;
  });
}

function Body({ blocks }: { blocks: Block[] }) {
  return blocks.map((b, i) => {
    if (b.t === "date") return null;
    if (b.t === "h") return <h4 key={i}>{b.text}</h4>;
    if (b.t === "p") return <p key={i}><Inline text={b.text} /></p>;
    if (b.essentiel) return (
      <div key={i} className="lg-brief"><span className="label">L'essentiel</span>
        <ul>{b.items.map((it, j) => <li key={j}><Icon name="check" /><span><Inline text={it} /></span></li>)}</ul>
      </div>
    );
    return <ul key={i}>{b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</ul>;
  });
}

const date = LEGAL[0].blocks.find(b => b.t === "date");
const updated = date && "text" in date ? date.text.replace(/^Mise à jour/, "Mises à jour") : undefined;
const hasTodo = LEGAL.some(p => p.blocks.some(b => ("text" in b ? b.text : b.items.join(" ")).includes(TODO)));

export function Legal() {
  const back = useBack();
  const navigate = useNavigate();
  const { page } = useParams();
  const current = LEGAL.find(p => p.key === page) ?? LEGAL[0];
  return (
    <div className="fa fa-app st-page" aria-label="Infos légales">
      <ScreenHeader title={<>Infos <em>légales</em></>} sub={updated} left={<RoundButton icon="back" label="Retour" big onClick={back} />}>
        <div className="lg-tabs" role="tablist">
          {LEGAL.map(p => (
            <button key={p.key} type="button" role="tab" aria-selected={p.key === current.key} className={p.key === current.key ? "on" : undefined}
              onClick={() => navigate(`/infos-legales/${p.key}`, { replace: true })}>{TABS[p.key]}</button>
          ))}
        </div>
      </ScreenHeader>
      <div className="lg-body">
        <article key={current.key} className="lg-page">
          <h3 className="lg-t">{current.title}</h3>
          <Body blocks={current.blocks} />
        </article>
        {hasTodo && <p className="lg-todo-note"><mark className="lg-todo">En doré</mark> : à compléter ou à valider avant la mise en ligne.</p>}
        <p className="lg-contact">Une question ? <a href="mailto:contact@frigia.fr">contact@frigia.fr</a></p>
      </div>
    </div>
  );
}
