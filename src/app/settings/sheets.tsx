// 22 · Les feuilles des réglages (prototype V3) : photo, prénom, email, mot de passe, suppression du compte, nous écrire.
import { useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import type { User } from "../../lib/types";
import {
  changePassword, confirmEmailChange, downloadMyData, isOAuthUser, sendSupportMessage, squarePhoto, startEmailChange,
} from "../../lib/account";
import { Chip, Dialog, Icon, Pill, TextLink } from "../../ui/components";
import { CodeBoxes } from "../onboarding/Onboarding";
import { authMessage } from "../onboarding/errors";
import { useRecipePhoto } from "../photo";
import { showToast } from "../toast";
import { kilos } from "../scan/savings";
import { t } from "../../lib/i18n";
import "../onboarding/ob.css";
import "./settings.css";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

export type AccountMode = "photo" | "name" | "email" | "pass";
/** Un plat de l'utilisateur, proposé comme photo de profil. */
export type Dish = { title: string; imageSearch?: string };

/** Le rond de la photo de profil, ou l'initiale. */
export function ProfileDot({ name, photo, className }: { name: string; photo: string | null; className: string }) {
  return (
    <span className={cx(className, photo && "has-pp")} style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
      {name.charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function DishPick({ dish, on, onPick }: { dish: Dish; on: boolean; onPick: (src: string) => void }) {
  const photo = useRecipePhoto(dish.title, dish.imageSearch);
  if (!photo) return null;
  return <button type="button" className={cx(on && "on")} aria-label={t(`Le plat ${dish.title}`, `The dish ${dish.title}`)} onClick={() => onPick(photo)}><img src={photo} alt="" /></button>;
}

// ─── Mon compte : photo, prénom, email (avec code), mot de passe ─────────────
export function AccountSheet({ mode, onClose, onMode, user, name, avatar, dishes, onAvatar, onName }: {
  mode: AccountMode | null; onClose: () => void; onMode: (m: AccountMode) => void;
  user: User; name: string; avatar: string | null; dishes: Dish[];
  onAvatar: (src: string | null) => void; onName: (name: string) => void;
}) {
  // Garde le dernier panneau pendant que la feuille redescend ; repart de zéro à chaque ouverture
  const [shown, setShown] = useState<{ mode: AccountMode; n: number }>({ mode: "photo", n: 0 });
  const [prev, setPrev] = useState<AccountMode | null>(null);
  if (mode !== prev) { setPrev(mode); if (mode) setShown(s => ({ mode, n: s.n + 1 })); }
  const k = shown.n;
  return (
    <Dialog open={!!mode} onClose={onClose} className="ac-sheet" label={t("Ton compte", "Your account")}>
      <button type="button" className="dl-x" aria-label={t("Fermer", "Close")} onClick={onClose}><Icon name="x" /></button>
      {shown.mode === "photo" && <PhotoPane key={k} name={name} avatar={avatar} dishes={dishes} onClose={onClose} onAvatar={onAvatar} onName={() => onMode("name")} />}
      {shown.mode === "name" && <NamePane key={k} name={name} onClose={onClose} onName={onName} />}
      {shown.mode === "email" && <EmailPane key={k} onClose={onClose} />}
      {shown.mode === "pass" && <PassPane key={k} user={user} onClose={onClose} />}
    </Dialog>
  );
}

function PhotoPane({ name, avatar, dishes, onClose, onAvatar, onName }: {
  name: string; avatar: string | null; dishes: Dish[]; onClose: () => void; onAvatar: (src: string | null) => void; onName: () => void;
}) {
  const [next, setNext] = useState<string | null>(null);
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { setNext(await squarePhoto(file)); } catch (err) { showToast((err as Error).message); }
  };
  const file = (capture?: boolean) => <input type="file" accept="image/*" capture={capture ? "user" : undefined} className="ac-file" onChange={pick} />;
  return (
    <div className="ac-pane">
      <h3>{t(<>Ta <em>photo</em></>, <>Your <em>photo</em></>)}</h3>
      <ProfileDot className="ac-pv" name={name} photo={next ?? avatar} />
      <p className="ac-pvt">{t("Elle apparaît sur ton compte et dans ta famille.", "It shows on your account and in your family.")}</p>
      {next === null ? <>
        {dishes.length > 0 && (
          <div className="ac-dish"><span>{t("Ou l'un de tes plats", "Or one of your dishes")}</span>
            <div>{dishes.map(d => <DishPick key={d.title} dish={d} on={false} onPick={setNext} />)}</div>
          </div>
        )}
        <div className="ac-pbt">
          <label className="pill sage block">{file(true)}<Icon name="cam" />{t("Prendre une photo", "Take a photo")}</label>
          <label className="pill block sf-line-btn">{file()}<Icon name="image" />{t("Choisir dans ma galerie", "Choose from my gallery")}</label>
          {avatar && <button type="button" className="ac-rm" onClick={() => { onAvatar(null); onClose(); showToast(t("Photo retirée, ton initiale revient", "Photo removed, your initial is back")); }}><Icon name="trash" />{t("Retirer la photo", "Remove the photo")}</button>}
        </div>
        <button type="button" className="ac-tonm" onClick={onName}>{t("Changer ton prénom", "Change your first name")}</button>
      </> : (
        <div className="ac-pbt">
          <Pill block onClick={() => { onAvatar(next); onClose(); showToast(t("Nouvelle photo, bien reçue", "New photo, got it")); }}>{t("Garder cette photo", "Keep this photo")}</Pill>
          <label className="link">{file()}{t("Choisir une autre", "Choose another")}</label>
        </div>
      )}
    </div>
  );
}

function NamePane({ name, onClose, onName }: { name: string; onClose: () => void; onName: (name: string) => void }) {
  const [value, setValue] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  const save = () => {
    const v = value.trim();
    if (!v) { input.current?.focus(); return; }
    onName(capitalize(v));
    onClose();
    showToast(t(`C'est noté, ${capitalize(v)}`, `Got it, ${capitalize(v)}`));
  };
  return (
    <form className="ac-pane" onSubmit={e => { e.preventDefault(); save(); }}>
      <h3>{t(<>Ton <em>prénom</em></>, <>Your <em>first name</em></>)}</h3>
      <p>{t("C'est lui qu'on utilise pour te dire bonsoir.", "It's the one we use to say good evening.")}</p>
      <div className="ob-input"><Icon name="user" /><input ref={input} autoComplete="given-name" aria-label={t("Ton prénom", "Your first name")} value={value} onChange={e => setValue(e.target.value)} /></div>
      <Pill type="submit" block>{t("Enregistrer", "Save")}</Pill>
    </form>
  );
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

function EmailPane({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [state, setState] = useState<"ok" | "bad" | null>(null);
  const [hint, setHint] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const send = async () => {
    if (busy || !EMAIL_RE.test(email.trim())) return;
    setBusy(true);
    try {
      await startEmailChange(email.trim());
      setSent(true);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) { showToast(authMessage(e)); } finally { setBusy(false); }
  };
  const verify = async (token: string) => {
    try {
      await confirmEmailChange(email.trim(), token);
      setState("ok");
      onClose();
      showToast(t("Ton email est changé", "Your email is changed"));
    } catch (e) {
      setState("bad"); setHint(authMessage(e)); setCode(""); codeRef.current?.focus();
    }
  };
  return (
    <form className="ac-pane" onSubmit={e => { e.preventDefault(); void send(); }}>
      <h3>{t(<>Change ton <em>email</em></>, <>Change your <em>email</em></>)}</h3>
      {!sent ? <>
        <p>{t("On envoie un code à la nouvelle adresse pour la confirmer.", "We send a code to the new address to confirm it.")}</p>
        <div className="ob-input"><Icon name="mail" /><input type="email" inputMode="email" autoComplete="email" placeholder={t("nouvelle@adresse.fr", "new@address.com")} aria-label={t("Nouvel email", "New email")} value={email} onChange={e => setEmail(e.target.value)} /></div>
        <Pill type="submit" block className={cx(busy && "loading")} disabled={!EMAIL_RE.test(email.trim())}>{t("Recevoir le code", "Get the code")}</Pill>
      </> : <>
        <p>{t(<>Code envoyé à <b>{email.trim()}</b>. Il marche 10 minutes.</>, <>Code sent to <b>{email.trim()}</b>. It works for 10 minutes.</>)}</p>
        <CodeBoxes inputRef={codeRef} value={code} state={state} onChange={v => { setCode(v); setState(null); setHint(""); if (v.length === 6) void verify(v); }} />
        {hint && <p className="ob-codehint">{hint}</p>}
      </>}
      <p className="ac-note"><Icon name="shield" /><span>{t("Ton ancienne adresse reçoit un message, au cas où ce ne serait pas toi.", "Your old address gets a message, in case it wasn't you.")}</span></p>
    </form>
  );
}

/** 0 à 3 : vide, 8 caractères, avec un chiffre, 12 caractères avec un signe. */
function strength(v: string): 0 | 1 | 2 | 3 {
  if (!v || v.length < 8) return 0;
  if (!/\d/.test(v)) return 1;
  return v.length >= 12 && /[^a-z0-9]/i.test(v) ? 3 : 2;
}
const STRENGTH = t(["8 caractères, dont un chiffre", "8 caractères et un chiffre", "Bien. Plus solide avec un !", "Très solide"],
  ["8 characters, including a number", "8 characters and a number", "Good. Stronger with a !", "Very strong"]);

function PassPane({ user, onClose }: { user: User; onClose: () => void }) {
  const navigate = useNavigate();
  // Compte ouvert avec Google : pas encore de mot de passe à donner
  const noPassword = isOAuthUser(user);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const level = strength(next);
  const ok = (noPassword || !!current) && level >= 2;
  const save = async () => {
    if (!ok || busy) return;
    setBusy(true);
    const res = await changePassword(user, current, next);
    setBusy(false);
    if (res === "wrong-current") { showToast(t("Ce n'est pas ton mot de passe actuel", "That's not your current password")); return; }
    if (res !== "ok") { showToast(authMessage({ message: res.error })); return; }
    onClose();
    showToast(t("Mot de passe changé. Tes autres appareils sont déconnectés", "Password changed. Your other devices are signed out"));
  };
  return (
    <form className="ac-pane" onSubmit={e => { e.preventDefault(); void save(); }}>
      <h3>{t(<>Ton <em>mot de passe</em></>, <>Your <em>password</em></>)}</h3>
      {!noPassword && <div className="ob-input"><Icon name="lock" /><input type="password" autoComplete="current-password" placeholder={t("Mot de passe actuel", "Current password")} aria-label={t("Mot de passe actuel", "Current password")} value={current} onChange={e => setCurrent(e.target.value)} /></div>}
      <div className="ob-input">
        <Icon name="lock" />
        <input type={show ? "text" : "password"} autoComplete="new-password" placeholder={t("Nouveau mot de passe", "New password")} aria-label={t("Nouveau mot de passe", "New password")} value={next} onChange={e => setNext(e.target.value)} />
        <button type="button" aria-label={show ? t("Cacher le mot de passe", "Hide password") : t("Afficher le mot de passe", "Show password")} onClick={() => setShow(s => !s)}><Icon name="eye" /></button>
      </div>
      <div className="ac-str" data-l={level} aria-live="polite"><i /><i /><i /><span>{STRENGTH[next ? Math.max(level, 1) : 0]}</span></div>
      <Pill type="submit" block className={cx(busy && "loading")} disabled={!ok}>{t("Changer le mot de passe", "Change password")}</Pill>
      {!noPassword && <TextLink onClick={() => { onClose(); navigate("/mot-de-passe", { state: { email: user.email } }); }}>{t("Mot de passe oublié ?", "Forgot your password?")}</TextLink>}
    </form>
  );
}

// ─── Supprimer mon compte : glisser jusqu'au bout pour confirmer ─────────────
export function DeleteSheet({ open, onClose, isPlus, user, onDelete, onGone, savedKg }: {
  open: boolean; onClose: () => void; isPlus: boolean; user: User; savedKg: number;
  /** Supprime le compte côté serveur. Lève une erreur avec le message à afficher. */
  onDelete: () => Promise<void>;
  /** Après « Compte supprimé » : on quitte l'appli. */
  onGone: () => void;
}) {
  const navigate = useNavigate();
  const slide = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState<{ from: number; max: number } | null>(null);
  const [back, setBack] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  // Course du bouton, mesurée quand on commence à glisser
  const [w, setW] = useState(0);
  const max = () => { const m = (slide.current?.clientWidth ?? 300) - 60; setW(m); return m; };
  const reset = () => { setBack(true); setX(0); };
  // À chaque ouverture, la feuille repart de zéro
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) { setWasOpen(open); if (open) { setDone(false); setBusy(false); setBack(true); setX(0); } }

  const finish = async () => {
    if (busy) return;
    setBack(true); setX(max()); setBusy(true);
    try {
      await onDelete();
      setTimeout(() => setDone(true), 350);
      setTimeout(onGone, 2600);
    } catch (e) {
      setBusy(false); reset();
      showToast((e as Error).message || t("La suppression n'a pas marché. Réessaie", "The deletion didn't work. Try again"));
    }
  };
  const up = () => {
    if (!drag) return;
    setDrag(null);
    if (x >= drag.max * 0.88) void finish(); else reset();
  };
  const idle = !drag && x === 0 && !busy;
  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} className="dl-sheet" label={t("Supprimer ton compte", "Delete your account")}>
      {!done ? <>
        <button type="button" className="dl-x" aria-label={t("Fermer", "Close")} onClick={onClose} disabled={busy}><Icon name="x" /></button>
        <div className="dl-form">
          <span className="dl-ic" aria-hidden="true"><Icon name="alert" /></span>
          <h3>{t(<>Supprimer ton <em>compte ?</em></>, <>Delete your <em>account?</em></>)}</h3>
          <p>{t("Tes scans, tes favoris, ta semaine, ta liste de courses et ta famille seront effacés, allergies comprises.", "Your scans, favourites, week, shopping list and family will be erased, allergies included.")}</p>
          {isPlus && <p>{t("Ton abonnement Frigia Plus s'arrête en même temps. La période déjà payée n'est pas remboursée.", "Your Frigia Plus subscription stops at the same time. The period already paid isn't refunded.")}</p>}
          <p className="dl-def">{t("C'est définitif : on ne pourra rien récupérer.", "It's final: we won't be able to recover anything.")}</p>
          <div ref={slide} className={cx("dl-slide", back && "back", idle && "idle")}>
            <span className="dl-fill" style={{ width: 60 + x }} />
            <span className="dl-txt">{t("Glisse pour supprimer", "Slide to delete")}</span>
            <button
              type="button" className="dl-knob" role="slider" aria-label={t("Glisse pour supprimer ton compte", "Slide to delete your account")}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={w ? Math.round((x / w) * 100) : 0}
              style={{ transform: `translateX(${x}px)` }} disabled={busy}
              onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setBack(false); setDrag({ from: e.clientX - x, max: max() }); }}
              onPointerMove={e => { if (drag) setX(Math.max(0, Math.min(drag.max, e.clientX - drag.from))); }}
              onPointerUp={up} onPointerCancel={up}
              onKeyDown={e => {
                if (e.key === "ArrowRight") { e.preventDefault(); setBack(true); const n = Math.min(max(), x + max() / 5); setX(n); if (n >= max()) void finish(); }
                else if (e.key === "End") { e.preventDefault(); void finish(); }
                else if (e.key === "ArrowLeft" || e.key === "Home") { e.preventDefault(); reset(); }
              }}
            ><Icon name="arrow" /></button>
          </div>
          <div className="dl-alt">
            {isPlus && <TextLink onClick={() => { onClose(); navigate("/resilier"); }}>{t("Plutôt une pause d'un mois", "A one-month pause instead")}</TextLink>}
            <TextLink onClick={() => downloadMyData(user).catch(() => showToast(t("Le fichier n'a pas pu être préparé. Réessaie", "The file couldn't be prepared. Try again")))}>{t("Télécharger mes données avant", "Download my data first")}</TextLink>
          </div>
        </div>
      </> : (
        <div className="dl-done">
          <span className="dl-ic ok" aria-hidden="true"><Icon name="check" /></span>
          <h3>{t(<>Compte <em>supprimé</em></>, <>Account <em>deleted</em></>)}</h3>
          {savedKg > 0 && <p>{t(<>Merci d'avoir sauvé <b>{kilos(savedKg)}</b> de nourriture avec nous.</>, <>Thanks for saving <b>{kilos(savedKg)}</b> of food with us.</>)}</p>}
        </div>
      )}
    </Dialog>
  );
}

// ─── Nous écrire, Signaler un problème, Donner ton avis ──────────────────────
export type SendMode = "contact" | "bug" | "idea";
type SendText = { t: [string, string]; p: string; c: string[]; ph: string; logs: boolean; ok: string };
const SEND: Record<SendMode, SendText> = t<Record<SendMode, SendText>>({
  contact: { t: ["Écris-", "nous"], p: "Une vraie personne te répond par email, sous 24 h.", c: ["Le scan", "Une recette", "Mon abonnement", "Autre"], ph: "Raconte-nous…", logs: false, ok: "On te répond par email, sous 24 h." },
  bug: { t: ["Signale un ", "problème"], p: "Dis-nous ce qui s'est passé, on regarde vite.", c: ["Ingrédient mal reconnu", "Recette bizarre", "L'app plante", "Autre"], ph: "Ce que tu faisais, ce qui s'est passé…", logs: true, ok: "Merci ! On regarde ça et on te tient au courant par email." },
  idea: { t: ["Ton idée ", "compte"], p: "On lit tout. Les meilleures idées arrivent dans l'app.", c: ["Les recettes", "La famille", "La liste", "Autre"], ph: "Ce qui te manque, ce qui t'aiderait…", logs: false, ok: "Merci ! On lit tout, promis." },
}, {
  contact: { t: ["Write to ", "us"], p: "A real person replies by email, within 24 h.", c: ["Scanning", "A recipe", "My subscription", "Other"], ph: "Tell us…", logs: false, ok: "We'll reply by email, within 24 h." },
  bug: { t: ["Report a ", "problem"], p: "Tell us what happened, we'll look quickly.", c: ["Ingredient misread", "Odd recipe", "The app crashes", "Other"], ph: "What you were doing, what happened…", logs: true, ok: "Thanks! We'll look into it and keep you posted by email." },
  idea: { t: ["Your idea ", "counts"], p: "We read everything. The best ideas make it into the app.", c: ["Recipes", "Family", "The list", "Other"], ph: "What's missing, what would help…", logs: false, ok: "Thanks! We read everything, promise." },
});

export function ContactSheet({ mode, onClose, user }: { mode: SendMode | null; onClose: () => void; user: User }) {
  const [shown, setShown] = useState<{ mode: SendMode; n: number }>({ mode: "contact", n: 0 });
  const [prev, setPrev] = useState<SendMode | null>(null);
  if (mode !== prev) { setPrev(mode); if (mode) setShown(s => ({ mode, n: s.n + 1 })); }
  return (
    <Dialog open={!!mode} onClose={onClose} className="hp-sheet" label={t("Écris-nous", "Write to us")}>
      <ContactForm key={shown.n} mode={shown.mode} onClose={onClose} user={user} />
    </Dialog>
  );
}

function ContactForm({ mode, onClose, user }: { mode: SendMode; onClose: () => void; user: User }) {
  const m = SEND[mode];
  const [topic, setTopic] = useState(m.c[0]);
  const [text, setText] = useState("");
  const [logs, setLogs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const send = async () => {
    if (busy) return;
    if (!text.trim()) { area.current?.focus(); return; }
    setBusy(true);
    try {
      await sendSupportMessage(user, mode, topic, text.trim(), m.logs && logs ? `Frigia 1.0 · ${navigator.userAgent}` : undefined);
      setSent(true);
    } catch { showToast(t("Ton message n'est pas parti. Réessaie dans un instant", "Your message wasn't sent. Try again in a moment")); } finally { setBusy(false); }
  };
  if (sent) return (
    <div className="hp-sent">
      <span className="dialog-art" aria-hidden="true"><Icon name="mail" /><span className="dialog-badge hp-ok"><Icon name="check" /></span></span>
      <h3>{t(<>Message <em>envoyé</em></>, <>Message <em>sent</em></>)}</h3>
      <p>{m.ok}</p>
      <Pill block onClick={onClose}>{t("Fermer", "Close")}</Pill>
    </div>
  );
  return (
    <div className="hp-form">
      <h3>{m.t[0]}<em>{m.t[1]}</em></h3>
      <p>{m.p}</p>
      <div className="chips hp-topics">{m.c.map(c => <Chip key={c} on={c === topic} onClick={() => setTopic(c)}>{c}</Chip>)}</div>
      <textarea ref={area} rows={4} placeholder={m.ph} aria-label={m.ph} value={text} onChange={e => setText(e.target.value)} />
      {m.logs && (
        <div className="st-row st-tgrow hp-logs">
          <div><b>{t("Joindre les infos de l'app", "Attach app info")}</b><small>{t("Version et modèle de téléphone, rien d'autre", "Version and phone model, nothing else")}</small></div>
          <button type="button" className={cx("st-tg", logs && "on")} role="switch" aria-checked={logs} aria-label={t("Joindre les infos de l'app", "Attach app info")} onClick={() => setLogs(l => !l)}><i /></button>
        </div>
      )}
      <Pill block icon="mail" className={cx(busy && "loading")} onClick={() => void send()}>{t("Envoyer", "Send")}</Pill>
      <TextLink onClick={onClose}>{t("Annuler", "Cancel")}</TextLink>
    </div>
  );
}
