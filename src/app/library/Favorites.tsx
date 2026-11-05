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
import { timeText } from "../../lib/recipes";
import { t } from "../../lib/i18n";

type Filter = "" | "frigo" | "enfants" | "rapide" | "vege";
// « Les enfants adorent » : en Plus, avec le foyer
const FILTERS: [Filter, string][] = [["", t("Récents", "Recent")], ["frigo", t("Avec mon frigo", "With my fridge")], ["enfants", t("Les enfants adorent", "Kids love it")],
  ["rapide", t("Moins de 20 min", "Under 20 min")], ["vege", t("Végé", "Veggie")]];

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
            <span className="fv-meta">{timeText(recipe.time)}{recipe.veg ? t(" · Végé", " · Veggie") : ""}</span>
            {serves ? <span className="fv-pill"><Icon name="users" /><span>{srvLabel(true, serves)}</span></span> : null}
          </span>
        </button>
        <button type="button" className="fv-heart" aria-label={t("Retirer des favoris", "Remove from favorites")} style={{ margin: "14px 14px 0 0" }} onClick={remove}><Icon name="heart-f" /></button>
      </div>
      <div className="fv-foot">
        <span><Icon name={origin.plan ? "cal" : origin.scan ? "cam" : "clock"} /><i>{origin.text}</i></span>
        {fridge ? <span className="fv-tag ok">{t("Tu as tout", "You have everything")}</span> : isPlus && recipe.kids ? <span className="fv-tag">{t("Les enfants adorent", "Kids love it")}</span> : null}
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
    <div className="fa fa-app" aria-label={t("Tes favoris", "Your favorites")}>
      <ScreenHeader
        title={t(<>Tes <em>favoris</em></>, <>Your <em>favorites</em></>)}
        sub={n ? t(`${plural(n, "recette")} gardée${n > 1 ? "s" : ""}`, `${plural(n, "recette", "recipe")} saved`) : t("Aucune recette gardée", "No recipes saved")}
        left={<RoundButton icon="back" label={t("Retour", "Back")} big onClick={back} />}
        right={<RoundButton icon="cam" label={t("Nouveau scan", "New scan")} big onClick={openScan} />}>
        {n > 0 && <>
          <label className="fv-search"><Icon name="search" /><input type="search" placeholder={t("Une recette, un ingrédient…", "A recipe, an ingredient…")} autoComplete="off" aria-label={t("Chercher dans tes favoris", "Search your favorites")} value={q} onChange={e => setQ(e.target.value)} /></label>
          <div className="chips fv-chips">
            {FILTERS.filter(([f]) => isPlus || f !== "enfants").map(([f, label]) => <Chip key={f} className="fv-chip" on={filter === f} onClick={() => setFilter(f)}>{label}</Chip>)}
          </div>
        </>}
      </ScreenHeader>
      {n === 0 ? (
        <EmptyState art={<ArtRecipeBox />} title={t(<>Pas encore de <em>favori</em></>, <>No <em>favorites</em> yet</>)}
          text={t("Touche le cœur sur une recette : elle t'attend ici, avec ses étapes.", "Tap the heart on a recipe: it waits for you here, with its steps.")}
          action={<Pill icon="cam" onClick={openScan}>{t("Scanner mon frigo", "Scan my fridge")}</Pill>} />
      ) : (
        <div className="fv-list">
          {shown.length === 0
            ? <div className="fv-empty"><b>{t("Rien ici", "Nothing here")}</b>{t("Aucun favori ne correspond. Essaie un autre mot ou un autre filtre.", "No favorite matches. Try another word or filter.")}</div>
            : shown.map(r => (
              <FavCard key={r.title} recipe={r} isPlus={isPlus} fridge={fridge(r)}
                onOpen={() => (locked(r) ? openPaywall("favoris", "/favoris") : onOpen(r))}
                onRemove={() => { onToggleFavorite(r); showToast(t("Retiré de tes favoris", "Removed from your favorites")); }} />
            ))}
          {shown.some(locked) && (
            <button type="button" className="fv-lock" onClick={() => openPaywall("favoris", "/favoris")}>
              <LockPill /><span><b>{t("Garde tous tes favoris", "Keep all your favorites")}</b>{t("En gratuit, seulement ceux des 7 derniers jours.", "On the free plan, only the last 7 days.")}</span>
            </button>
          )}
        </div>
      )}
      <AppTabBar active="home" isPlus={isPlus} />
    </div>
  );
}
