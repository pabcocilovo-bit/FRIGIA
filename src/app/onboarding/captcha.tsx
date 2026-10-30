// Anti-robot invisible (Cloudflare Turnstile), demandé par Supabase pour créer un compte, se connecter
// ou recevoir un code. Même clé que la landing. Chaque jeton ne sert qu'une fois.
import { useCallback, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

// Aperçus Vercel des branches et localhost : la clé de test de Cloudflare (toujours valide), pour ne pas ajouter
// chaque nouvelle branche dans Turnstile. Ils utilisent la base frigia-test, dont le captcha Supabase est coupé.
const PREVIEW = typeof window !== "undefined"
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
  const widget = (
    <Turnstile ref={ref} siteKey={SITE_KEY} onSuccess={onSuccess} onExpire={() => { token.current = null; ref.current?.reset(); }} options={{ size: "invisible" }} />
  );

  /** Un jeton neuf (attend que Turnstile en donne un, 20 s au plus). */
  const take = useCallback(async (): Promise<string> => {
    const ready = token.current;
    token.current = null;
    const t = ready ?? await new Promise<string>((resolve, reject) => {
      waiting.current.push(resolve);
      setTimeout(() => reject(new Error("captcha timeout")), 20_000);
    });
    ref.current?.reset();
    return t;
  }, []);

  return { widget, take };
}
