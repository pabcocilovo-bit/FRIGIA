// Inscription et connexion (prototype V3, écrans A à K) : Bienvenue, les 4 questions (la 4e, le foyer, facultative), Ton Frigia est prêt,
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
import { type FamPerson, getSignupEmail, resetAnswers, setSignupEmail, useAnswers, useFamily } from "./answers";
import { type Member, setPendingFamily } from "../../lib/home";
import { APPETITE, appetiteOf } from "../../lib/household";
import { useCaptcha } from "./captcha";
import { authMessage, isEmailNotConfirmed, JETABLE, looksLikeEmail } from "./errors";
import { withApple, withGoogle } from "./oauth";
import { Capacitor } from "@capacitor/core";
import { accessEmail, signupOpen, WAITLIST_URL } from "../../lib/launch";
import { trialPitch } from "../../lib/alpha";
import { detectInAppBrowser, openInNativeBrowser } from "../../landing/browser";
import { checkCode, cleanCode, clearInviteCode, inviteCode, setPendingCode } from "../../lib/codes";
import { CodeSheet, type CodeProblem } from "../plus/CodeSheet";
import { allergyName, ALLERGY_KEYS } from "../../lib/allergens";
import { isEn, t } from "../../lib/i18n";
import "./ob.css";

// iPhone (app) : Apple exige « Se connecter avec Apple » dès qu'une app propose Google
const APPLE = Capacitor.getPlatform() === "ios";

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
        <RoundButton icon="back" label={t("Retour", "Back")} tone="glass" onClick={back} />
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
      <Pill block className={cx(loading && "loading")} disabled={disabled} onClick={onClick}>{t("Enregistrer", "Save")}</Pill>
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
        {eye && <button type="button" aria-label={show ? t("Cacher le mot de passe", "Hide password") : t("Afficher le mot de passe", "Show password")} onClick={() => setShow(s => !s)}><Icon name="eye" /></button>}
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
        ref={inputRef} value={value} inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label={t("Code à 6 chiffres", "6-digit code")}
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
    const tm = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(tm);
  }, [left]);
  return { left, label: left > 0 ? t(`Renvoyer dans ${left} s`, `Resend in ${left} s`) : t("Renvoyer le code", "Resend the code"), restart: () => setLeft(30) };
}

// ─── A · Bienvenue (appli installée) ─────────────────────────────────────────

/** Dans l'appli Google (iPhone, Android) : on ne peut pas installer Frigia, on propose Safari ou Chrome (Hugo, 29 octobre).
 *  Le lien de la liste d'attente suit, avec son email : l'autre navigateur ne le connaît pas encore. */
function InAppBar() {
  const { isGoogleApp, isIos, isAndroid } = detectInAppBrowser();
  const [closed, setClosed] = useState(false);
  if (!isGoogleApp || !(isIos || isAndroid) || closed) return null;
  const email = accessEmail();
  const path = email ? `/acces${email !== "1" ? `?email=${encodeURIComponent(email)}` : ""}` : "/bienvenue";
  return (
    <div className="ob-gbar" role="region" aria-label={t("Ouvrir dans le navigateur", "Open in the browser")}>
      <span>{t(`Ouvre Frigia dans ${isIos ? "Safari" : "Chrome"} pour l'installer sur ton téléphone.`, `Open Frigia in ${isIos ? "Safari" : "Chrome"} to install it on your phone.`)}</span>
      <button type="button" className="go" onClick={() => openInNativeBrowser(isIos, path)}>{t("Ouvrir", "Open")}</button>
      <button type="button" className="x" onClick={() => setClosed(true)} aria-label={t("Fermer", "Close")}>✕</button>
    </div>
  );
}

export function Welcome() {
  const navigate = useNavigate();
  return (
    <Screen cls="scr-welcome" label={t("Bienvenue", "Welcome")}>
      <InAppBar />
      <div className="ob-wphoto"><img src="/landing/frigo.jpg" alt="" /></div>
      <div className="ob-wtop"><span className="ob-wlogo" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL + LOGO_WORD }} /></div>
      <div className="band ob-wband">
        <span className="label">{t("Bienvenue", "Welcome")}</span>
        <h2>{t(<>Une photo du frigo, <em>trois idées</em> pour ce soir.</>, <>One photo of your fridge, <em>three ideas</em> for tonight.</>)}</h2>
        <ol className="ob-how">
          <li><span><Icon name="cam" /></span>{t("Tu prends ton frigo en photo", "You take a photo of your fridge")}</li>
          <li><span><Icon name="sparkle" /></span>{t("Frigia te propose trois recettes", "Frigia suggests three recipes")}</li>
          <li><span><Icon name="pot" /></span>{t("Tu cuisines avec ce que tu as", "You cook with what you have")}</li>
        </ol>
        <Pill tone="cream" block onClick={() => { resetAnswers(); navigate("/questions/1"); }}>{t("Commencer", "Get started")}</Pill>
        <button type="button" className="ob-login" onClick={() => { clearPendingProfile(); navigate("/connexion"); }}>{t("J'ai déjà un compte", "I already have an account")}</button>
        <p className="ob-free">{trialPitch()}{t(", sans carte bancaire", ", no card needed")}</p>
      </div>
    </Screen>
  );
}

/** Une seule question ouverte depuis une ligne de « Tes goûts » (Famille) : on enregistre tout de suite. */
const isSingle = (state: unknown) => !!(state as { only?: boolean } | null)?.only;

// ─── B · Objectif ────────────────────────────────────────────────────────────

const GOALS: { v: string; icon: IconName; t: string; s: string }[] = [
  { v: "gaspi", icon: "leaf", t: t("Moins jeter", "Waste less"), s: t("Finir ce qui traîne dans le frigo", "Use up what's lying around in the fridge") },
  { v: "temps", icon: "clock", t: t("Gagner du temps le soir", "Save time in the evening"), s: t("Savoir vite quoi faire à manger", "Know quickly what to make") },
  { v: "sain", icon: "salad", t: t("Manger plus sain", "Eat healthier"), s: t("Plus de fait maison, moins de tout prêt", "More home-made, less ready-made") },
  { v: "budget", icon: "cart", t: t("Dépenser moins", "Spend less"), s: t("Moins de courses en plus", "Fewer extra shopping trips") },
  { v: "idees", icon: "sparkle", t: t("Sortir de la routine", "Break the routine"), s: t("Changer des pâtes au beurre", "Something other than buttered pasta") },
];
const GOAL_TIP: Record<string, string> = t({
  gaspi: "Bonne idée. Frigia part de ce qui est déjà dans ton frigo, et ce qui se garde le moins passe en premier.",
  temps: "C'est noté. Les recettes rapides passeront devant.",
  sain: "C'est noté. Les recettes équilibrées passeront devant, avec les calories affichées.",
  budget: "Bien vu. Cuisiner ce que tu as déjà, c'est moins de courses en plus.",
  idees: "Parfait. Chaque photo du frigo donne trois idées différentes.",
}, {
  gaspi: "Good idea. Frigia starts from what's already in your fridge, and what keeps least comes first.",
  temps: "Got it. Quick recipes will come first.",
  sain: "Got it. Balanced recipes will come first, with calories shown.",
  budget: "Smart. Cooking what you already have means fewer extra shopping trips.",
  idees: "Perfect. Every fridge photo gives three different ideas.",
});

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

/** signedIn : déjà connecté (goûts à remplir), trois questions seulement : pas celle du foyer, il se règle dans Mon foyer. */
export function QGoal({ signedIn }: { signedIn?: boolean }) {
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
    <Screen cls="ob" label={t("Ton objectif", "Your goal")}>
      <ObHead from={0} to={12} label={t(`Question 1 sur ${signedIn ? 3 : 4}`, `Question 1 of ${signedIn ? 3 : 4}`)} title={t(<>Qu'est-ce qui compte <em>le plus</em> ?</>, <>What matters <em>most</em>?</>)} sub={t("Choisis tout ce qui te parle.", "Pick everything that speaks to you.")} />
      <div className="scroll"><div className="ob-body">
        <div className="ob-opts">
          {GOALS.map(g => <Option key={g.v} on={a.goals.includes(g.v)} icon={g.icon} title={g.t} sub={g.s} onClick={() => toggle(g.v)} />)}
        </div>
        <Tip text={tip} />
      </div></div>
      <GoBar title={t("Continuer", "Continue")} sub={a.goals.length ? t(`${a.goals.length} choix`, `${a.goals.length} selected`) : t("Choisis au moins une réponse", "Pick at least one answer")} disabled={!a.goals.length} onClick={() => navigate("/questions/2", { state })} />
    </Screen>
  );
}

// ─── C · Régime et allergies ─────────────────────────────────────────────────

const DIET_TILES: { v: string; icon: IconName }[] = [
  { v: "tout", icon: "utensils" }, { v: "vege", icon: "leaf" }, { v: "vegan", icon: "sprout" },
  { v: "pesce", icon: "fish" }, { v: "gluten", icon: "wheat" }, { v: "lactose", icon: "milk" },
];
// Les allergies (le gluten est un régime, plus haut), gardées en français, affichées dans la langue de l'appli
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ALLERGIES: [string, string][] = ALLERGY_KEYS.filter(k => k !== "gluten").map(k => [k, capFirst(allergyName(k))]);
const VEG = ["vege", "vegan", "pesce"];
// Pour les proches : toutes les allergies, gluten compris (pas de régime à leur fiche)
const FAM_ALLERGIES: [string, string][] = ALLERGY_KEYS.map(k => [k, capFirst(allergyName(k))]);

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
  const sub = `${dietLabel(diet)} · ${!n ? t("sans allergie", "no allergies") : n === 1 ? allergyName(a.allergies[0]) : t(`${n} allergies`, `${n} allergies`)}`;

  return (
    <Screen cls="ob" label={t("Régime alimentaire", "Diet")}>
      <ObHead from={12} to={24} single={single} label={t(`Question 2 sur ${onSave ? 3 : 4}`, `Question 2 of ${onSave ? 3 : 4}`)} title={t(<>Quel est ton <em>régime alimentaire</em>&nbsp;?</>, <>What's your <em>diet</em>?</>)} sub={t("On te propose seulement des recettes qui te vont.", "We only suggest recipes that suit you.")} />
      <div className="scroll"><div className="ob-body">
        <div className="ob-tiles">
          {DIET_TILES.map(dt => {
            const on = diet.includes(dt.v);
            return (
              <button key={dt.v} type="button" className={cx("ob-tile", on && "on")} aria-pressed={on} onClick={() => tile(dt.v)}>
                <span className="ob-ic"><Icon name={dt.icon} /></span><b>{DIET_NAMES[dt.v]}</b><span className="ob-ck"><Icon name="check" /></span>
              </button>
            );
          })}
        </div>
        <h3>{t("Des allergies ?", "Any allergies?")}</h3>
        <div className="ob-chips">
          <Chip on={!n} onClick={() => patch({ allergies: [] })}>{t("Aucune", "None")}</Chip>
          {ALLERGIES.map(([v, l]) => <Chip key={v} on={a.allergies.includes(v)} onClick={() => allergy(v)}>{l}</Chip>)}
        </div>
        <p className="ob-note"><Icon name="users" /><span>{t(<>Ce sont tes goûts à toi. Avec <b>Frigia Plus</b>, tu pourras régler ceux de chaque membre de la famille.</>, <>These are your own tastes. With <b>Frigia Plus</b>, you can set them for each family member.</>)}</span></p>
      </div></div>
      {single && onSave
        ? <SaveBar loading={saving} onClick={async () => { setSaving(true); await onSave(a); navigate("/famille/preferences", { replace: true }); }} />
        : <GoBar title={t("Continuer", "Continue")} sub={sub} onClick={() => navigate("/questions/3", { state })} />}
    </Screen>
  );
}

// ─── D · Temps et équipement ─────────────────────────────────────────────────

const TIMES: { v: string; icon: IconName; t: string; s: string }[] = [
  { v: "15", icon: "flash", t: t("Moins de 15 minutes", "Under 15 minutes"), s: t("Les soirs où tout va vite", "For the hectic evenings") },
  { v: "30", icon: "clock", t: t("Une demi-heure", "Half an hour"), s: t("Le temps d'un vrai petit plat", "Time for a proper little dish") },
  { v: "any", icon: "cal", t: t("Ça dépend des soirs", "Depends on the evening"), s: t("Un peu de tout", "A bit of everything") },
];
const TIME_TIP: Record<string, string> = t({
  "15": "Moins de 15 minutes, c'est noté. On te proposera surtout des recettes à la poêle ou sans cuisson.",
  "30": "Une demi-heure, c'est noté. Assez pour un gratin ou une soupe maison.",
  any: "C'est noté. On variera entre recettes rapides et petits plats.",
}, {
  "15": "Under 15 minutes, got it. We'll mostly suggest pan or no-cook recipes.",
  "30": "Half an hour, got it. Enough for a gratin or a home-made soup.",
  any: "Got it. We'll mix quick recipes and little dishes.",
});
const NO_OVEN = "pas de four";
// [gardé en français (l'IA le lit), affiché]
const EQUIPMENT: [string, string][] = [
  ["four", t("Four", "Oven")], ["micro-ondes", t("Micro-ondes", "Microwave")], ["airfryer", t("Airfryer", "Air fryer")], ["Cookeo", "Cookeo"], ["Thermomix", "Thermomix"], ["Monsieur Cuisine", "Monsieur Cuisine"],
  // Seule façon de dire ce qu'on n'a pas : coché, l'IA ne propose plus rien au four (api/_ai.ts)
  [NO_OVEN, t("Pas de four", "No oven")],
];
const equipName = (v: string) => EQUIPMENT.find(e => e[0] === v)?.[1] ?? v;

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
    if (!onSave) { navigate("/questions/4", { state }); return; }
    setSaving(true);
    await onSave(a);
    navigate(edit ? "/famille/preferences" : "/", { replace: true });
  };

  return (
    <Screen cls="ob" label={t("Temps et équipement", "Time and equipment")}>
      <ObHead from={24} to={36} single={single} label={t(`Question 3 sur ${onSave ? 3 : 4}`, `Question 3 of ${onSave ? 3 : 4}`)} title={t(<>Le soir, tu as <em>combien de temps</em> pour&nbsp;cuisiner&nbsp;?</>, <>In the evening, <em>how much time</em> do you have to cook?</>)} sub={t("Les recettes qui rentrent dans ton temps passent en premier.", "Recipes that fit your time come first.")} />
      <div className="scroll"><div className="ob-body">
        <div className="ob-opts">
          {TIMES.map(tm => <Option key={tm.v} on={time === tm.v} icon={tm.icon} title={tm.t} sub={tm.s} onClick={() => { patch({ weeknight_time: tm.v }); setTip(TIME_TIP[tm.v]); }} />)}
        </div>
        <Tip text={tip} />
        <h3>{t("Ton équipement", "Your equipment")}</h3>
        <div className="ob-chips">
          {EQUIPMENT.map(([v, l]) => <Chip key={v} on={a.equipment.includes(v)} onClick={() => equip(v)}>{l}</Chip>)}
        </div>
        <p className="ob-note"><Icon name="pot" /><span>{t("Facultatif. Une plaque de cuisson suffit pour la plupart des recettes.", "Optional. A hob is enough for most recipes.")}</span></p>
      </div></div>
      {edit
        ? <SaveBar disabled={!time} loading={saving} onClick={next} />
        : <GoBar title={onSave ? t("Voir mon Frigia", "See my Frigia") : t("Continuer", "Continue")} sub={time ? (onSave ? t("3 questions sur 3", "3 questions of 3") : t("Plus qu'une, facultative", "One more, optional")) : t("Choisis ton temps du soir", "Pick your evening time")} disabled={!time} loading={saving} onClick={next} />}
    </Screen>
  );
}

// ─── D bis · Ton foyer (facultatif) ──────────────────────────────────────────
// Hugo, 5 novembre : le foyer dès l'inscription, sans obliger. Combien d'adultes et d'enfants (et leur âge, pour les portions) ;
// le « + » ouvre le prénom, l'appétit et les allergies de chacun. Ce qu'il n'aime pas se règle dans Mon foyer.

const FAM_MAX = 8;
const famName = (f: FamPerson[], i: number) => {
  const p = f[i], n = f.slice(0, i + 1).filter(x => x.kid === p.kid).length;
  return p.name.trim() || (p.kid ? t(`Enfant ${n}`, `Child ${n}`) : t(`Adulte ${n + 1}`, `Adult ${n + 1}`));
};
/** Les fiches de Mon foyer : un prénom par défaut (« Adulte 2 », « Enfant 1 ») quand il n'est pas donné */
const famMembers = (f: FamPerson[]): Member[] => f.map((p, i) => ({
  id: crypto.randomUUID(), name: capFirst(famName(f, i)).slice(0, 20), kid: p.kid, age: p.kid ? p.age : 0, allergies: p.allergies, dislikes: [],
  ...(p.appetite != null ? { appetite: p.appetite } : {}),
}));
const famLine = (f: FamPerson[]) => {
  const adults = 1 + f.filter(p => !p.kid).length, kids = f.filter(p => p.kid).length;
  return t(`${adults} adulte${adults > 1 ? "s" : ""}${kids ? ` et ${kids} enfant${kids > 1 ? "s" : ""}` : ""}`, `${adults} adult${adults > 1 ? "s" : ""}${kids ? ` and ${kids} child${kids > 1 ? "ren" : ""}` : ""}`);
};

function Counter({ title, sub, value, min, onChange }: { title: string; sub: string; value: number; min: number; onChange: (n: number) => void }) {
  return (
    <div className="ob-cnt">
      <span className="tx"><b>{title}</b><small>{sub}</small></span>
      <div className="stepper">
        <button type="button" aria-label={t(`Moins : ${title}`, `Fewer: ${title}`)} disabled={value <= min} onClick={() => onChange(value - 1)}><Icon name="minus" /></button>
        <output aria-live="polite">{value}</output>
        <button type="button" aria-label={t(`Plus : ${title}`, `More: ${title}`)} disabled={value >= FAM_MAX} onClick={() => onChange(value + 1)}><Icon name="plus" /></button>
      </div>
    </div>
  );
}

export function QFamily() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [fam, setFam] = useFamily();
  const [open, setOpen] = useState(() => fam.some(p => p.name || p.allergies.length));
  const adults = fam.filter(p => !p.kid).length, kids = fam.filter(p => p.kid);
  // Ajouter ou retirer garde les fiches déjà remplies (on retire la dernière de son groupe)
  const resize = (kid: boolean, n: number) => {
    const mine = fam.filter(p => p.kid === kid);
    if (n > mine.length) setFam([...fam, ...Array.from({ length: n - mine.length }, () => ({ kid, age: 6, name: "", allergies: [] }))]);
    else { const drop = new Set(mine.slice(n)); setFam(fam.filter(p => !drop.has(p))); }
  };
  const edit = (p: FamPerson, patch: Partial<FamPerson>) => setFam(fam.map(x => (x === p ? { ...x, ...patch } : x)));
  const allergy = (p: FamPerson, v: string) => edit(p, { allergies: p.allergies.includes(v) ? p.allergies.filter(x => x !== v) : [...p.allergies, v] });

  return (
    <Screen cls="ob" label={t("Ton foyer", "Your household")}>
      <ObHead from={36} to={48} label={t("Question 4 sur 4 · facultative", "Question 4 of 4 · optional")} title={t(<>Qui mange <em>avec toi</em>&nbsp;?</>, <>Who eats <em>with you</em>?</>)} sub={t("Les portions et les allergies s'adaptent à toute la table.", "Servings and allergies adapt to the whole table.")} />
      <div className="scroll"><div className="ob-body">
        <div className="ob-fam">
          <Counter title={t("Adultes", "Adults")} sub={t("Toi compris", "Including you")} value={1 + adults} min={1} onChange={n => resize(false, n - 1)} />
          <Counter title={t("Enfants", "Children")} sub={t("Moins de 18 ans", "Under 18")} value={kids.length} min={0} onChange={n => resize(true, n)} />
          {kids.map((p, i) => (
            <div key={i} className="ob-cnt ob-kid">
              <span className="tx"><b>{famName(fam, fam.indexOf(p))}</b><small>{t(`${p.age} an${p.age > 1 ? "s" : ""}`, `${p.age} year${p.age > 1 ? "s" : ""} old`)}</small></span>
              <div className="stepper">
                <button type="button" aria-label={t("Plus jeune", "Younger")} disabled={p.age <= 1} onClick={() => edit(p, { age: p.age - 1 })}><Icon name="minus" /></button>
                <button type="button" aria-label={t("Plus âgé", "Older")} disabled={p.age >= 17} onClick={() => edit(p, { age: p.age + 1 })}><Icon name="plus" /></button>
              </div>
            </div>
          ))}
        </div>
        {fam.length > 0 && (open ? <>
          <h3>{t("Prénoms, appétit et allergies", "Names, appetite and allergies")}</h3>
          {fam.map((p, i) => (
            <div key={i} className="ob-who">
              <div className="ob-input"><Icon name="user" />
                <input autoComplete="off" autoCapitalize="words" maxLength={20} placeholder={famName(fam.map(x => ({ ...x, name: "" })), i)}
                  aria-label={t("Prénom", "First name")} value={p.name} onChange={e => edit(p, { name: e.target.value })} />
              </div>
              <div className="ob-cnt ob-app">
                <span className="tx"><b>{APPETITE[appetiteOf(p) - 1].label}</b><small>{t("Appétit", "Appetite")}</small></span>
                <div className="stepper">
                  <button type="button" aria-label={t("Mange moins", "Eats less")} disabled={appetiteOf(p) <= 1} onClick={() => edit(p, { appetite: appetiteOf(p) - 1 })}><Icon name="minus" /></button>
                  <button type="button" aria-label={t("Mange plus", "Eats more")} disabled={appetiteOf(p) >= 5} onClick={() => edit(p, { appetite: appetiteOf(p) + 1 })}><Icon name="plus" /></button>
                </div>
              </div>
              <div className="ob-chips">
                <Chip on={!p.allergies.length} onClick={() => edit(p, { allergies: [] })}>{t("Sans allergie", "No allergies")}</Chip>
                {FAM_ALLERGIES.map(([v, l]) => <Chip key={v} on={p.allergies.includes(v)} onClick={() => allergy(p, v)}>{l}</Chip>)}
              </div>
            </div>
          ))}
        </> : (
          <button type="button" className="ob-more" onClick={() => setOpen(true)}><Icon name="plus" /><span>{t("Prénoms, appétit et allergies", "Names, appetite and allergies")}</span></button>
        ))}
        <p className="ob-note"><Icon name="users" /><span>{t(<>L'appétit compte dans les portions : un enfant de moins de 12 ans a un petit appétit, sauf si tu le changes. Tout se modifie dans <b>Mon profil, Mon foyer</b>.</>, <>Appetite counts in servings: a child under 12 has a small appetite unless you change it. Everything can be changed in <b>My profile, My household</b>.</>)}</span></p>
      </div></div>
      <GoBar title={t("Voir mon Frigia", "See my Frigia")} sub={fam.length ? famLine(fam) : t("Juste toi ? Continue, c'est facultatif", "Just you? Carry on, it's optional")} onClick={() => navigate("/pret", { state })} />
    </Screen>
  );
}

// ─── E · Ton Frigia est prêt ─────────────────────────────────────────────────

/** Le résumé : seulement ce que Frigia fera vraiment des réponses (5 lignes au plus). */
function summary(a: Profile, fam: FamPerson[]): string[] {
  const G: Record<string, string> = t({
    gaspi: "Ce qui se garde le moins passe en premier", temps: "Les recettes rapides passent devant", sain: "Les recettes équilibrées passent devant",
    budget: "Des recettes avec ce que tu as déjà", idees: "Des idées qui changent à chaque photo",
  }, {
    gaspi: "What keeps least comes first", temps: "Quick recipes come first", sain: "Balanced recipes come first",
    budget: "Recipes with what you already have", idees: "Ideas that change with every photo",
  });
  const low = (s: string) => (isEn ? s : s.toLowerCase());
  let L = [t("Trois recettes à chaque photo du frigo", "Three recipes with every fridge photo"), ...a.goals.slice(0, 2).map(g => G[g]).filter(Boolean)];
  if (fam.length) L.splice(1, 0, t(`Des portions pour ${famLine(fam)}`, `Servings for ${famLine(fam)}`));
  if (a.weeknight_time === "15") L.push(t("Prêt en moins de 15 minutes en semaine", "Ready in under 15 minutes on weekdays"));
  if (a.weeknight_time === "30") L.push(t("Une demi-heure maximum en semaine", "Half an hour max on weekdays"));
  if (a.diet.join() !== "tout" && a.diet.length) L.push(t("Régime noté : ", "Diet noted: ") + a.diet.map(d => low(DIET_NAMES[d] ?? d)).join(", "));
  if (a.allergies.length) L.push(t("Allergies notées : ", "Allergies noted: ") + a.allergies.map(allergyName).join(", "));
  if (a.equipment.length) L.push(t("Équipement noté : ", "Equipment noted: ") + a.equipment.map(e => low(equipName(e))).join(", "));
  if (!a.goals.length && !a.weeknight_time) L = L.concat([G.gaspi, G.temps, t("Une demi-heure maximum en semaine", "Half an hour max on weekdays")]);
  return L.slice(0, 5);
}

export function Ready() {
  const navigate = useNavigate();
  const [a] = useAnswers();
  const [fam] = useFamily();
  const [lines] = useState(() => summary(a, fam));
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const ts = lines.map((_, i) => setTimeout(() => setShown(i + 1), 500 + i * 420));
    ts.push(setTimeout(() => setDone(true), 700 + lines.length * 420));
    return () => ts.forEach(clearTimeout);
  }, [lines]);

  return (
    <Screen cls={cx("ob scr-ready", done && "done")} label={t("Ton Frigia est prêt", "Your Frigia is ready")}>
      <ObHead from={48} to={60} />
      <div className="ob-rbody">
        <div className="ob-plates">
          <img className="plate" src="/landing/salade-caprese.jpg" alt="" />
          <img className="plate" src="/landing/pasta-legumes.jpg" alt="" />
          <img className="plate" src="/landing/soupe-detox.jpg" alt="" />
        </div>
        <h2>{done ? t(<>Ton Frigia <em>est prêt</em></>, <>Your Frigia <em>is ready</em></>) : t(<>On prépare <em>ton Frigia</em>…</>, <>Preparing <em>your Frigia</em>…</>)}</h2>
        <ul className="ob-sum">
          {lines.map((l, i) => <li key={l} className={cx(i < shown && "in")}><i><Icon name="check" /></i><span>{l}</span></li>)}
        </ul>
      </div>
      <GoBar plain title={t("Créer mon compte", "Create my account")} sub={`${trialPitch()}${t(", sans carte bancaire", ", no card needed")}`} onClick={() => { setPendingProfile(a); setPendingFamily(famMembers(fam)); navigate("/compte"); }} />
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
  const [next, setNext] = useState<"google" | "apple" | "email">("email");
  const [busy, setBusy] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);

  const go = (to: "google" | "apple" | "email") => {
    setPendingProfile(a);
    if (to === "google") void withGoogle("signup"); else if (to === "apple") void withApple("signup"); else navigate("/compte/email");
  };
  // Un code tapé : on le vérifie d'abord. Refusé : la petite feuille, sans continuer.
  const start = async (to: "google" | "apple" | "email") => {
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
      showToast(e instanceof Error ? e.message : t("Ça n'a pas marché. Réessaie.", "That didn't work. Try again."));
    } finally { setBusy(false); }
  };

  return (
    <Screen cls="ob" label={t("Crée ton compte", "Create your account")}>
      <ObHead from={60} to={72} label={t("Dernière étape", "Last step")} title={t(<>Crée ton <em>compte</em></>, <>Create your <em>account</em></>)} sub={t("Pour garder tes réponses et lancer ton premier scan.", "To keep your answers and start your first scan.")} />
      <div className="scroll"><div className="ob-body" style={{ paddingBottom: 28 }}>
        {!codeOpen
          ? <button type="button" className="ob-codetg" style={{ alignSelf: "center" }} onClick={() => { setCodeOpen(true); setTimeout(() => codeInput.current?.focus(), 50); }}><Icon name="gift" />{t("J'ai un code ami ou créateur", "I have a friend or creator code")}</button>
          : (
            <div className="ob-field">
              <label htmlFor="obCode">{t("Code ami ou créateur (facultatif)", "Friend or creator code (optional)")}</label>
              <div className="ob-input"><Icon name="gift" />
                <input ref={codeInput} id="obCode" autoComplete="off" autoCapitalize="characters" placeholder={t("Ex. MARIE", "E.g. MARIE")} style={{ textTransform: code ? "uppercase" : "none" }}
                  value={code} onChange={e => { setCode(e.target.value); setCodeOk(null); }} />
              </div>
              {codeOk && <span className="ob-codeok"><Icon name="check" /><span>{codeOk}</span></span>}
            </div>
          )}
        {APPLE && <button type="button" className="ob-btn white" disabled={busy} onClick={() => void start("apple")}><Icon name="apple" />{t("Continuer avec Apple", "Continue with Apple")}</button>}
        <button type="button" className="ob-btn white" disabled={busy} onClick={() => void start("google")}><Icon name="google" />{t("Continuer avec Google", "Continue with Google")}</button>
        <div className="ob-or">{t("ou", "or")}</div>
        <button type="button" className="ob-btn sage" disabled={busy} onClick={() => void start("email")}><Icon name="mail" />{t("Continuer avec un email", "Continue with email")}</button>
        <div className="ob-perks">
          {t(["7 jours pour tout essayer", "Sans carte bancaire", "Tes goûts gardés sur ton compte"], ["7 days to try everything", "No card needed", "Your tastes saved to your account"]).map(p => <div key={p}><i><Icon name="check" /></i>{p}</div>)}
        </div>
        <p className="ob-have">{t("Déjà un compte ? ", "Already have an account? ")}<button type="button" onClick={() => { clearPendingProfile(); navigate("/connexion"); }}>{t("Se connecter", "Sign in")}</button></p>
        <p className="ob-legal">{t(<>En continuant, tu acceptes les <a href="/cgu">conditions d'utilisation</a> et la <a href="/confidentialite">politique de confidentialité</a>.</>, <>By continuing, you accept the <a href="/cgu">terms of use</a> and the <a href="/confidentialite">privacy policy</a>.</>)}</p>
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
    if (!looksLikeEmail(mail)) { showToast(t("Cet email n'a pas l'air complet.", "That email doesn't look complete.")); return; }
    if (password.length < 8) { showToast(t("8 caractères minimum", "8 characters minimum")); return; }
    setLoading(true);
    try {
      // Les emails jetables sont refusés par la base : on le dit avant le captcha
      const { data: jetable } = await supabase.rpc("email_jetable", { p_email: mail });
      if (jetable === true) { showToast(JETABLE); return; }
      const first = name.trim();
      setPendingProfile({ ...a, first_name: first || null });
      const captchaToken = await take();
      const { data, error } = await supabase.auth.signUp({ email: mail, password, options: { data: first ? { full_name: first } : undefined, captchaToken } });
      if (error) throw error;
      setSignupEmail(mail);
      // Compte déjà créé avec cet email : Supabase ne le dit pas, il renvoie un compte sans identité
      if (data.user && !data.session && data.user.identities?.length === 0) {
        showToast(t("Un compte existe déjà avec cet email. Connecte-toi.", "An account already exists with this email. Sign in."));
        clearPendingProfile();
        navigate("/connexion");
        return;
      }
      // Avec une session, la confirmation par email est coupée : l'appli enchaîne seule sur la caméra
      if (!data.session) navigate("/compte/code");
    } catch (e) {
      const msg = authMessage(e);
      showToast(msg);
      if (msg.startsWith(t("Un compte existe", "An account already exists"))) { clearPendingProfile(); setSignupEmail(mail); navigate("/connexion"); }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen cls="ob" label={t("Inscription par email", "Sign up with email")}>
      <ObHead from={72} to={84} label={t("Ton compte", "Your account")} title={t(<>Avec <em>ton email</em></>, <>With <em>your email</em></>)} sub={t("Tu recevras un code pour le confirmer.", "You'll get a code to confirm it.")} />
      <form className="scroll" onSubmit={e => { e.preventDefault(); void submit(); }}><div className="ob-body">
        <ObField label={t("Ton prénom", "Your first name")} icon="user" autoComplete="given-name" placeholder={t("Camille", "Sam")} value={name} onChange={e => setName(e.target.value)} />
        <ObField label="Email" icon="mail" type="email" autoComplete="email" inputMode="email" placeholder={t("camille@email.fr", "sam@email.com")} value={email} onChange={e => setEmail(e.target.value)} />
        <ObField label={t("Mot de passe", "Password")} icon="lock" eye autoComplete="new-password" placeholder={t("Ton mot de passe", "Your password")} hint={t("8 caractères minimum", "8 characters minimum")} value={password} onChange={e => setPassword(e.target.value)} />
        <p className="ob-robot"><Icon name="shield" />{t("Protégé contre les robots, rien à cocher", "Protected against bots, nothing to tick")}</p>
        {widget}
        <button type="submit" hidden />
      </div></form>
      <GoBar title={t("Créer mon compte", "Create my account")} sub={`${trialPitch()}${t(", sans carte bancaire", ", no card needed")}`} loading={loading} onClick={submit} />
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
    setHint(t("Email confirmé.", "Email confirmed."));
  };
  const resend = async () => {
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email, options: { captchaToken: await take() } });
      if (error) throw error;
      showToast(t("Nouveau code envoyé", "New code sent"));
      timer.restart();
    } catch (e) { showToast(authMessage(e)); }
  };

  if (!email) return <Navigate to="/compte/email" replace />;
  return (
    <Screen cls="ob" label={t("Vérifie ton email", "Check your email")}>
      <ObHead from={84} to={94} label={t("Presque fini", "Almost done")} title={t(<>Regarde <em>tes mails</em></>, <>Check <em>your inbox</em></>)} sub={t(`On a envoyé un code à 6 chiffres à ${email}.`, `We sent a 6-digit code to ${email}.`)} />
      <div className="scroll"><div className="ob-body">
        <CodeBoxes inputRef={input} value={code} state={state} onChange={v => { setCode(v); setState(null); setHint(""); if (v.length === 6) void verify(v); }} />
        <p className="ob-codehint">{hint}</p>
        <div className="ob-links">
          <button type="button" disabled={timer.left > 0} onClick={resend}>{timer.label}</button>
          <button type="button" onClick={() => navigate("/compte/email")}>{t("Changer d'email", "Change email")}</button>
        </div>
        <p className="ob-note"><Icon name="mail" /><span>{t("Rien reçu ? Regarde dans les spams ou l'onglet Promotions.", "Nothing? Check your spam or Promotions tab.")}</span></p>
        {/* Adresse déjà inscrite : Supabase n'envoie aucun code et ne le dit pas toujours */}
        <p className="ob-note"><Icon name="user" /><span>{t("Déjà un compte avec cet email ? ", "Already have an account with this email? ")}<button type="button" className="ob-inline" onClick={() => navigate("/connexion")}>{t("Connecte-toi", "Sign in")}</button></span></p>
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
    if (!looksLikeEmail(mail)) { showToast(t("Cet email n'a pas l'air complet.", "That email doesn't look complete.")); return; }
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
      showToast(name ? t(`Bon retour, ${name}`, `Welcome back, ${name}`) : t("Bon retour", "Welcome back"));
      navigate("/", { replace: true });
    } catch (e) {
      showToast(authMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen cls="scr-login" label={t("Connexion", "Sign in")}>
      <div className="ob-wphoto"><img src="/landing/frigo.jpg" alt="" /></div>
      <div className="ob-wtop"><span className="ob-wlogo" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL + LOGO_WORD }} /></div>
      <div className="lm-sheet">
        <span className="grab" />
        <button type="button" className="lm-x" aria-label={t("Fermer", "Close")} onClick={back}><Icon name="x" /></button>
        <form className="scroll" onSubmit={e => { e.preventDefault(); void submit(); }}><div className="lm-body">
          <h2>{t(<>Content de te <em>revoir</em></>, <>Good to see you <em>again</em></>)}</h2>
          {APPLE && <button type="button" className="ob-btn white" onClick={() => void withApple("login")}><Icon name="apple" />{t("Continuer avec Apple", "Continue with Apple")}</button>}
          <button type="button" className="ob-btn white" onClick={() => void withGoogle("login")}><Icon name="google" />{t("Continuer avec Google", "Continue with Google")}</button>
          <div className="ob-or">{t("ou avec ton email", "or with your email")}</div>
          <ObField label="Email" icon="mail" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} />
          <ObField label={t("Mot de passe", "Password")} icon="lock" eye autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="button" className="lm-forgot" onClick={() => navigate("/mot-de-passe", { state: { email: email.trim() } })}>{t("Mot de passe oublié ?", "Forgot your password?")}</button>
          <Pill type="submit" block className={cx("lm-go", loading && "loading")}>{loading ? t("Connexion…", "Signing in…") : t("Se connecter", "Sign in")}</Pill>
          {signupOpen()
            ? <p className="ob-have">{t("Pas encore de compte ? ", "No account yet? ")}<button type="button" onClick={() => { resetAnswers(); navigate("/questions/1"); }}>{t("Créer un compte", "Create an account")}</button></p>
            : <p className="ob-have">{t("Pas encore invité ? ", "Not invited yet? ")}<button type="button" onClick={() => navigate(WAITLIST_URL)}>{t("Rejoins la liste d'attente", "Join the waiting list")}</button></p>}
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
    if (!looksLikeEmail(email)) { mailRef.current?.focus(); showToast(t("Entre l'email de ton compte", "Enter your account email")); return; }
    setBusy(true);
    try {
      await sendCode();
      setSent(true);
      timer.restart();
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) { showToast(authMessage(e)); } finally { setBusy(false); }
  };
  const resend = async () => {
    try { await sendCode(); showToast(t("Nouveau code envoyé", "New code sent")); timer.restart(); } catch (e) { showToast(authMessage(e)); }
  };
  const verify = async (token: string) => {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "recovery" });
    if (error) { setCodeState("bad"); setHint(authMessage(error)); setCode(""); codeRef.current?.focus(); return; }
    setCodeState("ok");
    setHint(t("Code bon. Choisis ton nouveau mot de passe.", "Code correct. Choose your new password."));
    passRef.current?.focus();
  };
  const save = async () => {
    if (busy) return;
    if (codeState !== "ok") { codeRef.current?.focus(); return; }
    if (password.length < 8) { passRef.current?.focus(); showToast(t("8 caractères minimum", "8 characters minimum")); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      const name = data.user ? firstName(data.user) : "";
      showToast(name ? t(`Mot de passe changé. Bon retour, ${name}`, `Password changed. Welcome back, ${name}`) : t("Mot de passe changé.", "Password changed."));
      navigate("/", { replace: true });
    } catch (e) { showToast(authMessage(e)); } finally { setBusy(false); }
  };
  const otherEmail = () => {
    setSent(false); setCode(""); setCodeState(null); setHint(""); setPassword("");
    setTimeout(() => mailRef.current?.focus(), 50);
  };

  return (
    <Screen cls={cx("ob scr-forgot", sent && "sent")} label={t("Mot de passe oublié", "Forgot password")}>
      <div className="fg-top"><button type="button" className="fg-x" aria-label={t("Retour à la connexion", "Back to sign in")} onClick={() => navigate("/connexion")}><Icon name="x" /></button></div>
      <div className="scroll"><div className="fg-body">
        <span className="fg-tile" dangerouslySetInnerHTML={{ __html: LOGO_SYMBOL }} />
        <form className="fg-a" onSubmit={e => { e.preventDefault(); void send(); }}>
          <h2>{t(<>Mot de passe <em>oublié</em>&nbsp;?</>, <>Forgot your <em>password</em>?</>)}</h2>
          <p>{t("Donne l'email de ton compte. On t'envoie un code pour en choisir un nouveau.", "Enter your account email. We'll send you a code to choose a new one.")}</p>
          <div className="ob-input">
            <Icon name="mail" />
            <input ref={mailRef} type="email" autoComplete="email" inputMode="email" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <button type="button" aria-label={t("Effacer", "Clear")} onClick={() => { setEmail(""); mailRef.current?.focus(); }}><Icon name="x" /></button>
          </div>
          <Pill type="submit" block className={cx("fg-go", busy && !sent && "loading")}>{busy && !sent ? t("Envoi…", "Sending…") : t("Envoyer le code", "Send the code")}</Pill>
        </form>
        <form className="fg-b" onSubmit={e => { e.preventDefault(); void save(); }}>
          <h2>{t(<>Un <em>nouveau</em> mot&nbsp;de&nbsp;passe</>, <>A <em>new</em> password</>)}</h2>
          <p>{t(`On a envoyé un code à 6 chiffres à ${email.trim()}.`, `We sent a 6-digit code to ${email.trim()}.`)}</p>
          <CodeBoxes inputRef={codeRef} value={code} state={codeState} onChange={v => { setCode(v); setCodeState(null); setHint(""); if (v.length === 6) void verify(v); }} />
          <p className="ob-codehint">{hint}</p>
          <ObField ref={passRef} label={t("Nouveau mot de passe", "New password")} icon="lock" eye autoComplete="new-password" placeholder={t("8 caractères minimum", "8 characters minimum")} value={password} onChange={e => setPassword(e.target.value)} />
          <Pill type="submit" block className={cx("fg-go", busy && sent && "loading")}>{busy && sent ? t("Un instant…", "One moment…") : t("Changer mon mot de passe", "Change my password")}</Pill>
          <div className="ob-links">
            <button type="button" disabled={timer.left > 0} onClick={resend}>{timer.label}</button>
            <button type="button" onClick={otherEmail}>{t("Changer d'email", "Change email")}</button>
          </div>
        </form>
        <button type="button" className="fg-back" onClick={() => navigate("/connexion")}>{t("Retour à la connexion", "Back to sign in")}</button>
        {widget}
      </div></div>
    </Screen>
  );
}

// ─── J · Accès à la caméra ───────────────────────────────────────────────────

export function Camera({ onDone }: { onDone: () => void }) {
  const [asking, setAsking] = useState(false);
  const refuse = () => {
    showToast(t("Sans la caméra, tu pourras envoyer une photo de ta galerie", "Without the camera, you can send a photo from your gallery"));
    setTimeout(onDone, 1600);
  };
  const allow = async () => {
    if (asking) return;
    setAsking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach(tr => tr.stop());
      onDone();
    } catch {
      refuse();
    }
  };
  return (
    <Screen cls="scr-camera" label={t("Accès à la caméra", "Camera access")}>
      <div className="ob-cbody">
        <h2>{t(<>Touche <em>Autoriser</em> pour scanner ton frigo</>, <>Tap <em>Allow</em> to scan your fridge</>)}</h2>
        <div className="ob-ios" role="img" aria-label={t("Fenêtre du téléphone qui demande l'accès à l'appareil photo", "Phone prompt asking for camera access")}>
          <div className="q"><b>{t(`« ${window.location.host} » souhaite accéder à l'appareil photo`, `"${window.location.host}" would like to access the camera`)}</b></div>
          <div className="bt"><button type="button" onClick={refuse}>{t("Ne pas autoriser", "Don't Allow")}</button><button type="button" onClick={allow}>{t("Autoriser", "Allow")}</button></div>
        </div>
        <div className="ob-arrow" style={{ alignSelf: "center", marginLeft: 136 }}><Icon name="arrow" /></div>
        <div className="ob-safe"><Icon name="shield" /><span>{t("La photo sert seulement à repérer tes ingrédients. Tu pourras changer d'avis dans les réglages.", "The photo is only used to spot your ingredients. You can change your mind in settings.")}</span></div>
      </div>
      <GoBar plain title={t("Continuer", "Continue")} sub={t("Ton premier scan t'attend", "Your first scan is waiting")} onClick={allow} />
    </Screen>
  );
}
