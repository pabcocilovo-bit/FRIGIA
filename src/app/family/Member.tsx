// 22 quater · Ajouter un proche (prototype V3) : prénom, adulte ou enfant (et son âge), appétit, allergies, ce qu'il n'aime pas.
// Écart maquette : l'appétit (de « Petit appétit » à « Gros mangeur ») n'y est pas, demandé par Hugo pour ajuster les portions.
// Toi aussi : ton prénom reste celui du compte, tes allergies sont celles de « Tes goûts ».
import { useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Chip, Icon, RoundButton } from "../../ui/components";
import type { Member as MemberT } from "../../lib/home";
import { APPETITE, appetiteOf, num, type Person, portionsOf, portTxt } from "../../lib/household";
import { useBack } from "../nav";
import { showToast } from "../toast";
import "../onboarding/ob.css";
import { ALLERGY_KEYS, allergyName } from "../../lib/allergens";
import { t } from "../../lib/i18n";
import "../library/library.css";
import "../scan/scan.css";
import "./family.css";

const ALLERGIES: [string, string][] = ALLERGY_KEYS.map(k => [k, cap(allergyName(k))]);
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
  // Pas touché : il suit l'âge (enfant de moins de 12 ans = petit appétit)
  const [appetite, setAppetite] = useState<number | undefined>(edit?.appetite);
  const [no, setNo] = useState("");
  const noRef = useRef<HTMLInputElement>(null);
  if (id && !edit) return <Navigate to="/famille/foyer" replace />;

  const n = name.trim();
  const app = appetiteOf({ kid: !me && kid, age, appetite });
  const part = APPETITE[app - 1].part;
  const allergy = (v: string) => setAllergies(a => (a.includes(v) ? a.filter(x => x !== v) : [...a, v]));
  const addNo = () => {
    const v = no.trim().toLowerCase();
    if (v && !dislikes.includes(v)) setDislikes(d => [...d, v]);
    setNo("");
    noRef.current?.focus();
  };
  const save = () => {
    if (!n) return;
    const m: MemberT = { id: edit?.id ?? crypto.randomUUID(), name: cap(n), kid: !me && kid, age: !me && kid ? age : 0, allergies: me ? [] : allergies, dislikes, appetite };
    if (me) onMyAllergies(allergies);
    onSave(m);
    const after = edit ? household.map(p => (p.id === m.id ? { ...p, ...m } : p)) : [...household, m];
    navigate("/famille/foyer", { replace: true, state: { added: m.id } });
    showToast(edit ? t(`${me ? "Ta fiche" : m.name} est à jour`, `${me ? "Your profile" : m.name} is up to date`) : t(`${m.name} rejoint ton foyer : ${portTxt(portionsOf(after, 0))}`, `${m.name} joins your household: ${portTxt(portionsOf(after, 0))}`));
  };
  const remove = () => {
    if (!edit) return;
    onRemove(edit.id);
    navigate("/famille/foyer", { replace: true });
    showToast(t(`${edit.name} ne fait plus partie du foyer`, `${edit.name} is no longer in the household`));
  };

  return (
    <section className="fa scan-screen scr-member" aria-label={edit ? t(`Modifier ${edit.name}`, `Edit ${edit.name}`) : t("Ajouter un proche", "Add someone")}>
      <div className="scroll">
        <div className="fv-head mb-head">
          <div className="fv-row"><RoundButton icon="back" label={t("Retour", "Back")} className="fv-rb" onClick={back} /></div>
          <h2>{edit ? <>{t("Modifier", "Edit")} <em>{me ? t("ta fiche", "your profile") : edit.name}</em></> : t(<>Ajoute un <em>proche</em></>, <>Add <em>someone</em></>)}</h2>
          {!edit && <p className="mb-lead">{t(<>Son âge, ses allergies et ce qu'il n'aime pas comptent dans chaque recette. <b>Rien à payer en plus</b> : la famille est comprise dans Plus.</>, <>Their age, allergies and dislikes count in every recipe. <b>Nothing extra to pay</b>: family is included in Plus.</>)}</p>}
        </div>
        <div className="mb-body">
          <div className="ob-field"><label htmlFor="mbName">{t("Prénom", "First name")}</label>
            <div className="ob-input mb-in"><Icon name="user" />
              <input id="mbName" autoComplete="off" autoCapitalize="words" placeholder={t("Ex. Léa", "E.g. Emma")} maxLength={20} value={name} disabled={me}
                onChange={e => setName(e.target.value)} />
              {n && !me && <button type="button" className="mb-x" aria-label={t("Effacer le prénom", "Clear the name")} onClick={() => setName("")}><Icon name="x" /></button>}
            </div>
            {me && <small className="mb-hint">{t("Ton prénom se change dans Ton compte.", "Your first name is changed in Your account.")}</small>}
          </div>
          {!me && (
            <div className="ob-field"><label>{t("Âge", "Age")}</label>
              <div className="seg mb-seg">
                <button type="button" className={kid ? undefined : "on"} onClick={() => setKid(false)}>{t("Adulte", "Adult")}</button>
                <button type="button" className={kid ? "on" : undefined} onClick={() => setKid(true)}>{t("Enfant", "Child")}</button>
              </div>
              {kid && (
                <div className="mb-age">
                  <div className="mb-agev"><b>{t(`${age} ans`, `${age} years old`)}</b></div>
                  <div className="stepper">
                    <button type="button" aria-label={t("Plus jeune", "Younger")} onClick={() => setAge(a => Math.max(1, a - 1))}><Icon name="minus" /></button>
                    <button type="button" aria-label={t("Plus âgé", "Older")} onClick={() => setAge(a => Math.min(17, a + 1))}><Icon name="plus" /></button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="ob-field"><label>{t("Appétit", "Appetite")}</label>
            <div className="mb-age">
              <div className="mb-agev"><b>{APPETITE[app - 1].label}</b><small>{t(`Compte pour ${num(part)} portion${part > 1 ? "s" : ""}`, `Counts as ${num(part)} serving${part !== 1 ? "s" : ""}`)}</small></div>
              <div className="stepper">
                <button type="button" aria-label={t("Mange moins", "Eats less")} disabled={app === 1} onClick={() => setAppetite(Math.max(1, app - 1))}><Icon name="minus" /></button>
                <button type="button" aria-label={t("Mange plus", "Eats more")} disabled={app === 5} onClick={() => setAppetite(Math.min(5, app + 1))}><Icon name="plus" /></button>
              </div>
            </div>
          </div>
          <div className="ob-field"><label>Allergies</label>
            <div className="ob-chips">
              <Chip on={!allergies.length} onClick={() => setAllergies([])}>{t("Aucune", "None")}</Chip>
              {ALLERGIES.map(([v, l]) => <Chip key={v} on={allergies.includes(v)} onClick={() => allergy(v)}>{l}</Chip>)}
            </div>
          </div>
          <div className="ob-field"><label htmlFor="mbNoIn">{t("N'aime pas", "Doesn't like")}</label>
            {dislikes.length > 0 && (
              <div className="mb-tags">
                {dislikes.map(d => (
                  <span key={d} className="mb-tag"><span>{d}</span>
                    <button type="button" aria-label={t(`Retirer ${d}`, `Remove ${d}`)} onClick={() => setDislikes(x => x.filter(y => y !== d))}><Icon name="x" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="ob-input mb-in"><Icon name="utensils" />
              <input id="mbNoIn" ref={noRef} autoComplete="off" placeholder={t("Champignons, poivrons…", "Mushrooms, peppers…")} maxLength={24} value={no}
                onChange={e => setNo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addNo(); } }} />
              <button type="button" className="mb-add" aria-label={t("Ajouter", "Add")} onClick={addNo}><Icon name="plus" /></button>
            </div>
          </div>
          <p className="mb-note"><Icon name="shield" /><span>{t("Les allergies servent seulement à adapter les recettes. Tu peux les retirer quand tu veux.", "Allergies are only used to adapt the recipes. You can remove them any time.")}</span></p>
          {edit && !me && <button type="button" className="mb-del" onClick={remove}>{t("Retirer du foyer", "Remove from household")}</button>}
        </div>
      </div>
      <button type="button" className="gobar mb-go" disabled={!n} onClick={save}>
        <span><b>{edit ? t("Enregistrer", "Save") : n ? t(`Ajouter ${cap(n)} au foyer`, `Add ${cap(n)} to the household`) : t("Ajouter au foyer", "Add to the household")}</b><small>{t("Les recettes s'adaptent dès ce soir", "Recipes adapt from tonight")}</small></span>
        <span className="go"><Icon name="check" /></span>
      </button>
    </section>
  );
}
