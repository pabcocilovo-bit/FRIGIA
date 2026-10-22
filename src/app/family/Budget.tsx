// Budget courses (Frigia Plus) : la carte de l'onglet Famille et sa page (/famille/budget). Demandé par Hugo le 22 octobre.
// Le budget du mois, ce qui est dépensé (tickets scannés, ajouts à la main) et, à part, ce que Frigia a évité de jeter :
// les deux chiffres ne se mélangent pas (l'argent sauvé ne se retire pas des dépenses).
import { useState } from "react";
import { useNavigate } from "react-router";
import { Icon, Pill, RoundButton } from "../../ui/components";
import { type Budget as BudgetT, daysLeft, eur, monthName, monthSpends, ofMonth, projection, type Spend, suggestBudget, total } from "../../lib/budget";
import { type CookedMeal, thisMonth, totalSaved } from "../../lib/cooked";
import type { Person } from "../../lib/household";
import { useBack } from "../nav";
import { useOpenPaywall } from "../plus/subscription";
import { showToast } from "../toast";
import "../onboarding/ob.css";
import "../library/library.css";
import "../scan/scan.css";
import "./family.css";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const day = (at: number) => new Date(at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/** Le mois : dépensé sur le budget, la barre, ce qui reste, et l'argent que Frigia a évité de jeter */
function Summary({ budget, meals }: { budget: BudgetT; meals: CookedMeal[] }) {
  const now = new Date();
  const spent = total(monthSpends(budget, now));
  const saved = Math.round(totalSaved(thisMonth(meals, now)).eur);
  const m = budget.monthly;
  const over = m != null && spent > m;
  const proj = projection(spent, now);
  const left = daysLeft(now);
  return <>
    <div className="bud-top">
      <span className="label">{cap(monthName(now))}</span>
      <b className="bud-v">{eur(spent)}{m != null && <small> sur {eur(m)}</small>}</b>
    </div>
    {m != null && <span className={"bud-bar" + (over ? " over" : "")}><i style={{ width: `${Math.min(100, (spent / m) * 100)}%` }} /></span>}
    <span className="bud-sub">
      {m == null ? "Fixe ton budget pour voir ce qu'il te reste."
        : over ? `Dépassé de ${eur(Math.round((spent - m) * 100) / 100)}`
          : `Reste ${eur(Math.round((m - spent) * 100) / 100)} pour ${left} jour${left > 1 ? "s" : ""}${proj != null ? ` · à ce rythme, ${eur(proj)} sur le mois` : ""}`}
    </span>
    {saved > 0 && <span className="bud-save"><Icon name="leaf" />Frigia t'a évité {eur(saved)} de gaspillage ce mois-ci</span>}
  </>;
}

/** La carte de l'onglet Famille. Gratuit : l'invitation à Plus. */
export function BudgetCard({ isPlus, budget, meals }: { isPlus: boolean; budget: BudgetT; meals: CookedMeal[] }) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  if (!isPlus) return (
    <div className="refer">
      <span className="pi"><Icon name="cart" /></span>
      <div><b>Suis ton budget courses</b><span>Tes tickets de caisse s'ajoutent tout seuls</span></div>
      <Pill onClick={() => openPaywall("budget")}>Plus</Pill>
    </div>
  );
  if (budget.monthly == null && !budget.spends.length) return (
    <button type="button" className="refer bud-new" onClick={() => navigate("/famille/budget")}>
      <span className="pi"><Icon name="cart" /></span>
      <div><b>Fixe ton budget du mois</b><span>Tes tickets de caisse scannés s'y ajoutent tout seuls</span></div>
      <Icon name="next" />
    </button>
  );
  return <button type="button" className="bud" onClick={() => navigate("/famille/budget")}><Summary budget={budget} meals={meals} /></button>;
}

/** /famille/budget : le budget du mois, ajouter une dépense, les dépenses du mois */
export function BudgetPage({ budget, meals, household, onBudget }: {
  budget: BudgetT; meals: CookedMeal[]; household: Person[];
  onBudget: (u: (b: BudgetT) => BudgetT) => void;
}) {
  const back = useBack();
  const [monthly, setMonthly] = useState(budget.monthly != null ? String(budget.monthly) : "");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const suggested = suggestBudget(household);
  const list = monthSpends(budget);

  const saveMonthly = (v: string) => {
    setMonthly(v);
    const n = Math.round(Number(v.replace(",", ".")));
    onBudget(b => ({ ...b, monthly: Number.isFinite(n) && n > 0 && n < 100000 ? n : null }));
  };
  const value = Math.round(Number(amount.replace(",", ".")) * 100) / 100;
  const ok = Number.isFinite(value) && value > 0 && value < 10000;
  const add = () => {
    if (!ok) return;
    onBudget(b => ({ ...b, spends: [...b.spends, { id: crypto.randomUUID(), eur: value, at: Date.now(), label: label.trim() || "Courses", from: "main" }] }));
    showToast(`${eur(value)} ajoutés à ton budget`);
    setAmount(""); setLabel("");
  };
  const remove = (s: Spend) => {
    onBudget(b => ({ ...b, spends: b.spends.filter(x => x.id !== s.id) }));
    showToast(`${s.label} retiré du budget`);
  };

  return (
    <section className="fa scan-screen scr-member scr-budget" aria-label="Budget courses">
      <div className="scroll">
        <div className="fv-head mb-head">
          <div className="fv-row"><RoundButton icon="back" label="Retour" className="fv-rb" onClick={back} /></div>
          <h2>Budget <em>courses</em></h2>
          <p className="mb-lead">Tes tickets de caisse scannés s'ajoutent tout seuls. Le marché ou le boucher, ajoute-les ici.</p>
        </div>
        <div className="mb-body">
          <div className="bud"><Summary budget={budget} meals={meals} /></div>
          <div className="ob-field"><label htmlFor="budM">Ton budget par mois</label>
            <div className="ob-input mb-in"><Icon name="cart" />
              <input id="budM" inputMode="numeric" autoComplete="off" placeholder={`Ex. ${suggested}`} maxLength={6} value={monthly}
                onChange={e => saveMonthly(e.target.value.replace(/[^\d]/g, ""))} />
              <span className="bud-eur">€</span>
            </div>
            {String(suggested) !== monthly && (
              <button type="button" className="mb-hint bud-sug" onClick={() => saveMonthly(String(suggested))}>
                Pour ton foyer de {household.length} : environ <b>{eur(suggested)}</b>. <u>Utiliser</u>
              </button>
            )}
          </div>
          <div className="ob-field"><label htmlFor="budA">Ajouter une dépense</label>
            <div className="bud-add">
              <div className="ob-input mb-in"><input id="budA" inputMode="decimal" autoComplete="off" placeholder="Montant" maxLength={8} value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^\d,.]/g, ""))} /><span className="bud-eur">€</span></div>
              <div className="ob-input mb-in"><input aria-label="Où" autoComplete="off" placeholder="Où ? (marché…)" maxLength={30} value={label}
                onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} /></div>
              <button type="button" className="mb-add" aria-label="Ajouter la dépense" disabled={!ok} onClick={add}><Icon name="plus" /></button>
            </div>
          </div>
          <div className="ob-field"><label>Les dépenses {ofMonth()}</label>
            {list.length ? (
              <div className="plist">
                {list.map(s => (
                  <div key={s.id} className="prow bud-row">
                    <span className="pi"><Icon name={s.from === "ticket" ? "cam" : "store"} /></span>
                    <span className="tx"><b>{s.label}</b><span>{day(s.at)}{s.from === "ticket" ? " · ticket scanné" : ""}</span></span>
                    <b className="bud-amt">{eur(s.eur)}</b>
                    <button type="button" className="mb-x" aria-label={`Retirer ${s.label}, ${eur(s.eur)}`} onClick={() => remove(s)}><Icon name="trash" /></button>
                  </div>
                ))}
              </div>
            ) : <p className="mb-hint">Rien ce mois-ci. Scanne ton prochain ticket de caisse : son total s'ajoute ici.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
