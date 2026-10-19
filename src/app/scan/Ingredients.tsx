// « C'est bien ça ? » : les ingrédients trouvés sur la photo. On retire ce qui n'y est plus, on ajoute ce qui manque, on marque ce qui est à finir,
// Toucher un ingrédient change son nom ou sa quantité.
// puis le placard, l'envie du moment et pour combien (en Plus : qui du foyer mange, et les invités).
import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Chip, Chips, Icon, LockPill, RoundButton } from "../../ui/components";
import type { Envie } from "../../lib/scan";
import { type Person, whoNote, whoParts } from "../../lib/household";
import { useOpenPaywall } from "../plus/subscription";
import { getScan, MEAL_WORDS, setScan, useScan } from "./store";
import { Guide } from "./Guide";
import { ItemEdit } from "../fridge/ItemEdit";
import { qtyOf } from "../../lib/fridge";
import "../fridge/fridge.css";
import { INGR_GUIDE, setGuideState } from "./guideSteps";
import { eatersOf, portions, srvLabel } from "./portions";
import "./scan.css";

const ENVIES: [Envie, string][] = [["rapide", "Rapide"], ["healthy", "Healthy"], ["proteine", "Protéiné"], ["gourmand", "Gourmand"]];

export function Stepper({ value, label, min, max, onChange }: { value: number; label: [string, string]; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper">
      <button type="button" aria-label={label[0]} onClick={() => onChange(Math.max(min, value - 1))}><Icon name="minus" /></button>
      <output>{value}</output>
      <button type="button" aria-label={label[1]} onClick={() => onChange(Math.min(max, value + 1))}><Icon name="plus" /></button>
    </div>
  );
}

/** En Plus : qui mange (le foyer, chacun se retire d'un appui) et les invités, comptés comme des adultes. */
function Who({ household, avatar }: { household: Person[]; avatar: string | null }) {
  const scan = useScan();
  const g = scan.guests;
  const eaters = eatersOf(household, scan);
  const toggle = (id: string) => setScan({ away: scan.away.includes(id) ? scan.away.filter(x => x !== id) : [...scan.away, id] });
  const when = scan.meal === "m" ? "ce midi" : scan.meal === "w" ? "cette semaine" : "ce soir";
  return (
    <div className="opt">
      <span className="label">{MEAL_WORDS[scan.meal].qui}</span>
      <div className="who">
        {household.map(p => {
          const on = !scan.away.includes(p.id), pp = p.me && avatar;
          return (
            <button key={p.id} type="button" className={"wm" + (on ? " on" : "")} aria-pressed={on} onClick={() => toggle(p.id)}>
              <i className={pp ? "has-pp" : undefined} style={pp ? { backgroundImage: `url(${avatar})` } : undefined}>{p.name.charAt(0).toUpperCase()}</i>{p.name}
              {p.kid && <small>{p.age} ans</small>}
            </button>
          );
        })}
      </div>
      <div className="gst"><span className="gst-ic"><Icon name="users" /></span><div><b>Des invités ?</b><small>Comptés comme des adultes</small></div>
        <Stepper value={g} min={0} max={8} label={["Un invité de moins", "Un invité de plus"]} onChange={n => setScan({ guests: n })} />
      </div>
      <p className="whonote"><Icon name="users" /><span><b>{whoParts(eaters, g) || "Personne"}, soit {srvLabel(true, portions(true, scan, eaters))}.</b> {whoNote(eaters, when)}</span></p>
    </div>
  );
}

export function Ingredients({ isPlus, household, avatar, guide, userId }: {
  isPlus: boolean; household: Person[]; avatar: string | null; guide: boolean; userId: string;
}) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const scan = useScan();
  const screen = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState<{ i: number; focus: "name" | "qty" } | null>(null);
  if (!scan.photo && scan.ingredients.length === 0) return <Navigate to="/scan" replace />;

  const n = scan.ingredients.length;
  // Sans jeton, aucune photo n'a été lue : les ingrédients ont été tapés à la main
  const remove = (i: number) => setScan({ ingredients: getScan().ingredients.filter((_, k) => k !== i) });
  // « À finir » : passe en premier dans les recettes, et compte comme sauvé une fois cuisiné
  const rename = (i: number, name: string, qty: string) => {
    setScan({ ingredients: getScan().ingredients.map((it, k) => (k === i ? { ...it, name, qty } : it)) });
    setEditing(null);
  };
  const toggleFinish = (i: number) => setScan({ ingredients: getScan().ingredients.map((it, k) => (k === i ? { ...it, finish: !it.finish } : it)) });

  return (
    <section ref={screen} className="fa scan-screen scr-ingr" aria-label="Ingrédients trouvés">
      <div className="ingr-photo">{scan.photo && <img src={scan.photo} alt="" />}</div>
      <div className="ingr-top">
        <RoundButton icon="back" label="Reprendre la photo" tone="dark" onClick={() => navigate("/scan", { replace: true })} />
        <RoundButton icon="redo" label="Rescanner" tone="dark" onClick={() => navigate("/scan", { replace: true })} />
      </div>
      <div className="ingr-sheet">
        <div className="ingr-gh">
          <div className="grab" />
          <span className="label">{n} ingrédient{n > 1 ? "s" : ""} {scan.token ? "trouvé" : "ajouté"}{n > 1 ? "s" : ""}</span>
          <h2>C'est bien <em>ça&nbsp;?</em></h2>
          <p>Retire ce qui n'y est plus, ajoute ce qui manque, et marque ce qui est à finir vite. Touche un nom ou une quantité pour le changer.</p>
        </div>
        <div className="scroll">
          <div className="ingr-body">
            {n > 0 && (
              <div className="ilist">
                {scan.ingredients.map((it, i) => { const qty = qtyOf(it.qty); return (
                  <div key={it.name + i} className={"irow" + (it.finish ? " fin" : "") + (editing?.i === i ? " editing" : "")}>
                    <i />
                    {editing?.i === i ? <ItemEdit name={it.name} qty={qty} focus={editing.focus} onSave={(nm, q) => rename(i, nm, q)} onCancel={() => setEditing(null)} /> : <>
                      <button type="button" className="inm" aria-label={`Changer le nom de ${it.name}`} onClick={() => setEditing({ i, focus: "name" })}><b>{it.name}</b></button>
                      <button type="button" className={"iq" + (qty ? "" : " none")} aria-label={qty ? `Quantité de ${it.name} : ${qty}. Changer` : `Ajouter une quantité à ${it.name}`}
                        onClick={() => setEditing({ i, focus: "qty" })}>{qty || "+ quantité"}</button>
                    </>}
                    {editing?.i !== i && <>
                    <button type="button" className="finb" aria-pressed={!!it.finish} aria-label={`${it.name} à finir`} onClick={() => toggleFinish(i)}>À finir</button>
                    <button type="button" className="rm" aria-label={`Retirer ${it.name}`} onClick={() => remove(i)}><Icon name="x" /></button>
                    </>}
                  </div>
                ); })}
              </div>
            )}
            <button type="button" className="add" onClick={() => navigate("/scan/ajouter")}><span className="rm"><Icon name="plus" /></span>Ajouter un ingrédient</button>
            <div className="toggle-row">
              <div><b>Inclure mon placard</b><span>Pâtes, riz, huile, ail, épices</span></div>
              <button type="button" className="sw" role="switch" aria-checked={scan.pantry} aria-label="Inclure mon placard" onClick={() => setScan({ pantry: !scan.pantry })} />
            </div>
            <div className="opt">
              <span className="label">Envie de</span>
              <Chips>{ENVIES.map(([e, label]) => <Chip key={e} className="light" on={scan.envie === e} onClick={() => setScan({ envie: e })}>{label}</Chip>)}</Chips>
            </div>
            {isPlus ? <Who household={household} avatar={avatar} /> : (
              <div className="opt">
                <div className="forrow"><b>Pour combien ?</b>
                  <Stepper value={scan.servings} min={1} max={8} label={["Moins", "Plus"]} onChange={s => setScan({ servings: s })} />
                </div>
                <button type="button" className="famlock" onClick={() => openPaywall("famille")}>
                  <span className="ini"><Icon name="users" /></span>
                  <div><b>Mode famille</b><span>Les goûts de chacun, les portions calculées</span></div>
                  <LockPill />
                </button>
              </div>
            )}
          </div>
        </div>
        <button type="button" className="gobar" disabled={n === 0} onClick={() => navigate("/scan/preparation")}>
          <span><b>Voir mes 3 recettes</b><small>Pour {srvLabel(isPlus, portions(isPlus, scan, eatersOf(household, scan)))}</small></span>
          <span className="go"><Icon name="arrow" /></span>
        </button>
      </div>
      {guide && n > 0 && (
        <Guide host={screen} steps={INGR_GUIDE} delay={620}
          onDone={() => setGuideState(userId, "done")} onSkip={() => setGuideState(userId, "done")} />
      )}
    </section>
  );
}
