// « Qu'est-ce qu'on cuisine ? » : après « C'est bien ça ? » (scan, ou « Que cuisiner avec ? » de Ma cuisine, ou frigo vide).
// Le menu (3 plats, 2 plats et 1 dessert…, la semaine en Plus), l'envie du moment et pour combien.
// Puis « Tes placards » (Placards.tsx), et seulement après, les recettes. Demandé par Hugo le 21 octobre, à la place de « Plat / Dessert » sur la caméra
// et des envies en haut de l'accueil.
import { useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router";
import { Chip, Chips, Icon, LockPill, RoundButton } from "../../ui/components";
import type { IconName } from "../../ui/icons";
import type { Envie } from "../../lib/scan";
import { type Person, whoNote, whoParts } from "../../lib/household";
import { useOpenPaywall } from "../plus/subscription";
import { madeKey, MAX_GUESTS, MEAL_WORDS, mealOf, menuOf, MENUS, type MenuId, placardStep, setScan, useScan } from "./store";
import { Stepper } from "./Ingredients";
import { eatersOf, portions, srvLabel } from "./portions";
import "./scan.css";

const ENVIES: [Envie, string][] = [["rapide", "Rapide"], ["healthy", "Healthy"], ["proteine", "Protéiné"], ["gourmand", "Gourmand"], ["enfants", "Enfants"], ["gaspi", "Anti-gaspi"]];
const ICON: Record<MenuId, IconName> = { plats: "pan", "plats-dessert": "utensils", "plat-dessert": "salad", desserts: "sparkle", semaine: "cal" };

/** En Plus : qui mange (le foyer, chacun se retire d'un appui) et les invités, comptés comme des adultes. */
function Who({ household, avatar }: { household: Person[]; avatar: string | null }) {
  const scan = useScan();
  const g = scan.guests;
  const eaters = eatersOf(household, scan);
  const toggle = (id: string) => setScan({ away: scan.away.includes(id) ? scan.away.filter(x => x !== id) : [...scan.away, id] });
  const when = scan.meal === "m" ? "ce midi" : scan.meal === "w" ? "cette semaine" : scan.meal === "d" ? "pour le dessert" : "ce soir";
  return (
    <div className="opt">
      <span className="label">{MEAL_WORDS[scan.meal].qui}</span>
      <div className="who">
        {household.map(p => {
          const on = !scan.away.includes(p.id), pp = p.me && avatar;
          return (
            <button key={p.id} type="button" className={"wm" + (on ? " on" : "")} aria-pressed={on} onClick={() => toggle(p.id)}>
              <i className={pp ? "has-pp" : undefined} style={pp ? { backgroundImage: `url(${avatar})` } : undefined}>{p.name.charAt(0).toUpperCase()}</i>{p.name}
              {p.kid && <small>{p.age} ans</small>}
            </button>
          );
        })}
      </div>
      <div className="gst"><span className="gst-ic"><Icon name="users" /></span><div><b>Des invités ?</b><small>Comptés comme des adultes</small></div>
        <Stepper value={g} min={0} max={MAX_GUESTS} label={["Un invité de moins", "Un invité de plus"]} onChange={n => setScan({ guests: n })} />
      </div>
      <p className="whonote"><Icon name="users" /><span><b>{whoParts(eaters, g) || "Personne"}, soit {srvLabel(true, portions(true, scan, eaters))}.</b> {whoNote(eaters, when)}</span></p>
    </div>
  );
}

/** « Créer mes 3 recettes » (ou « Revoir mes recettes »), en bas du menu ou de « Tes placards ». */
export function CreateBar({ isPlus, household }: { isPlus: boolean; household: Person[] }) {
  const navigate = useNavigate();
  const scan = useScan();
  const menu = menuOf(scan.menu);
  // Mêmes choix que les recettes déjà créées : on les rouvre (pas de nouveau scan, pas de nouvel appel)
  const again = scan.made?.key === madeKey(scan) ? scan.made.id : null;
  return (
    <button type="button" className="gobar" onClick={() => navigate(again ? `/recettes/${again}` : "/scan/preparation")}>
      {again ? <span><b>Revoir mes recettes</b><small>Déjà prêtes, sans utiliser de scan</small></span>
        : <span><b>Créer mes {menu.n} recettes</b>
          {/* Gratuit sans photo comptée (« Que cuisiner avec ? ») : c'est ici que le scan part */}
          <small>{!isPlus && !scan.token ? "Utilise 1 scan · " : ""}Pour {srvLabel(isPlus, portions(isPlus, scan, eatersOf(household, scan)))}</small></span>}
      <span className="go"><Icon name="arrow" /></span>
    </button>
  );
}

export function Menu({ isPlus, household, avatar }: { isPlus: boolean; household: Person[]; avatar: string | null }) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const scan = useScan();
  // La semaine est dans Plus : sans Plus, on repart sur 3 plats. Midi ou soir suit l'heure (on planifie plus tard).
  const fixed = useRef(false);
  useEffect(() => {
    if (fixed.current) return;
    fixed.current = true;
    // Retour sur le menu après les recettes : les choix restent (« Revoir mes recettes »)
    if (scan.made) return;
    const id = scan.menu === "semaine" && !isPlus ? "plats" : scan.menu;
    setScan({ menu: id, meal: mealOf(id) });
  }, [scan.menu, scan.made, isPlus]);

  const n = scan.ingredients.length;
  const empty = isPlus && scan.empty && !n;
  if (!n && !empty) return <Navigate to="/scan" replace />;

  const menu = menuOf(scan.menu);
  const pick = (id: MenuId) => {
    if (menuOf(id).plus && !isPlus) { openPaywall("planning"); return; }
    setScan({ menu: id, meal: mealOf(id) });
  };

  return (
    <section className="fa scan-screen scr-menu" aria-label="Qu'est-ce qu'on cuisine ?">
      <div className="mn-head">
        <RoundButton icon="back" label="Retour" tone="dark" onClick={() => navigate(-1)} />
        {empty ? <span className="label">Frigo vide</span> : (
          <button type="button" className="label mn-edit" onClick={() => navigate("/scan/ingredients")}>
            {n} ingrédient{n > 1 ? "s" : ""} · <u>Modifier</u>
          </button>
        )}
        <h2>Qu'est-ce qu'on <em>cuisine&nbsp;?</em></h2>
      </div>
      <div className="mn-sheet">
        <div className="scroll">
          <div className="ingr-body">
            <div className="opt">
              <span className="label">Le menu</span>
              <div className="mn-list" role="radiogroup" aria-label="Le menu">
                {MENUS.map(m => {
                  const on = m.id === menu.id, locked = m.plus && !isPlus;
                  return (
                    <button key={m.id} type="button" role="radio" aria-checked={on} className={"mn-card" + (on ? " on" : "")} onClick={() => pick(m.id)}>
                      <span className="mn-ic"><Icon name={ICON[m.id]} /></span>
                      <span className="tx"><b>{m.label}</b><small>{m.sub}</small></span>
                      {locked ? <LockPill /> : <span className="mn-dot" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="opt">
              <span className="label">Envie de</span>
              <Chips wrap>{ENVIES.map(([e, label]) => (
                <Chip key={e} className="light" on={scan.envies.includes(e)}
                  onClick={() => setScan({ envies: scan.envies.includes(e) ? scan.envies.filter(x => x !== e) : [...scan.envies, e] })}>{label}</Chip>
              ))}</Chips>
            </div>
            {/* Zéro course : rien à acheter. Frigo vide : sans objet (on y fait une petite liste de courses). */}
            {!empty && (
              <div className="toggle-row">
                <div><b>Zéro course</b><span>Rien à acheter : seulement ton frigo et tes placards.</span></div>
                <button type="button" className="sw" role="switch" aria-checked={scan.noShop} aria-label="Zéro course" onClick={() => setScan({ noShop: !scan.noShop })} />
              </div>
            )}
            {isPlus ? <Who household={household} avatar={avatar} /> : (
              <div className="opt">
                <div className="forrow"><b>Pour combien ?</b>
                  <Stepper value={scan.servings} min={1} max={MAX_GUESTS} label={["Moins", "Plus"]} onChange={s => setScan({ servings: s })} />
                </div>
                <button type="button" className="famlock" onClick={() => openPaywall("famille")}>
                  <span className="ini"><Icon name="users" /></span>
                  <div><b>Mode famille</b><span>Les goûts de chacun, les portions calculées</span></div>
                  <LockPill />
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Puis « Tes placards » (pas après un scan des placards, ni frigo vide), ou tout de suite les recettes (et « Revoir ») */}
        {placardStep(scan) && scan.made?.key !== madeKey(scan) ? (
          <button type="button" className="gobar" onClick={() => navigate("/scan/placards")}>
            <span><b>Continuer</b><small>Et dans tes placards ?</small></span>
            <span className="go"><Icon name="arrow" /></span>
          </button>
        ) : <CreateBar isPlus={isPlus} household={household} />}
      </div>
    </section>
  );
}
