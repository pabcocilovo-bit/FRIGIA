// « Qu'est-ce qu'on cuisine ? » : après « C'est bien ça ? » (scan, ou « Que cuisiner avec ? » de Ma cuisine, ou frigo vide).
// Le menu (3 plats, 2 plats et 1 dessert…, la semaine en Plus), l'envie du moment, les placards et pour combien.
// Puis seulement, les recettes. Demandé par Hugo le 21 octobre, à la place de « Plat / Dessert » sur la caméra
// et des envies en haut de l'accueil.
import { useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router";
import { Chip, Chips, Icon, LockPill, RoundButton } from "../../ui/components";
import type { IconName } from "../../ui/icons";
import type { Envie } from "../../lib/scan";
import type { Fridge } from "../../lib/home";
import { type Person, whoNote, whoParts } from "../../lib/household";
import { useOpenPaywall } from "../plus/subscription";
import { madeKey, MAX_GUESTS, MEAL_WORDS, mealOf, menuOf, MENUS, type MenuId, setScan, sideChoices, sidesOf, toggleSide, useScan } from "./store";
import { pantryOf } from "../../lib/fridge";
import { same } from "../../lib/shopping";
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

export function Menu({ isPlus, household, avatar, kitchen }: {
  isPlus: boolean; household: Person[]; avatar: string | null;
  /** Ma cuisine : ce qu'il y a vraiment dans les placards */
  kitchen: Fridge;
}) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const scan = useScan();
  // La semaine est dans Plus : sans Plus, on repart sur 3 plats. Midi ou soir suit l'heure (puis « Pour quand ? »).
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
  const sides = sideChoices(scan), sidesOn = sidesOf(kitchen, scan);
  // Le reste des placards de Ma cuisine (hors pastilles) part aussi : on le dit en une ligne
  const others = pantryOf(kitchen, scan.ingredients).filter(x => !sides.some(([n]) => same(n, x.name))).map(x => x.name);
  const pick = (id: MenuId) => {
    if (menuOf(id).plus && !isPlus) { openPaywall("planning"); return; }
    // Des plats : on garde « ce midi » ou « ce soir » s'il était choisi
    setScan({ menu: id, meal: id !== "semaine" && id !== "desserts" && (scan.meal === "m" || scan.meal === "s") ? scan.meal : mealOf(id) });
  };
  // Mêmes choix que les recettes déjà créées : on les rouvre (pas de nouveau scan, pas de nouvel appel)
  const again = scan.made?.key === madeKey(scan) ? scan.made.id : null;

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
            {(scan.meal === "m" || scan.meal === "s") && (
              <div className="opt">
                <span className="label">Pour quand ?</span>
                <Chips>{(["m", "s"] as const).map(m => <Chip key={m} className="light" on={scan.meal === m} onClick={() => setScan({ meal: m })}>{m === "m" ? "Ce midi" : "Ce soir"}</Chip>)}</Chips>
              </div>
            )}
            <div className="opt">
              <span className="label">Envie de</span>
              <Chips wrap>{ENVIES.map(([e, label]) => <Chip key={e} className="light" on={scan.envie === e} onClick={() => setScan({ envie: e })}>{label}</Chip>)}</Chips>
            </div>
            {/* Dans tes placards ? : les accompagnements (ou de quoi pâtisser) d'un appui, cochés s'ils sont dans Ma cuisine.
                Un scan des placards les montre déjà ; frigo vide : tous les placards partent. */}
            {scan.source !== "placard" && !empty && sides.length > 0 && (
              <div className="opt">
                <span className="label">Dans tes placards ?</span>
                <Chips wrap>{sides.map(([name, label]) => (
                  <Chip key={name} className="light" on={sidesOn.some(x => same(x, name))} onClick={() => toggleSide(kitchen, scan, name)}>{label}</Chip>
                ))}</Chips>
                {others.length > 0 && (
                  <span className="mn-note">Et le reste de tes placards : {others.slice(0, 3).join(", ")}{others.length > 3 ? ` et ${others.length - 3} autre${others.length > 4 ? "s" : ""}` : ""}.</span>
                )}
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
        <button type="button" className="gobar" onClick={() => navigate(again ? `/recettes/${again}` : "/scan/preparation")}>
          {again ? <span><b>Revoir mes recettes</b><small>Déjà prêtes, sans utiliser de scan</small></span>
            : <span><b>Créer mes {menu.n} recettes</b>
              {/* Gratuit sans photo comptée (« Que cuisiner avec ? ») : c'est ici que le scan part */}
              <small>{!isPlus && !scan.token ? "Utilise 1 scan · " : ""}Pour {srvLabel(isPlus, portions(isPlus, scan, eatersOf(household, scan)))}</small></span>}
          <span className="go"><Icon name="arrow" /></span>
        </button>
      </div>
    </section>
  );
}
