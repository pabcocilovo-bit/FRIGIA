// Fiche recette : la photo, les chiffres, les ingrédients (quantités recalculées pour les portions) et les étapes.
// Les manquants partent dans la liste de courses (étape 10). « Lancer la cuisson » ouvre le mode cuisine pour ces portions.
// Ce que tu as est comparé à Ma cuisine (ou à la photo du scan) : avec des invités, « il en manque 200 g » part aussi dans la liste.
import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { Badge, Icon, LockPill, Pill, RoundButton, Sheet } from "../../ui/components";
import type { GeneratedRecipe, HistoryEntry } from "../../lib/types";
import { useBack } from "../nav";
import { useRecipePhoto } from "../photo";
import { useOpenPaywall } from "../plus/subscription";
import { showToast } from "../toast";
import { Stepper } from "./Ingredients";
import { eatersOf, haveCount, piecesText, recipeLines, srvLabel, toggleAway } from "./portions";
import { guestTxt, names, recipeBadges, type Person, portionsOf, whoParts } from "../../lib/household";
import { allergyHits, allergyName } from "../../lib/allergens";
import type { Fridge, ShopItem, Week } from "../../lib/home";
import { weekDays } from "../format";
import { WeekSheet } from "../plan/sheets";
import { type Option, placedText } from "../plan/week";
import { inListAs, joinNames } from "../../lib/shopping";
import { checkQty, type Stock } from "../../lib/stock";
import { qtyOf } from "../../lib/fridge";
import { MAX_GUESTS, setScan, useScan } from "./store";
import { WhoGrid } from "./WhoGrid";
import "./scan.css";
import { diffText, minText, timeText } from "../../lib/recipes";
import { isEn, t } from "../../lib/i18n";

/** « Ajouter les 2 manquants à ma liste », « Ajouter le manque à ma liste », « Ajouter les 2 manquants et le manque à ma liste » */
function addText(missing: number, short: number): string {
  if (isEn) {
    const parts = [missing > 1 ? `the ${missing} missing items` : missing ? "the missing item" : "", short ? "what's short" : ""].filter(Boolean);
    return `Add ${parts.join(" and ")} to my list`;
  }
  const m = missing > 1 ? `les ${missing} manquants` : missing ? "le manquant" : "";
  const s = short ? "le manque" : "";
  return `Ajouter ${[m, s].filter(Boolean).join(" et ")} à ma liste`;
}

/** from « plan » : ouverte depuis le planning (un favori gardé ici dit « Depuis ton planning ») */
export type RecipeState = { recipe?: GeneratedRecipe; servings?: number; from?: "plan" };

export function Recipe({ history, isPlus, household, shopping, fridge, onAddMissing, week, onWeek, avatar, isFavorite, onToggleFavorite }: {
  history: HistoryEntry[]; isPlus: boolean; household: Person[]; avatar: string | null;
  week: Week; onWeek: (w: Week) => void;
  shopping: ShopItem[]; fridge: Fridge;
  /** Les manquants partent dans la liste de courses ; renvoie les articles arrivés */
  onAddMissing: (items: { name: string; qty: string }[], from: string) => string[];
  isFavorite: (r: GeneratedRecipe) => boolean; onToggleFavorite: (r: GeneratedRecipe) => void;
}) {
  const back = useBack();
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const { id, n } = useParams();
  const state = useLocation().state as RecipeState | null;
  const entry = id ? history.find(e => e.id === id) : undefined;
  const index = Number(n);
  const recipe = entry ? entry.recipes[index] : state?.recipe;
  const scan = useScan();
  // Plus : ceux du foyer qui mangent (« Qui mange ce soir ? », ou choisis ici d'un appui sur les avatars), et les invités en plus
  const [away, setAway] = useState(scan.away);
  const [whoOpen, setWhoOpen] = useState(false);
  const eaters = eatersOf(household, { away });
  const family = portionsOf(eaters, 0);
  const base = entry?.servings ?? state?.servings ?? (isPlus ? family : 2);
  const [servings, setServings] = useState(base);
  const [tab, setTab] = useState<"ing" | "stp">("ing");
  const [done, setDone] = useState<number[]>([]);
  const [arrived, setArrived] = useState<string[]>([]);
  const [wk, setWk] = useState<Option | null>(null);
  const photo = useRecipePhoto(recipe?.title, recipe?.imageSearch);
  if (!recipe) return <Navigate to="/" replace />;

  // Ce que tu as : Ma cuisine d'abord, puis la photo du scan de la recette
  const stocks: Stock[] = [...fridge.items, ...(entry?.ingredients ?? [])].map(i => ({ name: i.name, qty: qtyOf(i.qty) }));
  const linesFor = (srv: number) => recipeLines(recipe, srv, entry?.ingredients)
    .map(l => ({ ...l, check: l.have && l.q ? checkQty(l.q, l.n, stocks) : null }));
  const lines = linesFor(servings);
  const pieces = piecesText(recipe, servings);
  const { have, total } = haveCount(recipe, entry?.ingredients);
  const missing = total - have;
  const steps = recipe.steps ?? [];
  const fav = isFavorite(recipe);
  const cook = () => navigate(entry ? `/recettes/${entry.id}/${index}/cuisine` : "/recette/cuisine", { state: { recipe, servings } satisfies RecipeState });
  // Ajouter à ma semaine (Plus) : la feuille « Quel repas ? »
  const days = weekDays();
  const placed = isPlus ? placedText(week, days, recipe.title) : null;
  const addToWeek = () => (isPlus
    ? setWk({ recipe, scanId: entry?.id ?? null, n: entry ? index : null, found: entry?.ingredients ?? [], fav: !entry })
    : openPaywall("planning", "/planning"));
  // Les manquants (pour ces portions) dans la liste, et ce qu'il manque de ce que tu as. Déjà dedans : « Dans ta liste · voir »
  const short = lines.filter(l => l.check?.short).length;
  const buy = lines.filter(l => !l.have || l.check?.short).map(l => ({ name: l.n, qty: l.check?.short ?? l.q }));
  const listed = buy.length > 0 && buy.every(b => inListAs(shopping, b, recipe.title));
  const addMissing = () => {
    if (listed) { navigate("/courses", { state: { flash: arrived } }); return; }
    const ids = onAddMissing(buy, recipe.title);
    setArrived(ids);
    showToast(`${joinNames(buy.map(b => b.name.charAt(0).toUpperCase() + b.name.slice(1)))} ${t(buy.length > 1 ? "ajoutés" : "ajouté", "added")} ${t("à ta liste", "to your list")}`);
  };
  // Une allergie de ceux qui mangent dans la recette (catalogue, favori, allergie ajoutée après) : l'alerte et « Allergie » sur la ligne
  const hits = allergyHits(recipe, isPlus ? eaters : household);
  const allergic = new Set(hits.flatMap(h => h.items));
  const lineName = (i: number) => (recipe.items?.length ? recipe.items[i]?.name : recipe.recipeIngredients?.[i]?.name) ?? "";
  const alert = hits.length > 0 && (
    <p className="r-allergy" role="alert"><Icon name="alert" /><span><b>{t("Attention, allergie.", "Allergy warning.")}</b> {hits.map(h => `${h.who} (${allergyName(h.allergy)})${t(" : ", ": ")}${h.items.join(", ")}`).join(". ")}.</span></p>
  );
  const safe = eaters.filter(p => p.allergies.length && !hits.some(h => h.who === p.name));
  // Plus : les invités du soir, comptés comme des adultes
  const guests = Math.max(0, Math.round(servings - family));
  const all = eaters.length === household.length;
  const who = (household.length > 1 && all ? (guests ? t("Famille", "Family") : t("Toute la famille", "The whole family")) : eaters.map(p => p.name).join(", "))
    + (guests ? ` + ${guestTxt(guests)}` : "");
  // Qui mange (Hugo, 30 octobre) : les portions suivent. Ouverte hors d'un scan (Explorer, favoris), le choix reste pour les suivantes.
  const pickEater = (id: string) => {
    const next = toggleAway(household, away, id);
    if (next === away) return;
    setAway(next);
    setServings(portionsOf(eatersOf(household, { away: next }), 0) + guests);
    if (!entry) setScan({ away: next });
  };
  const addGuest = (d: number) => {
    const g = Math.max(0, Math.min(MAX_GUESTS, guests + d));
    setServings(family + g);
    if (d <= 0) return;
    // Assez pour tout le monde ? Comparé à ce que tu as
    const next = linesFor(family + g);
    const low = next.filter(l => l.check?.short).map(l => l.n);
    const tonight = g === 1 ? t("Un invité ce soir", "One guest tonight") : t(`${g} invités ce soir`, `${g} guests tonight`);
    showToast(low.length ? `${tonight}. ${t("Pas assez : ", "Not enough: ")}${joinNames(low).toLowerCase()}`
      : next.some(l => l.check?.sure) ? t(`${tonight} : les quantités suivent, tu as assez`, `${tonight}: quantities updated, you have enough`) : t(`${tonight} : les quantités suivent`, `${tonight}: quantities updated`));
  };

  return (
    <section className="fa scan-screen scr-recipe" aria-label={t("Fiche recette", "Recipe")}>
      <div className="scroll">
        <div className="r-hero">
          {photo ? <img src={photo} alt={recipe.title} /> : <span style={{ display: "block", height: "100%", background: "var(--surface)" }} />}
          <div className="bar2">
            <RoundButton icon="back" label={t("Retour", "Back")} onClick={back} />
            <span style={{ display: "flex", gap: 8 }}>
              <RoundButton icon="cal" label={t("Ajouter à ma semaine", "Add to my week")} onClick={addToWeek} />
              <RoundButton icon="heart" label={fav ? t("Retirer des favoris", "Remove from favorites") : t("Ajouter aux favoris", "Add to favorites")} aria-pressed={fav}
                style={fav ? { background: "var(--sage)", color: "var(--on)" } : undefined}
                onClick={() => onToggleFavorite({ ...recipe, scanDate: recipe.scanDate ?? entry?.date.toISOString(), savedServings: servings, ...(state?.from === "plan" ? { fromPlan: true } : {}) })} />
            </span>
          </div>
        </div>
        <div className="band r-band">
          <span className="label">{entry ? `${t(`Recette ${index + 1} sur ${entry.recipes.length}`, `Recipe ${index + 1} of ${entry.recipes.length}`)} · ${diffText(recipe.diff)}` : diffText(recipe.diff)}</span>
          {recipeBadges(recipe, isPlus).length > 0 && <span className="bbadges">{recipeBadges(recipe, isPlus).map(b => <Badge key={b} tone="ongreen">{b}</Badge>)}</span>}
          <h2>{recipe.title}</h2>
          <div className="stats">
            <div><b>{timeText(recipe.time)}</b><span>{t("au total", "in total")}</span></div>
            <div><b>{recipe.cal}</b><span>{t("kcal / pers.", "kcal / serving")}</span></div>
            {total > 0 && <div><b>{have}/{total}</b><span>{t("dans ton frigo", "in your fridge")}</span></div>}
          </div>
        </div>
        <div className="r-body">
          {recipe.intro && <p className="intro">{recipe.intro}</p>}
          {/* Ce qui manque, en vue dès le haut : un appui et c'est dans la liste de courses */}
          {missing + short > 0 && (
            <button type="button" className={"wk-add" + (listed ? " done" : "")} onClick={addMissing}>
              <Icon name={listed ? "check" : "cart"} />
              <span>{listed ? t("Dans ta liste de courses · voir", "In your shopping list · see") : recipe.missing && recipe.missing.length <= 24 && !short ? t(`Manque ${recipe.missing} · ajouter à ma liste`, `Missing ${recipe.missing} · add to my list`) : addText(missing, short)}</span>
            </button>
          )}
          <button type="button" className={"wk-add" + (placed ? " done" : "")} onClick={addToWeek}>
            <Icon name={placed ? "check" : "cal"} /><span>{placed ?? t("Ajouter à ma semaine", "Add to my week")}</span>{!isPlus && <LockPill />}
          </button>
          <div className="seg" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "ing"} className={tab === "ing" ? "on" : undefined} onClick={() => setTab("ing")}>{t("Ingrédients", "Ingredients")}</button>
            <button type="button" role="tab" aria-selected={tab === "stp"} className={tab === "stp" ? "on" : undefined} onClick={() => setTab("stp")}>{t("Étapes", "Steps")}</button>
          </div>
          {tab === "ing" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {isPlus ? (
                <div className="rg">
                  <button type="button" className="rg-who" disabled={household.length < 2} aria-label={`${srvLabel(true, servings)}, ${who}. ${t("Choisir qui mange", "Choose who's eating")}`} onClick={() => setWhoOpen(true)}>
                    <span className="rg-avs">
                      {eaters.slice(0, 3).map(p => {
                        const pp = p.me && avatar;
                        return <span key={p.id} className={"ini" + (p.kid ? " k" : "") + (pp ? " has-pp" : "")} style={pp ? { backgroundImage: `url(${avatar})` } : undefined}>{p.name.charAt(0).toUpperCase()}</span>;
                      })}
                      {guests > 0 && <span key={guests} className="ini g pop">+{guests}</span>}
                    </span>
                    <span className="rg-tx"><b>{srvLabel(true, servings)}</b><small><span>{who}</span>{household.length > 1 && <Icon name="next" />}</small></span>
                  </button>
                  <span className="rg-ctl">
                    <button type="button" className="rg-minus" aria-label={t("Un invité de moins", "One guest fewer")} hidden={!guests} onClick={() => addGuest(-1)}><Icon name="minus" /></button>
                    <button type="button" className="rg-plus" aria-label={t("Un invité de plus", "One more guest")} onClick={() => addGuest(1)}>+1</button>
                  </span>
                </div>
              ) : (
                <div className="forrow"><b>{t("Pour", "For")} {srvLabel(false, servings)}</b>
                  <Stepper value={servings} min={1} max={MAX_GUESTS} label={t(["Moins", "Plus"], ["Fewer", "More"])} onChange={setServings} />
                </div>
              )}
              {alert}
              {pieces && <p className="rc-makes">{pieces}</p>}
              <div className="ingbox">
                <ul className="ings">
                  {lines.map((l, i) => (
                    <li key={i} className={done.includes(i) ? "done" : undefined}>
                      <button type="button" className="ck" aria-label={t("Cocher", "Tick")} aria-pressed={done.includes(i)}
                        onClick={() => setDone(d => (d.includes(i) ? d.filter(x => x !== i) : [...d, i]))}><Icon name="check" /></button>
                      <span className="q">{l.q}</span>
                      <span className="nm">{l.n}
                        {/* Ce que tu as : quand il en manque, ou dès que les portions changent */}
                        {l.check && (l.check.short || servings !== base) && (
                          <small className={"ing-have" + (l.check.short ? " low" : "")}>
                            {l.check.short ? t(`Tu en as ${l.check.have} · il manque ${l.check.short}`, `You have ${l.check.have} · ${l.check.short} short`)
                              : l.check.sure ? t(`Tu en as ${l.check.have} : assez`, `You have ${l.check.have}: enough`) : t(`Tu en as ${l.check.have} : vérifie`, `You have ${l.check.have}: check`)}
                          </small>
                        )}
                      </span>
                      {allergic.has(lineName(i)) ? <Badge tone="warn" icon="alert">{t("Allergie", "Allergy")}</Badge> : !l.have && <Badge tone="warn">{t("À acheter", "To buy")}</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
              {missing + short > 0 && (
                <button type="button" className="add" style={{ alignSelf: "flex-start" }} onClick={addMissing}>
                  <span className="rm"><Icon name="plus" /></span>
                  <span>{listed ? t("Dans ta liste · voir", "In your list · see") : addText(missing, short)}</span>
                </button>
              )}
            </div>
          ) : (
            <ol className="stepcards">
              {steps.map((s, i) => {
                const tm = recipe.timers?.[i];
                return (
                  <li key={i}><span className="num">{i + 1}</span>
                    <div><p>{s}</p>{tm && <span className="timer-chip"><Icon name="clock" />{tm.label} · {minText(tm.min)}</span>}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
      <button type="button" className="gobar" onClick={cook}>
        <span><b>{t("Lancer la cuisson", "Start cooking")}</b><small>{timeText(recipe.time)} · {steps.length} {t("étape", "step")}{steps.length > 1 ? "s" : ""}</small></span>
        <span className="go"><Icon name="arrow" /></span>
      </button>
      <WeekSheet option={wk} week={week} days={days} setWeek={onWeek} onClose={() => setWk(null)} />
      {isPlus && household.length > 1 && (
        <Sheet open={whoOpen} onClose={() => setWhoOpen(false)} label={t("Qui mange ?", "Who's eating?")}>
          <h3 className="stitle">{t(<>Qui <em>mange&nbsp;?</em></>, <>Who's <em>eating?</em></>)}</h3>
          <WhoGrid household={household} away={away} avatar={avatar} onToggle={pickEater} />
          <p className="whonote"><Icon name="users" /><span><b>{whoParts(eaters, guests)}, {t("soit", "so")} {srvLabel(true, servings)}.</b> {t("Les quantités suivent.", "Quantities follow.")}</span></p>
          {alert}
          {safe.length > 0 && <p className="whonote"><Icon name="shield" /><span>{t(`${safe.length > 1 ? "Allergies" : "Allergie"} de ${names(safe.map(p => `${p.name} (${p.allergies.join(", ")})`))} : rien de repéré dans cette recette.`,
            `${names(safe.map(p => `${p.name}'s (${p.allergies.map(allergyName).join(", ")})`))} ${safe.length > 1 ? "allergies" : "allergy"}: nothing spotted in this recipe.`)}</span></p>}
          <Pill block onClick={() => setWhoOpen(false)}>{t("C'est bon", "Done")}</Pill>
        </Sheet>
      )}
    </section>
  );
}
