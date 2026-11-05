// « C'est bien ça ? » : les ingrédients trouvés sur la photo. On retire ce qui n'y est plus, on ajoute ce qui manque, on marque ce qui est à finir,
// Toucher un ingrédient change son nom ou sa quantité.
// puis « Continuer » : le menu, l'envie, les placards et pour combien se choisissent sur la page suivante (Menu.tsx).
// Un ticket de caisse : son total part dans le budget courses à « Continuer » (Plus), sauf si on décoche.
import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Icon, LockPill, RoundButton } from "../../ui/components";
import type { ScanSource } from "../../lib/scan";
import { datesStep, getScan, setScan, useScan } from "./store";
import { Guide } from "./Guide";
import { ItemEdit } from "../fridge/ItemEdit";
import { qtyOf } from "../../lib/fridge";
import { eur, ofMonth, type Spend, ticketDay } from "../../lib/budget";
import { useOpenPaywall } from "../plus/subscription";
import { showToast } from "../toast";
import "../fridge/fridge.css";
import { INGR_GUIDE, setGuideState } from "./guideSteps";
import { locale, t } from "../../lib/i18n";
import "./scan.css";

// La photo ne montrait pas ce qui était choisi : où vont les produits, et « C'était bien… » pour revenir au choix de départ
const SEEN: Record<ScanSource, string> = t({
  frigo: "On dirait ton frigo : ces produits iront dans le frigo de Ma cuisine.",
  placard: "On dirait un placard : ces produits iront dans tes placards, pas dans le frigo.",
  ticket: "On dirait un ticket de caisse : ces produits s'ajoutent à Ma cuisine, sans rien remplacer.",
}, {
  frigo: "Looks like your fridge: these items will go in the fridge in My kitchen.",
  placard: "Looks like a cupboard: these items will go in your cupboards, not the fridge.",
  ticket: "Looks like a receipt: these items get added to My kitchen, nothing is replaced.",
});
const WAS: Record<ScanSource, string> = t({ frigo: "C'était bien le frigo", placard: "C'était bien un placard", ticket: "C'était bien un ticket" },
  { frigo: "It was the fridge", placard: "It was a cupboard", ticket: "It was a receipt" });

/** « 21 oct. » */
const dayTxt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" });

export function Stepper({ value, label, min, max, onChange }: { value: number; label: [string, string]; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper">
      <button type="button" aria-label={label[0]} onClick={() => onChange(Math.max(min, value - 1))}><Icon name="minus" /></button>
      <output>{value}</output>
      <button type="button" aria-label={label[1]} onClick={() => onChange(Math.min(max, value + 1))}><Icon name="plus" /></button>
    </div>
  );
}

export function Ingredients({ guide, userId, isPlus, onSpend }: {
  guide: boolean; userId: string; isPlus: boolean;
  /** Budget courses : le total du ticket */
  onSpend: (s: Omit<Spend, "id">) => void;
}) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const scan = useScan();
  const screen = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState<{ i: number; focus: "name" | "qty" } | null>(null);
  if (!scan.photo && scan.ingredients.length === 0) return <Navigate to="/scan" replace />;

  const n = scan.ingredients.length;
  // Le total d'un ticket de caisse, pas encore compté
  const receipt = scan.source === "ticket" ? scan.ticket : null;
  const go = () => {
    if (receipt && isPlus && !scan.ticketOff) {
      const at = ticketDay(receipt.date);
      onSpend({ eur: receipt.eur, at, label: receipt.store || t("Ticket de caisse", "Receipt"), from: "ticket" });
      showToast(t(`${eur(receipt.eur)} ajoutés à ton budget ${ofMonth(new Date(at))}`, `${eur(receipt.eur)} added to your ${ofMonth(new Date(at))} budget`));
    }
    // Compté une fois : revenir sur cette page ne le recompte pas
    if (scan.ticket) setScan({ ticket: null });
    navigate(datesStep(getScan()) ? "/scan/dates" : "/scan/menu");
  };
  // Sans jeton, aucune photo n'a été lue : les ingrédients ont été tapés à la main
  const remove = (i: number) => setScan({ ingredients: getScan().ingredients.filter((_, k) => k !== i) });
  // « À finir » : passe en premier dans les recettes, et compte comme sauvé une fois cuisiné
  const rename = (i: number, name: string, qty: string) => {
    setScan({ ingredients: getScan().ingredients.map((it, k) => (k === i ? { ...it, name, qty } : it)) });
    setEditing(null);
  };
  const toggleFinish = (i: number) => setScan({ ingredients: getScan().ingredients.map((it, k) => (k === i ? { ...it, finish: !it.finish } : it)) });

  return (
    <section ref={screen} className="fa scan-screen scr-ingr" aria-label={t("Ingrédients trouvés", "Ingredients found")}>
      <div className="ingr-photo">{scan.photo && <img src={scan.photo} alt="" />}</div>
      <div className="ingr-top">
        <RoundButton icon="back" label={t("Reprendre la photo", "Retake the photo")} tone="dark" onClick={() => navigate("/scan", { replace: true })} />
        <RoundButton icon="redo" label={t("Rescanner", "Scan again")} tone="dark" onClick={() => navigate("/scan", { replace: true })} />
      </div>
      <div className="ingr-sheet">
        <div className="ingr-gh">
          <div className="grab" />
          <span className="label">{t(`${n} ingrédient${n > 1 ? "s" : ""} ${scan.token ? "trouvé" : "ajouté"}${n > 1 ? "s" : ""}`, `${n} ingredient${n > 1 ? "s" : ""} ${scan.token ? "found" : "added"}`)}</span>
          <h2>{t(<>C'est bien <em>ça&nbsp;?</em></>, <>Is that <em>right?</em></>)}</h2>
          <p>{t("Retire ce qui n'y est plus, ajoute ce qui manque, et marque ce qui est à finir vite. Touche un nom ou une quantité pour le changer.", "Remove what's gone, add what's missing, and mark what needs using up soon. Tap a name or a quantity to change it.")}</p>
          {scan.switched && !scan.merge && (
            <div className="seen" role="status">
              <Icon name="eye" /><span>{SEEN[scan.source]}</span>
              <button type="button" onClick={() => setScan({ source: scan.switched!, switched: null })}>{WAS[scan.switched]}</button>
            </div>
          )}
        </div>
        <div className="scroll">
          <div className="ingr-body">
            {receipt && (isPlus ? (
              <div className="toggle-row">
                <div><b>{t("Compter dans mon budget", "Count in my budget")}</b><span>{eur(receipt.eur)}{receipt.store ? t(` chez ${receipt.store}`, ` at ${receipt.store}`) : ""}{receipt.date ? t(`, le ${dayTxt(receipt.date)}`, `, on ${dayTxt(receipt.date)}`) : ""}</span></div>
                <button type="button" className="sw" role="switch" aria-checked={!scan.ticketOff} aria-label={t("Compter dans mon budget", "Count in my budget")}
                  onClick={() => setScan({ ticketOff: !scan.ticketOff })} />
              </div>
            ) : (
              <button type="button" className="toggle-row" onClick={() => openPaywall("budget")}>
                <div><b>{t("Suis ton budget courses", "Track your grocery budget")}</b><span>{t(`Ce ticket fait ${eur(receipt.eur)}. Avec Plus, il s'ajoute tout seul à ton budget du mois.`, `This receipt comes to ${eur(receipt.eur)}. With Plus, it's added to your monthly budget automatically.`)}</span></div>
                <LockPill />
              </button>
            ))}
            {n > 0 && (
              <div className="ilist">
                {scan.ingredients.map((it, i) => { const qty = qtyOf(it.qty); return (
                  <div key={it.name + i} className={"irow" + (it.finish ? " fin" : "") + (editing?.i === i ? " editing" : "")}>
                    <i />
                    {editing?.i === i ? <ItemEdit name={it.name} qty={qty} focus={editing.focus} onSave={(nm, q) => rename(i, nm, q)} onCancel={() => setEditing(null)} /> : <>
                      <button type="button" className="inm" aria-label={t(`Changer le nom de ${it.name}`, `Rename ${it.name}`)} onClick={() => setEditing({ i, focus: "name" })}><b>{it.name}</b></button>
                      <button type="button" className={"iq" + (qty ? "" : " none")} aria-label={qty ? t(`Quantité de ${it.name} : ${qty}. Changer`, `Quantity of ${it.name}: ${qty}. Change`) : t(`Ajouter une quantité à ${it.name}`, `Add a quantity to ${it.name}`)}
                        onClick={() => setEditing({ i, focus: "qty" })}>{qty || t("+ quantité", "+ quantity")}</button>
                    </>}
                    {editing?.i !== i && <>
                    <button type="button" className="finb" aria-pressed={!!it.finish} aria-label={t(`${it.name} à finir`, `Use up ${it.name}`)} onClick={() => toggleFinish(i)}>{t("À finir", "Use up")}</button>
                    <button type="button" className="rm" aria-label={t(`Retirer ${it.name}`, `Remove ${it.name}`)} onClick={() => remove(i)}><Icon name="x" /></button>
                    </>}
                  </div>
                ); })}
              </div>
            )}
            <button type="button" className="add" onClick={() => navigate("/scan/ajouter")}><span className="rm"><Icon name="plus" /></span>{t("Ajouter un ingrédient", "Add an ingredient")}</button>
          </div>
        </div>
        <button type="button" className="gobar" disabled={n === 0} onClick={go}>
          <span><b>{t("Continuer", "Continue")}</b><small>{datesStep(scan) ? t("Puis les dates de péremption", "Then the use-by dates") : t("Puis tu choisis ton menu", "Then you pick your menu")}</small></span>
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
