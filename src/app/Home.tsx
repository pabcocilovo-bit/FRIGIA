// 1 · Accueil. V3 (maquette de Hugo, 25 octobre) : l'en-tête avec « Mon profil », la carte du scan (sans recherche : Explorer la fait, Hugo le 5 novembre),
// les recettes de la semaine, le prochain repas prévu, le budget si choisi dans Mon espace, puis « Mon espace Frigia » (économies, scans, favoris, courses : Space.tsx).
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Icon } from "../ui/components";
import type { GeneratedRecipe, HistoryEntry, User } from "../lib/types";
import { type CookedMeal, isMeal } from "../lib/cooked";
import { AppTabBar } from "./AppTabBar";
import { initial } from "./format";
import { useOpenScan } from "./offline";
import { useNotifs } from "../lib/notify";
import "./notifs/notifs.css";
import { useOpenPaywall } from "./plus/subscription";
import { type Person, portionsOf, portTxt } from "../lib/household";
import type { Fridge, MealKey, ShopItem, Week } from "../lib/home";
import { weekRecipes } from "./featured";
import { useScan } from "./scan/store";
import { eatersOf } from "./scan/portions";
import { weekDays } from "./format";
import { Dish } from "./plan/Dish";
import { AlphaBanner } from "./AlphaBanner";
import { SwapSheet, TonightSheet } from "./plan/sheets";
import { cookedSlot, MEAL_NAME, mealOfKey, nextUp, options, recipePath } from "./plan/week";
import { BetaCard } from "./beta/BetaCard";
import { diffText, timeText } from "../lib/recipes";
import { t } from "../lib/i18n";
import type { Budget } from "../lib/budget";
import { BudgetCard } from "./family/Budget";
import { HouseholdCard } from "./family/HouseholdCard";
import "./family/family.css";

export function Avatar({ user, name, photo, className, onClick, label }: {
  user: User; name?: string; photo: string | null; className: string; onClick?: () => void; label: string;
}) {
  const style = photo ? { backgroundImage: `url(${photo})` } : undefined;
  const letter = name ? name.charAt(0).toUpperCase() : initial(user);
  return onClick
    ? <button type="button" className={className + (photo ? " has-pp" : "")} style={style} aria-label={label} onClick={onClick}>{letter}</button>
    : <span className={className + (photo ? " has-pp" : "")} style={style} role="img" aria-label={label}>{letter}</span>;
}

/** Les recettes de la semaine, qu'on fait défiler. Une carte ouvre sa fiche recette. */
function WeekRecipes({ kitchen, onOpen }: { kitchen: Fridge; onOpen: (r: GeneratedRecipe) => void }) {
  const list = useMemo(() => weekRecipes(kitchen.items), [kitchen.items]);
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const go = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" });
  return (
    <section className="hm-wk wk" aria-label={t("Recettes de la semaine", "Recipes of the week")}>
      <div className="wk-track" ref={track} onScroll={e => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {list.map(({ recipe: r, alt }, i) => (
          <button key={r.title} type="button" className="wk-slide" onClick={() => onOpen(r)} aria-label={`${r.title}, ${timeText(r.time)}. ${t("Voir la recette", "See the recipe")}`}>
            <img src={r.imageSearch} alt={alt} loading={i ? "lazy" : undefined} />
            <span className="wk-cap">
              <small>{t("Recette de la semaine", "Recipe of the week")}</small>
              <b>{r.title}</b>
              <span>{timeText(r.time)} · {diffText(r.diff)}{r.veg ? t(" · Végé", " · Veggie") : ""}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="wk-dots">
        {list.map(({ recipe: r }, i) => <button key={r.title} type="button" className={i === at ? "on" : undefined} aria-label={t(`Recette ${i + 1} sur ${list.length}`, `Recipe ${i + 1} of ${list.length}`)} aria-current={i === at || undefined} onClick={() => go(i)} />)}
      </div>
    </section>
  );
}

export function Home({ user, isPlus, avatar, history, favorites, cooked, household, homeReady, week, onWeek, kitchen, shopping, budget, onOpenRecipe }: {
  user: User | null; isPlus: boolean;
  /** Le foyer du compte est chargé : la carte « Ton foyer » ne s'affiche pas sur une liste encore vide */
  homeReady: boolean;
  /** Le budget courses : sa carte sur l'accueil quand elle y a été ajoutée (Mon espace Frigia) */
  budget: Budget;
  avatar: string | null; history: HistoryEntry[]; favorites: GeneratedRecipe[];
  household: Person[];
  week: Week; onWeek: (w: Week) => void;
  cooked: CookedMeal[];
  /** Ma cuisine : ce qu'on a déjà pour les recettes de la semaine */
  kitchen: Fridge;
  /** La liste de courses : le panier en haut, avec ce qu'il reste à acheter */
  shopping: ShopItem[];
  onOpenRecipe: (r: GeneratedRecipe) => void;
}) {
  const navigate = useNavigate();
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  // Plus : qui mange ce soir (« Qui mange » du scan), avec les invités
  const scan = useScan();
  const eaters = eatersOf(household, scan);
  // Plus : la semaine, et le plat prévu ce soir
  const days = weekDays();
  const notifs = useNotifs();
  const [tn, setTn] = useState(false);
  const [swap, setSwap] = useState<{ i: number; meal: MealKey } | null>(null);
  // Le prochain repas prévu : ce midi, ce soir, le dessert une fois le plat cuisiné, sinon demain ou plus loin
  const today = new Date().toDateString();
  // Le soir est passé : repas du soir cuisiné, ou après 21 h. Avant, rien de prévu ce soir : « Qu'est-ce qu'on mange ce soir ? »
  const now = new Date();
  // (un produit « Mangé » dans Ma cuisine n'est pas un repas)
  const meals = cooked.filter(isMeal);
  const evening = now.getHours() >= 21 || meals.some(c => c.date.toDateString() === today && c.date.getHours() >= 17);
  const cookedToday = meals.filter(c => c.date.toDateString() === today).map(c => c.title);
  const next = isPlus ? nextUp(week, days, cookedToday, evening) : null;
  // Le repas prévu aujourd'hui et déjà cuisiné : on peut y revenir (« Revoir ») une fois que l'accueil est passé au suivant
  const done = isPlus ? cookedSlot(week, days, cookedToday) : null;
  const tonight = next?.slot;
  const nm = next ? MEAL_NAME[mealOfKey(next.key)] : "";
  const sweet = !!next && (next.key === "md" || next.key === "sd");
  const lunch = nm === "midi";
  const when = !next ? (evening ? t("demain", "tomorrow") : t("ce soir", "tonight"))
    : next.i === 0 ? t(`ce ${nm}`, lunch ? "today at lunch" : "tonight") : t(`demain ${nm}`, lunch ? "tomorrow at lunch" : "tomorrow night");
  // Le titre de la carte verte, en capitales comme sur la maquette
  const nextLabel = !next ? (evening ? t("Demain", "Tomorrow") : t("Ce soir", "Tonight"))
    : sweet ? t(`Le dessert de ${when}`, `Dessert ${when}`)
      : next.i === 0 ? t(`${lunch ? "Ce midi" : "Ce soir"}, c'est prévu`, lunch ? "Planned for lunch" : "Planned for tonight")
        : t(`Demain ${nm}, c'est prévu`, lunch ? "Planned for tomorrow's lunch" : "Planned for tomorrow night");
  const openPlanning = () => (isPlus ? navigate("/planning") : openPaywall("planning", "/planning"));

  const toBuy = shopping.filter(x => !x.done);
  // La cloche : les notifs non lues (« Il te reste 3 scans » ne compte plus en Plus)
  const unread = (notifs ?? []).filter(x => !x.read && !(isPlus && x.kind === "scans")).length;
  // La recherche ouvre Explorer avec ce qu'on a tapé

  return (
    <div className="fa fa-app hm3" aria-label={t("Accueil", "Home")}>
      <div className="ghead">
        <div className="row hd-row">
          <button type="button" className="hm-me" aria-label={t("Mon profil", "My profile")} onClick={() => navigate("/famille")}>
            {avatar ? <span className="hm-pp" style={{ backgroundImage: `url(${avatar})` }} aria-hidden="true" /> : <Icon name="user" />}
            <span className="hm-me-tx">{t("Mon profil", "My profile")}</span>
          </button>
          <span className="word">Frigia</span>
          <span className="hd-r">
          {/* La liste de courses, toujours à portée : le panier, avec ce qu'il reste à acheter */}
          <button type="button" className="cbtn glass ib-bell" aria-label={toBuy.length ? t(`Liste de courses, ${toBuy.length} article${toBuy.length > 1 ? "s" : ""}`, `Shopping list, ${toBuy.length} item${toBuy.length > 1 ? "s" : ""}`) : t("Liste de courses", "Shopping list")} onClick={() => navigate("/courses")}>
            <Icon name="cart" />{toBuy.length > 0 && <i className="ib-badge" aria-hidden="true">{toBuy.length > 9 ? "9+" : toBuy.length}</i>}
          </button>
          <button type="button" className="cbtn glass ib-bell" aria-label={unread ? t(`Notifications, ${unread} non lue${unread > 1 ? "s" : ""}`, `Notifications, ${unread} unread`) : "Notifications"} onClick={() => navigate("/notifications")}>
            <Icon name="bell" />{unread > 0 && <i className="ib-badge" aria-hidden="true">{unread > 9 ? "9+" : unread}</i>}
          </button>
          </span>
        </div>
      </div>
      <div className="hm-body">
        {/* Pas de bandeau d'essai en V3 pour l'instant (Hugo, 25 octobre) : à décider, voir notes/versions.md du projet */}
        <AlphaBanner />
        <section className="hm-hero" aria-label={t("Scanner mon frigo", "Scan my fridge")}>
          <img src="/landing/frigo.jpg" alt="" />
          <h1>{t(<>Ton frigo a des idées&nbsp;!</>, "Your fridge has ideas!")}</h1>
          <p>{t("Scanne tes aliments et découvre ce que tu peux cuisiner avec ce que tu as déjà.", "Scan your food and discover what you can cook with what you already have.")}</p>
          <button type="button" className="hm-scan" onClick={openScan}><Icon name="cam" /><span>{t("Scanner mon frigo", "Scan my fridge")}</span><Icon name="arrow" /></button>
        </section>

        {/* Bêta : le questionnaire, proposé à partir du 5e jour */}
        <BetaCard user={user} uses={history.length + cooked.length} />
        {/* Comptes d'avant la question du foyer : ajouter son foyer, ou découvrir l'appétit de chacun */}
        {isPlus && user && homeReady && <HouseholdCard userId={user.id} household={household} />}

        <WeekRecipes kitchen={kitchen} onOpen={onOpenRecipe} />

        <section className="hm-next" aria-label={nextLabel}>
          <div className="hm-next-hd"><h2>{nextLabel}</h2><button type="button" onClick={openPlanning}>{t("Voir tout", "See all")}<Icon name="next" /></button></div>
          {tonight ? (
            <button type="button" className="tn-card" onClick={() => setTn(true)}>
              <Dish recipe={tonight.recipe} className="plate" />
              <span className="tn-tx"><b>{tonight.recipe.title}</b><span className="tn-m">{timeText(tonight.recipe.time)} · {t("pour", "for")} {portTxt(portionsOf(eaters, scan.guests))}{next?.dessert ? t(" · et un dessert", " · and a dessert") : ""}</span></span>
              <span className="tn-go" aria-hidden="true"><Icon name="arrow" /></span>
            </button>
          ) : (
            <button type="button" className="tn-card" onClick={openScan}>
              <span className="hm-q"><Icon name="utensils" /></span>
              <span className="tn-tx"><b>{t(<>Qu'est-ce qu'on mange {when}&nbsp;?</>, <>What's for {!next && evening ? "tomorrow" : "dinner"}?</>)}</b><span className="tn-m">{t("Scanne ton frigo : trois recettes avec ce que tu as", "Scan your fridge: three recipes with what you have")}</span></span>
              <span className="tn-go" aria-hidden="true"><Icon name="arrow" /></span>
            </button>
          )}
          {done && done.slot !== tonight && (
            <button type="button" className="tn-back" onClick={() => navigate(recipePath(done.slot, history), { state: { recipe: done.slot.recipe, from: "plan" } })}>
              <Icon name="redo" /><span>{t(`Revoir ${done.key === "m" || done.key === "md" ? "ce midi" : "ce soir"} :`, `See again ${done.key === "m" || done.key === "md" ? "lunch" : "tonight"}:`)} <b>{done.slot.recipe.title}</b></span>
            </button>
          )}
        </section>

        {isPlus && budget.home && <section className="hm-bud" aria-label={t("Budget courses", "Grocery budget")}>
          <BudgetCard isPlus budget={budget} meals={cooked} />
        </section>}

        <button type="button" className="hm-space" onClick={() => navigate("/espace")}>
          <span className="hm-space-ic"><Icon name="grid" /></span>
          <span className="tx"><b>{t("Mon espace Frigia", "My Frigia space")}</b></span>
          <Icon name="next" />
        </button>
      </div>
      <AppTabBar active="home" isPlus={isPlus} />
      <TonightSheet open={tn} slot={tonight} history={history} household={household} onClose={() => setTn(false)}
        label={sweet ? t(`Le dessert de ${when}`, `Dessert ${when}`) : t(`Prévu ${when}`, `Planned ${when}`)}
        onSwap={next && !sweet ? () => { setTn(false); setTimeout(() => setSwap({ i: next.i, meal: mealOfKey(next.key) }), 280); } : undefined} />
      <SwapSheet at={swap} week={week} days={days} opts={options(history, favorites)} household={household}
        setWeek={onWeek} onClose={() => setSwap(null)} />
    </div>
  );
}
