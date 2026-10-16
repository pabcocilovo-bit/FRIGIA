// 7 · Mon frigo (écart maquette, demandé par Hugo le 16 octobre) : l'onglet « Courses » devient « Mon frigo », deux pages.
// Le frigo (pour tous) : ce que le dernier scan a vu, les courses cochées, ce qu'on ajoute. La liste de courses (Plus) : Lists.tsx.
import { useState } from "react";
import { useNavigate } from "react-router";
import { Chip, EmptyState, Icon, LockPill, Pill, RoundButton } from "../../ui/components";
import { ArtFridge } from "../../ui/art";
import type { Fridge, FridgeItem } from "../../lib/home";
import { addItems, toIngredients, undoCooked } from "../../lib/fridge";
import { aisleOf, AISLES, joinNames } from "../../lib/shopping";
import { AppTabBar } from "../AppTabBar";
import { plural } from "../format";
import { useOpenScan } from "../offline";
import { useOpenPaywall } from "../plus/subscription";
import { setScan } from "../scan/store";
import "../scan/scan.css";
import "./fridge.css";

const DAY = 864e5;
const daysSince = (at: number) => Math.max(0, Math.round((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / DAY));
const ago = (at: number) => { const d = daysSince(at); return d === 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} jours`; };
const FROM: Record<FridgeItem["from"], string> = { scan: "Vu", courses: "Acheté", main: "Ajouté" };

/** Les deux pages de l'onglet : Mon frigo, Courses (cadenas en Gratuit) */
export function FridgeTabs({ on, isPlus }: { on: "frigo" | "courses"; isPlus: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="chips fr-tabs" role="tablist">
      <Chip ongreen on={on === "frigo"} role="tab" aria-selected={on === "frigo"} onClick={() => on !== "frigo" && navigate("/frigo", { replace: true })}>Mon frigo</Chip>
      <Chip ongreen on={on === "courses"} role="tab" aria-selected={on === "courses"} onClick={() => on !== "courses" && navigate("/courses", { replace: true })}>
        Courses{!isPlus && <Icon name="lock" />}
      </Chip>
    </div>
  );
}

function Row({ it, onFinish, onRemove }: { it: FridgeItem; onFinish: () => void; onRemove: () => void }) {
  return (
    <div className={"litem fr-item" + (it.finish ? " fin" : "")}>
      <span className="nm"><b>{it.name}</b><small>{it.qty ? `${it.qty} · ` : ""}{FROM[it.from]} {ago(it.at)}</small></span>
      <button type="button" className={"fr-fin" + (it.finish ? " on" : "")} aria-pressed={!!it.finish} onClick={onFinish}>À finir</button>
      <button type="button" className="fr-x" aria-label={`Retirer ${it.name}`} onClick={onRemove}><Icon name="x" /></button>
    </div>
  );
}

export function MyFridge({ isPlus, fridge, onFridge }: {
  isPlus: boolean; fridge: Fridge; onFridge: (f: Fridge | ((f: Fridge) => Fridge)) => void;
}) {
  const navigate = useNavigate();
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  const [name, setName] = useState("");
  const items = fridge.items;
  const old = fridge.seen != null && daysSince(fridge.seen) > 5;
  // La dernière recette cuisinée, les deux derniers jours : ce qu'elle a retiré, et « Remettre »
  const cooked = fridge.cooked && daysSince(fridge.cooked.at) <= 1 ? fridge.cooked : null;

  const groups = AISLES.map(a => [a, items.filter(x => aisleOf(x.name) === a)] as const).filter(([, l]) => l.length);
  const set = (id: string, patch: Partial<FridgeItem> | null) =>
    onFridge(f => ({ ...f, items: patch ? f.items.map(x => (x.id === id ? { ...x, ...patch } : x)) : f.items.filter(x => x.id !== id) }));
  const add = () => {
    if (!name.trim()) return;
    onFridge(f => addItems(f, [{ name, qty: "" }], "main"));
    setName("");
  };
  // « Que cuisiner avec ? » : les produits du frigo passent dans « C'est bien ça ? », sans photo
  const cook = () => {
    setScan({ source: "frigo", photo: null, ingredients: toIngredients(fridge), token: null, empty: false, guests: 0 });
    navigate("/scan/ingredients");
  };
  // Frigo vide : des plats quand même (Plus)
  const ideas = () => {
    if (!isPlus) { openPaywall("vide"); return; }
    setScan({ source: "frigo", photo: null, ingredients: [], token: null, empty: true });
    navigate("/scan/preparation");
  };

  return (
    <div className="fa fa-app" aria-label="Mon frigo">
      <div className="rhead">
        <div className="row">
          <span className="label">{fridge.seen != null ? `Scanné ${ago(fridge.seen)}` : "Pas encore scanné"}</span>
          <RoundButton icon="cam" label="Scanner mon frigo" tone="glass" onClick={openScan} />
        </div>
        <div>
          {items.length > 0 && <span className="label">{plural(items.length, "produit")}</span>}
          <h2>Ton <em>frigo</em></h2>
        </div>
        <FridgeTabs on="frigo" isPlus={isPlus} />
      </div>
      <div className="lbody">
        {cooked && (
          <div className="fr-note">
            <span><b>{cooked.title}</b> · retiré du frigo : {joinNames(cooked.items.map(x => x.name)).toLowerCase()}.</span>
            <button type="button" className="link" onClick={() => onFridge(undoCooked)}>Remettre</button>
          </div>
        )}
        {items.length === 0 ? <>
          <EmptyState
            art={<ArtFridge />}
            title={<>Ton frigo est <em>vide</em></>}
            text="Scanne-le : ce que Frigia voit arrive ici. Tes courses cochées aussi."
            action={<Pill icon="cam" onClick={openScan}>Scanner mon frigo</Pill>}
          />
          <button type="button" className="sf-empty fr-ideas" onClick={ideas}>
            <span className="ico"><Icon name="sparkle" /></span>
            <span className="tx"><b>Rien dedans ?</b>3 plats avec ton placard, et une petite liste de courses</span>
            {isPlus ? <Icon name="next" className="muted" /> : <LockPill />}
          </button>
        </> : <>
          {old && <p className="fr-old">Vu il y a {daysSince(fridge.seen!)} jours. Rescanne ton frigo pour le mettre à jour.</p>}
          <Pill block icon="sparkle" onClick={cook}>Que cuisiner avec ?</Pill>
          {groups.map(([aisle, group]) => (
            <div key={aisle} className="lgroup">
              <span className="label">{aisle}</span>
              <div className="litems">
                {group.map(it => <Row key={it.id} it={it} onFinish={() => set(it.id, { finish: !it.finish || undefined })} onRemove={() => set(it.id, null)} />)}
              </div>
            </div>
          ))}
        </>}
        <form className="fr-add" onSubmit={e => { e.preventDefault(); add(); }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ajouter un produit" aria-label="Ajouter un produit" maxLength={60} enterKeyHint="done" />
          <button type="submit" aria-label="Ajouter" disabled={!name.trim()}><Icon name="plus" /></button>
        </form>
      </div>
      <AppTabBar active="list" isPlus={isPlus} />
    </div>
  );
}
