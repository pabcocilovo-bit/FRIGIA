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
import { isEn, t } from "../../lib/i18n";
import "./beta.css";

// Les réponses restent gardées en français (le tableau de bord les compte telles quelles) : en anglais, seul l'affichage change.
const EN: Record<string, string> = {
  "Scanner mon frigo ou mes placards": "Scanning my fridge or cupboards", "Le scan du frigo": "The fridge scan",
  "Scanner un ticket de caisse": "Scanning a receipt", "Le scan des tickets": "The receipt scan",
  "Les recettes proposées": "The suggested recipes", "Chercher un plat dans Explorer": "Searching for a dish in Explore", "Explorer": "Explore",
  "Ma cuisine, ce que j'ai chez moi": "My kitchen, what I have at home", "Ma cuisine": "My kitchen",
  "Le planning des repas": "The meal plan", "Le planning": "The plan", "La liste de courses": "The shopping list",
  "Mon foyer, les profils de la famille": "My household, the family profiles", "Mon foyer": "My household",
  "Rien pour l'instant": "Nothing for now",
  "Simple, sans souci": "Easy, no trouble", "Simple, avec un petit bug": "Easy, with a small bug", "Parfois compliqué": "Sometimes complicated", "Un bug m'a empêché d'avancer": "A bug stopped me",
  "Si Frigia n'existait plus demain, ça te manquerait ?": "If Frigia disappeared tomorrow, would you miss it?",
  "Beaucoup": "A lot", "Un peu": "A little", "Pas vraiment": "Not really",
  "Qu'est-ce que tu as utilisé ?": "What did you use?",
  "La reconnaissance des aliments a-t-elle été fiable ?": "Was the food recognition reliable?",
  "Oui, presque toujours": "Yes, almost always", "Oui, avec quelques erreurs": "Yes, with a few mistakes", "Non, trop d'erreurs": "No, too many mistakes",
  "Les recettes étaient-elles adaptées à tes ingrédients et à tes envies ?": "Did the recipes suit your ingredients and what you felt like?",
  "Oui, très bien": "Yes, very well", "Plutôt oui": "Mostly yes", "Non, pas du tout": "No, not at all",
  "Utiliser Frigia, c'était…": "Using Frigia was…",
  "Qu'est-ce qui t'a le plus donné envie de revenir ?": "What made you want to come back most?",
  "Frigia Plus coûtera 6,99 € par mois, ou 39,99 € par an. Tu trouves ça…": "Frigia Plus will cost €6.99 a month, or €39.99 a year. You find that…",
  "Trop cher": "Too expensive", "Correct": "Fair", "Pas cher": "Cheap",
  "Qu'est-ce qu'on devrait améliorer en priorité ?": "What should we improve first?",
  "Dis-nous franchement ce qui t'a déçu, ce qui manque ou ce qui pourrait être mieux…": "Tell us honestly what disappointed you, what's missing or what could be better…",
};
const tr = (s: string) => (isEn ? EN[s] ?? s : s);

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
      showToast(t("Tes réponses ne sont pas parties. Réessaie dans un instant", "Your answers weren't sent. Try again in a moment"));
    } finally { setBusy(false); }
  };
  const next = () => { if (!ok || busy) return; if (last) void send(); else setI(i + 1); };

  // Toujours « sur 8 » : une question qui saute fait avancer le numéro d'autant
  const n = ALL.indexOf(step.id) + 1;
  const pct = done ? 100 : Math.round((n / ALL.length) * 100);
  return (
    <div className="fa fa-app" aria-label={t("Ton avis compte", "Your feedback counts")}>
      <GreenHead title={t("Ton avis compte", "Your feedback counts")} sub={done ? t("Terminé", "Done") : t(`Question ${n} sur ${ALL.length} · environ 2 minutes`, `Question ${n} of ${ALL.length} · about 2 minutes`)}>
        <div className="av-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("Avancement", "Progress")}><i style={{ width: `${pct}%` }} /></div>
      </GreenHead>

      {done ? (
        <div className="v3-body av-body av-done">
          <span className="av-ok" aria-hidden="true"><Icon name="check" /></span>
          <h2>{t("Merci pour ton retour !", "Thanks for your feedback!")}</h2>
          <p>{t("Tes réponses nous aident à améliorer Frigia avant son lancement. Si tu connais quelqu'un à qui ça plairait, fais-le-lui découvrir.", "Your answers help us improve Frigia before launch. If you know someone who'd like it, tell them about it.")}</p>
          <Pill block icon="gift" onClick={() => navigate("/parrainage", { replace: true })}>{t("Inviter un ami", "Invite a friend")}</Pill>
          <TextLink onClick={() => navigate("/", { replace: true })}>{t("Retour à l'accueil", "Back to home")}</TextLink>
        </div>
      ) : (
        <div className="v3-body av-body" key={step.id}>
          <h2 className="av-q">{tr(step.q)}</h2>
          {step.kind === "many" && <p className="av-hint">{t("Plusieurs réponses possibles", "Several answers possible")}</p>}

          {step.kind === "one" && (
            <div className="av-opts" role="radiogroup" aria-label={tr(step.q)}>
              {step.opts.map(o => (
                <button key={o} type="button" role="radio" aria-checked={one[step.id] === o} className={"av-opt" + (one[step.id] === o ? " on" : "")}
                  onClick={() => setOne(a => ({ ...a, [step.id]: o }))}>
                  <span className="av-dot" aria-hidden="true" />{tr(o)}
                </button>
              ))}
            </div>
          )}
          {step.kind === "many" && (
            <div className="av-opts" role="group" aria-label={tr(step.q)}>
              {FEATURES.map(([k, label]) => (
                <button key={k} type="button" role="checkbox" aria-checked={used.includes(k)} className={"av-opt" + (used.includes(k) ? " on" : "")} onClick={() => toggle(k)}>
                  <span className="av-box" aria-hidden="true">{used.includes(k) && <Icon name="check" />}</span>{tr(label)}
                </button>
              ))}
            </div>
          )}
          {askDetail && (
            <label className="av-more">{t("Raconte-nous ce qui s'est passé", "Tell us what happened")}
              <textarea rows={3} placeholder={t("Ce que tu faisais, ce qui a coincé… (facultatif)", "What you were doing, what got stuck… (optional)")} value={text.usage ?? ""} onChange={e => setText(x => ({ ...x, usage: e.target.value }))} />
            </label>
          )}
          {step.kind === "text" && <>
            <textarea className="av-text" rows={5} placeholder={tr(step.ph)} aria-label={tr(step.q)} value={text[step.id] ?? ""} onChange={e => setText(x => ({ ...x, [step.id]: e.target.value }))} />
            <p className="av-hint">{t("Réponse facultative", "Optional answer")}</p>
          </>}

          <div className="av-nav">
            <Pill tone="line" disabled={i === 0} onClick={() => setI(i - 1)}>{t("Retour", "Back")}</Pill>
            <Pill disabled={!ok || busy} className={busy ? "loading" : undefined} onClick={next}>{last ? t("Envoyer", "Send") : t("Suivant", "Next")}<Icon name="arrow" /></Pill>
          </div>
        </div>
      )}
    </div>
  );
}
