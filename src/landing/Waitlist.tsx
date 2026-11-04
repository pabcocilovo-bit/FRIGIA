import { useRef, useState, type FormEvent } from "react";
import { Sheet } from "./Sheet";
import { lang, t } from "../lib/i18n";

// Liste d'attente (tant que l'appli n'est pas ouverte à tous) : prénom + email, envoyés à /api/waitlist.
// Pas de Supabase ici : la route s'occupe de tout (doublons, limite, email de confirmation).
// website : champ piège caché. Une personne ne le voit pas, un robot le remplit.

// Même règle que la route, pour prévenir avant d'envoyer
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const GENERIC_ERROR = t("L'inscription n'a pas marché. Réessaie.", "Sign-up didn't work. Try again.");

// « hero », ou « hero|instagram » si la page a été ouverte avec ?ref= ou ?utm_source=
function sourceWithRef(source: string) {
  if (typeof window === "undefined") return source;
  const params = new URLSearchParams(window.location.search);
  const ref = (params.get("ref") || params.get("utm_source") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
  return (ref ? `${source}|${ref}` : source).slice(0, 60);
}

type Result = { kind: "ok" | "already"; firstName: string };

export function WaitlistSheet({ source, onLogin, onClose }: { source: string; onLogin: () => void; onClose: () => void }) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<{ firstName?: string; email?: string }>({});
  const [serverError, setServerError] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const name = firstName.trim(), mail = email.trim();
    const next: typeof errors = {};
    if (!name) next.firstName = t("Ton prénom manque.", "Your first name is missing.");
    if (!EMAIL.test(mail)) next.email = mail ? t("Cette adresse email n'a pas l'air valide.", "This email address doesn't look valid.") : t("Ton email manque.", "Your email is missing.");
    setErrors(next);
    setServerError("");
    if (next.firstName) { firstRef.current?.focus(); return; }
    if (next.email) { emailRef.current?.focus(); return; }

    setSending(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        // La langue de la page : l'email de confirmation part dans cette langue (api/waitlist.ts)
        headers: { "Content-Type": "application/json", "X-Frigia-Lang": lang },
        body: JSON.stringify({ firstName: name, email: mail, source: sourceWithRef(source), website }),
      });
      const data = await res.json().catch(() => ({})) as { status?: string; error?: string };
      if (res.ok && (data.status === "ok" || data.status === "already")) setResult({ kind: data.status, firstName: name });
      else setServerError(data.error || GENERIC_ERROR);
    } catch {
      setServerError(t("Pas de connexion ? Vérifie ton réseau et réessaie.", "No connection? Check your network and try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet label={t("Rejoindre la liste d'attente", "Join the waiting list")} onClose={onClose}>
      {result
        ? <h2>{result.kind === "ok" ? t(<>C'est <em>noté</em> !</>, <>You're <em>in</em>!</>) : t(<>Déjà <em>sur la liste</em></>, <>Already <em>on the list</em></>)}</h2>
        : <><h2>{t(<>Rejoins la <em>liste d'attente</em></>, <>Join the <em>waiting list</em></>)}</h2><p className="intro">{t("Frigia ouvre par petits groupes. Laisse ton prénom et ton email : on t'écrit dès que c'est ton tour.", "Frigia is opening in small groups. Leave your first name and email: we'll write as soon as it's your turn.")}</p></>}
      {!result && (
        <form className="stack" onSubmit={submit} noValidate>
          <label>
            {t("Prénom", "First name")}
            <input ref={firstRef} name="firstName" autoComplete="given-name" maxLength={40} value={firstName}
              onChange={e => setFirstName(e.target.value)} placeholder="Camille"
              aria-invalid={!!errors.firstName} aria-describedby={errors.firstName ? "wl-first-err" : undefined} />
            {errors.firstName && <span className="field-err" id="wl-first-err">{errors.firstName}</span>}
          </label>
          <label>
            Email
            <input ref={emailRef} name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} value={email}
              onChange={e => setEmail(e.target.value)} placeholder="camille@email.fr"
              aria-invalid={!!errors.email} aria-describedby={errors.email ? "wl-mail-err" : undefined} />
            {errors.email && <span className="field-err" id="wl-mail-err">{errors.email}</span>}
          </label>
          {/* Piège à robots : hors écran, ignoré par les lecteurs d'écran et le clavier */}
          <div className="wl-trap" aria-hidden="true">
            <label>Ton site web<input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
          </div>
          <button type="submit" className="btn btn-fill full" disabled={sending}>{sending ? t("Un instant…", "One moment…") : t("Rejoindre la liste d'attente", "Join the waiting list")}</button>
          <p className="fine">
            {t("On utilise ton email seulement pour te prévenir quand c'est ton tour. Tu peux demander à être retiré à", "We only use your email to tell you when it's your turn. You can ask to be removed at")}{" "}
            <a href="mailto:contact@frigia.fr">contact@frigia.fr</a>. <a href="/confidentialite">{t("Confidentialité", "Privacy")}</a>
          </p>
        </form>
      )}
      {/* Le résultat de l'envoi : seule zone annoncée par les lecteurs d'écran */}
      <div className="wl-live" aria-live="polite">
        {result && (
          <p className="intro">
            {result.kind === "ok"
              ? t(`C'est noté, ${result.firstName} ! Regarde tes emails : tu as reçu une confirmation. On t'écrit dès que c'est ton tour.`, `You're in, ${result.firstName}! Check your emails: you've got a confirmation. We'll write as soon as it's your turn.`)
              : t("Tu es déjà sur la liste avec cette adresse. On t'écrit dès que c'est ton tour.", "You're already on the list with this address. We'll write as soon as it's your turn.")}
          </p>
        )}
        {serverError && <p className="msg">{serverError}</p>}
      </div>
      {result
        ? <button className="btn btn-fill full" onClick={onClose}>{t("Fermer", "Close")}</button>
        : <p className="switch">{t("Déjà invité ?", "Already invited?")} <button onClick={onLogin}>{t("Se connecter", "Log in")}</button></p>}
    </Sheet>
  );
}
