// 22 quater · Ajouter un proche (prototype V3) : prénom, adulte ou enfant (et son âge), allergies, ce qu'il n'aime pas.
// Toi aussi : ton prénom reste celui du compte, tes allergies sont celles de « Tes goûts ».
import { useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Chip, Icon, RoundButton } from "../../ui/components";
import type { Member as MemberT } from "../../lib/home";
import { type Person, portionsOf, portTxt } from "../../lib/household";
import { useBack } from "../nav";
import { showToast } from "../toast";
import "../onboarding/ob.css";
import "../library/library.css";
import "../scan/scan.css";
import "./family.css";

const ALLERGIES: [string, string][] = [
  ["arachides", "Arachides"], ["fruits à coque", "Fruits à coque"], ["œufs", "Œufs"], ["lait", "Lait"], ["gluten", "Gluten"],
  ["poisson", "Poisson"], ["crustacés", "Crustacés"], ["soja", "Soja"], ["sésame", "Sésame"],
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Member({ household, onSave, onRemove, onMyAllergies }: {
  household: Person[];
  onSave: (m: MemberT) => void;
  onRemove: (id: string) => void;
  /** Tes allergies sont celles de ton compte (« Tes goûts ») */
  onMyAllergies: (allergies: string[]) => void;
}) {
  const back = useBack();
  const navigate = useNavigate();
  const { id } = useParams();
  const edit = id ? household.find(p => p.id === id) : undefined;
  const me = !!edit?.me;
  const [name, setName] = useState(edit?.name ?? "");
  const [kid, setKid] = useState(edit?.kid ?? false);
  const [age, setAge] = useState(edit?.kid ? edit.age : 6);
  const [allergies, setAllergies] = useState<string[]>(edit?.allergies ?? []);
  const [dislikes, setDislikes] = useState<string[]>(edit?.dislikes ?? []);
  const [no, setNo] = useState("");
  const noRef = useRef<HTMLInputElement>(null);
  if (id && !edit) return <Navigate to="/famille" replace />;

  const n = name.trim();
  const allergy = (v: string) => setAllergies(a => (a.includes(v) ? a.filter(x => x !== v) : [...a, v]));
  const addNo = () => {
    const v = no.trim().toLowerCase();
    if (v && !dislikes.includes(v)) setDislikes(d => [...d, v]);
    setNo("");
    noRef.current?.focus();
  };
  const save = () => {
    if (!n) return;
    const m: MemberT = { id: edit?.id ?? crypto.randomUUID(), name: cap(n), kid: !me && kid, age: !me && kid ? age : 0, allergies: me ? [] : allergies, dislikes };
    if (me) onMyAllergies(allergies);
    onSave(m);
    const after = edit ? household.map(p => (p.id === m.id ? { ...p, ...m } : p)) : [...household, m];
    navigate("/famille", { replace: true, state: { added: m.id } });
    showToast(edit ? `${me ? "Ta fiche" : m.name} est à jour` : `${m.name} rejoint ton foyer : ${portTxt(portionsOf(after, 0))}`);
  };
  const remove = () => {
    if (!edit) return;
    onRemove(edit.id);
    navigate("/famille", { replace: true });
    showToast(`${edit.name} ne fait plus partie du foyer`);
  };

  return (
    <section className="fa scan-screen scr-member" aria-label={edit ? `Modifier ${edit.name}` : "Ajouter un proche"}>
      <div className="scroll">
        <div className="fv-head mb-head">
          <div className="fv-row"><RoundButton icon="back" label="Retour" className="fv-rb" onClick={back} /></div>
          <h2>{edit ? <>Modifier <em>{me ? "ta fiche" : edit.name}</em></> : <>Ajoute un <em>proche</em></>}</h2>
          {!edit && <p className="mb-lead">Son âge, ses allergies et ce qu'il n'aime pas comptent dans chaque recette. <b>Rien à payer en plus</b> : la famille est comprise dans Plus.</p>}
        </div>
        <div className="mb-body">
          <div className="ob-field"><label htmlFor="mbName">Prénom</label>
            <div className="ob-input mb-in"><Icon name="user" />
              <input id="mbName" autoComplete="off" autoCapitalize="words" placeholder="Ex. Léa" maxLength={20} value={name} disabled={me}
                onChange={e => setName(e.target.value)} />
              {n && !me && <button type="button" className="mb-x" aria-label="Effacer le prénom" onClick={() => setName("")}><Icon name="x" /></button>}
            </div>
            {me && <small className="mb-hint">Ton prénom se change dans Ton compte.</small>}
          </div>
          {!me && (
            <div className="ob-field"><label>Âge</label>
              <div className="seg mb-seg">
                <button type="button" className={kid ? undefined : "on"} onClick={() => setKid(false)}>Adulte</button>
                <button type="button" className={kid ? "on" : undefined} onClick={() => setKid(true)}>Enfant</button>
              </div>
              {kid && (
                <div className="mb-age">
                  <div className="mb-agev"><b>{age} ans</b><small>Compte pour une demi-portion</small></div>
                  <div className="stepper">
                    <button type="button" aria-label="Plus jeune" onClick={() => setAge(a => Math.max(1, a - 1))}><Icon name="minus" /></button>
                    <button type="button" aria-label="Plus âgé" onClick={() => setAge(a => Math.min(17, a + 1))}><Icon name="plus" /></button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="ob-field"><label>Allergies</label>
            <div className="ob-chips">
              <Chip on={!allergies.length} onClick={() => setAllergies([])}>Aucune</Chip>
              {ALLERGIES.map(([v, l]) => <Chip key={v} on={allergies.includes(v)} onClick={() => allergy(v)}>{l}</Chip>)}
            </div>
          </div>
          <div className="ob-field"><label htmlFor="mbNoIn">N'aime pas</label>
            {dislikes.length > 0 && (
              <div className="mb-tags">
                {dislikes.map(d => (
                  <span key={d} className="mb-tag"><span>{d}</span>
                    <button type="button" aria-label={`Retirer ${d}`} onClick={() => setDislikes(x => x.filter(y => y !== d))}><Icon name="x" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="ob-input mb-in"><Icon name="utensils" />
              <input id="mbNoIn" ref={noRef} autoComplete="off" placeholder="Champignons, poivrons…" maxLength={24} value={no}
                onChange={e => setNo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addNo(); } }} />
              <button type="button" className="mb-add" aria-label="Ajouter" onClick={addNo}><Icon name="plus" /></button>
            </div>
          </div>
          <p className="mb-note"><Icon name="shield" /><span>Les allergies servent seulement à adapter les recettes. Tu peux les retirer quand tu veux.</span></p>
          {edit && !me && <button type="button" className="mb-del" onClick={remove}>Retirer du foyer</button>}
        </div>
      </div>
      <button type="button" className="gobar mb-go" disabled={!n} onClick={save}>
        <span><b>{edit ? "Enregistrer" : n ? `Ajouter ${cap(n)} au foyer` : "Ajouter au foyer"}</b><small>Les recettes s'adaptent dès ce soir</small></span>
        <span className="go"><Icon name="check" /></span>
      </button>
    </section>
  );
}
