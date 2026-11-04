// « Tes placards » : après « Qu'est-ce qu'on cuisine ? », juste avant les recettes. Ce que Ma cuisine range aux placards
// (coché, on décoche ce qui est fini), « + Riz » pour ajouter d'un appui, un champ, et « Scanner mes placards ».
// Tout ce qui est ajouté ici l'est aussi dans Ma cuisine. Demandé par Hugo le 23 octobre, à la place de « Dans tes placards ? ».
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Chip, Icon, Pill, RoundButton } from "../../ui/components";
import { addItems, pantryOf } from "../../lib/fridge";
import type { Fridge } from "../../lib/home";
import type { Person } from "../../lib/household";
import { same } from "../../lib/shopping";
import { CreateBar } from "./Menu";
import { placardIdeas, placardStep, setScan, useScan } from "./store";
import { t } from "../../lib/i18n";
import "./scan.css";
import "../fridge/fridge.css";

export function Placards({ isPlus, household, kitchen, onFridge }: {
  isPlus: boolean; household: Person[];
  /** Ma cuisine : ce qu'il y a vraiment dans les placards */
  kitchen: Fridge;
  onFridge: (fn: (f: Fridge) => Fridge) => void;
}) {
  const navigate = useNavigate();
  const scan = useScan();
  const [name, setName] = useState("");
  if (!scan.ingredients.length || !placardStep(scan)) return <Navigate to="/scan/menu" replace />;

  const have = pantryOf(kitchen, scan.ingredients);
  const ideas = placardIdeas(kitchen, scan);
  const isOff = (n: string) => scan.off.some(o => same(o, n));
  const toggle = (n: string) => setScan({ off: isOff(n) ? scan.off.filter(o => !same(o, n)) : [...scan.off, n] });
  // Ajouté ici : rangé aux placards de Ma cuisine, et coché pour ces recettes
  const add = (n: string) => {
    if (!n.trim()) return;
    onFridge(f => addItems(f, [{ name: n.trim(), qty: "" }], "main", { place: "placard" }));
    if (isOff(n)) setScan({ off: scan.off.filter(o => !same(o, n)) });
  };
  // La caméra en mode placards : la photo s'ajoute à Ma cuisine, puis on revient ici
  const scanPlacards = () => { setScan({ forPlacards: true }); navigate("/scan"); };
  const on = have.filter(x => !isOff(x.name)).length;

  return (
    <section className="fa scan-screen scr-menu" aria-label={t("Tes placards", "Your cupboards")}>
      <div className="mn-head">
        <RoundButton icon="back" label={t("Retour", "Back")} tone="dark" onClick={() => navigate(-1)} />
        <span className="label">{t("Avant les recettes", "Before the recipes")}</span>
        <h2>{t(<>Et dans tes <em>placards&nbsp;?</em></>, <>And in your <em>cupboards?</em></>)}</h2>
      </div>
      <div className="mn-sheet">
        <div className="scroll">
          <div className="ingr-body">
            {have.length > 0 ? (
              <div className="opt pl-have">
                <span className="label">{t("Déjà dans tes placards", "Already in your cupboards")}</span>
                <div className="pl-chips">{have.map(x => (
                  <Chip key={x.name} on={!isOff(x.name)} onClick={() => toggle(x.name)}>{!isOff(x.name) && <Icon name="check" />}{x.name}</Chip>
                ))}</div>
                <span className="mn-note">{on ? t(`Frigia peut piocher dans ${on > 1 ? `ces ${on} produits` : "ce produit"}. Décoche ce qui est fini.`, `Frigia can use ${on > 1 ? `these ${on} items` : "this item"}. Untick what's run out.`) : t("Rien de coché : les recettes se font sans tes placards.", "Nothing ticked: the recipes skip your cupboards.")}</span>
              </div>
            ) : (
              <p className="fr-none">{t("Rien aux placards pour l'instant.", "Nothing in the cupboards yet.")} <button type="button" className="link" onClick={scanPlacards}>{t("Scanner mes placards", "Scan my cupboards")}</button></p>
            )}
            {ideas.length > 0 && (
              <div className="fr-basics">
                <span className="label">{t("Souvent dans les placards", "Often in the cupboards")}</span>
                <div className="fr-chips">
                  {ideas.map(([n, label]) => (
                    <button key={n} type="button" onClick={() => add(n)}><Icon name="plus" />{label}</button>
                  ))}
                </div>
              </div>
            )}
            <form className="fr-add" onSubmit={e => { e.preventDefault(); add(name); setName(""); }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t("Ajouter aux placards", "Add to the cupboards")}
                aria-label={t("Ajouter aux placards", "Add to the cupboards")} maxLength={60} enterKeyHint="done" />
              <button type="submit" aria-label={t("Ajouter", "Add")} disabled={!name.trim()}><Icon name="plus" /></button>
            </form>
            {have.length > 0 && <Pill tone="line" block icon="cam" onClick={scanPlacards}>{t("Scanner mes placards", "Scan my cupboards")}</Pill>}
          </div>
        </div>
        <CreateBar isPlus={isPlus} household={household} />
      </div>
    </section>
  );
}
