// Les membres du foyer, chacun se retire ou revient d'un appui : « Qui mange ce soir ? » (Menu), la fiche recette et Explorer.
import type { Person } from "../../lib/household";
import "./scan.css";

export function WhoGrid({ household, away, avatar, onToggle }: {
  household: Person[]; away: string[]; avatar: string | null; onToggle: (id: string) => void;
}) {
  return (
    <div className="who">
      {household.map(p => {
        const on = !away.includes(p.id), pp = p.me && avatar;
        return (
          <button key={p.id} type="button" className={"wm" + (on ? " on" : "")} aria-pressed={on} onClick={() => onToggle(p.id)}>
            <i className={pp ? "has-pp" : undefined} style={pp ? { backgroundImage: `url(${avatar})` } : undefined}>{p.name.charAt(0).toUpperCase()}</i>{p.name}
            {p.kid && <small>{p.age} ans</small>}
          </button>
        );
      })}
    </div>
  );
}

