// Inscription et connexion (prototype V3, écrans A à K) : Bienvenue, les 3 questions, Ton Frigia est prêt,
// Crée ton compte, email, code par email, connexion, mot de passe oublié, accès à la caméra.
import { useEffect, useId, useRef, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { supabase } from "../../supabase";
import { clearPendingProfile, setPendingProfile, type Profile } from "../../lib/profile";
import { Chip, Icon, Pill, RoundButton } from "../../ui/components";
import type { IconName } from "../../ui/icons";
import { DIET_NAMES, dietLabel, firstName } from "../format";
import { LOGO_SYMBOL, LOGO_WORD } from "../logo";
import { useBack } from "../nav";
import { showToast } from "../toast";
import { getSignupEmail, resetAnswers, setSignupEmail, useAnswers } from "./answers";
import { useCaptcha } from "./captcha";
import { authMessage, isEmailNotConfirmed, looksLikeEmail } from "./errors";
import { withGoogle } from "./oauth";
import { SIGNUP_OPEN, WAITLIST_URL } from "../../lib/launch";
import { checkCode, cleanCode, clearInviteCode, inviteCode, setPendingCode } from "../../lib/codes";
import { CodeSheet, type CodeProblem } from "../plus/CodeSheet";
import "./ob.css";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ─── Briques communes ────────────────────────────────────────────────────────

function Screen({ cls, label, children }: { cls: string; label: string; children: ReactNode }) {
  return <section className={cx("fa ob-screen", cls)} aria-label={label}>{children}</section>;
}

/** En-tête des questions : retour, barre de progression, petit titre, grand titre, phrase.
 *  single : une seule question modifiée depuis Famille, sans progression ni « Question 2 sur 3 ». */
function ObHead({ from, to, label, title, sub, single }: { from: number; to: number; label?: string; title?: ReactNode; sub?: ReactNode; single?: boolean }) {
  const back = useBack();
  return (
    <div className="ob-head">
      <div className="ob-row">
        <RoundButton icon="back" label="Retour" tone="glass" onClick={back} />
        {!single && <div className="ob-prog"><i style={{ "--from": `${from}%`, "--p": `${to}%` } as CSSProperties} /></div>}
      </div>
      {label && !single && <span className="label">{label}</span>}
      {title && <h2>{title}</h2>}
      {sub && <p>{sub}</p>}
    </div>
  );
}

/** Grand bouton vert en bas de l'écran : un titre, une petite ligne, une flèche. */
function GoBar({ title, sub, disabled, loading, plain, className, onClick }: {
  title: string; sub: string; disabled?: boolean; loading?: boolean; plain?: boolean; className?: string; onClick: () => void;
}) {
  return (
    <button type="button" className={cx("gobar", !plain && "ob-go", loading && "loading", className)} disabled={disabled} onClick={onClick}>
      <span><b>{title}</b><small>{sub}</small></span>
      <span className="go"><Icon name="arrow" /></span>
    </button>
  );
}

/** « Enregistrer » quand on modifie ses goûts depuis Famille : la pilule verte de la maquette (Mon compte), sans flèche. */
function SaveBar({ disabled, loading, onClick }: { disabled?: boolean; loading?: boolean; onClick: () => void }) {
  return (
    <div className="ob-save">
      <Pill block className={cx(loading && "loading")} disabled={disabled} onClick={onClick}>Enregistrer</Pill>
    </div>
  );
}

function ObField({ label, icon, hint, eye, ref, ...input }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; icon: IconName; hint?: string; eye?: boolean; ref?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="ob-field">
      <label htmlFor={id}>{label}</label>
      <div className="ob-input">
        <Icon name={icon} />
        <input id={id} ref={ref} {...input} type={eye ? (show ? "text" : "password") : input.type} />
        {eye && <button type="button" aria-label={show ? "Cacher le mot de passe" : "Afficher le mot de passe"} onClick={() => setShow(s => !s)}><Icon name="eye" /></button>}
      </div>
      {hint && <span className="ob-hint">{hint}</span>}
    </div>
  );
}

/** Les 6 cases du code reçu par email. Un vrai champ invisible par-dessus reçoit la saisie (et le code proposé par le téléphone). */
export function CodeBoxes({ value, onChange, state, inputRef }: {
  value: string; onChange: (v: string) => void; state: "ok" | "bad" | null; inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className={cx("ob-code", state)}>
      {Array.from({ length: 6 }, (_, i) => <span key={i} className={i === value.length && state !== "ok" ? "cur" : undefined}>{value[i] ?? ""}</span>)}
      <input
        ref={inputRef} value={value} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="Code à 6 chiffres"
        disabled={state === "ok"} onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />
    </div>
  );
}

/** « Renvoyer dans 30 s », puis « Renvoyer le code ». */
function useCountdown() {
  const [left, setLeft] = useState(30);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, label: left > 0 ? `Renvoyer dans ${left} s` : "Renvoyer le code", restart: () => setLeft(30) };
}

// ─── A · Bienvenue (appli installée) ─────────────────────────────────────────

export function Welcome() {
  const navigate = useNavigate();
  return (
    <Screen cls="scr-welcome" label="Bienvenue">
      <div className="ob-wphoto"><img src="/landing/frigo.jpg" alt="" /></div>
      <div className="ob-wtop"><span className="ob-wlogo" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL + LOGO_WORD }} /></div>
      <div className="band ob-wband">
        <span className="label">Bienvenue</span>
        <h2>Une photo du frigo, <em>trois idées</em> pour ce soir.</h2>
        <ol className="ob-how">
          <li><span><Icon name="cam" /></span>Tu prends ton frigo en photo</li>
          <li><span><Icon name="sparkle" /></span>Frigia te propose trois recettes</li>
          <li><span><Icon name="pot" /></span>Tu cuisines avec ce que tu as</li>
        </ol>
        <Pill tone="cream" block onClick={() => { resetAnswers(); navigate("/questions/1"); }}>Commencer</Pill>
        <button type="button" className="ob-login" onClick={() => { clearPendingProfile(); navigate("/connexion"); }}>J'ai déjà un compte</button>
        <p className="ob-free">7 jours d'essai, sans carte bancaire</p>
      </div>
    </Screen>
  );
}

/** Une seule question ouverte depuis une ligne de « Tes goûts » (Famille) : on enregistre tout de suite. */
const isSingle = (state: unknown) => !!(state as { only?: boolean } | null)?.only;

// ─── B · Objectif ────────────────────────────────────────────────────────────

const GOALS: { v: string; icon: IconName; t: string; s: string }[] = [
  { v: "gaspi", icon: "leaf", t: "Moins jeter", s: "Finir ce qui traîne dans le frigo" },
  { v: "temps", icon: "clock", t: "Gagner du temps le soir", s: "Savoir vite quoi faire à manger" },
  { v: "sain", icon: "salad", t: "Manger plus sain", s: "Plus de fait maison, moins de tout prêt" },
  { v: "budget", icon: "cart", t: "Dépenser moins", s: "Moins de courses en plus" },
  { v: "idees", icon: "sparkle", t: "Sortir de la routine", s: "Changer des pâtes au beurre" },
];
const GOAL_TIP: Record<string, string> = {
  gaspi: "Bonne idée. Frigia part de ce qui est déjà dans ton frigo, et ce qui se garde le moins passe en premier.",
  temps: "C'est noté. Les recettes rapides passeront devant.",
  sain: "C'est noté. Les recettes équilibrées passeront devant, avec les calories affichées.",
  budget: "Bien vu. Cuisiner ce que tu as déjà, c'est moins de courses en plus.",
  idees: "Parfait. Chaque photo du frigo donne trois idées différentes.",
};

function Tip({ text }: { text: string }) {
  return <div className={cx("ob-tip", text && "on")}><Icon name="sparkle" /><p>{text}</p></div>;
}

function Option({ on, icon, title, sub, onClick }: { on: boolean; icon: IconName; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" className={cx("ob-oc", on && "on")} aria-pressed={on} onClick={onClick}>
      <span className="ob-ic"><Icon name={icon} /></span>
      <span className="tx"><b>{title}</b><small>{sub}</small></span>
      <span className="ob-ck"><Icon name="check" /></span>
    </button>
  );
}

export function QGoal() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [a, patch] = useAnswers();
  const [tip, setTip] = useState("");
  const toggle = (v: string) => {
    const on = !a.goals.includes(v);
    const goals = on ? [...a.goals, v] : a.goals.filter(g => g !== v);
    patch({ goals });
    setTip(on ? GOAL_TIP[v] : goals.length ? GOAL_TIP[goals[goals.length - 1]] : "");
  };
  return (
    <Screen cls="ob" label="Ton objectif">
      <ObHead from={0} to={15} label="Question 1 sur 3" title={<>Qu'est-ce qui compte <em>le plus</em> ?</>} sub="Choisis tout ce qui te parle." />
      <div className="scroll"><div className="ob-body">
        <div className="ob-opts">
          {GOALS.map(g => <Option key={g.v} on={a.goals.includes(g.v)} icon={g.icon} title={g.t} sub={g.s} onClick={() => toggle(g.v)} />)}
        </div>
        <Tip text={tip} />
      </div></div>
      <GoBar title="Continuer" sub={a.goals.length ? `${a.goals.length} choix` : "Choisis au moins une réponse"} disabled={!a.goals.length} onClick={() => navigate("/questions/2", { state })} />
    </Screen>
  );
}

// ─── C · Régime et allergies ─────────────────────────────────────────────────

const DIET_TILES: { v: string; icon: IconName }[] = [
  { v: "tout", icon: "utensils" }, { v: "vege", icon: "leaf" }, { v: "vegan", icon: "sprout" },
  { v: "pesce", icon: "fish" }, { v: "gluten", icon: "wheat" }, { v: "lactose", icon: "milk" },
];
const ALLERGIES: [string, string][] = [
  ["arachides", "Arachides"], ["fruits à coque", "Fruits à coque"], ["œufs", "Œufs"], ["lait", "Lait"],
  ["poisson", "Poisson"], ["crustacés", "Crustacés"], ["soja", "Soja"], ["sésame", "Sésame"],
];
const VEG = ["vege", "vegan", "pesce"];

export function QDiet({ onSave }: { onSave?: (p: Profile) => Promise<void> }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const single = !!onSave && isSingle(state);
  const [a, patch] = useAnswers();
  const [saving, setSaving] = useState(false);
  const diet = a.diet.length ? a.diet : ["tout"];

  // « De tout » exclut le reste ; végétarien, vegan et pescétarien s'excluent entre eux
  const tile = (v: string) => {
    let next: string[];
    if (v === "tout") next = ["tout"];
    else if (diet.includes(v)) next = diet.filter(d => d !== v);
    else next = [...diet.filter(d => d !== "tout" && !(VEG.includes(v) && VEG.includes(d))), v];
    patch({ diet: next.length ? next : ["tout"] });
  };
  const allergy = (v: string) => patch({ allergies: a.allergies.includes(v) ? a.allergies.filter(x => x !== v) : [...a.allergies, v] });
  const n = a.allergies.length;
  const sub = `${dietLabel(diet)} · ${!n ? "sans allergie" : n === 1 ? a.allergies[0] : `${n} allergies`}`;

  return (
    <Screen cls="ob" label="Régime alimentaire">
      <ObHead from={15} to={30} single={single} label="Question 2 sur 3" title={<>Quel est ton <em>régime alimentaire</em>&nbsp;?</>} sub="On te propose seulement des recettes qui te vont." />
      <div className="scroll"><div className="ob-body">
        <div className="ob-tiles">
          {DIET_TILES.map(t => {
            const on = diet.includes(t.v);
            return (
              <button key={t.v} type="button" className={cx("ob-tile", on && "on")} aria-pressed={on} onClick={() => tile(t.v)}>
                <span className="ob-ic"><Icon name={t.icon} /></span><b>{DIET_NAMES[t.v]}</b><span className="ob-ck"><Icon name="check" /></span>
              </button>
            );
          })}
        </div>
        <h3>Des allergies ?</h3>
        <div className="ob-chips">
          <Chip on={!n} onClick={() => patch({ allergies: [] })}>Aucune</Chip>
          {ALLERGIES.map(([v, l]) => <Chip key={v} on={a.allergies.includes(v)} onClick={() => allergy(v)}>{l}</Chip>)}
        </div>
        <p className="ob-note"><Icon name="users" /><span>Ce sont tes goûts à toi. Avec <b>Frigia Plus</b>, tu pourras régler ceux de chaque membre de la famille.</span></p>
      </div></div>
      {single && onSave
        ? <SaveBar loading={saving} onClick={async () => { setSaving(true); await onSave(a); navigate("/famille/preferences", { replace: true }); }} />
        : <GoBar title="Continuer" sub={sub} onClick={() => navigate("/questions/3", { state })} />}
    </Screen>
  );
}

// ─── D · Temps et équipement ─────────────────────────────────────────────────

const TIMES: { v: string; icon: IconName; t: string; s: string }[] = [
  { v: "15", icon: "flash", t: "Moins de 15 minutes", s: "Les soirs où tout va vite" },
  { v: "30", icon: "clock", t: "Une demi-heure", s: "Le temps d'un vrai petit plat" },
  { v: "any", icon: "cal", t: "Ça dépend des soirs", s: "Un peu de tout" },
];
const TIME_TIP: Record<string, string> = {
  "15": "Moins de 15 minutes, c'est noté. On te proposera surtout des recettes à la poêle ou sans cuisson.",
  "30": "Une demi-heure, c'est noté. Assez pour un gratin ou une soupe maison.",
  any: "C'est noté. On variera entre recettes rapides et petits plats.",
};
const NO_OVEN = "pas de four";
const EQUIPMENT: [string, string][] = [
  ["four", "Four"], ["micro-ondes", "Micro-ondes"], ["airfryer", "Airfryer"], ["Cookeo", "Cookeo"], ["Thermomix", "Thermomix"], ["Monsieur Cuisine", "Monsieur Cuisine"],
  // Seule façon de dire ce qu'on n'a pas : coché, l'IA ne propose plus rien au four (api/_ai.ts)
  [NO_OVEN, "Pas de four"],
];

/** onSave : la personne est déjà connectée (goûts à remplir, ou « Modifier » depuis Famille), on enregistre sur son compte. */
export function QTime({ onSave }: { onSave?: (p: Profile) => Promise<void> }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const edit = !!(state as { edit?: boolean } | null)?.edit;
  const single = !!onSave && isSingle(state);
  const [a, patch] = useAnswers();
  const [tip, setTip] = useState("");
  const [saving, setSaving] = useState(false);
  const time = a.weeknight_time;
  // « Four » et « Pas de four » ne vont pas ensemble
  const equip = (v: string) => patch({ equipment: a.equipment.includes(v) ? a.equipment.filter(x => x !== v)
    : [...a.equipment.filter(x => !(v === NO_OVEN && x === "four") && !(v === "four" && x === NO_OVEN)), v] });

  const next = async () => {
    if (!onSave) { navigate("/pret"); return; }
    setSaving(true);
    await onSave(a);
    navigate(edit ? "/famille/preferences" : "/", { replace: true });
  };

  return (
    <Screen cls="ob" label="Temps et équipement">
      <ObHead from={30} to={45} single={single} label="Question 3 sur 3" title={<>Le soir, tu as <em>combien de temps</em> pour&nbsp;cuisiner&nbsp;?</>} sub="Les recettes qui rentrent dans ton temps passent en premier." />
      <div className="scroll"><div className="ob-body">
        <div className="ob-opts">
          {TIMES.map(t => <Option key={t.v} on={time === t.v} icon={t.icon} title={t.t} sub={t.s} onClick={() => { patch({ weeknight_time: t.v }); setTip(TIME_TIP[t.v]); }} />)}
        </div>
        <Tip text={tip} />
        <h3>Ton équipement</h3>
        <div className="ob-chips">
          {EQUIPMENT.map(([v, l]) => <Chip key={v} on={a.equipment.includes(v)} onClick={() => equip(v)}>{l}</Chip>)}
        </div>
        <p className="ob-note"><Icon name="pot" /><span>Facultatif. Une plaque de cuisson suffit pour la plupart des recettes.</span></p>
      </div></div>
      {edit
        ? <SaveBar disabled={!time} loading={saving} onClick={next} />
        : <GoBar title="Voir mon Frigia" sub={time ? "3 questions sur 3" : "Choisis ton temps du soir"} disabled={!time} loading={saving} onClick={next} />}
    </Screen>
  );
}

// ─── E · Ton Frigia est prêt ─────────────────────────────────────────────────

/** Le résumé : seulement ce que Frigia fera vraiment des réponses (5 lignes au plus). */
function summary(a: Profile): string[] {
  const G: Record<string, string> = {
    gaspi: "Ce qui se garde le moins passe en premier", temps: "Les recettes rapides passent devant", sain: "Les recettes équilibrées passent devant",
    budget: "Des recettes avec ce que tu as déjà", idees: "Des idées qui changent à chaque photo",
  };
  let L = ["Trois recettes à chaque photo du frigo", ...a.goals.slice(0, 2).map(g => G[g]).filter(Boolean)];
  if (a.weeknight_time === "15") L.push("Prêt en moins de 15 minutes en semaine");
  if (a.weeknight_time === "30") L.push("Une demi-heure maximum en semaine");
  if (a.diet.join() !== "tout" && a.diet.length) L.push("Régime noté : " + a.diet.map(d => (DIET_NAMES[d] ?? d).toLowerCase()).join(", "));
  if (a.allergies.length) L.push("Allergies notées : " + a.allergies.join(", "));
  if (a.equipment.length) L.push("Équipement noté : " + a.equipment.join(", "));
  if (!a.goals.length && !a.weeknight_time) L = L.concat(["Ce qui se garde le moins passe en premier", "Les recettes rapides passent devant", "Une demi-heure maximum en semaine"]);
  return L.slice(0, 5);
}

export function Ready() {
  const navigate = useNavigate();
  const [a] = useAnswers();
  const [lines] = useState(() => summary(a));
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const ts = lines.map((_, i) => setTimeout(() => setShown(i + 1), 500 + i * 420));
    ts.push(setTimeout(() => setDone(true), 700 + lines.length * 420));
    return () => ts.forEach(clearTimeout);
  }, [lines]);

  return (
    <Screen cls={cx("ob scr-ready", done && "done")} label="Ton Frigia est prêt">
      <ObHead from={45} to={60} />
      <div className="ob-rbody">
        <div className="ob-plates">
          <img className="plate" src="/landing/salade-caprese.jpg" alt="" />
          <img className="plate" src="/landing/pasta-legumes.jpg" alt="" />
          <img className="plate" src="/landing/soupe-detox.jpg" alt="" />
        </div>
        <h2>{done ? <>Ton Frigia <em>est prêt</em></> : <>On prépare <em>ton Frigia</em>…</>}</h2>
        <ul className="ob-sum">
          {lines.map((l, i) => <li key={l} className={cx(i < shown && "in")}><i><Icon name="check" /></i><span>{l}</span></li>)}
        </ul>
      </div>
      <GoBar plain title="Créer mon compte" sub="7 jours d'essai, sans carte bancaire" onClick={() => { setPendingProfile(a); navigate("/compte"); }} />
    </Screen>
  );
}

// ─── F · Crée ton compte ─────────────────────────────────────────────────────
// « J'ai un code ami ou créateur » : vérifié avant de continuer (Google comme email), utilisé dès que le compte existe.
// Un lien d'invitation (frigia.fr/i/…) le préremplit.

export function Signup() {
  const navigate = useNavigate();
  const [a] = useAnswers();
  const [code, setCode] = useState(() => inviteCode() ?? "");
  const [codeOpen, setCodeOpen] = useState(() => !!inviteCode());
  const [codeOk, setCodeOk] = useState<string | null>(null);
  const [problem, setProblem] = useState<CodeProblem | null>(null);
  const [next, setNext] = useState<"google" | "email">("email");
  const [busy, setBusy] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);

  const go = (to: "google" | "email") => {
    setPendingProfile(a);
    if (to === "google") void withGoogle("signup"); else navigate("/compte/email");
  };
  // Un code tapé : on le vérifie d'abord. Refusé : la petite feuille, sans continuer.
  const start = async (to: "google" | "email") => {
    const typed = cleanCode(code);
    if (!typed) { setPendingCode(null); go(to); return; }
    setNext(to);
    setBusy(true);
    try {
      const v = await checkCode(typed);
      if (v.status !== "ok") { setProblem({ ...v, typed }); return; }
      setPendingCode(typed);
      clearInviteCode();
      setCodeOk(v.perk);
      setTimeout(() => go(to), 600);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Ça n'a pas marché. Réessaie.");
    } finally { setBusy(false); }
  };

  return (
    <Screen cls="ob" label="Crée ton compte">
      <ObHead from={60} to={72} label="Dernière étape" title={<>Crée ton <em>compte</em></>} sub="Pour garder tes réponses et lancer ton premier scan." />
      <div className="scroll"><div className="ob-body" style={{ paddingBottom: 28 }}>
        {!codeOpen
          ? <button type="button" className="ob-codetg" style={{ alignSelf: "center" }} onClick={() => { setCodeOpen(true); setTimeout(() => codeInput.current?.focus(), 50); }}><Icon name="gift" />J'ai un code ami ou créateur</button>
          : (
            <div className="ob-field">
              <label htmlFor="obCode">Code ami ou créateur (facultatif)</label>
              <div className="ob-input"><Icon name="gift" />
                <input ref={codeInput} id="obCode" autoComplete="off" autoCapitalize="characters" placeholder="Ex. MARIE" style={{ textTransform: code ? "uppercase" : "none" }}
                  value={code} onChange={e => { setCode(e.target.value); setCodeOk(null); }} />
              </div>
              {codeOk && <span className="ob-codeok"><Icon name="check" /><span>{codeOk}</span></span>}
            </div>
          )}
        <button type="button" className="ob-btn white" disabled={busy} onClick={() => void start("google")}><Icon name="google" />Continuer avec Google</button>
        <div className="ob-or">ou</div>
        <button type="button" className="ob-btn sage" disabled={busy} onClick={() => void start("email")}><Icon name="mail" />Continuer avec un email</button>
        <div className="ob-perks">
          {["7 jours pour tout essayer", "Sans carte bancaire", "Tes goûts gardés sur ton compte"].map(p => <div key={p}><i><Icon name="check" /></i>{p}</div>)}
        </div>
        <p className="ob-have">Déjà un compte ? <button type="button" onClick={() => { clearPendingProfile(); navigate("/connexion"); }}>Se connecter</button></p>
        <p className="ob-legal">En continuant, tu acceptes les <a href="/cgu">conditions d'utilisation</a> et la <a href="/confidentialite">politique de confidentialité</a>.</p>
      </div></div>
      <CodeSheet problem={problem}
        onFix={() => { setProblem(null); setTimeout(() => { codeInput.current?.focus(); codeInput.current?.select(); }, 350); }}
        onSkip={() => { setProblem(null); setCode(""); setCodeOpen(false); setPendingCode(null); clearInviteCode(); setTimeout(() => go(next), 300); }} />
    </Screen>
  );
}

// ─── G · Email et mot de passe ───────────────────────────────────────────────

export function EmailSignup() {
  const navigate = useNavigate();
  const [a] = useAnswers();
  const { widget, take } = useCaptcha();
  const [name, setName] = useState(a.first_name ?? "");
  const [email, setEmail] = useState(getSignupEmail());
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    const mail = email.trim();
    if (!looksLikeEmail(mail)) { showToast("Cet email n'a pas l'air complet."); return; }
    if (password.length < 8) { showToast("8 caractères minimum"); return; }
    setLoading(true);
    try {
      const first = name.trim();
      setPendingProfile({ ...a, first_name: first || null });
      const captchaToken = await take();
      const { data, error } = await supabase.auth.signUp({ email: mail, password, options: { data: first ? { full_name: first } : undefined, captchaToken } });
      if (error) throw error;
      setSignupEmail(mail);
      // Compte déjà créé avec cet email : Supabase ne le dit pas, il renvoie un compte sans identité
      if (data.user && !data.session && data.user.identities?.length === 0) {
        showToast("Un compte existe déjà avec cet email. Connecte-toi.");
        clearPendingProfile();
        navigate("/connexion");
        return;
      }
      // Avec une session, la confirmation par email est coupée : l'appli enchaîne seule sur la caméra
      if (!data.session) navigate("/compte/code");
    } catch (e) {
      const msg = authMessage(e);
      showToast(msg);
      if (msg.startsWith("Un compte existe")) { clearPendingProfile(); setSignupEmail(mail); navigate("/connexion"); }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen cls="ob" label="Inscription par email">
      <ObHead from={72} to={84} label="Ton compte" title={<>Avec <em>ton email</em></>} sub="Tu recevras un code pour le confirmer." />
      <form className="scroll" onSubmit={e => { e.preventDefault(); void submit(); }}><div className="ob-body">
        <ObField label="Ton prénom" icon="user" autoComplete="given-name" placeholder="Camille" value={name} onChange={e => setName(e.target.value)} />
        <ObField label="Email" icon="mail" type="email" autoComplete="email" inputMode="email" placeholder="camille@email.fr" value={email} onChange={e => setEmail(e.target.value)} />
        <ObField label="Mot de passe" icon="lock" eye autoComplete="new-password" placeholder="Ton mot de passe" hint="8 caractères minimum" value={password} onChange={e => setPassword(e.target.value)} />
        <p className="ob-robot"><Icon name="shield" />Protégé contre les robots, rien à cocher</p>
        {widget}
        <button type="submit" hidden />
      </div></form>
      <GoBar title="Créer mon compte" sub="7 jours d'essai, sans carte bancaire" loading={loading} onClick={submit} />
    </Screen>
  );
}

// ─── H · Code par email ──────────────────────────────────────────────────────

export function VerifyEmail() {
  const navigate = useNavigate();
  const email = getSignupEmail();
  const { widget, take } = useCaptcha();
  const [code, setCode] = useState("");
  const [state, setState] = useState<"ok" | "bad" | null>(null);
  const [hint, setHint] = useState("");
  const timer = useCountdown();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  const verify = async (token: string) => {
    let { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error && !/rate|too many/i.test(error.message)) ({ error } = await supabase.auth.verifyOtp({ email, token, type: "signup" }));
    if (error) { setState("bad"); setHint(authMessage(error)); setCode(""); input.current?.focus(); return; }
    // Connecté : l'appli passe seule à l'accès à la caméra
    setState("ok");
    setHint("Email confirmé.");
  };
  const resend = async () => {
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email, options: { captchaToken: await take() } });
      if (error) throw error;
      showToast("Nouveau code envoyé");
      timer.restart();
    } catch (e) { showToast(authMessage(e)); }
  };

  if (!email) return <Navigate to="/compte/email" replace />;
  return (
    <Screen cls="ob" label="Vérifie ton email">
      <ObHead from={84} to={94} label="Presque fini" title={<>Regarde <em>tes mails</em></>} sub={`On a envoyé un code à 6 chiffres à ${email}.`} />
      <div className="scroll"><div className="ob-body">
        <CodeBoxes inputRef={input} value={code} state={state} onChange={v => { setCode(v); setState(null); setHint(""); if (v.length === 6) void verify(v); }} />
        <p className="ob-codehint">{hint}</p>
        <div className="ob-links">
          <button type="button" disabled={timer.left > 0} onClick={resend}>{timer.label}</button>
          <button type="button" onClick={() => navigate("/compte/email")}>Changer d'email</button>
        </div>
        <p className="ob-note"><Icon name="mail" /><span>Rien reçu ? Regarde dans les spams ou l'onglet Promotions.</span></p>
        {/* Adresse déjà inscrite : Supabase n'envoie aucun code et ne le dit pas toujours */}
        <p className="ob-note"><Icon name="user" /><span>Déjà un compte avec cet email ? <button type="button" className="ob-inline" onClick={() => navigate("/connexion")}>Connecte-toi</button></span></p>
        {widget}
      </div></div>
    </Screen>
  );
}

// ─── I · Connexion ───────────────────────────────────────────────────────────

export function Login() {
  const navigate = useNavigate();
  const back = useBack();
  const { widget, take } = useCaptcha();
  const [email, setEmail] = useState(getSignupEmail());
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    const mail = email.trim();
    if (!looksLikeEmail(mail)) { showToast("Cet email n'a pas l'air complet."); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password, options: { captchaToken: await take() } });
      if (error) {
        // Compte créé mais email jamais confirmé : on renvoie un code et on passe à l'écran du code
        if (isEmailNotConfirmed(error)) {
          setSignupEmail(mail);
          await supabase.auth.resend({ type: "signup", email: mail, options: { captchaToken: await take() } });
          navigate("/compte/code");
          return;
        }
        throw error;
      }
      const name = firstName(data.user);
      showToast(name ? `Bon retour, ${name}` : "Bon retour");
      navigate("/", { replace: true });
    } catch (e) {
      showToast(authMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen cls="scr-login" label="Connexion">
      <div className="ob-wphoto"><img src="/landing/frigo.jpg" alt="" /></div>
      <div className="ob-wtop"><span className="ob-wlogo" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL + LOGO_WORD }} /></div>
      <div className="lm-sheet">
        <span className="grab" />
        <button type="button" className="lm-x" aria-label="Fermer" onClick={back}><Icon name="x" /></button>
        <form className="scroll" onSubmit={e => { e.preventDefault(); void submit(); }}><div className="lm-body">
          <h2>Content de te <em>revoir</em></h2>
          <button type="button" className="ob-btn white" onClick={() => void withGoogle("login")}><Icon name="google" />Continuer avec Google</button>
          <div className="ob-or">ou avec ton email</div>
          <ObField label="Email" icon="mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} />
          <ObField label="Mot de passe" icon="lock" eye autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="button" className="lm-forgot" onClick={() => navigate("/mot-de-passe", { state: { email: email.trim() } })}>Mot de passe oublié ?</button>
          <Pill type="submit" block className={cx("lm-go", loading && "loading")}>{loading ? "Connexion…" : "Se connecter"}</Pill>
          {SIGNUP_OPEN
            ? <p className="ob-have">Pas encore de compte ? <button type="button" onClick={() => { resetAnswers(); navigate("/questions/1"); }}>Créer un compte</button></p>
            : <p className="ob-have">Pas encore invité ? <button type="button" onClick={() => navigate(WAITLIST_URL)}>Rejoins la liste d'attente</button></p>}
          {widget}
        </div></form>
      </div>
    </Screen>
  );
}

// ─── K · Mot de passe oublié ─────────────────────────────────────────────────

export function Forgot() {
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const { widget, take } = useCaptcha();
  const [email, setEmail] = useState(((navState as { email?: string } | null)?.email) || getSignupEmail());
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<"ok" | "bad" | null>(null);
  const [hint, setHint] = useState("");
  const [password, setPassword] = useState("");
  const timer = useCountdown();
  const mailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  const sendCode = async () => {
    const mail = email.trim();
    await supabase.auth.resetPasswordForEmail(mail, { captchaToken: await take() }).then(({ error }) => { if (error) throw error; });
  };
  const send = async () => {
    if (busy) return;
    if (!looksLikeEmail(email)) { mailRef.current?.focus(); showToast("Entre l'email de ton compte"); return; }
    setBusy(true);
    try {
      await sendCode();
      setSent(true);
      timer.restart();
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) { showToast(authMessage(e)); } finally { setBusy(false); }
  };
  const resend = async () => {
    try { await sendCode(); showToast("Nouveau code envoyé"); timer.restart(); } catch (e) { showToast(authMessage(e)); }
  };
  const verify = async (token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "recovery" });
    if (error) { setCodeState("bad"); setHint(authMessage(error)); setCode(""); codeRef.current?.focus(); return; }
    setCodeState("ok");
    setHint("Code bon. Choisis ton nouveau mot de passe.");
    passRef.current?.focus();
  };
  const save = async () => {
    if (busy) return;
    if (codeState !== "ok") { codeRef.current?.focus(); return; }
    if (password.length < 8) { passRef.current?.focus(); showToast("8 caractères minimum"); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const name = data.user ? firstName(data.user) : "";
      showToast(name ? `Mot de passe changé. Bon retour, ${name}` : "Mot de passe changé.");
      navigate("/", { replace: true });
    } catch (e) { showToast(authMessage(e)); } finally { setBusy(false); }
  };
  const otherEmail = () => {
    setSent(false); setCode(""); setCodeState(null); setHint(""); setPassword("");
    setTimeout(() => mailRef.current?.focus(), 50);
  };

  return (
    <Screen cls={cx("ob scr-forgot", sent && "sent")} label="Mot de passe oublié">
      <div className="fg-top"><button type="button" className="fg-x" aria-label="Retour à la connexion" onClick={() => navigate("/connexion")}><Icon name="x" /></button></div>
      <div className="scroll"><div className="fg-body">
        <span className="fg-tile" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL }} />
        <form className="fg-a" onSubmit={e => { e.preventDefault(); void send(); }}>
          <h2>Mot de passe <em>oublié</em>&nbsp;?</h2>
          <p>Donne l'email de ton compte. On t'envoie un code pour en choisir un nouveau.</p>
          <div className="ob-input">
            <Icon name="mail" />
            <input ref={mailRef} type="email" autoComplete="email" inputMode="email" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <button type="button" aria-label="Effacer" onClick={() => { setEmail(""); mailRef.current?.focus(); }}><Icon name="x" /></button>
          </div>
          <Pill type="submit" block className={cx("fg-go", busy && !sent && "loading")}>{busy && !sent ? "Envoi…" : "Envoyer le code"}</Pill>
        </form>
        <form className="fg-b" onSubmit={e => { e.preventDefault(); void save(); }}>
          <h2>Un <em>nouveau</em> mot&nbsp;de&nbsp;passe</h2>
          <p>On a envoyé un code à 6 chiffres à {email.trim()}.</p>
          <CodeBoxes inputRef={codeRef} value={code} state={codeState} onChange={v => { setCode(v); setCodeState(null); setHint(""); if (v.length === 6) void verify(v); }} />
          <p className="ob-codehint">{hint}</p>
          <ObField ref={passRef} label="Nouveau mot de passe" icon="lock" eye autoComplete="new-password" placeholder="8 caractères minimum" value={password} onChange={e => setPassword(e.target.value)} />
          <Pill type="submit" block className={cx("fg-go", busy && sent && "loading")}>{busy && sent ? "Un instant…" : "Changer mon mot de passe"}</Pill>
          <div className="ob-links">
            <button type="button" disabled={timer.left > 0} onClick={resend}>{timer.label}</button>
            <button type="button" onClick={otherEmail}>Changer d'email</button>
          </div>
        </form>
        <button type="button" className="fg-back" onClick={() => navigate("/connexion")}>Retour à la connexion</button>
        {widget}
      </div></div>
    </Screen>
  );
}

// ─── J · Accès à la caméra ───────────────────────────────────────────────────

export function Camera({ onDone }: { onDone: () => void }) {
  const [asking, setAsking] = useState(false);
  const refuse = () => {
    showToast("Sans la caméra, tu pourras envoyer une photo de ta galerie");
    setTimeout(onDone, 1600);
  };
  const allow = async () => {
    if (asking) return;
    setAsking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach(t => t.stop());
      onDone();
    } catch {
      refuse();
    }
  };
  return (
    <Screen cls="scr-camera" label="Accès à la caméra">
      <div className="ob-cbody">
        <h2>Touche <em>Autoriser</em> pour scanner ton frigo</h2>
        <div className="ob-ios" role="img" aria-label="Fenêtre du téléphone qui demande l'accès à l'appareil photo">
          <div className="q"><b>« {window.location.host} » souhaite accéder à l'appareil photo</b></div>
          <div className="bt"><button type="button" onClick={refuse}>Ne pas autoriser</button><button type="button" onClick={allow}>Autoriser</button></div>
        </div>
        <div className="ob-arrow" style={{ alignSelf: "center", marginLeft: 136 }}><Icon name="arrow" /></div>
        <div className="ob-safe"><Icon name="shield" /><span>La photo sert seulement à repérer tes ingrédients. Tu pourras changer d'avis dans les réglages.</span></div>
      </div>
      <GoBar plain title="Continuer" sub="Ton premier scan t'attend" onClick={allow} />
    </Screen>
  );
}
