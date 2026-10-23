import { useState, type FormEvent } from "react";
import { supabase } from "../supabase";
import { Sheet } from "./Sheet";
import type { LegalKey } from "./legal";

// Inscription et connexion depuis la landing, avec la logique Supabase de l'ancienne version.
// Provisoire : dans la refonte, « Commencer » ouvrira le parcours d'inscription de l'appli (questions, compte, code par email).
export type AuthMode = "signup" | "login";

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.09-6.09C34.46 3.08 29.5 1 24 1 14.82 1 7.07 6.48 3.96 14.18l7.1 5.52C12.73 13.44 17.94 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.52 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.67c-.55 2.97-2.2 5.48-4.68 7.17l7.18 5.58C43.32 37.45 46.52 31.4 46.52 24.5z"/>
    <path fill="#FBBC05" d="M11.06 28.3A14.56 14.56 0 0 1 9.5 24c0-1.49.26-2.93.72-4.28l-7.1-5.52A23.94 23.94 0 0 0 0 24c0 3.87.92 7.53 2.54 10.76l8.52-6.46z"/>
    <path fill="#34A853" d="M24 47c5.5 0 10.12-1.82 13.49-4.96l-7.18-5.58C28.52 37.82 26.37 38.5 24 38.5c-6.06 0-11.27-3.94-13.14-9.44l-8.52 6.46C5.8 43.18 14.27 47 24 47z"/>
  </svg>
);

const errorText = (e: unknown) => (e instanceof Error && e.message) || "Une erreur est survenue. Réessaie.";

export function AuthSheet({ initialMode, captchaToken, onResetCaptcha, onLegal, onClose }: {
  initialMode: AuthMode;
  captchaToken: string | null;
  onResetCaptcha: () => void;
  onLegal: (k: LegalKey) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [step, setStep] = useState<"form" | "review" | "check-mail">("form");

  const switchMode = (m: AuthMode) => { setMode(m); setMsg(""); setStep("form"); };

  const google = async () => {
    setLoading(true); setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) { setMsg(error.message); setLoading(false); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !pw) { setMsg("Remplis ton email et ton mot de passe."); return; }
    setMsg("");
    if (mode === "signup") {
      if (pw.length < 8) { setMsg("Ton mot de passe doit faire au moins 8 caractères."); return; }
      setStep("review");
      return;
    }
    if (!captchaToken) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw, options: { captchaToken } });
      if (error) throw error;
      onClose();
    } catch (err) {
      setMsg(errorText(err));
      onResetCaptcha();
    } finally { setLoading(false); }
  };

  const confirmSignup = async () => {
    if (!captchaToken) return;
    setLoading(true); setMsg("");
    try {
      const { data, error } = await supabase.auth.signUp({ email, password: pw, options: { captchaToken } });
      if (error) throw error;
      if (data.session) onClose();
      else setStep("check-mail");
    } catch (err) {
      setMsg(errorText(err));
      setStep("form");
      onResetCaptcha();
    } finally { setLoading(false); }
  };

  if (step === "check-mail") {
    return (
      <Sheet label="Vérifie tes emails" onClose={onClose}>
        <h2>Regarde <em>tes emails</em></h2>
        <p className="intro">On t'a envoyé un lien à <b>{email}</b> pour confirmer ton compte. Pense aux spams.</p>
        <button className="btn btn-fill full" onClick={onClose}>C'est noté</button>
      </Sheet>
    );
  }

  if (step === "review") {
    return (
      <Sheet label="Vérifie ton email" onClose={onClose}>
        <h2>C'est bien <em>ton email</em> ?</h2>
        <p className="intro">Tu y recevras tes reçus et de quoi récupérer ton compte.</p>
        <div className="stack">
          <div className="email-box">{email}</div>
          {msg && <p className="msg" role="alert">{msg}</p>}
          <button className="btn btn-fill full" onClick={confirmSignup} disabled={loading || !captchaToken}>
            {loading ? "Création…" : "Créer mon compte"}
          </button>
          <button className="back" onClick={() => setStep("form")}>Corriger l'email</button>
        </div>
      </Sheet>
    );
  }

  const signup = mode === "signup";
  return (
    <Sheet label={signup ? "Crée ton compte" : "Connexion"} onClose={onClose}>
      <h2>{signup ? <>Crée ton <em>compte</em></> : <>Content de te <em>revoir</em></>}</h2>
      <p className="intro">{signup ? "7 jours d'essai, sans carte bancaire." : "Connecte-toi pour retrouver tes recettes."}</p>
      <div className="stack">
        <button className="btn btn-google full" onClick={google} disabled={loading}><GoogleIcon />Continuer avec Google</button>
        <div className="or">ou avec ton email</div>
        <form className="stack" onSubmit={submit} noValidate>
          <label>Email<input type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="camille@email.fr" /></label>
          <label>Mot de passe<input type="password" autoComplete={signup ? "new-password" : "current-password"} value={pw} onChange={e => setPw(e.target.value)} placeholder={signup ? "8 caractères minimum" : "Ton mot de passe"} /></label>
          {msg && <p className="msg" role="alert">{msg}</p>}
          <button type="submit" className="btn btn-fill full" disabled={loading || (!signup && !captchaToken)}>
            {loading ? "…" : signup ? "Continuer" : "Se connecter"}
          </button>
        </form>
        {signup && (
          <div className="perks">
            <div><i>✓</i>7 jours pour tout essayer</div>
            <div><i>✓</i>Sans carte bancaire</div>
            <div><i>✓</i>Rien à télécharger</div>
          </div>
        )}
        <p className="switch">
          {signup
            ? <>Déjà un compte ? <button onClick={() => switchMode("login")}>Se connecter</button></>
            : <>Pas encore de compte ? <button onClick={() => switchMode("signup")}>Créer un compte</button></>}
        </p>
        {signup && (
          <p className="fine">En continuant, tu acceptes les <button onClick={() => onLegal("cgu")}>conditions d'utilisation</button> et la <button onClick={() => onLegal("confidentialite")}>politique de confidentialité</button>.</p>
        )}
      </div>
    </Sheet>
  );
}
