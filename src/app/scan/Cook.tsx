// Mode cuisine : une étape à la fois, en grand, avec ses ingrédients et son minuteur.
// « J'ai cuisiné ça » garde le repas (kilos et euros sauvés, base du bilan) et propose la carte story.
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { Icon, Pill, RoundButton } from "../../ui/components";
import { type CookedMeal, thisMonth, totalSaved } from "../../lib/cooked";
import type { GeneratedRecipe, HistoryEntry } from "../../lib/types";
import { useBack } from "../nav";
import { useRecipePhoto } from "../photo";
import { useOpenPaywall } from "../plus/subscription";
import { showToast } from "../toast";
import { recipeLines, words } from "./portions";
import type { RecipeState } from "./Recipe";
import { type Counted, countCooked, euros, kilos } from "./savings";
import { shareStory, storyImage } from "./story";
import { cmFmt, useCommunity } from "../report/community";
import { notifAsked, pushState } from "../../lib/notify";
import type { NotifAskState } from "../notifs/NotifAsk";
import "../report/report.css";
import "./scan.css";

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

/** Minuteur d'une étape : compte à rebours, juste même quand le téléphone met l'appli en veille. Change d'étape : il repart arrêté. */
function useTimer(seconds: number, step: number) {
  type T = { step: number; seconds: number; left: number; end: number | null };
  const [s, setS] = useState<T>({ step, seconds, left: seconds, end: null });
  const cur: T = s.step === step && s.seconds === seconds ? s : { step, seconds, left: seconds, end: null };
  useEffect(() => {
    if (cur.end == null) return;
    const t = setInterval(() => setS(p => {
      if (p.end == null || p.step !== step) return p;
      const left = Math.max(0, Math.round((p.end - Date.now()) / 1000));
      if (!left) navigator.vibrate?.([200, 100, 200]);
      return { ...p, left, end: left ? p.end : null };
    }), 250);
    return () => clearInterval(t);
  }, [cur.end, step]);
  const toggle = () => {
    if (cur.end != null) setS({ ...cur, end: null });
    else if (cur.left > 0) setS({ ...cur, end: Date.now() + cur.left * 1000 });
  };
  return { left: cur.left, running: cur.end != null, toggle, stop: () => setS(p => ({ ...p, end: null })) };
}

/** L'écran reste allumé pendant la cuisine (là où le téléphone le permet). */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const take = () => {
      if (document.visibilityState !== "visible" || !navigator.wakeLock) return;
      navigator.wakeLock.request("screen").then(l => { if (gone) void l.release(); else lock = l; }).catch(() => undefined);
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => { gone = true; document.removeEventListener("visibilitychange", take); void lock?.release(); };
  }, []);
}

export function Cook({ history, isPlus, meals, onCooked, onUsed }: {
  history: HistoryEntry[]; isPlus: boolean; meals: CookedMeal[];
  onCooked: (m: Omit<CookedMeal, "id" | "date">) => void;
  /** Mon frigo : ce que la recette a pris en sort */
  onUsed: (r: GeneratedRecipe) => void;
}) {
  const back = useBack();
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const { id, n } = useParams();
  const state = useLocation().state as RecipeState | null;
  const entry = id ? history.find(e => e.id === id) : undefined;
  const recipe = entry ? entry.recipes[Number(n)] : state?.recipe;
  const servings = state?.servings ?? entry?.servings ?? (isPlus ? 1 : 2);
  const steps = recipe?.steps ?? [];
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [story, setStory] = useState(false);
  const [counted, setCounted] = useState<Counted | null>(null);
  const photo = useRecipePhoto(recipe?.title, recipe?.imageSearch);
  const t = recipe?.timers?.[step] ?? null;
  const timer = useTimer((t?.min ?? 0) * 60, step);
  const card = useRef<Promise<Blob | null> | null>(null);
  // Après le premier repas : « On te fait signe au bon moment ? » (une fois, si le téléphone ne sonne pas déjà)
  const askNotif = useRef(false);
  useEffect(() => { if (!notifAsked()) void pushState().then(p => { askNotif.current = p !== "on" && p !== "denied"; }); }, []);
  const goHome = () => (askNotif.current
    ? navigate("/notifications/activer", { replace: true, state: { back: "/" } satisfies NotifAskState })
    : navigate("/", { replace: true }));
  const community = useCommunity();
  useWakeLock();
  if (!recipe || !steps.length) return <Navigate to="/" replace />;

  // Les ingrédients nommés dans l'étape, avec leur quantité pour ces portions
  const lines = recipeLines(recipe, servings, entry?.ingredients);
  const names = recipe.items?.length ? recipe.items.map(i => i.name) : (recipe.recipeIngredients ?? []).map(i => i.name);
  const stepWords = words(steps[step]);
  const chips = lines.filter((_, i) => words(names[i] ?? "").some(w => stepWords.includes(w)));
  const last = step === steps.length - 1;
  const meal = new Date().getHours() < 16 ? "Ce midi" : "Ce soir";
  const saved = counted && counted.saved.kg > 0 ? counted.saved : null;
  const used = counted && counted.used.kg > 0 ? counted.used : null;
  const badge = saved ? `${euros(saved.eur)} sauvés ${meal.toLowerCase()}` : "Cuisiné avec mon frigo";

  const go = (i: number) => { timer.stop(); setStep(i); };
  const finish = () => {
    timer.stop();
    if (!counted) {
      const c = countCooked(recipe, servings, entry?.ingredients);
      setCounted(c);
      onCooked({
        scanId: entry?.id ?? null, title: recipe.title, image: photo, servings: Math.max(1, Math.round(servings)),
        kg: c.saved.kg, eur: c.saved.eur, usedKg: c.used.kg, usedEur: c.used.eur, items: c.items,
      });
      onUsed(recipe);
    }
    setDone(true);
  };
  const month = totalSaved(thisMonth(meals));
  const openStory = () => {
    card.current = storyImage(photo, badge, recipe.title);
    setStory(true);
  };
  // Instagram, WhatsApp : le menu de partage du téléphone. Sans lui (ordinateur), la carte est téléchargée.
  const share = async (to: string, save: boolean) => {
    const blob = await (card.current ?? storyImage(photo, badge, recipe.title));
    if (!blob) { showToast("La carte n'a pas pu être créée"); return; }
    const r = await shareStory(blob, recipe.title, save);
    if (r === "cancelled") return;
    setStory(false);
    showToast(r === "shared" ? `Carte prête pour ${to}` : save ? "Carte enregistrée" : `Carte enregistrée : ajoute-la sur ${to}`);
  };

  return (
    <section className="fa scan-screen scr-cook" aria-label="Mode cuisine">
      <div className="ck-top">
        <RoundButton icon="x" tone="glass" label="Quitter le mode cuisine" onClick={back} />
        <div className="prog">{steps.map((_, i) => <i key={i} className={i <= step ? "f" : undefined} />)}</div>
      </div>
      <div className="ck-body">
        <div className="ck-img">
          {photo ? <img className="plate" src={photo} alt="" /> : <span className="plate" style={{ background: "var(--sage-deep)" }} />}
          <span><span className="label" style={{ color: "rgba(247,241,230,.72)" }}>Mode cuisine</span><br /><b style={{ fontWeight: 600 }}>{recipe.title}</b></span>
        </div>
        <div className="ck-num" aria-live="polite"><b>{step + 1}</b><span>sur {steps.length}</span></div>
        <p className="ck-text">{steps[step]}</p>
        {chips.length > 0 && <div className="ck-chips">{chips.map((c, i) => <span key={i}>{c.q ? `${c.q} ${c.n}` : c.n}</span>)}</div>}
        {t && (
          <div className={"tcard" + (timer.running ? " run" : "")}>
            <div><div className="lbl">{t.label}</div><div className="t" role="timer">{mmss(timer.left)}</div></div>
            <Pill tone="cream" onClick={timer.toggle}>{timer.running ? "Pause" : "Démarrer"}</Pill>
          </div>
        )}
      </div>
      <div className="ck-foot">
        <button type="button" className="ghost" disabled={step === 0} onClick={() => go(step - 1)}>Précédent</button>
        <Pill tone="cream" onClick={() => (last ? finish() : go(step + 1))}>{last ? "J'ai cuisiné ça" : "Étape suivante"}</Pill>
      </div>

      <div className={"done-view" + (done ? " on" : "")} aria-hidden={!done}>
        {photo ? <img className="plate" src={photo} alt="" /> : <span className="plate" style={{ background: "var(--sage-deep)" }} />}
        <h2>Bon appétit !</h2>
        {counted && (
          <div className="savedbox">
            {/* Sauvé : ce qui était « À finir ». Sinon, ce qui a été cuisiné de ton frigo (pas forcément sauvé). */}
            {saved ? <>
              <span className="label">{meal}, tu as sauvé</span>
              <div className="sv"><div><b>{euros(saved.eur)}</b><span>de courses</span></div><div><b>{kilos(saved.kg)}</b><span>de nourriture</span></div></div>
              {used && used.kg > saved.kg && <p className="used">Et {kilos(used.kg)} de ton frigo cuisinés en tout.</p>}
            </> : used ? <>
              <span className="label">{meal}, tu as cuisiné de ton frigo</span>
              <div className="sv"><div><b>{euros(used.eur)}</b><span>de courses utilisées</span></div><div><b>{kilos(used.kg)}</b><span>de produits frais</span></div></div>
              <p className="used">Marque « À finir » au scan ce qui doit partir vite : on le comptera comme sauvé.</p>
            </> : null}
            {isPlus && (
              <div className="foot"><span>{MONTHS[new Date().getMonth()]} : {month.eur > 0 ? `${euros(month.eur)} sauvés` : `${kilos(month.usedKg)} de ton frigo cuisinés`}</span>
                <button type="button" className="link" onClick={() => navigate("/bilan")}>Ton bilan</button></div>
            )}
            {community && (
              <div className="foot cm-foot"><span><Icon name="users" />Avec toi, la communauté a sauvé <b>{cmFmt(community.kg)} kg</b></span></div>
            )}
            {!isPlus && (
              <div className="foot"><span>Ton bilan du mois est dans Plus</span>
                <button type="button" className="lockpill" onClick={() => openPaywall("bilan")}><Icon name="lock" />Voir</button></div>
            )}
          </div>
        )}
        <div className="done-actions">
          <Pill tone="cream" icon="share" onClick={openStory}>Partager en story</Pill>
          <button type="button" className="ghost" onClick={goHome}>Retour à l'accueil</button>
        </div>
      </div>

      <div className={"story" + (story ? " on" : "")} aria-hidden={!story} role="dialog" aria-label="Carte story">
        <RoundButton icon="x" tone="glass" className="x" label="Fermer" onClick={() => setStory(false)} />
        <div className="scard">
          {photo && <img src={photo} alt="" />}
          <span className="w">Frigia</span>
          <div className="bt"><span className="sv2">{badge}</span><b>{recipe.title}</b><span>Faite avec ce qu'il y avait dans le frigo · frigia.fr</span></div>
        </div>
        <div className="acts">
          <button type="button" onClick={() => share("Instagram", false)}>Instagram</button>
          <button type="button" onClick={() => share("WhatsApp", false)}>WhatsApp</button>
          <button type="button" onClick={() => share("ta galerie", true)}>Enregistrer</button>
        </div>
      </div>
    </section>
  );
}
