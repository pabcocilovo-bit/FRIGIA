// 8 bis · Crée ta semaine (prototype V3) : midi et soir, du jour même à la semaine suivante. Une case vide ouvre
// les repas possibles ; « Remplir » complète le reste, en commençant par ce qui se garde le moins. Un jour touché est sauté.
// En Gratuit, on peut essayer sans valider (rien n'est gardé).
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Icon, LockPill, RoundButton } from "../../ui/components";
import type { MealKey, Week } from "../../lib/home";
import { useBack } from "../nav";
import { useOpenPaywall } from "../plus/subscription";
import { showToast } from "../toast";
import { weekDays, weekRange } from "../format";
import { Dish } from "./Dish";
import { PickSheet } from "./sheets";
import {
  canFill, count, dayOf, doubled, fill, foundOf, MEALS, options, type PlanProps, recipePath, scannedText, setSlot, status, toggleOff,
} from "./week";
import "../scan/scan.css";
import "./plan.css";

export type PlanNewState = { pick?: [number, MealKey] };

export function PlanNew({ isPlus, week, setWeek, history, favorites }: PlanProps) {
  const navigate = useNavigate();
  const back = useBack();
  const openPaywall = useOpenPaywall();
  const start = (useLocation().state as PlanNewState | null)?.pick;
  // Gratuit : un brouillon, perdu en quittant l'écran
  const [draft, setDraft] = useState<Week>(week);
  const w = isPlus ? week : draft;
  const setW = (nw: Week) => (isPlus ? setWeek(nw) : setDraft(nw));
  const [pick, setPick] = useState<{ i: number; meal: MealKey } | null>(start ? { i: start[0], meal: start[1] } : null);
  const [menu, setMenu] = useState<string | null>(null);
  const days = weekDays();
  const opts = options(history, favorites);
  const favTitles = favorites.map(f => f.title);
  const { n } = count(w, days);
  const note = scannedText(history);

  // Un appui ailleurs ferme le petit menu d'une carte
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => { if (!(e.target as Element).closest?.(".pn-card")) setMenu(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  const doFill = () => {
    const r = fill(w, days, opts);
    setW(r.week);
    if (r.added) showToast(`${r.added} repas ajouté${r.added > 1 ? "s" : ""}${r.lefts ? `, dont ${r.lefts} midi${r.lefts > 1 ? "s" : ""} avec les restes de la veille` : ", ce qui se garde le moins d'abord"}`);
  };
  const validate = () => {
    if (!isPlus) { openPaywall("planning", "/planning"); return; }
    showToast("Ta semaine est prête");
    navigate("/planning", { replace: true });
  };

  return (
    <section className="fa scan-screen scr-plannew" aria-label="Crée ta semaine">
      <div className="pn-top">
        <button type="button" className="pn-seg" disabled={!history.length} onClick={() => navigate(`/recettes/${history[0].id}`)}><Icon name="salad" />Idées du scan</button>
        <button type="button" className="pn-seg on" aria-current="page"><Icon name="cal" />Ma semaine</button>
      </div>
      <div className="scroll">
        <div className="pn-body">
          <div className="pn-title">
            <div className="pn-back"><RoundButton icon="back" label="Retour" onClick={back} /><h2>Crée ta <em>semaine</em></h2></div>
            <span>{weekRange()}, midi et soir. Touche une case pour choisir ton repas, ou un jour pour le sauter.</span>
          </div>
          {!isPlus && (
            <button type="button" className="lockbar" onClick={() => openPaywall("planning", "/planning")}>
              <span><b>Fonction Plus.</b> Tu peux essayer, sans valider.</span><LockPill>Débloquer</LockPill>
            </button>
          )}
          <div className="pn-grid">
            {days.map((d, i) => {
              const day = dayOf(w, d.key);
              return [
                <button key={d.key} type="button" className={"pn-day" + (i === 0 ? " today" : "") + (day.off ? " off" : "")}
                  aria-label={`${day.off ? "Remettre" : "Sauter"} ${d.short} ${d.date.getDate()}`} onClick={() => setW(toggleOff(w, days, d.key))}>
                  <small>{d.short}</small><b>{d.date.getDate()}</b>
                </button>,
                <div key={d.key + "c"} className="pn-col">
                  {i === 0 && note && <div className="pn-note"><Icon name="cam" />{note}</div>}
                  {day.off
                    ? <button type="button" className="pn-empty skip" onClick={() => setW(toggleOff(w, days, d.key))}>Pas de repas ce jour-là</button>
                    : MEALS.map(meal => {
                      const sl = day[meal];
                      const id = d.key + meal;
                      return [
                        <span key={id + "l"} className="pn-ml"><Icon name={meal === "m" ? "utensils" : "pot"} />{meal === "m" ? "Midi" : "Soir"}</span>,
                        !sl
                          ? <button key={id} type="button" className="pn-empty" aria-label={`Choisir le repas du ${meal === "m" ? "midi" : "soir"}`} onClick={() => setPick({ i, meal })}><Icon name="plus" /></button>
                          : (() => {
                            const st = status(sl.recipe, foundOf(sl, history));
                            const dbl = meal === "s" && doubled(w, days, i);
                            const band = sl.left ? { t: `Restes de ${days[i - 1]?.long.toLowerCase() ?? "la veille"} soir · zéro gâchis`, c: " left" }
                              : dbl ? { t: "Double la dose · restes pour demain midi", c: " dbl" } : { t: st.text, c: st.warn ? " warn" : "" };
                            return (
                              <div key={id} className={"pn-card" + (meal === "m" ? " mid" : "") + (menu === id ? " menu" : "")}>
                                <button type="button" className="rw" onClick={() => navigate(recipePath(sl, history), { state: { recipe: sl.recipe, from: "plan" } })}>
                                  <Dish recipe={sl.recipe} /><span className="tx"><b>{sl.recipe.title}</b><span>{sl.left ? "Rien à cuisiner" : sl.recipe.time}</span></span>
                                </button>
                                <button type="button" className="pn-more" aria-label="Options" aria-expanded={menu === id} onClick={() => setMenu(m => (m === id ? null : id))}>···</button>
                                <div className={"pn-band" + band.c}>{band.t}</div>
                                {menu === id && (
                                  <div className="pn-menu">
                                    <button type="button" onClick={() => { setMenu(null); setPick({ i, meal }); }}><Icon name="redo" />Choisir une autre recette</button>
                                    <button type="button" onClick={() => { setMenu(null); setW(setSlot(w, days, d.key, meal, undefined)); }}><Icon name="x" />Retirer ce repas</button>
                                  </div>
                                )}
                              </div>
                            );
                          })(),
                      ];
                    })}
                </div>,
              ];
            })}
          </div>
        </div>
      </div>
      <div className="pn-foot">
        <button type="button" className="pn-fill" disabled={!canFill(w, days, opts)} onClick={doFill}><Icon name="sparkle" />Remplir</button>
        <button type="button" className="pill sage pn-go" onClick={validate}>{n > 1 ? `Valider mes ${n} repas` : n ? "Valider ce repas" : "Valider"}</button>
      </div>
      <PickSheet at={pick} week={w} days={days} opts={opts} favTitles={favTitles}
        onPick={s => { if (pick) setW(setSlot(w, days, days[pick.i].key, pick.meal, s)); setPick(null); }}
        onClose={() => setPick(null)} />
    </section>
  );
}
