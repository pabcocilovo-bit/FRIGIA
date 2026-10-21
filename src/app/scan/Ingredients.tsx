// « C'est bien ça ? » : les ingrédients trouvés sur la photo. On retire ce qui n'y est plus, on ajoute ce qui manque, on marque ce qui est à finir,
// Toucher un ingrédient change son nom ou sa quantité.
// puis « Continuer » : le menu, l'envie, les placards et pour combien se choisissent sur la page suivante (Menu.tsx).
import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Icon, RoundButton } from "../../ui/components";
import type { ScanSource } from "../../lib/scan";
import { getScan, setScan, useScan } from "./store";
import { Guide } from "./Guide";
import { ItemEdit } from "../fridge/ItemEdit";
import { qtyOf } from "../../lib/fridge";
import "../fridge/fridge.css";
import { INGR_GUIDE, setGuideState } from "./guideSteps";
import "./scan.css";

// La photo ne montrait pas ce qui était choisi : où vont les produits, et « C'était bien… » pour revenir au choix de départ
const SEEN: Record<ScanSource, string> = {
  frigo: "On dirait ton frigo : ces produits iront dans le frigo de Ma cuisine.",
  placard: "On dirait un placard : ces produits iront dans tes placards, pas dans le frigo.",
  ticket: "On dirait un ticket de caisse : ces produits s'ajoutent à Ma cuisine, sans rien remplacer.",
};
const WAS: Record<ScanSource, string> = { frigo: "C'était bien le frigo", placard: "C'était bien un placard", ticket: "C'était bien un ticket" };

export function Stepper({ value, label, min, max, onChange }: { value: number; label: [string, string]; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper">
      <button type="button" aria-label={label[0]} onClick={() => onChange(Math.max(min, value - 1))}><Icon name="minus" /></button>
      <output>{value}</output>
      <button type="button" aria-label={label[1]} onClick={() => onChange(Math.min(max, value + 1))}><Icon name="plus" /></button>
    </div>
  );
}

export function Ingredients({ guide, userId }: { guide: boolean; userId: string }) {
  const navigate = useNavigate();
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
          {scan.switched && !scan.merge && (
            <div className="seen" role="status">
              <Icon name="eye" /><span>{SEEN[scan.source]}</span>
              <button type="button" onClick={() => setScan({ source: scan.switched!, switched: null })}>{WAS[scan.switched]}</button>
            </div>
          )}
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
          </div>
        </div>
        <button type="button" className="gobar" disabled={n === 0} onClick={() => navigate("/scan/menu")}>
          <span><b>Continuer</b><small>Puis tu choisis ton menu</small></span>
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
