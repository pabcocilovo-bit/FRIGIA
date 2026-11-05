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
import { locale, t } from "../../lib/i18n";
import { showToast } from "../toast";
import "../onboarding/ob.css";
import "../library/library.css";
import "../scan/scan.css";
import "./family.css";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const day = (at: number) => new Date(at).toLocaleDateString(locale, { day: "numeric", month: "short" });

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
      <b className="bud-v">{eur(spent)}{m != null && <small> {t("sur", "of")} {eur(m)}</small>}</b>
    </div>
    {m != null && <span className={"bud-bar" + (over ? " over" : "")}><i style={{ width: `${Math.min(100, (spent / m) * 100)}%` }} /></span>}
    <span className="bud-sub">
      {m == null ? t("Fixe ton budget pour voir ce qu'il te reste.", "Set your budget to see what's left.")
        : over ? t(`Dépassé de ${eur(Math.round((spent - m) * 100) / 100)}`, `Over by ${eur(Math.round((spent - m) * 100) / 100)}`)
          : t(`Reste ${eur(Math.round((m - spent) * 100) / 100)} pour ${left} jour${left > 1 ? "s" : ""}${proj != null ? ` · à ce rythme, ${eur(proj)} sur le mois` : ""}`,
            `${eur(Math.round((m - spent) * 100) / 100)} left for ${left} day${left > 1 ? "s" : ""}${proj != null ? ` · at this rate, ${eur(proj)} for the month` : ""}`)}
    </span>
    {saved > 0 && <span className="bud-save"><Icon name="leaf" />{t(`Frigia t'a évité ${eur(saved)} de gaspillage ce mois-ci`, `Frigia saved you ${eur(saved)} of waste this month`)}</span>}
  </>;
}

/** La carte de l'onglet Famille. Gratuit : l'invitation à Plus. */
export function BudgetCard({ isPlus, budget, meals }: { isPlus: boolean; budget: BudgetT; meals: CookedMeal[] }) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  if (!isPlus) return (
    <div className="refer">
      <span className="pi"><Icon name="cart" /></span>
      <div><b>{t("Suis ton budget courses", "Track your grocery budget")}</b><span>{t("Tes tickets de caisse s'ajoutent tout seuls", "Your receipts add up on their own")}</span></div>
      <Pill onClick={() => openPaywall("budget")}>Plus</Pill>
    </div>
  );
  if (budget.monthly == null && !budget.spends.length) return (
    <button type="button" className="refer bud-new" onClick={() => navigate("/famille/budget")}>
      <span className="pi"><Icon name="cart" /></span>
      <div><b>{t("Fixe ton budget du mois", "Set your monthly budget")}</b><span>{t("Tes tickets de caisse scannés s'y ajoutent tout seuls", "Your scanned receipts add up on their own")}</span></div>
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
    onBudget(b => ({ ...b, spends: [...b.spends, { id: crypto.randomUUID(), eur: value, at: Date.now(), label: label.trim() || t("Courses", "Groceries"), from: "main" }] }));
    showToast(t(`${eur(value)} ajoutés à ton budget`, `${eur(value)} added to your budget`));
    setAmount(""); setLabel("");
  };
  const remove = (s: Spend) => {
    onBudget(b => ({ ...b, spends: b.spends.filter(x => x.id !== s.id) }));
    showToast(t(`${s.label} retiré du budget`, `${s.label} removed from the budget`));
  };

  return (
    <section className="fa scan-screen scr-member scr-budget" aria-label={t("Budget courses", "Grocery budget")}>
      <div className="scroll">
        <div className="fv-head mb-head">
          <div className="fv-row"><RoundButton icon="back" label={t("Retour", "Back")} className="fv-rb" onClick={back} /></div>
          <h2>{t(<>Budget <em>courses</em></>, <>Grocery <em>budget</em></>)}</h2>
          <p className="mb-lead">{t("Tes tickets de caisse scannés s'ajoutent tout seuls. Le marché ou le boucher, ajoute-les ici.", "Your scanned receipts add up on their own. The market or the butcher, add them here.")}</p>
        </div>
        <div className="mb-body">
          <div className="bud"><Summary budget={budget} meals={meals} /></div>
          <div className="ob-field"><label htmlFor="budM">{t("Ton budget par mois", "Your monthly budget")}</label>
            <div className="ob-input mb-in"><Icon name="cart" />
              <input id="budM" inputMode="numeric" autoComplete="off" placeholder={t(`Ex. ${suggested}`, `E.g. ${suggested}`)} maxLength={6} value={monthly}
                onChange={e => saveMonthly(e.target.value.replace(/[^\d]/g, ""))} />
              <span className="bud-eur">€</span>
            </div>
            {String(suggested) !== monthly && (
              <button type="button" className="mb-hint bud-sug" onClick={() => saveMonthly(String(suggested))}>
                {t(<>Pour ton foyer de {household.length} : environ <b>{eur(suggested)}</b>. <u>Utiliser</u></>, <>For your household of {household.length}: about <b>{eur(suggested)}</b>. <u>Use it</u></>)}
              </button>
            )}
          </div>
          <div className="ob-field"><label htmlFor="budA">{t("Ajouter une dépense", "Add an expense")}</label>
            <div className="bud-add">
              <div className="ob-input mb-in"><input id="budA" inputMode="decimal" autoComplete="off" placeholder={t("Montant", "Amount")} maxLength={8} value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^\d,.]/g, ""))} /><span className="bud-eur">€</span></div>
              <div className="ob-input mb-in"><input aria-label={t("Où", "Where")} autoComplete="off" placeholder={t("Où ? (marché…)", "Where? (market…)")} maxLength={30} value={label}
                onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} /></div>
              <button type="button" className="mb-add" aria-label={t("Ajouter la dépense", "Add the expense")} disabled={!ok} onClick={add}><Icon name="plus" /></button>
            </div>
          </div>
          <div className="ob-field"><label>{t(`Les dépenses ${ofMonth()}`, `${cap(ofMonth())} expenses`)}</label>
            {list.length ? (
              <div className="plist">
                {list.map(s => (
                  <div key={s.id} className="prow bud-row">
                    <span className="pi"><Icon name={s.from === "ticket" ? "cam" : "store"} /></span>
                    <span className="tx"><b>{s.label}</b><span>{day(s.at)}{s.from === "ticket" ? t(" · ticket scanné", " · scanned receipt") : ""}</span></span>
                    <b className="bud-amt">{eur(s.eur)}</b>
                    <button type="button" className="mb-x" aria-label={t(`Retirer ${s.label}, ${eur(s.eur)}`, `Remove ${s.label}, ${eur(s.eur)}`)} onClick={() => remove(s)}><Icon name="trash" /></button>
                  </div>
                ))}
              </div>
            ) : <p className="mb-hint">{t("Rien ce mois-ci. Scanne ton prochain ticket de caisse : son total s'ajoute ici.", "Nothing this month. Scan your next receipt: its total adds up here.")}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
