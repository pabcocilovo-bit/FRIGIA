import { useState } from "react";
import { Sheet } from "./Sheet";
import { ENVIES, FRIDGE, IDEAS, RECIPES, fridgeScore, quantity, type Envie, type Recipe } from "./recipes";

// Section « Avec ce frigo-là, on mange quoi ? » : le frigo de l'exemple, une envie, un nombre de personnes,
// et trois recettes qu'on peut ouvrir en entier. Le visiteur voit ce que Frigia lui donnerait vraiment.
const IMG = "/landing";
const PEOPLE = [2, 3, 4, 5];
const WHERE = { frigo: "Dans ton frigo", placard: "Placard", achat: "À acheter" };

function Meta({ r, people }: { r: Recipe; people: number }) {
  const s = fridgeScore(r);
  return (
    <div className="meta">
      <span>{r.minutes} min</span>
      <span>Pour {people}</span>
      <span className="in">{s.inFridge}/{s.total} dans ton frigo</span>
      {s.missing > 0 && <span className="miss">Manque {s.missing}</span>}
    </div>
  );
}

function RecipeSheet({ r, people, setPeople, index, cta, onStart, onClose }: {
  r: Recipe; people: number; setPeople: (n: number) => void; index: number; cta: string; onStart: () => void; onClose: () => void;
}) {
  return (
    <Sheet label={r.name} onClose={onClose} wide>
      <div className="recipe">
        <img className="rhero" src={`${IMG}/${r.photo}.jpg`} alt="" width={560} height={373} />
        <span className="k">Idée {index + 1} sur 3 · exemple</span>
        <h2>{r.name}</h2>
        <Meta r={r} people={people} />
        <div className="rhead">
          <h3>Ingrédients</h3>
          <div className="stepper" role="group" aria-label="Nombre de personnes">
            <button onClick={() => setPeople(Math.max(1, people - 1))} disabled={people <= 1} aria-label="Une personne de moins">−</button>
            <span aria-live="polite">Pour {people}</span>
            <button onClick={() => setPeople(Math.min(8, people + 1))} disabled={people >= 8} aria-label="Une personne de plus">+</button>
          </div>
        </div>
        <ul className="ings">
          {r.ings.map(i => (
            <li key={i.name}>
              <span className="name">{i.name}</span>
              <span className="qty">{quantity(i, people)}</span>
              <span className={`where ${i.where}`}>{WHERE[i.where]}</span>
            </li>
          ))}
        </ul>
        <h3>Étapes</h3>
        <ol className="steps-list">{r.steps.map(s => <li key={s}>{s}</li>)}</ol>
        <div className="rfoot">
          <p className="muted">Exemple fait avec le frigo de la photo. Avec le tien, Frigia te propose tes propres recettes.</p>
          <button className="btn btn-fill" onClick={onStart}>{cta}</button>
        </div>
      </div>
    </Sheet>
  );
}

// cta : le libellé des boutons (« Essayer avec mon frigo », ou celui de la liste d'attente)
// onStart reçoit d'où vient le clic : « essai » (bas de section) ou « recette » (fiche ouverte)
export function Tonight({ onStart, cta = "Essayer avec mon frigo" }: { onStart: (source: string) => void; cta?: string }) {
  const [envie, setEnvie] = useState<Envie>("rapide");
  const [people, setPeople] = useState(4);
  const [open, setOpen] = useState<number | null>(null);
  const ideas = IDEAS[envie].map(id => RECIPES[id]);

  return (
    <section className="tonight" id="essai">
      <div className="container">
        <div className="sh">
          <span className="k">Essaie, ici</span>
          <h2>Avec ce frigo-là, <em>on mange quoi ?</em></h2>
          <p className="lede">Voici ce que Frigia a trouvé sur la photo. Choisis une envie et le nombre de personnes, puis ouvre une recette : les quantités suivent.</p>
        </div>

        <div className="fridge">
          <img src={`${IMG}/frigo.jpg`} alt="La photo du frigo de l'exemple" width={640} height={969} loading="lazy" />
          <div>
            <span className="k">Le frigo de l'exemple · {FRIDGE.length} ingrédients repérés</span>
            <div className="chips">{FRIDGE.map(f => <span className="chip" key={f}>{f}</span>)}</div>
            <small>Plus le fond de placard : pâtes, huile, ail…</small>
          </div>
        </div>

        <form className="controls" onSubmit={e => e.preventDefault()}>
          <fieldset>
            <legend>Ce soir, plutôt</legend>
            <div className="opts">
              {ENVIES.map(([v, label]) => (
                <label key={v}><input type="radio" name="envie" value={v} checked={envie === v} onChange={() => setEnvie(v)} /><span>{label}</span></label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Pour combien</legend>
            <div className="opts">
              {PEOPLE.map(p => (
                <label key={p}><input type="radio" name="pers" value={p} checked={people === p} onChange={() => setPeople(p)} aria-label={`${p} personnes`} /><span>{p}</span></label>
              ))}
            </div>
          </fieldset>
        </form>

        <div className="cards" aria-live="polite">
          {ideas.map((r, i) => (
            // Toute la carte s'ouvre au clic ; le bouton sert au clavier et aux lecteurs d'écran
            <article className="card" key={envie + r.id} onClick={() => setOpen(i)}>
              <div className="img"><img src={`${IMG}/${r.photo}.jpg`} alt="" width={560} height={373} loading="lazy" /></div>
              <div className="body">
                <span className="k">Idée {i + 1} sur 3</span>
                <h3>{r.name}</h3>
                <Meta r={r} people={people} />
                <button className="open" onClick={e => { e.stopPropagation(); setOpen(i); }}>Voir la recette</button>
              </div>
            </article>
          ))}
        </div>
        <div className="end"><span className="note">Exemple. Avec ton frigo, les idées seront les tiennes.</span><button className="btn btn-cream" onClick={() => onStart("essai")}>{cta}</button></div>
      </div>
      {open !== null && (
        <RecipeSheet r={ideas[open]} index={open} people={people} setPeople={setPeople} cta={cta} onStart={() => { setOpen(null); onStart("recette"); }} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}
