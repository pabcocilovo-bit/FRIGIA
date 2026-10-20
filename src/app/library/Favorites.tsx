// 1 bis · Tes favoris (prototype V3) : recherche, filtres, cartes avec leur origine.
// En Gratuit, les favoris gardés il y a plus de 7 jours sont floutés et ouvrent « Passe à Plus ».
import { useState } from "react";
import type { Fridge } from "../../lib/home";
import type { GeneratedRecipe } from "../../lib/types";
import { ArtRecipeBox } from "../../ui/art";
import { Chip, EmptyState, Icon, LockPill, Pill, RoundButton, ScreenHeader } from "../../ui/components";
import { AppTabBar } from "../AppTabBar";
import { daysAgo, favoriteOrigin, plural } from "../format";
import { useBack } from "../nav";
import { useOpenScan } from "../offline";
import { useRecipePhoto } from "../photo";
import { useOpenPaywall } from "../plus/subscription";
import { allInKitchen, minutesOf, srvLabel } from "../scan/portions";
import { showToast } from "../toast";
import "../scan/scan.css";
import "./library.css";

type Filter = "" | "frigo" | "enfants" | "rapide" | "vege";
// « Les enfants adorent » : en Plus, avec le foyer
const FILTERS: [Filter, string][] = [["", "Récents"], ["frigo", "Avec mon frigo"], ["enfants", "Les enfants adorent"], ["rapide", "Moins de 20 min"], ["vege", "Végé"]];

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const words = (r: GeneratedRecipe) => [r.title, ...(r.items?.map(i => i.name) ?? r.recipeIngredients?.map(i => i.name) ?? [])].join(" ");
const dateOf = (s?: string) => (s ? new Date(s) : null);

/** Gardé il y a plus de 7 jours : flouté en Gratuit. */
const oldFavorite = (r: GeneratedRecipe) => { const d = dateOf(r.savedAt); return !!d && daysAgo(d) > 7; };

function FavCard({ recipe, isPlus, fridge, onOpen, onRemove }: {
  recipe: GeneratedRecipe; isPlus: boolean; fridge: boolean; onOpen: () => void; onRemove: () => void;
}) {
  const photo = useRecipePhoto(recipe.title, recipe.imageSearch);
  const [gone, setGone] = useState(false);
  const old = oldFavorite(recipe);
  const origin = favoriteOrigin(dateOf(recipe.scanDate), dateOf(recipe.savedAt), undefined, recipe.fromPlan);
  const serves = recipe.savedServings ?? recipe.serves;
  const remove = () => { setGone(true); setTimeout(onRemove, 250); };
  return (
    <div className={["fv-card", old && "old", old && !isPlus && "blur", gone && "gone"].filter(Boolean).join(" ")}>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <button type="button" className="fv-main" onClick={onOpen}>
          {photo ? <img src={photo} alt="" /> : <span style={{ width: 84, height: 84, borderRadius: 18, background: "var(--surface)", flex: "none" }} />}
          <span className="tx">
            <b>{recipe.title}</b>
            <span className="fv-meta">{recipe.time}{recipe.veg ? " · Végé" : ""}</span>
            {serves ? <span className="fv-pill"><Icon name="users" /><span>{srvLabel(true, serves)}</span></span> : null}
          </span>
        </button>
        <button type="button" className="fv-heart" aria-label="Retirer des favoris" style={{ margin: "14px 14px 0 0" }} onClick={remove}><Icon name="heart-f" /></button>
      </div>
      <div className="fv-foot">
        <span><Icon name={origin.plan ? "cal" : origin.scan ? "cam" : "clock"} /><i>{origin.text}</i></span>
        {fridge ? <span className="fv-tag ok">Tu as tout</span> : isPlus && recipe.kids ? <span className="fv-tag">Les enfants adorent</span> : null}
      </div>
    </div>
  );
}

export function Favorites({ favorites, kitchen, isPlus, onOpen, onToggleFavorite }: {
  favorites: GeneratedRecipe[]; kitchen: Fridge; isPlus: boolean;
  onOpen: (r: GeneratedRecipe) => void; onToggleFavorite: (r: GeneratedRecipe) => void;
}) {
  const back = useBack();
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("");
  // « Avec mon frigo » et « Tu as tout » : tout est dans Ma cuisine (choix de Hugo le 20 octobre)
  const found = kitchen.items.map(x => ({ name: x.name }));
  const fridge = (r: GeneratedRecipe) => allInKitchen(r, found);
  const n = favorites.length;
  const query = norm(q.trim());
  const shown = favorites.filter(r =>
    (filter === "" || (filter === "frigo" ? fridge(r) : filter === "enfants" ? !!r.kids : filter === "rapide" ? minutesOf(r) < 20 : !!r.veg))
    && (!query || norm(words(r)).includes(query)));
  const locked = (r: GeneratedRecipe) => !isPlus && oldFavorite(r);

  return (
    <div className="fa fa-app" aria-label="Tes favoris">
      <ScreenHeader
        title={<>Tes <em>favoris</em></>}
        sub={n ? `${plural(n, "recette")} gardée${n > 1 ? "s" : ""}` : "Aucune recette gardée"}
        left={<RoundButton icon="back" label="Retour" big onClick={back} />}
        right={<RoundButton icon="cam" label="Nouveau scan" big onClick={openScan} />}>
        {n > 0 && <>
          <label className="fv-search"><Icon name="search" /><input type="search" placeholder="Une recette, un ingrédient…" autoComplete="off" aria-label="Chercher dans tes favoris" value={q} onChange={e => setQ(e.target.value)} /></label>
          <div className="chips fv-chips">
            {FILTERS.filter(([f]) => isPlus || f !== "enfants").map(([f, label]) => <Chip key={f} className="fv-chip" on={filter === f} onClick={() => setFilter(f)}>{label}</Chip>)}
          </div>
        </>}
      </ScreenHeader>
      {n === 0 ? (
        <EmptyState art={<ArtRecipeBox />} title={<>Pas encore de <em>favori</em></>}
          text="Touche le cœur sur une recette : elle t'attend ici, avec ses étapes."
          action={<Pill icon="cam" onClick={openScan}>Scanner mon frigo</Pill>} />
      ) : (
        <div className="fv-list">
          {shown.length === 0
            ? <div className="fv-empty"><b>Rien ici</b>Aucun favori ne correspond. Essaie un autre mot ou un autre filtre.</div>
            : shown.map(r => (
              <FavCard key={r.title} recipe={r} isPlus={isPlus} fridge={fridge(r)}
                onOpen={() => (locked(r) ? openPaywall("favoris", "/favoris") : onOpen(r))}
                onRemove={() => { onToggleFavorite(r); showToast("Retiré de tes favoris"); }} />
            ))}
          {shown.some(locked) && (
            <button type="button" className="fv-lock" onClick={() => openPaywall("favoris", "/favoris")}>
              <LockPill /><span><b>Garde tous tes favoris</b>En gratuit, seulement ceux des 7 derniers jours.</span>
            </button>
          )}
        </div>
      )}
      <AppTabBar active="home" isPlus={isPlus} />
    </div>
  );
}
