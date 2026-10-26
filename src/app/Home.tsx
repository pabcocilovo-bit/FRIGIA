// 1 · Accueil. V3 (maquette de Hugo, 25 octobre) : l'en-tête avec « Mon profil », la carte du scan, la recherche (Explorer),
// les recettes de la semaine, le prochain repas prévu, puis « Mon espace Frigia » (économies, scans, favoris, courses : Space.tsx).
import { type FormEvent, useMemo, useRef, useState } from "react";
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
import { forTonight, type Person, portionsOf, portTxt } from "../lib/household";
import type { Fridge, MealKey, ShopItem, Week } from "../lib/home";
import { weekRecipes } from "./featured";
import { useScan } from "./scan/store";
import { eatersOf } from "./scan/portions";
import { weekDays } from "./format";
import { Dish } from "./plan/Dish";
import { SwapSheet, TonightSheet } from "./plan/sheets";
import { cookedSlot, MEAL_NAME, mealOfKey, nextUp, options, recipePath } from "./plan/week";
import { BetaCard } from "./beta/BetaCard";

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
    <section className="hm-wk wk" aria-label="Recettes de la semaine">
      <div className="wk-track" ref={track} onScroll={e => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {list.map(({ recipe: r, alt }, i) => (
          <button key={r.title} type="button" className="wk-slide" onClick={() => onOpen(r)} aria-label={`${r.title}, ${r.time}. Voir la recette`}>
            <img src={r.imageSearch} alt={alt} loading={i ? "lazy" : undefined} />
            <span className="wk-cap">
              <small>Recette de la semaine</small>
              <b>{r.title}</b>
              <span>{r.time} · {r.diff}{r.veg ? " · Végé" : ""}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="wk-dots">
        {list.map(({ recipe: r }, i) => <button key={r.title} type="button" className={i === at ? "on" : undefined} aria-label={`Recette ${i + 1} sur ${list.length}`} aria-current={i === at || undefined} onClick={() => go(i)} />)}
      </div>
    </section>
  );
}

export function Home({ user, isPlus, avatar, history, favorites, cooked, household, week, onWeek, kitchen, shopping, onOpenRecipe }: {
  user: User | null; isPlus: boolean;
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
  const [q, setQ] = useState("");
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
  const when = !next ? (evening ? "demain" : "ce soir") : next.i === 0 ? `ce ${nm}` : `demain ${nm}`;
  // Le titre de la carte verte, en capitales comme sur la maquette
  const nextLabel = !next ? (evening ? "Demain" : "Ce soir")
    : sweet ? `Le dessert de ${when}`
      : next.i === 0 ? `${nm === "midi" ? "Ce midi" : "Ce soir"}, c'est prévu`
        : `Demain ${nm}, c'est prévu`;
  const openPlanning = () => (isPlus ? navigate("/planning") : openPaywall("planning", "/planning"));

  const toBuy = shopping.filter(x => !x.done);
  // La cloche : les notifs non lues (« Il te reste 3 scans » ne compte plus en Plus)
  const unread = (notifs ?? []).filter(x => !x.read && !(isPlus && x.kind === "scans")).length;
  // La recherche ouvre Explorer avec ce qu'on a tapé
  const search = (e: FormEvent) => { e.preventDefault(); navigate(q.trim() ? `/explorer?q=${encodeURIComponent(q.trim())}` : "/explorer"); };

  return (
    <div className="fa fa-app hm3" aria-label="Accueil">
      <div className="ghead">
        <div className="row hd-row">
          <button type="button" className="hm-me" aria-label="Mon profil" onClick={() => navigate("/famille")}>
            {avatar ? <span className="hm-pp" style={{ backgroundImage: `url(${avatar})` }} aria-hidden="true" /> : <Icon name="user" />}
            <span className="hm-me-tx">Mon profil</span>
          </button>
          <span className="word">Frigia</span>
          <span className="hd-r">
          {/* La liste de courses, toujours à portée : le panier, avec ce qu'il reste à acheter */}
          <button type="button" className="cbtn glass ib-bell" aria-label={toBuy.length ? `Liste de courses, ${toBuy.length} article${toBuy.length > 1 ? "s" : ""}` : "Liste de courses"} onClick={() => navigate("/courses")}>
            <Icon name="cart" />{toBuy.length > 0 && <i className="ib-badge" aria-hidden="true">{toBuy.length > 9 ? "9+" : toBuy.length}</i>}
          </button>
          <button type="button" className="cbtn glass ib-bell" aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"} onClick={() => navigate("/notifications")}>
            <Icon name="bell" />{unread > 0 && <i className="ib-badge" aria-hidden="true">{unread > 9 ? "9+" : unread}</i>}
          </button>
          </span>
        </div>
      </div>
      <div className="hm-body">
        {/* Pas de bandeau d'essai en V3 pour l'instant (Hugo, 25 octobre) : à décider, voir notes/versions.md du projet */}
        <section className="hm-hero" aria-label="Scanner mon frigo">
          <img src="/landing/frigo.jpg" alt="" />
          <h1>Ton frigo a des idées&nbsp;!</h1>
          <p>Scanne tes aliments et découvre ce que tu peux cuisiner avec ce que tu as déjà.</p>
          <button type="button" className="hm-scan" onClick={openScan}><Icon name="cam" /><span>Scanner mon frigo</span><Icon name="arrow" /></button>
        </section>

        <form className="hm-search" role="search" onSubmit={search}>
          <label><Icon name="search" /><input type="search" enterKeyHint="search" autoComplete="off" placeholder="Ou cherche : saumon, pâtes, burger…"
            aria-label="Chercher une recette" value={q} onChange={e => setQ(e.target.value)} /></label>
          <button type="button" className="hm-filter" aria-label="Filtres" onClick={() => navigate("/explorer?filtres=1")}><Icon name="sliders" /></button>
        </form>

        {/* Bêta : le questionnaire, proposé à partir du 5e jour */}
        <BetaCard user={user} uses={history.length + cooked.length} />

        <WeekRecipes kitchen={kitchen} onOpen={onOpenRecipe} />

        <section className="hm-next" aria-label={nextLabel}>
          <div className="hm-next-hd"><h2>{nextLabel}</h2><button type="button" onClick={openPlanning}>Voir tout<Icon name="next" /></button></div>
          {tonight ? (
            <button type="button" className="tn-card" onClick={() => setTn(true)}>
              <Dish recipe={tonight.recipe} className="plate" />
              <span className="tn-tx"><b>{tonight.recipe.title}</b><span className="tn-m">{tonight.recipe.time} · pour {portTxt(portionsOf(eaters, scan.guests))}{next?.dessert ? " · et un dessert" : ""}</span></span>
              <span className="tn-go" aria-hidden="true"><Icon name="arrow" /></span>
            </button>
          ) : (
            <button type="button" className="tn-card" onClick={openScan}>
              <span className="hm-q"><Icon name="utensils" /></span>
              <span className="tn-tx"><b>Qu'est-ce qu'on mange {when}&nbsp;?</b><span className="tn-m">Scanne ton frigo : trois recettes avec ce que tu as</span></span>
              <span className="tn-go" aria-hidden="true"><Icon name="arrow" /></span>
            </button>
          )}
          {done && done.slot !== tonight && (
            <button type="button" className="tn-back" onClick={() => navigate(recipePath(done.slot, history), { state: { recipe: done.slot.recipe, from: "plan" } })}>
              <Icon name="redo" /><span>Revoir {done.key === "m" || done.key === "md" ? "ce midi" : "ce soir"} : <b>{done.slot.recipe.title}</b></span>
            </button>
          )}
          {isPlus && <p className="hm-next-ft"><Icon name="pin" /><span>{forTonight(eaters, scan.guests, when)}</span></p>}
        </section>

        <button type="button" className="hm-space" onClick={() => navigate("/espace")}>
          <span className="hm-space-ic"><Icon name="grid" /></span>
          <span className="tx"><b>Mon espace Frigia</b><span>Mes économies, mes scans, mes favoris et mes courses</span></span>
          <Icon name="next" />
        </button>
      </div>
      <AppTabBar active="home" isPlus={isPlus} />
      <TonightSheet open={tn} slot={tonight} history={history} household={household} onClose={() => setTn(false)}
        label={sweet ? `Le dessert de ${when}` : `Prévu ${when}`}
        onSwap={next && !sweet ? () => { setTn(false); setTimeout(() => setSwap({ i: next.i, meal: mealOfKey(next.key) }), 280); } : undefined} />
      <SwapSheet at={swap} week={week} days={days} opts={options(history, favorites)} household={household}
        setWeek={onWeek} onClose={() => setSwap(null)} />
    </div>
  );
}
