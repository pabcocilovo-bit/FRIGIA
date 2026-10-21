// Ajouter ce que la photo a raté : une feuille par-dessus la liste. On cherche, ou on pioche dans ce qu'on ajoute
// souvent, rangé par rayon. Plusieurs d'un coup. Si rien ne correspond, on ajoute le mot tapé tel quel, et il revient la fois d'après.
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Icon } from "../../ui/components";
import type { IconName } from "../../ui/icons";
import { typedItem } from "../../lib/shopping";
import { showToast } from "../toast";
import { CATALOG, type Cat, OFTEN, same, type Sug, typedSug } from "./catalog";
import { communityIngredients, shareTyped } from "./community";
import { getScan, setScan, useScan } from "./store";
import "./scan.css";

const CAT: Record<Cat, [IconName, string]> = {
  legume: ["sprout", "Légumes"], fruit: ["leaf", "Fruits"], herbe: ["leaf", "Herbes"], cremerie: ["milk", "Crèmerie"],
  viande: ["utensils", "Boucherie"], poisson: ["fish", "Poissonnerie"], epicerie: ["wheat", "Épicerie"], libre: ["plus", "Ajouté à la main"],
};
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Row({ it, q, on, onClick }: { it: Sug; q: string; on: boolean; onClick: () => void }) {
  const [icon, label] = CAT[it[1]];
  const i = q ? norm(it[0]).indexOf(q) : -1;
  return (
    <button type="button" className={"ai-row" + (on ? " on" : "") + (it[1] === "libre" ? " ai-free" : "")} onClick={onClick}>
      <span className={"ai-ic c-" + it[1]}><Icon name={icon} /></span>
      <span className="tx">
        <b>{i >= 0 ? <>{it[0].slice(0, i)}<mark>{it[0].slice(i, i + q.length)}</mark>{it[0].slice(i + q.length)}</> : it[0]}</b>
        <small>{it[1] === "libre" ? "Pas dans la liste : on l'ajoute, et tu le retrouveras ici" : it[3] === "toi" ? `${label} · ajouté par toi` : it[3] ? `${label} · ajouté par la communauté` : `${label} · ${it[2]}`}</small>
      </span>
      <span className="ai-pl"><Icon name={on ? "check" : "plus"} /></span>
    </button>
  );
}

/** mine : les ingrédients tapés un jour (gardés sur le compte) ; onMine : ceux qu'on vient de taper, à garder */
export function AddIngredient({ mine, onMine }: { mine: string[]; onMine: (names: string[]) => void }) {
  const navigate = useNavigate();
  const typed = !!(useLocation().state as { typed?: boolean } | null)?.typed;
  const scan = useScan();
  const [raw, setRaw] = useState("");
  const [picked, setPicked] = useState<Sug[]>([]);
  const [all, setAll] = useState(false);
  const [community, setCommunity] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let on = true;
    void communityIngredients(n => setCommunity(n)).then(n => { if (on) setCommunity(n); });
    return () => { on = false; };
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { if (window.innerWidth > 700) input.current?.focus(); }, 350);
    return () => clearTimeout(t);
  }, []);

  const q = norm(raw.trim());
  const have = (typed ? [] : scan.ingredients).map(i => i.name);
  const extra = picked.filter(p => p[1] === "libre");
  const yours = mine.map(n => typedSug(n, "toi"));
  const known = [...yours, ...CATALOG];
  const others = community.filter(n => !known.some(k => same(k[0], n))).map(n => typedSug(n, "communaute"));
  const fresh = (list: Sug[]) => list.filter(it => !have.some(h => same(h, it[0])));
  // Rien de tapé : tes ajouts d'abord, puis les plus courants. En cherchant : toute la liste.
  const pool = fresh(q ? [...known, ...others, ...extra] : [...yours, ...OFTEN, ...extra]);
  const isOn = (it: Sug) => picked.some(p => p[0] === it[0]);
  const toggle = (it: Sug) => setPicked(p => (isOn(it) ? p.filter(x => x[0] !== it[0]) : [...p, it]));

  let rows: Sug[], sec: string, more = false;
  if (!q) {
    sec = "Souvent ajoutés";
    rows = all ? pool : pool.slice(0, 6);
    more = !all && pool.length > 6;
  } else {
    rows = pool.filter(it => norm(it[0]).includes(q)).sort((a, b) => norm(a[0]).indexOf(q) - norm(b[0]).indexOf(q));
    sec = rows.length ? `${rows.length} résultat${rows.length > 1 ? "s" : ""}` : "Aucun résultat";
    if (!rows.some(it => norm(it[0]) === q || same(it[0], raw))) {
      const t = raw.trim();
      rows = [...rows, [t.charAt(0).toUpperCase() + t.slice(1), "libre", ""]];
    }
  }

  const commit = () => {
    if (!picked.length) return;
    // Tapé librement : « 500 g de farine » donne farine, 500 g ; sans quantité, elle se met sur « C'est bien ça ? »
    const added = picked.map(it => {
      if (it[2]) return { name: it[0], qty: it[2] };
      const t = typedItem(it[0]);
      return { name: t.name.charAt(0).toUpperCase() + t.name.slice(1), qty: t.qty };
    });
    onMine(added.filter((_, i) => picked[i][1] === "libre" || picked[i][3]).map(a => a.name));
    shareTyped(added.filter((_, i) => picked[i][1] === "libre").map(a => a.name));
    const n = added.length;
    showToast(`${n} ingrédient${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""}`);
    if (typed) {
      // Sans photo lue : la liste part de zéro, et les recettes compteront un scan en Gratuit
      setScan({ ingredients: added, token: null, guests: 0, merge: true });
      navigate("/scan/ingredients", { replace: true });
    } else {
      setScan({ ingredients: [...getScan().ingredients, ...added] });
      navigate(-1);
    }
  };

  return (
    <section className="fa scan-screen scr-addIng" aria-label="Ajouter un ingrédient">
      <div className="ai-bg">{scan.photo && <img src={scan.photo} alt="" />}</div>
      <div className="ai-sheet">
        <span className="ai-grab" />
        <div className="ai-head">
          <button type="button" onClick={() => navigate(-1)}>Annuler</button>
          <b>Ajouter</b>
          <button type="button" className="ai-ok" disabled={!picked.length} onClick={commit}>OK</button>
        </div>
        <label className="ai-search">
          <Icon name="search" />
          <input ref={input} type="search" placeholder="Cherche un ingrédient" autoComplete="off" aria-label="Chercher un ingrédient" value={raw} onChange={e => setRaw(e.target.value)} />
          {raw && <button type="button" aria-label="Effacer" onClick={e => { e.preventDefault(); setRaw(""); input.current?.focus(); }}><Icon name="x" /></button>}
        </label>
        <div className={"ai-picked" + (picked.length ? " has" : "")}>
          {picked.length === 0 && <span className="ai-none">Rien de choisi pour l'instant</span>}
          {picked.map(it => (
            <button key={it[0]} type="button" className="ai-chip" aria-label={`Retirer ${it[0]}`} onClick={() => toggle(it)}><span>{it[0]}</span><Icon name="x" /></button>
          ))}
        </div>
        <div className="scroll"><div className="ai-list">
          <span className="ai-sec">{sec}</span>
          {rows.map(it => <Row key={it[1] + it[0]} it={it} q={q} on={isOn(it)} onClick={() => toggle(it)} />)}
          {more && <button type="button" className="ai-more" onClick={() => setAll(true)}>Voir plus <Icon name="next" className="ai-down" /></button>}
        </div></div>
        <div className="ai-foot">
          <button type="button" className="pill sage block" disabled={!picked.length} onClick={commit}>
            {picked.length ? `Ajouter ${picked.length} ingrédient${picked.length > 1 ? "s" : ""}` : "Choisis un ou plusieurs ingrédients"}
          </button>
        </div>
      </div>
    </section>
  );
}
