// 1 · Accueil (prototype V3).
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Band, BandFoot, Icon, LockPill, Pill, QuotaBar } from "../ui/components";
import type { GeneratedRecipe, HistoryEntry, User } from "../lib/types";
import { type CookedMeal, thisMonth, totalSaved } from "../lib/cooked";
import { euros, kilos } from "./scan/savings";
import { quotaText, quotaTotal, scansLeft, type ScanQuota } from "../lib/billing";
import { AppTabBar } from "./AppTabBar";
import { bandLabel, daysAgo, initial, plural, scanWhen } from "./format";
import { useOpenScan } from "./offline";
import { useRecipePhoto } from "./photo";
import { showToast } from "./toast";
import { useNotifs } from "../lib/notify";
import "./notifs/notifs.css";
import { useOpenPaywall } from "./plus/subscription";
import { forTonight, type Person, portionsOf, portTxt } from "../lib/household";
import type { Fridge, MealKey, Week } from "../lib/home";
import { weekRecipes } from "./featured";
import { type ScanState, setScan, useScan } from "./scan/store";
import { eatersOf } from "./scan/portions";
import { weekDays } from "./format";
import { Dish } from "./plan/Dish";
import { cmFmt, useCommunity } from "./report/community";
import "./report/report.css";
import { SwapSheet, TonightSheet } from "./plan/sheets";
import { count, dayOf, MEALS, options } from "./plan/week";

// Les envies du haut (écart maquette : décoratives dans le prototype). Chacune règle le prochain scan
// et change le bandeau : Rapide, Les enfants adorent, Anti-gaspi (l'envie), Batch cooking (la semaine).
type Cat = { id: string; label: string; title: React.ReactNode; text: string; scan: Partial<ScanState> };
const CATS: Cat[] = [
  { id: "soir", label: "Ce soir", title: null, text: "", scan: { meal: "s", envie: "rapide" } },
  { id: "rapide", label: "Rapide", title: <>Prêt en <em>25 minutes</em></>, text: "Prends ton frigo en photo : trois idées rapides avec ce que tu as.", scan: { meal: "s", envie: "rapide" } },
  { id: "enfants", label: "Les enfants adorent", title: <>Un plat que les <em>enfants adorent</em></>, text: "Trois idées simples et douces, qui plaisent aux petits.", scan: { meal: "s", envie: "enfants" } },
  { id: "gaspi", label: "Anti-gaspi", title: <>Rien ne se <em>perd</em></>, text: "Les recettes vident le frigo, en commençant par ce qui s'abîme vite. Au scan, marque « À finir » ce qui presse.", scan: { meal: "s", envie: "gaspi" } },
  { id: "batch", label: "Batch cooking", title: <>Cuisine une fois, mange <em>toute la semaine</em></>, text: "Des plats qui se gardent, dans l'ordre où les cuisiner.", scan: { meal: "w" } },
];
const catOf = (s: ScanState) => (s.meal === "w" ? "batch" : s.envie === "enfants" ? "enfants" : s.envie === "gaspi" ? "gaspi" : "soir");

export function Avatar({ user, name, photo, className, onClick, label }: {
  user: User; name?: string; photo: string | null; className: string; onClick?: () => void; label: string;
}) {
  const style = photo ? { backgroundImage: `url(${photo})` } : undefined;
  const letter = name ? name.charAt(0).toUpperCase() : initial(user);
  return onClick
    ? <button type="button" className={className + (photo ? " has-pp" : "")} style={style} aria-label={label} onClick={onClick}>{letter}</button>
    : <span className={className + (photo ? " has-pp" : "")} style={style} role="img" aria-label={label}>{letter}</span>;
}

function ScanRow({ entry, locked, onClick }: { entry: HistoryEntry; locked: boolean; onClick: () => void }) {
  const first = entry.recipes[0];
  const photo = useRecipePhoto(first?.title, first?.imageSearch);
  return (
    <button type="button" className={"hrow" + (locked ? " old blur" : "")} onClick={onClick}>
      {photo ? <img src={photo} alt="" /> : <span style={{ width: 46, height: 46, borderRadius: 12, background: "var(--surface)", flex: "none" }} />}
      <div><b>{scanWhen(entry.date)}</b><span>{entry.ingredients.length ? plural(entry.ingredients.length, "ingrédient") : "Frigo vide"} · {plural(entry.recipes.length, "recette")}</span></div>
      {locked ? <LockPill /> : <Icon name="next" className="muted" />}
    </button>
  );
}

/** En haut de l'accueil : les recettes de la semaine, qu'on fait défiler. Une carte ouvre sa fiche recette. */
function WeekRecipes({ kitchen, onOpen }: { kitchen: Fridge; onOpen: (r: GeneratedRecipe) => void }) {
  const list = useMemo(() => weekRecipes(kitchen.items), [kitchen.items]);
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const go = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" });
  return (
    <section className="hphoto wk" aria-label="Recettes de la semaine">
      <div className="wk-track" ref={track} onScroll={e => setAt(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {list.map(({ recipe: r, alt }, i) => (
          <button key={r.title} type="button" className="wk-slide" onClick={() => onOpen(r)} aria-label={`${r.title}, ${r.time}. Voir la recette`}>
            <img src={r.imageSearch} alt={alt} loading={i ? "lazy" : undefined} />
            <span className="wk-cap">
              <small>{i === 0 ? "Recette de la semaine" : "Aussi cette semaine"}</small>
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

function FavCard({ recipe, onClick }: { recipe: GeneratedRecipe; onClick: () => void }) {
  const photo = useRecipePhoto(recipe.title, recipe.imageSearch);
  return (
    <button type="button" className="gc" onClick={onClick}>
      {recipe.diff && <span className="tg">{recipe.diff}</span>}
      <span className="rw">
        {photo ? <img className="plate" src={photo} alt="" /> : <span className="plate" style={{ width: 58, background: "var(--surface)" }} />}
        <span><b>{recipe.title}</b><span className="m">{recipe.time}</span></span>
      </span>
    </button>
  );
}

// Sans scan : les trois étapes, avec les captures de la page d'accueil du site
const STEPS = [
  { img: "app-scan", t: "Tu prends ton frigo en photo", p: "Pour un plat ou un dessert" },
  { img: "app-ingr", t: "Tu vérifies, tu dis qui mange", p: "Frigia liste ce qu'il a vu" },
  { img: "app-results", t: "Tu choisis parmi trois recettes", p: "Avec ce que tu as déjà" },
];

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function Home({ user, name, isPlus, quota, avatar, history, favorites, cooked, household, week, onWeek, kitchen, onOpenRecipe }: {
  user: User; name: string; isPlus: boolean; quota: ScanQuota | null; avatar: string | null; history: HistoryEntry[]; favorites: GeneratedRecipe[];
  household: Person[];
  week: Week; onWeek: (w: Week) => void;
  cooked: CookedMeal[];
  /** Ma cuisine : ce qu'on a déjà pour les recettes de la semaine */
  kitchen: Fridge;
  onOpenRecipe: (r: GeneratedRecipe) => void;
}) {
  const navigate = useNavigate();
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  const community = useCommunity();
  // Plus : qui mange ce soir (« Qui mange » du scan), avec les invités
  const scan = useScan();
  const [catId, setCatId] = useState(() => catOf(scan));
  const cat = CATS.find(c => c.id === catId) ?? CATS[0];
  const pickCat = (c: Cat) => { setCatId(c.id); setScan(c.scan); };
  const eaters = eatersOf(household, scan);
  // Ce que les repas cuisinés ce mois-ci ont sauvé (le détail : Ton bilan)
  const month = thisMonth(cooked);
  const saved = totalSaved(month);
  // Plus : la semaine, et le plat prévu ce soir
  const days = weekDays();
  const notifs = useNotifs();
  const [tn, setTn] = useState(false);
  const [swap, setSwap] = useState<{ i: number; meal: MealKey } | null>(null);
  const planned = isPlus ? count(week, days) : { n: 0, last: -1 };
  const plates = isPlus ? days.flatMap(d => MEALS.map(m => dayOf(week, d.key)[m])).filter(x => x && !x.left).slice(0, 3) : [];
  const tonight = isPlus && !dayOf(week, days[0].key).off ? dayOf(week, days[0].key).s : undefined;

  // Sans favori : deux recettes du dernier scan encore ouvert (moins de 7 jours en gratuit)
  const recent = history.find(e => e.recipes.length > 0 && (isPlus || daysAgo(e.date) <= 7));
  const ideas = recent ? recent.recipes.slice(0, 2) : [];

  // La cloche : les notifs non lues (« Il te reste 3 scans » ne compte plus en Plus)
  const unread = (notifs ?? []).filter(x => !x.read && !(isPlus && x.kind === "scans")).length;

  return (
    <div className="fa fa-app" aria-label="Accueil">
      <div className="ghead">
        <div className="row">
          <Avatar user={user} name={name} photo={avatar} className="avatar" label="Ta famille" onClick={() => navigate("/famille")} />
          <span className="word">Frigia</span>
          <button type="button" className="cbtn glass ib-bell" aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"} onClick={() => navigate("/notifications")}>
            <Icon name="bell" />{unread > 0 && <i className="ib-badge" aria-hidden="true">{unread > 9 ? "9+" : unread}</i>}
          </button>
        </div>
        <div className="cats">
          {CATS.map(c => <button key={c.id} type="button" className={c.id === cat.id ? "on" : undefined} aria-pressed={c.id === cat.id} onClick={() => pickCat(c)}>{c.label}</button>)}
        </div>
      </div>
      <WeekRecipes kitchen={kitchen} onOpen={onOpenRecipe} />
      <div className={"home-band" + (tonight ? " tn-has" : "")}>
        <Band label={bandLabel(user)} title={cat.title ?? (tonight ? <>Ce soir, c'est <em>prévu</em></> : <>Qu'est-ce qu'on mange <em>ce soir&nbsp;?</em></>)}>
          {cat.title ? <p>{cat.text}</p> : tonight ? (
            <button type="button" className="tn-card" onClick={() => setTn(true)}>
              <Dish recipe={tonight.recipe} className="plate" />
              <span className="tn-tx"><b>{tonight.recipe.title}</b><span className="tn-m">{tonight.recipe.time} · pour {portTxt(portionsOf(eaters, scan.guests))}</span></span>
              <span className="tn-go" aria-hidden="true"><Icon name="arrow" /></span>
            </button>
          ) : <p>Prends ton frigo en photo. Trois idées pour toute la famille, avec ce que tu as.</p>}
          <Pill tone="cream" icon="cam" onClick={openScan}>Scanner mon frigo</Pill>
          {!isPlus && <BandFoot><QuotaBar left={scansLeft(quota)} total={quotaTotal(quota)} />{quotaText(quota)}</BandFoot>}
          {isPlus && (
            <BandFoot>
              <span className="stack">{eaters.map(p => <i key={p.id}>{p.name.charAt(0).toUpperCase()}</i>)}{scan.guests > 0 && <i>+{scan.guests}</i>}</span>
              {forTonight(eaters, scan.guests)}
            </BandFoot>
          )}
        </Band>
      </div>
      <div className="hbody">
        {(saved.kg > 0 || saved.usedKg > 0) && (
          <button type="button" className="saved-card" onClick={() => (isPlus ? navigate("/bilan") : openPaywall("bilan"))}>
            <span className="ico"><Icon name="leaf" /></span>
            {/* Sauvé : ce qui était « À finir ». Sans rien de marqué, ce qui a été cuisiné de ton frigo. */}
            {saved.kg > 0
              ? <div><b>{euros(saved.eur)} sauvés en {MONTHS[new Date().getMonth()]}</b><span>{kilos(saved.kg)} de nourriture en moins à la poubelle</span></div>
              : <div><b>{kilos(saved.usedKg)} de ton frigo cuisinés en {MONTHS[new Date().getMonth()]}</b><span>Marque « À finir » au scan pour compter ce que tu sauves</span></div>}
            {isPlus ? <Icon name="next" className="muted" /> : <span className="lockpill">Aperçu</span>}
          </button>
        )}

        {community && (
          <button type="button" className="cm-line"
            onClick={() => (isPlus ? navigate("/bilan") : showToast(`Ensemble, ${cmFmt(community.kg)} kg de nourriture en moins à la poubelle`))}>
            <span className="cm-ic"><Icon name="users" /></span>
            <span><b>{cmFmt(community.kg)} kg</b> sauvés par la communauté Frigia</span>
            <i className="cm-live" aria-hidden="true" />
          </button>
        )}

        <div className="sec"><h3>Ta semaine</h3>{!isPlus && <LockPill />}</div>
        <button type="button" className="week" onClick={() => (isPlus ? navigate("/planning") : openPaywall("planning", "/planning"))}>
          <span className="pl3">
            {plates.length ? plates.map(sl => sl && <Dish key={sl.recipe.title} recipe={sl.recipe} className="plate" />) : <>
              <img className="plate" src="/landing/pasta-legumes.jpg" alt="" />
              <img className="plate" src="/landing/soupe-detox.jpg" alt="" />
              <img className="plate" src="/landing/wrap-proteine.jpg" alt="" />
            </>}
          </span>
          <div className="tx"><b>{!isPlus ? "Prévois tes 5 prochains repas" : planned.n
            ? `${planned.n} repas prêt${planned.n > 1 ? "s" : ""}${planned.last > 0 ? ` jusqu'à ${days[planned.last].long.toLowerCase()}` : ""}`
            : "Ta semaine est vide"}</b><span className="m">{history.length ? "À partir de ton scan d'hier, sans gâchis" : "À partir de ton premier scan, sans gâchis"}</span></div>
          <Icon name="next" className="muted" />
        </button>

        {/* Écart maquette : sans scan ni favori, l'accueil garde ses deux sections (comment ça marche, idées à garder) au lieu de s'arrêter à « Ta semaine » */}
        {history.length > 0 ? <>
          <div className="sec"><h3>Tes derniers scans</h3><button type="button" className="link" onClick={() => navigate("/scans")}>Tout voir</button></div>
          <div className="hist">
            {history.slice(0, 3).map(e => (
              <ScanRow key={e.id} entry={e} locked={!isPlus && daysAgo(e.date) > 7} onClick={() => (!isPlus && daysAgo(e.date) > 7 ? openPaywall("historique") : navigate(`/recettes/${e.id}`))} />
            ))}
          </div>
        </> : <>
          <div className="sec"><h3>Comment ça marche</h3><button type="button" className="link" onClick={openScan}>C'est parti</button></div>
          <div className="hist">
            {STEPS.map(st => (
              <button key={st.img} type="button" className="hrow how" onClick={openScan}>
                <img src={`/landing/${st.img}.jpg`} alt="" />
                <div><b>{st.t}</b><span>{st.p}</span></div>
                <Icon name="next" className="muted" />
              </button>
            ))}
          </div>
        </>}

        <div className="sec"><h3>Tes favoris</h3>{favorites.length > 0 && <button type="button" className="link" onClick={() => navigate("/favoris")}>Tout voir</button>}</div>
        {favorites.length > 0 ? (
          <div className="grid2">
            {favorites.slice(0, 2).map(r => <FavCard key={r.title} recipe={r} onClick={() => onOpenRecipe(r)} />)}
          </div>
        ) : ideas.length > 0 ? <>
          <p className="fav-hint">Touche <Icon name="heart" /> sur une recette pour la retrouver ici. Celles de ton dernier scan :</p>
          <div className="grid2">
            {ideas.map(r => <FavCard key={r.title} recipe={r} onClick={() => onOpenRecipe(r)} />)}
          </div>
        </> : (
          <div className="fav-empty">
            <span className="ico"><Icon name="heart" /></span>
            <div><b>Tes recettes préférées arriveront ici</b><span>Touche le cœur sur une recette pour la garder.</span></div>
          </div>
        )}
      </div>
      <AppTabBar active="home" isPlus={isPlus} />
      <TonightSheet open={tn} slot={tonight} history={history} household={household} onClose={() => setTn(false)}
        onSwap={() => { setTn(false); setTimeout(() => setSwap({ i: 0, meal: "s" }), 280); }} />
      <SwapSheet at={swap} week={week} days={days} opts={options(history, favorites)} household={household}
        setWeek={onWeek} onClose={() => setSwap(null)} />
    </div>
  );
}
