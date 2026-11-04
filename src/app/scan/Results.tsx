// Trois recettes : la première en grand, les autres à côté. « D'autres idées » relance l'IA sur le même scan,
// sans le décompter (Frigia Plus). « Ajouter à ma semaine » place une idée dans la semaine (Frigia Plus).
import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { Badge, Chip, Icon, LockPill, RoundButton } from "../../ui/components";
import { makeRecipes } from "../../lib/scan";
import type { DetectedIngredient, GeneratedRecipe, HistoryEntry } from "../../lib/types";
import { AppTabBar } from "../AppTabBar";
import { daysAgo, hm } from "../format";
import { isEn, locale, t } from "../../lib/i18n";
import { useBack } from "../nav";
import { useOpenScan } from "../offline";
import { useRecipePhoto } from "../photo";
import { useOpenPaywall } from "../plus/subscription";
import { showToast } from "../toast";
import { getScan, MEAL_WORDS, pantryFor } from "./store";
import { eatersOf, haveCount, minutesOf, srvLabel } from "./portions";
import { apiEaters, recipeBadges, type Person } from "../../lib/household";
import type { Fridge, Week } from "../../lib/home";
import { pantryOf } from "../../lib/fridge";
import { weekDays } from "../format";
import { WeekSheet } from "../plan/sheets";
import { findTitle, type Option, placedText } from "../plan/week";
import "./scan.css";
import { diffText, timeText } from "../../lib/recipes";

type Filter = "all" | "quick" | "veg" | "oven" | "cold";

const DAY = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
/** « Scan de 18 h 42 · pour ce soir », « Scan du 9 octobre » */
function scanTitle(e: HistoryEntry): string {
  const d = e.date;
  const when = daysAgo(d) === 0 ? t(`Scan de ${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`, `Scan at ${hm(d)}`) : t(`Scan du ${DAY.format(d)}`, `Scan on ${DAY.format(d)}`);
  return e.meal ? `${when} · ${MEAL_WORDS[e.meal].pour}` : when;
}

/** « Manque le fromage », ou « Manque 2 ingrédients » quand la liste est longue. */
function missingText(r: GeneratedRecipe, missing: number): string {
  return r.missing && r.missing.length <= 24 ? t(`Manque ${r.missing}`, `Missing ${r.missing}`) : t(`Manque ${missing} ingrédient${missing > 1 ? "s" : ""}`, `Missing ${missing} ingredient${missing > 1 ? "s" : ""}`);
}

function Feat({ recipe, found, label, isPlus, onClick }: { recipe: GeneratedRecipe; found: DetectedIngredient[]; label: string; isPlus: boolean; onClick: () => void }) {
  const photo = useRecipePhoto(recipe.title, recipe.imageSearch);
  const { have, total } = haveCount(recipe, found);
  return (
    <button type="button" className="feat" onClick={onClick}>
      {photo ? <img className="ph" src={photo} alt={recipe.title} /> : <span className="ph" style={{ display: "block", height: 230, borderRadius: 24, background: "var(--surface)" }} />}
      <span className="band">
        <span className="label">{label}</span>
        {recipeBadges(recipe, isPlus).length > 0 && <span className="bbadges">{recipeBadges(recipe, isPlus).map(b => <Badge key={b} tone="ongreen">{b}</Badge>)}</span>}
        <b>{recipe.title}</b>
        <span className="meta"><span><Icon name="clock" />{timeText(recipe.time)}</span><span><Icon name="flame" />{recipe.cal} kcal</span><span>{diffText(recipe.diff)}</span></span>
        {total > 0 && <>
          <span className="segs">{Array.from({ length: total }, (_, i) => <i key={i} className={i < have ? "f" : undefined} />)}</span>
          <span className="mrow"><span>{t(`${have} ingrédient${have > 1 ? "s" : ""} sur ${total} dans ton frigo`, `${have} of ${total} ingredient${total > 1 ? "s" : ""} in your fridge`)}</span>{have < total && <span>· {t("manque", "missing")} {total - have}</span>}</span>
        </>}
      </span>
    </button>
  );
}

function Idea({ recipe, found, planned, onClick, onWeek }: {
  recipe: GeneratedRecipe; found: DetectedIngredient[]; planned: boolean; onClick: () => void; onWeek: () => void;
}) {
  const photo = useRecipePhoto(recipe.title, recipe.imageSearch);
  const { have, total } = haveCount(recipe, found);
  return (
    <button type="button" className="gc" onClick={onClick}>
      <span className={"gc-wk" + (planned ? " done" : "")} role="button" tabIndex={0} aria-label={planned ? t("Prévu dans ta semaine", "Planned in your week") : t("Ajouter à ma semaine", "Add to my week")}
        onClick={e => { e.stopPropagation(); onWeek(); }}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onWeek(); } }}>
        <Icon name="cal" />
      </span>
      <span className="tg">{timeText(recipe.time)}</span>
      <span className="rw">
        {photo ? <img className="plate" src={photo} alt="" /> : <span className="plate" style={{ width: 58, background: "var(--surface)" }} />}
        <span><b>{recipe.title}</b><span className="m">{recipe.dessert ? "Dessert · " : ""}{recipe.cal} kcal{recipe.origin ? ` · ${recipe.origin}` : ""}</span></span>
      </span>
      {total > 0 && (have === total ? <Badge icon="check">{t("Tu as tout", "You have everything")}</Badge> : <Badge tone="warn">{missingText(recipe, total - have)}</Badge>)}
    </button>
  );
}

export function Results({ history, isPlus, household, kitchen, week, onWeek, onNewIdeas }: {
  history: HistoryEntry[]; isPlus: boolean; household: Person[];
  /** Ma cuisine : ce qu'il y a vraiment dans les placards */
  kitchen: Fridge;
  week: Week; onWeek: (w: Week) => void;
  /** « D'autres idées » : les recettes du scan changent */
  onNewIdeas: (entryId: string, recipes: GeneratedRecipe[]) => void;
}) {
  const navigate = useNavigate();
  const back = useBack();
  // Tout juste créées : la flèche ramène à l'accueil, sans repasser par le menu
  const fresh = !!(useLocation().state as { fresh?: boolean } | null)?.fresh;
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  const [wk, setWk] = useState<Option | null>(null);
  const { id } = useParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const entry = history.find(e => e.id === id);
  if (!entry) return <Navigate to="/" replace />;

  const meal = entry.meal ?? "s";
  const filters: [Filter, string][] = [["all", t("Toutes", "All")], ["quick", t("Moins de 20 min", "Under 20 min")], ["veg", t("Végé", "Veggie")],
    meal === "m" || meal === "d" ? ["cold", t("Se mange froid", "Eaten cold")] : ["oven", t("Sans four", "No oven")]];
  const keep = (r: GeneratedRecipe) =>
    filter === "quick" ? minutesOf(r) < 20 : filter === "veg" ? !!r.veg : filter === "oven" ? r.oven === false : filter === "cold" ? !!r.cold : true;
  const shown = entry.recipes.map((r, i) => ({ r, i })).filter(x => keep(x.r));
  const [feat, ...others] = shown;
  const open = (i: number) => navigate(`/recettes/${entry.id}/${i}`);
  const n = entry.ingredients.length;
  // « Manque riz » sous « avec ton frigo » : le sous-titre dit qu'il y a un peu de courses (Hugo, 30 octobre)
  const toBuy = (r: GeneratedRecipe) => { const c = haveCount(r, entry.ingredients); return c.have < c.total; };
  // Le menu : que des desserts, des plats et un dessert, ou que des plats
  const sweets = entry.recipes.filter(r => r.dessert).length + (meal === "d" ? entry.recipes.filter(r => !r.dessert).length : 0);
  const howMany = t(["Une", "Deux", "Trois", "Quatre", "Cinq"], ["One", "Two", "Three", "Four", "Five"])[entry.recipes.length - 1] ?? String(entry.recipes.length);
  const days = weekDays();
  // Ajouter à ma semaine (Plus) : la feuille « Quel repas ? » ; en Gratuit, c'est dans Plus
  const addToWeek = (i: number) => (isPlus
    ? setWk({ recipe: entry.recipes[i], scanId: entry.id, n: i, found: entry.ingredients, fav: false })
    : openPaywall("planning", "/planning"));
  const placed = (i: number) => (isPlus ? placedText(week, days, entry.recipes[i].title) : null);

  const more = async () => {
    if (!isPlus) { openPaywall("idees"); return; }
    if (busy) return;
    setBusy(true);
    const s = getScan();
    const r = await makeRecipes({
      ingredients: entry.ingredients.map(i => ({ name: i.name, qty: i.qty ?? "", finish: i.finish })),
      pantry: pantryFor(kitchen, { ...s, empty: n === 0 }, entry.ingredients), envies: s.envies, noShop: s.noShop && n > 0, meal, servings: entry.servings, token: null, empty: n === 0,
      avoid: entry.recipes.map(x => x.title), more: true, eaters: apiEaters(eatersOf(household, s)),
    });
    setBusy(false);
    if (r.status === "ok" && r.recipes.length) {
      onNewIdeas(entry.id, [entry.recipes[0], ...r.recipes].slice(0, 3));
      showToast(t(`${r.recipes.length} nouvelle${r.recipes.length > 1 ? "s" : ""} idée${r.recipes.length > 1 ? "s" : ""}. Ton scan n'est pas décompté.`,
        `${r.recipes.length} new idea${r.recipes.length > 1 ? "s" : ""}. Your scan doesn't count.`));
    } else if (r.status !== "signed-out") showToast(r.status === "error" && r.message ? r.message : t("Frigia ne répond pas. Réessaie dans un instant.", "Frigia isn't responding. Try again in a moment."));
  };

  return (
    <section className="fa scan-screen scr-results" aria-label={t("Trois recettes", "Three recipes")}>
      <div className="rhead">
        <div className="row">
          <RoundButton icon="back" label={t("Retour", "Back")} tone="glass" onClick={() => (fresh ? navigate("/", { replace: true }) : back())} />
          <span className="mid">{scanTitle(entry)}</span>
          <RoundButton icon="cam" label={t("Rescanner", "Scan again")} tone="glass" onClick={openScan} />
        </div>
        <div>
          <span className="label">{n ? `${n} ${t("ingrédient", "ingredient")}${n > 1 ? "s" : ""}` : t("Frigo vide", "Empty fridge")} · {srvLabel(isPlus, entry.servings)}</span>
          <h2>{isEn
            ? (meal === "w" ? <>Ideas for <em>your week</em></> : sweets === entry.recipes.length ? <>{howMany} <em>dessert</em> ideas</>
              : sweets ? <>Your menu for <em>{meal === "m" ? "lunch" : "tonight"}</em></> : <>{howMany} ideas for <em>{meal === "m" ? "lunch" : "tonight"}</em></>)
            : (meal === "w" ? <>Des idées pour <em>ta semaine</em></> : sweets === entry.recipes.length ? <>{howMany} idées de <em>dessert</em></>
              : sweets ? <>Ton menu pour <em>{meal === "m" ? "ce midi" : "ce soir"}</em></> : <>{howMany} idées pour <em>{meal === "m" ? "ce midi" : "ce soir"}</em></>)}</h2>
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
              <span><b>{t("Choisis tes repas de la semaine", "Pick your meals for the week")}</b>{t("Touche le calendrier d'une idée pour la placer, ou laisse Frigia remplir les jours vides.", "Tap an idea's calendar to place it, or let Frigia fill the empty days.")}</span>
              <button type="button" className="pill sage" onClick={() => (isPlus ? navigate("/planning/creer") : openPaywall("planning", "/planning"))}>{t("Créer ma semaine", "Plan my week")}</button>
            </div>
          )}
          {feat ? <>
            <Feat recipe={feat.r} found={entry.ingredients} label={MEAL_WORDS[feat.r.dessert ? "d" : meal].feat} isPlus={isPlus} onClick={() => open(feat.i)} />
            <button type="button" className={"wk-add" + (placed(feat.i) ? " done" : "")} onClick={() => addToWeek(feat.i)}>
              <Icon name={placed(feat.i) ? "check" : "cal"} /><span>{placed(feat.i) ?? t("Ajouter à ma semaine", "Add to my week")}</span>{!isPlus && <LockPill />}
            </button>
          </> : <p className="muted" style={{ margin: 0, fontSize: 14 }}>{t("Aucune idée de ce scan ne correspond.", "No idea from this scan matches.")}</p>}
          {others.length > 0 && <>
            <div className="sec"><h3>{meal === "w" ? t("Pour la suite de la semaine", "For the rest of the week") : t("Autres idées", "Other ideas")}</h3><span className="muted" style={{ fontSize: 13 }}>{n ? (others.some(x => toBuy(x.r)) ? t("avec ton frigo et un peu de courses", "with your fridge and a little shopping") : t("avec ton frigo", "with your fridge")) : pantryOf(kitchen).length ? t("avec tes placards", "with your cupboards") : t("avec quelques courses", "with some shopping")}</span></div>
            <div className="grid2">{others.map(x => <Idea key={x.i} recipe={x.r} found={entry.ingredients} planned={isPlus && !!findTitle(week, days, x.r.title)}
              onClick={() => open(x.i)} onWeek={() => addToWeek(x.i)} />)}</div>
          </>}
          <button type="button" className="more" disabled={busy} onClick={more}>
            <Icon name="redo" /><span>{t(<>D'autres idées <small>· sans utiliser de scan</small></>, <>More ideas <small>· without using a scan</small></>)}</span>{!isPlus && <LockPill />}
          </button>
        </div>
      </div>
      <AppTabBar isPlus={isPlus} />
      <WeekSheet option={wk} week={week} days={days} setWeek={onWeek} onClose={() => setWk(null)} />
    </section>
  );
}
