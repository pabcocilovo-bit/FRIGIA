// « C'est bien ça ? » : les ingrédients trouvés sur la photo. On retire ce qui n'y est plus, on ajoute ce qui manque,
// puis le placard, l'envie du moment et pour combien (en Plus : qui mange, et les invités).
import { useRef } from "react";
import { Navigate, useNavigate } from "react-router";
import { Chip, Chips, Icon, LockPill, RoundButton } from "../../ui/components";
import type { Envie } from "../../lib/scan";
import type { Profile } from "../../lib/profile";
import { useOpenPaywall } from "../plus/subscription";
import { getScan, MEAL_WORDS, setScan, useScan } from "./store";
import { Guide } from "./Guide";
import { INGR_GUIDE, setGuideState } from "./guideSteps";
import { portions, srvLabel } from "./portions";
import "./scan.css";

const ENVIES: [Envie, string][] = [["rapide", "Rapide"], ["healthy", "Healthy"], ["proteine", "Protéiné"], ["gourmand", "Gourmand"]];

export function Stepper({ value, label, min, max, onChange }: { value: number; label: [string, string]; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="stepper">
      <button type="button" aria-label={label[0]} onClick={() => onChange(Math.max(min, value - 1))}><Icon name="minus" /></button>
      <output>{value}</output>
      <button type="button" aria-label={label[1]} onClick={() => onChange(Math.min(max, value + 1))}><Icon name="plus" /></button>
    </div>
  );
}

/** En Plus : qui mange (pour l'instant toi seul, le foyer arrive à l'étape 10) et les invités, comptés comme des adultes. */
function Who({ name, avatar, profile }: { name: string; avatar: string | null; profile: Profile | null }) {
  const scan = useScan();
  const g = scan.guests;
  const parts = ["1 adulte", ...(g ? [`${g} invité${g > 1 ? "s" : ""}`] : [])];
  const allergies = profile?.allergies ?? [];
  const note = allergies.length ? `Allergie de ${name} (${allergies.join(", ")}) : aucune recette n'en contient.` : `Pas de contrainte ${scan.meal === "m" ? "ce midi" : scan.meal === "w" ? "cette semaine" : "ce soir"}.`;
  return (
    <div className="opt">
      <span className="label">{MEAL_WORDS[scan.meal].qui}</span>
      <div className="who">
        <button type="button" className="wm on" aria-pressed="true">
          <i className={avatar ? "has-pp" : undefined} style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>{name.charAt(0).toUpperCase()}</i>{name}
        </button>
      </div>
      <div className="gst"><span className="gst-ic"><Icon name="users" /></span><div><b>Des invités ?</b><small>Comptés comme des adultes</small></div>
        <Stepper value={g} min={0} max={8} label={["Un invité de moins", "Un invité de plus"]} onChange={n => setScan({ guests: n })} />
      </div>
      <p className="whonote"><Icon name="users" /><span><b>{parts.join(" et ")}, soit {srvLabel(true, portions(true, scan))}.</b> {note}</span></p>
    </div>
  );
}

export function Ingredients({ isPlus, name, avatar, profile, guide, userId }: {
  isPlus: boolean; name: string; avatar: string | null; profile: Profile | null; guide: boolean; userId: string;
}) {
  const navigate = useNavigate();
  const openPaywall = useOpenPaywall();
  const scan = useScan();
  const screen = useRef<HTMLElement>(null);
  if (!scan.photo && scan.ingredients.length === 0) return <Navigate to="/scan" replace />;

  const n = scan.ingredients.length;
  // Sans jeton, aucune photo n'a été lue : les ingrédients ont été tapés à la main
  const remove = (i: number) => setScan({ ingredients: getScan().ingredients.filter((_, k) => k !== i) });

  return (
    <section ref={screen} className="fa scan-screen scr-ingr" aria-label="Ingrédients trouvés">
      <div className="ingr-photo">{scan.photo && <img src={scan.photo} alt="" />}</div>
      <div className="ingr-top">
        <RoundButton icon="back" label="Reprendre la photo" tone="dark" onClick={() => navigate("/scan", { replace: true })} />
        <RoundButton icon="redo" label="Rescanner" tone="dark" onClick={() => navigate("/scan", { replace: true })} />
      </div>
      <div className="ingr-sheet">
        <div className="ingr-gh">
          <div className="grab" />
          <span className="label">{n} ingrédient{n > 1 ? "s" : ""} {scan.token ? "trouvé" : "ajouté"}{n > 1 ? "s" : ""}</span>
          <h2>C'est bien <em>ça&nbsp;?</em></h2>
          <p>Retire ce qui n'y est plus, ajoute ce qui manque.</p>
        </div>
        <div className="scroll">
          <div className="ingr-body">
            {n > 0 && (
              <div className="ilist">
                {scan.ingredients.map((it, i) => (
                  <div key={it.name + i} className="irow">
                    <i /><b>{it.name}</b><span>{it.qty}</span>
                    <button type="button" className="rm" aria-label={`Retirer ${it.name}`} onClick={() => remove(i)}><Icon name="x" /></button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="add" onClick={() => navigate("/scan/ajouter")}><span className="rm"><Icon name="plus" /></span>Ajouter un ingrédient</button>
            <div className="toggle-row">
              <div><b>Inclure mon placard</b><span>Pâtes, riz, huile, ail, épices</span></div>
              <button type="button" className="sw" role="switch" aria-checked={scan.pantry} aria-label="Inclure mon placard" onClick={() => setScan({ pantry: !scan.pantry })} />
            </div>
            <div className="opt">
              <span className="label">Envie de</span>
              <Chips>{ENVIES.map(([e, label]) => <Chip key={e} className="light" on={scan.envie === e} onClick={() => setScan({ envie: e })}>{label}</Chip>)}</Chips>
            </div>
            {isPlus ? <Who name={name} avatar={avatar} profile={profile} /> : (
              <div className="opt">
                <div className="forrow"><b>Pour combien ?</b>
                  <Stepper value={scan.servings} min={1} max={8} label={["Moins", "Plus"]} onChange={s => setScan({ servings: s })} />
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
        <button type="button" className="gobar" disabled={n === 0} onClick={() => navigate("/scan/preparation")}>
          <span><b>Voir mes 3 recettes</b><small>Pour {srvLabel(isPlus, portions(isPlus, scan))}</small></span>
          <span className="go"><Icon name="arrow" /></span>
        </button>
      </div>
      {guide && n > 0 && (
        <Guide host={screen} steps={INGR_GUIDE} delay={620}
          onDone={() => setGuideState(userId, "done")} onSkip={() => setGuideState(userId, "done")} />
      )}
    </section>
  );
}
