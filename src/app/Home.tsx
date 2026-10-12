// 1 · Accueil (prototype V3).
import { useState } from "react";
import { useNavigate } from "react-router";
import { Band, Icon, LockPill, Pill, RoundButton } from "../ui/components";
import type { GeneratedRecipe, HistoryEntry, User } from "../lib/types";
import { AppTabBar } from "./AppTabBar";
import { bandLabel, daysAgo, initial, plural, scanWhen } from "./format";
import { useOpenScan } from "./offline";
import { useRecipePhoto } from "./photo";
import { comingSoon } from "./toast";

const CATS = ["Ce soir", "Rapide", "Les enfants adorent", "Anti-gaspi", "Batch cooking"];

export function Avatar({ user, photo, className, onClick, label }: {
  user: User; photo: string | null; className: string; onClick?: () => void; label: string;
}) {
  const style = photo ? { backgroundImage: `url(${photo})` } : undefined;
  return onClick
    ? <button type="button" className={className + (photo ? " has-pp" : "")} style={style} aria-label={label} onClick={onClick}>{initial(user)}</button>
    : <span className={className + (photo ? " has-pp" : "")} style={style} role="img" aria-label={label}>{initial(user)}</span>;
}

function ScanRow({ entry, locked, onClick }: { entry: HistoryEntry; locked: boolean; onClick: () => void }) {
  const first = entry.recipes[0];
  const photo = useRecipePhoto(first?.title, first?.imageSearch);
  return (
    <button type="button" className={"hrow" + (locked ? " old blur" : "")} onClick={onClick}>
      {photo ? <img src={photo} alt="" /> : <span style={{ width: 46, height: 46, borderRadius: 12, background: "var(--surface)", flex: "none" }} />}
      <div><b>{scanWhen(entry.date)}</b><span>{plural(entry.ingredients.length, "ingrédient")} · {plural(entry.recipes.length, "recette")}</span></div>
      {locked ? <LockPill /> : <Icon name="next" className="muted" />}
    </button>
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

export function Home({ user, isPlus, avatar, history, favorites, onOpenRecipe }: {
  user: User; isPlus: boolean; avatar: string | null; history: HistoryEntry[]; favorites: GeneratedRecipe[];
  onOpenRecipe: (r: GeneratedRecipe) => void;
}) {
  const navigate = useNavigate();
  const openScan = useOpenScan();
  const [cat, setCat] = useState(CATS[0]);

  return (
    <div className="fa fa-app" aria-label="Accueil">
      <div className="ghead">
        <div className="row">
          <Avatar user={user} photo={avatar} className="avatar" label="Ta famille" onClick={() => navigate("/famille")} />
          <span className="word">Frigia</span>
          <RoundButton icon="bell" label="Notifications" tone="glass" onClick={() => comingSoon(12)} />
        </div>
        <div className="cats">
          {CATS.map(c => <button key={c} type="button" className={c === cat ? "on" : undefined} onClick={() => setCat(c)}>{c}</button>)}
        </div>
      </div>
      <div className="hphoto"><img src="/landing/gratin-courgettes.jpg" alt="Gratin de courgettes doré dans un plat blanc" /></div>
      <div className="home-band">
        <Band label={bandLabel(user)} title={<>Qu'est-ce qu'on mange <em>ce soir&nbsp;?</em></>}>
          <p>Prends ton frigo en photo. Trois idées pour toute la famille, avec ce que tu as.</p>
          <Pill tone="cream" icon="cam" onClick={openScan}>Scanner mon frigo</Pill>
        </Band>
      </div>
      <div className="hbody">
        <div className="sec"><h3>Ta semaine</h3>{!isPlus && <LockPill />}</div>
        <button type="button" className="week" onClick={() => navigate("/planning")}>
          <span className="pl3">
            <img className="plate" src="/landing/pasta-legumes.jpg" alt="" />
            <img className="plate" src="/landing/soupe-detox.jpg" alt="" />
            <img className="plate" src="/landing/wrap-proteine.jpg" alt="" />
          </span>
          <div className="tx"><b>{isPlus ? "Ta semaine est vide" : "Prévois tes 5 prochains repas"}</b><span className="m">À partir de ton scan d'hier, sans gâchis</span></div>
          <Icon name="next" className="muted" />
        </button>

        {history.length > 0 && <>
          <div className="sec"><h3>Tes derniers scans</h3><button type="button" className="link" onClick={() => navigate("/scans")}>Tout voir</button></div>
          <div className="hist">
            {history.slice(0, 3).map(e => (
              <ScanRow key={e.id} entry={e} locked={!isPlus && daysAgo(e.date) > 7} onClick={() => (!isPlus && daysAgo(e.date) > 7 ? comingSoon(5) : navigate("/scans"))} />
            ))}
          </div>
        </>}

        {favorites.length > 0 && <>
          <div className="sec"><h3>Tes favoris</h3><button type="button" className="link" onClick={() => navigate("/favoris")}>Tout voir</button></div>
          <div className="grid2">
            {favorites.slice(0, 2).map(r => <FavCard key={r.title} recipe={r} onClick={() => onOpenRecipe(r)} />)}
          </div>
        </>}
      </div>
      <AppTabBar active="home" isPlus={isPlus} />
    </div>
  );
}
