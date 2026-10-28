// « Ton avis compte » : le questionnaire de la bêta (maquette de Hugo, 26 octobre, revue avec lui).
// Huit questions au plus, une par écran. Les questions sans objet sautent : rien sur le scan s'il n'a pas été
// utilisé, et « envie de revenir » ne propose que ce qui a été coché. Les réponses vont dans public.beta_feedback.
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Icon, Pill, TextLink } from "../../ui/components";
import type { User } from "../../lib/types";
import { GreenHead } from "../GreenHead";
import { showToast } from "../toast";
import { sendFeedback, type Answers } from "./survey";
import "./beta.css";

// [clé, ce qu'on coche, le nom court proposé dans « envie de revenir »]
const FEATURES: [string, string, string][] = [
  ["scan", "Scanner mon frigo ou mes placards", "Le scan du frigo"],
  ["ticket", "Scanner un ticket de caisse", "Le scan des tickets"],
  ["recettes", "Les recettes proposées", "Les recettes proposées"],
  ["explorer", "Chercher un plat dans Explorer", "Explorer"],
  ["cuisine", "Ma cuisine, ce que j'ai chez moi", "Ma cuisine"],
  ["planning", "Le planning des repas", "Le planning"],
  ["courses", "La liste de courses", "La liste de courses"],
  ["foyer", "Mon foyer, les profils de la famille", "Mon foyer"],
];
const NOTHING = "Rien pour l'instant";
// Les 8 questions dans l'ordre, pour le numéro affiché
const ALL = ["manque", "utilise", "scan", "recettes", "usage", "revenir", "prix", "ameliorer"];
const USAGE = ["Simple, sans souci", "Simple, avec un petit bug", "Parfois compliqué", "Un bug m'a empêché d'avancer"];

type Step =
  | { id: string; kind: "one"; q: string; opts: string[] }
  | { id: "utilise"; kind: "many"; q: string }
  | { id: string; kind: "text"; q: string; ph: string };

/** Les questions à poser, selon ce qui a déjà été répondu */
function stepsFor(used: string[]): Step[] {
  const has = (...k: string[]) => k.some(x => used.includes(x));
  const back = FEATURES.filter(([k]) => used.includes(k)).map(f => f[2]);
  return [
    { id: "manque", kind: "one", q: "Si Frigia n'existait plus demain, ça te manquerait ?", opts: ["Beaucoup", "Un peu", "Pas vraiment"] },
    { id: "utilise", kind: "many", q: "Qu'est-ce que tu as utilisé ?" },
    ...(has("scan", "ticket") ? [{ id: "scan", kind: "one", q: "La reconnaissance des aliments a-t-elle été fiable ?", opts: ["Oui, presque toujours", "Oui, avec quelques erreurs", "Non, trop d'erreurs"] } as Step] : []),
    ...(has("recettes", "explorer") ? [{ id: "recettes", kind: "one", q: "Les recettes étaient-elles adaptées à tes ingrédients et à tes envies ?", opts: ["Oui, très bien", "Plutôt oui", "Pas vraiment", "Non, pas du tout"] } as Step] : []),
    { id: "usage", kind: "one", q: "Utiliser Frigia, c'était…", opts: USAGE },
    { id: "revenir", kind: "one", q: "Qu'est-ce qui t'a le plus donné envie de revenir ?", opts: [...back, NOTHING] },
    { id: "prix", kind: "one", q: "Frigia Plus coûtera 6,99 € par mois, ou 39,99 € par an. Tu trouves ça…", opts: ["Trop cher", "Correct", "Pas cher"] },
    { id: "ameliorer", kind: "text", q: "Qu'est-ce qu'on devrait améliorer en priorité ?", ph: "Dis-nous franchement ce qui t'a déçu, ce qui manque ou ce qui pourrait être mieux…" },
  ];
}

export function BetaSurvey({ user }: { user: User }) {
  const navigate = useNavigate();
  const source = useSearchParams()[0].get("depuis") === "accueil" ? "accueil" : "profil";
  const [i, setI] = useState(0);
  const [one, setOne] = useState<Record<string, string>>({});
  const [used, setUsed] = useState<string[]>([]);
  const [text, setText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const steps = stepsFor(used);
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;
  // Un souci en utilisant Frigia : on demande ce qui s'est passé (facultatif)
  const askDetail = step.id === "usage" && !!one.usage && one.usage !== USAGE[0];
  const ok = step.kind === "text" || (step.kind === "many" ? used.length > 0 : !!one[step.id] && step.opts.includes(one[step.id]));

  const toggle = (k: string) => setUsed(u => (u.includes(k) ? u.filter(x => x !== k) : [...u, k]));

  const send = async () => {
    // Seulement les questions posées, avec les réponses telles qu'affichées
    const answers: Answers = {};
    for (const s of steps) {
      if (s.kind === "many") answers.utilise = FEATURES.filter(([k]) => used.includes(k)).map(f => f[1]);
      else if (s.kind === "text") { if (text[s.id]?.trim()) answers[s.id] = text[s.id].trim(); }
      else if (one[s.id]) answers[s.id] = one[s.id];
    }
    if (one.usage && one.usage !== USAGE[0] && text.usage?.trim()) answers.souci = text.usage.trim();
    setBusy(true);
    try {
      await sendFeedback(user.id, answers, source);
      setDone(true);
    } catch {
      showToast("Tes réponses ne sont pas parties. Réessaie dans un instant");
    } finally { setBusy(false); }
  };
  const next = () => { if (!ok || busy) return; if (last) void send(); else setI(i + 1); };

  // Toujours « sur 8 » : une question qui saute fait avancer le numéro d'autant
  const n = ALL.indexOf(step.id) + 1;
  const pct = done ? 100 : Math.round((n / ALL.length) * 100);
  return (
    <div className="fa fa-app" aria-label="Ton avis compte">
      <GreenHead title="Ton avis compte" sub={done ? "Terminé" : `Question ${n} sur ${ALL.length} · environ 2 minutes`}>
        <div className="av-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement"><i style={{ width: `${pct}%` }} /></div>
      </GreenHead>

      {done ? (
        <div className="v3-body av-body av-done">
          <span className="av-ok" aria-hidden="true"><Icon name="check" /></span>
          <h2>Merci pour ton retour&nbsp;!</h2>
          <p>Tes réponses nous aident à améliorer Frigia avant son lancement. Si tu connais quelqu'un à qui ça plairait, fais-le-lui découvrir.</p>
          <Pill block icon="gift" onClick={() => navigate("/parrainage", { replace: true })}>Inviter un ami</Pill>
          <TextLink onClick={() => navigate("/", { replace: true })}>Retour à l'accueil</TextLink>
        </div>
      ) : (
        <div className="v3-body av-body" key={step.id}>
          <h2 className="av-q">{step.q}</h2>
          {step.kind === "many" && <p className="av-hint">Plusieurs réponses possibles</p>}

          {step.kind === "one" && (
            <div className="av-opts" role="radiogroup" aria-label={step.q}>
              {step.opts.map(o => (
                <button key={o} type="button" role="radio" aria-checked={one[step.id] === o} className={"av-opt" + (one[step.id] === o ? " on" : "")}
                  onClick={() => setOne(a => ({ ...a, [step.id]: o }))}>
                  <span className="av-dot" aria-hidden="true" />{o}
                </button>
              ))}
            </div>
          )}
          {step.kind === "many" && (
            <div className="av-opts" role="group" aria-label={step.q}>
              {FEATURES.map(([k, label]) => (
                <button key={k} type="button" role="checkbox" aria-checked={used.includes(k)} className={"av-opt" + (used.includes(k) ? " on" : "")} onClick={() => toggle(k)}>
                  <span className="av-box" aria-hidden="true">{used.includes(k) && <Icon name="check" />}</span>{label}
                </button>
              ))}
            </div>
          )}
          {askDetail && (
            <label className="av-more">Raconte-nous ce qui s'est passé
              <textarea rows={3} placeholder="Ce que tu faisais, ce qui a coincé… (facultatif)" value={text.usage ?? ""} onChange={e => setText(t => ({ ...t, usage: e.target.value }))} />
            </label>
          )}
          {step.kind === "text" && <>
            <textarea className="av-text" rows={5} placeholder={step.ph} aria-label={step.q} value={text[step.id] ?? ""} onChange={e => setText(t => ({ ...t, [step.id]: e.target.value }))} />
            <p className="av-hint">Réponse facultative</p>
          </>}

          <div className="av-nav">
            <Pill tone="line" disabled={i === 0} onClick={() => setI(i - 1)}>Retour</Pill>
            <Pill disabled={!ok || busy} className={busy ? "loading" : undefined} onClick={next}>{last ? "Envoyer" : "Suivant"}<Icon name="arrow" /></Pill>
          </div>
        </div>
      )}
    </div>
  );
}
