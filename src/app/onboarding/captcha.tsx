// Anti-robot invisible (Cloudflare Turnstile), demandé par Supabase pour créer un compte, se connecter
// ou recevoir un code. Même clé que la landing. Chaque jeton ne sert qu'une fois.
import { useCallback, useEffect, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { isNativeApp, SITE_ORIGIN } from "../../lib/native";

// Aperçus Vercel des branches et localhost : la clé de test de Cloudflare (toujours valide), pour ne pas ajouter
// chaque nouvelle branche dans Turnstile. Ils utilisent la base frigia-test, dont le captcha Supabase est coupé.
// (L'app mobile tourne elle aussi sur « localhost », mais avec la vraie base : elle garde la vraie clé.)
const PREVIEW = typeof window !== "undefined" && !isNativeApp
  && (/^frigia-[a-z0-9-]+-pablo-s-projects16\.vercel\.app$/.test(window.location.hostname) || window.location.hostname === "localhost");
export const SITE_KEY = PREVIEW ? "1x00000000000000000000AA" : "0x4AAAAAADcyx1Wtay8saMMq";

export function useCaptcha() {
  const ref = useRef<TurnstileInstance>(null);
  const token = useRef<string | null>(null);
  const waiting = useRef<((t: string) => void)[]>([]);

  const onSuccess = (t: string) => {
    const w = waiting.current.shift();
    if (w) w(t); else token.current = t;
  };
  const frame = useRef<HTMLIFrameElement>(null);

  // App mobile : Turnstile refuse les pages servies depuis le téléphone. Il tourne dans frigia.fr/captcha,
  // chargée dans un cadre invisible, qui renvoie ses jetons par message.
  useEffect(() => {
    if (!isNativeApp) return;
    const on = (e: MessageEvent) => {
      if (e.origin !== SITE_ORIGIN || e.source !== frame.current?.contentWindow) return;
      const d = e.data as { frigiaCaptcha?: string; token?: string };
      if (d?.frigiaCaptcha === "token" && d.token) onSuccess(d.token);
      if (d?.frigiaCaptcha === "expired") token.current = null;
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);

  const reset = () => isNativeApp
    ? frame.current?.contentWindow?.postMessage({ frigiaCaptcha: "reset" }, SITE_ORIGIN)
    : ref.current?.reset();

  const widget = isNativeApp
    ? <iframe ref={frame} src={`${SITE_ORIGIN}/captcha`} title="captcha" aria-hidden tabIndex={-1}
        style={{ position: "fixed", width: 1, height: 1, opacity: 0, border: 0, pointerEvents: "none", bottom: 0, left: 0 }} />
    : <Turnstile ref={ref} siteKey={SITE_KEY} onSuccess={onSuccess} onExpire={() => { token.current = null; ref.current?.reset(); }} options={{ size: "invisible" }} />;

  /** Un jeton neuf (attend que Turnstile en donne un, 20 s au plus). */
  const take = useCallback(async (): Promise<string> => {
    const ready = token.current;
    token.current = null;
    const t = ready ?? await new Promise<string>((resolve, reject) => {
      waiting.current.push(resolve);
      setTimeout(() => reject(new Error("captcha timeout")), 20_000);
    });
    reset();
    return t;
  }, []);

  return { widget, take };
}
