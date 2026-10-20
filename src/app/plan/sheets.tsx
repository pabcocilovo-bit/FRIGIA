// Les feuilles de la semaine : choisir un repas (Crée ta semaine), placer une recette (« Ajouter à ma semaine »),
// remplacer un repas (Planning, Accueil) et le plat prévu ce soir (Accueil, Plus).
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Badge, Chip, Dialog, Icon } from "../../ui/components";
import type { MealKey, Slot, Week } from "../../lib/home";
import { type Person, portionsOf, portTxt } from "../../lib/household";
import type { HistoryEntry } from "../../lib/types";
import type { WeekDay } from "../format";
import { showToast } from "../toast";
import { Stepper } from "../scan/Ingredients";
import { eatersOf, minutesOf } from "../scan/portions";
import { MAX_GUESTS, setScan, useScan } from "../scan/store";
import { Dish } from "./Dish";
import {
  dayOf, doubled, findTitle, foundOf, leftFor, MEAL_NAME, type Option, recipePath, setSlot, slotOption, status, swapOrder, type SwapBy,
} from "./week";
import "../onboarding/ob.css";
import "./plan.css";

const lower1 = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** « mercredi soir », « ce soir » */
const when = (days: WeekDay[], i: number, meal: MealKey) => (i === 0 ? `ce ${MEAL_NAME[meal]}` : `${days[i].long.toLowerCase()} ${MEAL_NAME[meal]}`);

/** Grande feuille du bas, avec son en-tête et sa liste qui défile. */
function Layer({ open, onClose, label, className, children }: { open: boolean; onClose: () => void; label: string; className: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  return createPortal(
    <div className={"fa fa-layer" + (open ? " open" : "")} aria-hidden={!open} inert={!open}>
      <div className="scrim" onClick={onClose} />
      <div className={"sheet " + className} role="dialog" aria-modal="true" aria-label={label}>
        <span className="grab" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

type Tab = "scan" | "fav" | "ok" | "box" | "fast";

/** Crée ta semaine : « Choisis ton repas » pour une case. Les restes de la veille d'abord pour un midi. */
export function PickSheet({ at, week, days, opts, favTitles, onPick, onClose }: {
  at: { i: number; meal: MealKey } | null;
  week: Week; days: WeekDay[]; opts: Option[]; favTitles: string[];
  onPick: (slot: Slot) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("scan");
  const [chosen, setChosen] = useState<string | null>(null);
  const [last, setLast] = useState(at);
  if (at && at !== last) { setLast(at); setTab("scan"); setChosen(null); }
  const cur = last;
  const i = cur?.i ?? 0, meal = cur?.meal ?? "s";
  const d = days[i];
  const slot = cur ? dayOf(week, d.key)[meal] : undefined;
  const lf = cur && meal === "m" ? leftFor(week, days, i) : undefined;
  const tabs: [Tab, string][] = meal === "m"
    ? [["scan", "Idées du scan"], ["fav", "Tes favoris"], ["box", "Se mange froid"], ["fast", "Moins de 20 min"]]
    : [["scan", "Idées du scan"], ["fav", "Tes favoris"], ["ok", "Tu as tout"], ["fast", "Moins de 20 min"]];
  const list = opts.filter(o =>
    tab === "scan" ? !o.fav : tab === "fav" ? favTitles.includes(o.recipe.title) : tab === "ok" ? status(o.recipe, o.found).missing === 0
      : tab === "box" ? !!o.recipe.cold : minutesOf(o.recipe) > 0 && minutesOf(o.recipe) < 20);
  const pick = (s: Slot, id: string) => {
    setChosen(id);
    setTimeout(() => {
      onPick(s);
      showToast(`${s.left ? "Restes : " : ""}${s.recipe.title} · ${days[i].long.toLowerCase()} ${MEAL_NAME[meal]}`);
    }, 260);
  };
  const isOn = (id: string, fallback: boolean) => (chosen ? chosen === id : fallback);

  return (
    <Layer open={!!at} onClose={onClose} label="Choisis ton repas" className="pn-sheet">
      <div className="pn-sh-head">
        <div><small>{d.long} {d.date.getDate()} · {meal === "m" ? "le midi" : "le soir"}</small><h3>{slot ? "Change de repas" : "Choisis ton repas"}</h3></div>
        <button type="button" className="fg-x" aria-label="Fermer" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="chips pn-sh-chips">
        {tabs.map(([t, l]) => <Chip key={t} on={tab === t} onClick={() => setTab(t)}>{l}</Chip>)}
      </div>
      <div className="pn-sh-list">
        {lf && (
          <button type="button" className={"pn-opt left" + (isOn("left", !!slot?.left) ? " on" : "")} onClick={() => pick({ ...lf, left: true }, "left")}>
            <Dish recipe={lf.recipe} />
            <span className="tx"><span className="kick">Zéro gâchis</span><b>Les restes de {days[i - 1].long.toLowerCase()} soir</b>
              <span>{lf.recipe.title} · rien à cuisiner</span><Badge>On double la dose la veille</Badge></span>
            <span className="ck"><Icon name="check" /></span>
          </button>
        )}
        {list.map(o => {
          const st = status(o.recipe, o.found);
          const other = findTitle(week, days, o.recipe.title, [d.key, meal]);
          const on = isOn(o.recipe.title, !!slot && !slot.left && slot.recipe.title === o.recipe.title);
          return (
            <button key={o.recipe.title} type="button" className={"pn-opt" + (on ? " on" : "")} onClick={() => pick(slotOption(o), o.recipe.title)}>
              <Dish recipe={o.recipe} />
              <span className="tx"><b>{o.recipe.title}</b><span>{o.recipe.time}{tab === "box" ? " · se mange froid" : ""}</span>
                <Badge tone={st.warn ? "warn" : undefined}>{st.text}</Badge>
                {other && <span className="pn-used">Déjà prévu {when(days, other[0], other[1])}</span>}
              </span>
              <span className="ck"><Icon name="check" /></span>
            </button>
          );
        })}
        {!list.length && !lf && (
          <p className="pn-sh-none">{tab === "scan" ? "Pas encore d'idée cette semaine. Scanne ton frigo : ses recettes arrivent ici."
            : tab === "fav" ? "Pas encore de favori. Touche le cœur d'une recette pour la garder."
              : "Rien dans cette liste pour l'instant."}</p>
        )}
      </div>
    </Layer>
  );
}

/** « Ajouter à ta semaine » : on touche une case libre (ou pleine, pour remplacer). Déjà prévue ailleurs : elle se déplace. */
export function WeekSheet({ option, week, days, setWeek, onClose }: {
  option: Option | null; week: Week; days: WeekDay[]; setWeek: (w: Week) => void; onClose: () => void;
}) {
  const navigate = useNavigate();
  const [last, setLast] = useState(option);
  if (option && option !== last) setLast(option);
  const o = last;
  const place = (i: number, meal: MealKey) => {
    if (!o) return;
    const old = findTitle(week, days, o.recipe.title);
    let w = week;
    if (old && !(old[0] === i && old[1] === meal)) w = setSlot(w, days, days[old[0]].key, old[1], undefined);
    setWeek(setSlot(w, days, days[i].key, meal, slotOption(o)));
    onClose();
    showToast(`Ajouté à ta semaine · ${days[i].long.toLowerCase()} ${MEAL_NAME[meal]}`);
  };
  const slotBtn = (i: number, meal: MealKey) => {
    const day = dayOf(week, days[i].key), sl = day[meal];
    const tag = <span className="wk-tag">{MEAL_NAME[meal]}</span>;
    if (!sl) return <button key={meal} type="button" className="wk-slot free" onClick={() => place(i, meal)}>{tag}Libre</button>;
    const me = !!o && !sl.left && sl.recipe.title === o.recipe.title;
    return (
      <button key={meal} type="button" className={"wk-slot has" + (me ? " me" : "")} onClick={() => place(i, meal)}>
        {tag}<Dish recipe={sl.recipe} /><span><b>{sl.recipe.title}</b><i>{me ? "Déjà prévu ici" : sl.left ? "Restes de la veille" : "Toucher pour remplacer"}</i></span>
      </button>
    );
  };
  return (
    <Layer open={!!option} onClose={onClose} label="Ajouter à ta semaine" className="wk-sheet">
      {o && <>
        <div className="wk-head"><Dish recipe={o.recipe} /><div><small>Ajouter à ta semaine</small><h3>{o.recipe.title}</h3></div>
          <button type="button" className="fg-x" aria-label="Fermer" onClick={onClose}><Icon name="x" /></button></div>
        <p className="wk-q">Quel repas ?</p>
        <div className="wk-list">
          {days.map((d, i) => {
            const off = dayOf(week, d.key).off;
            return [
              <span key={d.key} className={"wk-day" + (i === 0 ? " today" : "")}><small>{d.short}</small><b>{d.date.getDate()}</b></span>,
              off
                ? <button key={d.key + "x"} type="button" className="wk-slot off" onClick={() => place(i, "s")}>Pas de repas</button>
                : <div key={d.key + "p"} className="wk-pair">{slotBtn(i, "m")}{slotBtn(i, "s")}</div>,
            ];
          })}
        </div>
        <button type="button" className="wk-see" onClick={() => { onClose(); navigate("/planning/creer"); }}>Voir toute ma semaine<Icon name="next" /></button>
      </>}
    </Layer>
  );
}

/** Remplacer un repas : trois idées à la fois, triées selon la pastille. Les restes du lendemain suivent le nouveau plat. */
export function SwapSheet({ at, week, days, opts, household, setWeek, onClose }: {
  at: { i: number; meal: MealKey } | null;
  week: Week; days: WeekDay[]; opts: Option[]; household: Person[];
  setWeek: (w: Week) => void; onClose: () => void;
}) {
  const [by, setBy] = useState<SwapBy>("frigo");
  const [off, setOff] = useState(0);
  const [sel, setSel] = useState(0);
  const [last, setLast] = useState(at);
  const car = useRef<HTMLDivElement>(null);
  if (at && at !== last) { setLast(at); setBy("frigo"); setOff(0); setSel(0); }
  const i = last?.i ?? 0, meal = last?.meal ?? "s";
  const sl = last ? dayOf(week, days[i].key)[meal] : undefined;
  const pool = swapOrder(opts.filter(o => o.recipe.title !== sl?.recipe.title), by);
  const list = pool.length ? Array.from({ length: Math.min(3, pool.length) }, (_, j) => pool[(off + j) % pool.length]) : [];
  const dbl = !!sl && meal === "s" && doubled(week, days, i);
  const kids = household.some(p => p.kid);
  const reset = (fn: () => void) => { fn(); setSel(0); car.current?.scrollTo({ left: 0 }); };
  const go = () => {
    const o = list[sel];
    if (!o || !last) return;
    const ns = slotOption(o);
    let w = setSlot(week, days, days[i].key, meal, ns);
    if (dbl) w = setSlot(w, days, days[i + 1].key, "m", { ...ns, left: true });
    setWeek(w);
    onClose();
    showToast(`${i === 0 ? `Ce ${MEAL_NAME[meal]}` : `${days[i].long} ${MEAL_NAME[meal]}`} : ${lower1(o.recipe.title)}`);
  };
  const onScroll = () => {
    const el = car.current, c = el?.querySelector<HTMLElement>(".sw-card");
    if (!el || !c) return;
    setSel(Math.max(0, Math.min(list.length - 1, Math.round(el.scrollLeft / (c.offsetWidth + 12)))));
  };
  const tap = (j: number) => {
    if (j === sel) { go(); return; }
    const c = car.current?.querySelector<HTMLElement>(".sw-card");
    car.current?.scrollTo({ left: j * ((c?.offsetWidth ?? 0) + 12), behavior: "smooth" });
    setSel(j);
  };

  return (
    <Dialog open={!!at} onClose={onClose} className="sw-sheet" label="Remplacer ce repas">
      <button type="button" className="dl-x" aria-label="Fermer" onClick={onClose}><Icon name="x" /></button>
      <span className="sw-d">{i === 0 ? "Aujourd'hui" : `${days[i].long} ${days[i].date.getDate()}`} · {meal === "m" ? "le midi" : "le soir"}</span>
      <h3>{i === 0 && meal === "s" ? <>Autre chose <em>ce soir&nbsp;?</em></> : <>Plutôt autre <em>chose&nbsp;?</em></>}</h3>
      {sl && <p className="sw-cur"><Dish recipe={sl.recipe} className="plate" /><span>À la place de <b>{lower1(sl.recipe.title)}{sl.left ? " (les restes)" : ""}</b></span></p>}
      <div className="chips sw-chips" role="tablist">
        <Chip on={by === "frigo"} onClick={() => reset(() => { setBy("frigo"); setOff(0); })}>Mon frigo</Chip>
        <Chip on={by === "vite"} onClick={() => reset(() => { setBy("vite"); setOff(0); })}>Plus rapide</Chip>
        {kids && <Chip on={by === "kids"} onClick={() => reset(() => { setBy("kids"); setOff(0); })}>Enfants</Chip>}
      </div>
      {list.length ? <>
        <div className="sw-car" ref={car} onScroll={onScroll}>
          {list.map((o, j) => {
            const st = status(o.recipe, o.found);
            return (
              <button key={o.recipe.title} type="button" className={"sw-card" + (j === sel ? " on" : "")} onClick={() => tap(j)}>
                <Dish recipe={o.recipe} className="plate" /><b>{o.recipe.title}</b>
                <span className="sw-m">{o.recipe.time}{o.recipe.kids ? " · les enfants adorent" : ""}</span>
                <Badge tone={st.warn ? "warn" : undefined} icon={st.warn ? undefined : "check"}>{st.text}</Badge>
              </button>
            );
          })}
        </div>
        <div className="sw-dots" aria-hidden="true">{list.map((_, j) => <i key={j} className={j === sel ? "on" : undefined} />)}</div>
      </> : <p className="sw-none">Pas d'autre idée cette semaine. Scanne ton frigo pour en avoir de nouvelles.</p>}
      {dbl && <p className="sw-left"><Icon name="leaf" /><span>Les restes sont prévus {days[i + 1].long.toLowerCase()} midi : ils suivront le nouveau plat. Fais-en un peu plus.</span></p>}
      <button type="button" className="pill sage block" disabled={!list.length} onClick={go}>Remplacer par ce plat</button>
      <div className="sw-alt">
        <button type="button" className="link" disabled={pool.length <= 3} onClick={() => reset(() => setOff(x => x + 3))}><Icon name="redo" />D'autres idées</button>
        <button type="button" className="link sw-keep" onClick={onClose}>Garder ce plat</button>
      </div>
    </Dialog>
  );
}

/** Accueil (Plus) : le plat prévu ce soir. Qui mange, les invités, puis la cuisson. */
export function TonightSheet({ open, slot, history, household, onSwap, onClose }: {
  open: boolean; slot: Slot | undefined; history: HistoryEntry[]; household: Person[];
  onSwap: () => void; onClose: () => void;
}) {
  const navigate = useNavigate();
  const scan = useScan();
  const eaters = eatersOf(household, scan);
  const p = portionsOf(eaters, scan.guests);
  if (!slot) return null;
  const r = slot.recipe;
  const st = status(r, foundOf(slot, history));
  const steps = r.steps?.length ?? 0;
  const path = recipePath(slot, history);
  const toggle = (id: string) => {
    const away = scan.away.includes(id);
    if (!away && eaters.length === 1) { showToast("Il faut au moins une personne à table"); return; }
    setScan({ away: away ? scan.away.filter(x => x !== id) : [...scan.away, id] });
  };
  const guests = (g: number) => {
    if (g > scan.guests) showToast(g === 1 ? "Un invité ce soir : les quantités suivent" : `${g} invités ce soir : les quantités suivent`);
    setScan({ guests: g });
  };
  return (
    <Dialog open={open} onClose={onClose} className="tn-sheet" label="Prévu ce soir">
      <div className="tn-top">
        <Dish recipe={r} className="plate" />
        <div><span className="label">Prévu ce soir</span><h3>{r.title}</h3><span className="tn-sm">{r.time}{steps ? ` · ${steps} étape${steps > 1 ? "s" : ""}` : ""}</span></div>
      </div>
      <p className={"tn-have" + (st.warn ? " warn" : "")}><Icon name={st.warn ? "cart" : "leaf"} /><span>{st.text}{st.warn ? " : pense à l'acheter en rentrant." : "."}</span></p>
      <span className="label tn-q">Qui mange ?</span>
      <div className="tn-who">
        {household.map(m => {
          const on = !scan.away.includes(m.id);
          return (
            <button key={m.id} type="button" className={"tn-p" + (on ? " on" : "")} aria-pressed={on} onClick={() => toggle(m.id)}>
              <i>{m.name.charAt(0).toUpperCase()}</i>{m.name}{m.kid && <small>{m.age} ans</small>}
            </button>
          );
        })}
      </div>
      <div className="gst tn-gst"><span className="gst-ic"><Icon name="users" /></span><div><b>Des invités ?</b><small>Comptés comme des adultes</small></div>
        <Stepper value={scan.guests} min={0} max={MAX_GUESTS} label={["Un invité de moins", "Un invité de plus"]} onChange={guests} />
      </div>
      <button type="button" className="gobar tn-cook" onClick={() => { onClose(); navigate(`${path}/cuisine`, { state: { recipe: r, servings: p } }); }}>
        <span><b>Commencer la cuisson</b><small>Pour {portTxt(p)} · {r.time}</small></span>
        <span className="go"><Icon name="arrow" /></span>
      </button>
      <div className="tn-links">
        <button type="button" className="link" onClick={() => { onClose(); navigate(path, { state: { recipe: r, servings: p, from: "plan" } }); }}>Voir la recette en entier</button>
        <button type="button" className="link" onClick={onSwap}>Changer de plat</button>
      </div>
    </Dialog>
  );
}
