// Trois recettes : la première en grand, les autres à côté. « D'autres idées » relance l'IA sur le même scan,
// sans le décompter (Frigia Plus). « Ajouter à ma semaine » arrive avec le planning (étape 10).
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Badge, Chip, Icon, LockPill, RoundButton } from "../../ui/components";
import { makeRecipes } from "../../lib/scan";
import type { DetectedIngredient, GeneratedRecipe, HistoryEntry } from "../../lib/types";
import { AppTabBar } from "../AppTabBar";
import { daysAgo } from "../format";
import { useBack } from "../nav";
import { useOpenScan } from "../offline";
import { useRecipePhoto } from "../photo";
import { useOpenPaywall } from "../plus/subscription";
import { comingSoon, showToast } from "../toast";
import { getScan, MEAL_WORDS } from "./store";
import { haveCount, minutesOf, srvLabel } from "./portions";
import "./scan.css";

type Filter = "all" | "quick" | "veg" | "oven" | "cold";

const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
/** « Scan de 18 h 42 · pour ce soir », « Scan du 9 octobre » */
function scanTitle(e: HistoryEntry): string {
  const d = e.date;
  const when = daysAgo(d) === 0 ? `Scan de ${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}` : `Scan du ${DAY.format(d)}`;
  return e.meal ? `${when} · ${MEAL_WORDS[e.meal].pour}` : when;
}

/** « Manque le fromage », ou « Manque 2 ingrédients » quand la liste est longue. */
function missingText(r: GeneratedRecipe, missing: number): string {
  return r.missing && r.missing.length <= 24 ? `Manque ${r.missing}` : `Manque ${missing} ingrédient${missing > 1 ? "s" : ""}`;
}

/** Ajouter à ma semaine : le planning arrive à l'étape 10 ; en Gratuit, c'est dans Plus. */
function useAddToWeek(isPlus: boolean) {
  const openPaywall = useOpenPaywall();
  return () => (isPlus ? comingSoon(10) : openPaywall("planning", "/planning"));
}

function Feat({ recipe, found, label, onClick }: { recipe: GeneratedRecipe; found: DetectedIngredient[]; label: string; onClick: () => void }) {
  const photo = useRecipePhoto(recipe.title, recipe.imageSearch);
  const { have, total } = haveCount(recipe, found);
  return (
    <button type="button" className="feat" onClick={onClick}>
      {photo ? <img className="ph" src={photo} alt={recipe.title} /> : <span className="ph" style={{ display: "block", height: 230, borderRadius: 24, background: "var(--surface)" }} />}
      <span className="band">
        <span className="label">{label}</span>
        <b>{recipe.title}</b>
        <span className="meta"><span><Icon name="clock" />{recipe.time}</span><span><Icon name="flame" />{recipe.cal} kcal</span><span>{recipe.diff}</span></span>
        {total > 0 && <>
          <span className="segs">{Array.from({ length: total }, (_, i) => <i key={i} className={i < have ? "f" : undefined} />)}</span>
          <span className="mrow"><span>{have} ingrédient{have > 1 ? "s" : ""} sur {total} dans ton frigo</span>{have < total && <span>· manque {total - have}</span>}</span>
        </>}
      </span>
    </button>
  );
}

function Idea({ recipe, found, onClick, onWeek }: { recipe: GeneratedRecipe; found: DetectedIngredient[]; onClick: () => void; onWeek: () => void }) {
  const photo = useRecipePhoto(recipe.title, recipe.imageSearch);
  const { have, total } = haveCount(recipe, found);
  return (
    <button type="button" className="gc" onClick={onClick}>
      <span className="gc-wk" role="button" tabIndex={0} aria-label="Ajouter à ma semaine"
        onClick={e => { e.stopPropagation(); onWeek(); }}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onWeek(); } }}>
        <Icon name="cal" />
      </span>
      <span className="tg">{recipe.time}</span>
      <span className="rw">
        {photo ? <img className="plate" src={photo} alt="" /> : <span className="plate" style={{ width: 58, background: "var(--surface)" }} />}
        <span><b>{recipe.title}</b><span className="m">{recipe.cal} kcal</span></span>
      </span>
      {total > 0 && (have === total ? <Badge icon="check">Tu as tout</Badge> : <Badge tone="warn">{missingText(recipe, total - have)}</Badge>)}
    </button>
  );
}

export function Results({ history, isPlus, onNewIdeas }: {
  history: HistoryEntry[]; isPlus: boolean;
  /** « D'autres idées » : les recettes du scan changent */
  onNewIdeas: (entryId: string, recipes: GeneratedRecipe[]) => void;
}) {
  const navigate = useNavigate();
  const back = useBack();
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  const addToWeek = useAddToWeek(isPlus);
  const { id } = useParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const entry = history.find(e => e.id === id);
  if (!entry) return <Navigate to="/" replace />;

  const meal = entry.meal ?? "s";
  const filters: [Filter, string][] = [["all", "Toutes"], ["quick", "Moins de 20 min"], ["veg", "Végé"], meal === "m" ? ["cold", "Se mange froid"] : ["oven", "Sans four"]];
  const keep = (r: GeneratedRecipe) =>
    filter === "quick" ? minutesOf(r) < 20 : filter === "veg" ? !!r.veg : filter === "oven" ? r.oven === false : filter === "cold" ? !!r.cold : true;
  const shown = entry.recipes.map((r, i) => ({ r, i })).filter(x => keep(x.r));
  const [feat, ...others] = shown;
  const open = (i: number) => navigate(`/recettes/${entry.id}/${i}`);
  const n = entry.ingredients.length;

  const more = async () => {
    if (!isPlus) { openPaywall("idees"); return; }
    if (busy) return;
    setBusy(true);
    const s = getScan();
    const r = await makeRecipes({
      ingredients: entry.ingredients.map(i => ({ name: i.name, qty: i.qty ?? "" })),
      pantry: s.pantry, envie: s.envie, meal, servings: entry.servings, token: null,
      avoid: entry.recipes.map(x => x.title), more: true,
    });
    setBusy(false);
    if (r.status === "ok" && r.recipes.length) {
      onNewIdeas(entry.id, [entry.recipes[0], ...r.recipes].slice(0, 3));
      showToast(`${r.recipes.length} nouvelle${r.recipes.length > 1 ? "s" : ""} idée${r.recipes.length > 1 ? "s" : ""}. Ton scan n'est pas décompté.`);
    } else if (r.status !== "signed-out") showToast("Frigia ne répond pas. Réessaie dans un instant.");
  };

  return (
    <section className="fa scan-screen scr-results" aria-label="Trois recettes">
      <div className="rhead">
        <div className="row">
          <RoundButton icon="back" label="Retour" tone="glass" onClick={back} />
          <span className="mid">{scanTitle(entry)}</span>
          <RoundButton icon="cam" label="Rescanner" tone="glass" onClick={openScan} />
        </div>
        <div>
          <span className="label">{n} ingrédient{n > 1 ? "s" : ""} · {srvLabel(isPlus, entry.servings)}</span>
          <h2>{meal === "w" ? <>Des idées pour <em>ta semaine</em></> : <>Trois idées pour <em>{meal === "m" ? "ce midi" : "ce soir"}</em></>}</h2>
        </div>
        <div className="chips">
          {filters.map(([f, label]) => <Chip key={f} ongreen on={filter === f} onClick={() => setFilter(f)}>{label}</Chip>)}
        </div>
      </div>
      <div className="scroll">
        <div className="rbody">
          {meal === "w" && (
            <div className="res-week">
              <span className="ic"><Icon name="cal" /></span>
              <span><b>Choisis tes repas de la semaine</b>Touche le calendrier d'une idée pour la placer, ou laisse Frigia remplir les jours vides.</span>
              <button type="button" className="pill sage" onClick={addToWeek}>Créer ma semaine</button>
            </div>
          )}
          {feat ? <>
            <Feat recipe={feat.r} found={entry.ingredients} label={MEAL_WORDS[meal].feat} onClick={() => open(feat.i)} />
            <button type="button" className="wk-add" onClick={addToWeek}><Icon name="cal" /><span>Ajouter à ma semaine</span>{!isPlus && <LockPill />}</button>
          </> : <p className="muted" style={{ margin: 0, fontSize: 14 }}>Aucune idée de ce scan ne correspond.</p>}
          {others.length > 0 && <>
            <div className="sec"><h3>{meal === "w" ? "Pour la suite de la semaine" : "Autres idées"}</h3><span className="muted" style={{ fontSize: 13 }}>avec ton frigo</span></div>
            <div className="grid2">{others.map(x => <Idea key={x.i} recipe={x.r} found={entry.ingredients} onClick={() => open(x.i)} onWeek={addToWeek} />)}</div>
          </>}
          <button type="button" className="more" disabled={busy} onClick={more}>
            <Icon name="redo" /><span>D'autres idées <small>· sans utiliser de scan</small></span>{!isPlus && <LockPill />}
          </button>
        </div>
      </div>
      <AppTabBar isPlus={isPlus} />
    </section>
  );
}
