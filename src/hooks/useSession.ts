// Session Supabase : la personne connectée et le rafraîchissement régulier (Plus suit vite le webhook Stripe).
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import type { User } from "../lib/types";

type Handlers = {
  /** Connexion trouvée au démarrage (source "start") ou annoncée par Supabase (source "event"). */
  onSignedIn: (u: User, source: "start" | "event") => void;
  onSignedOut: () => void;
};

export function useSession(handlers: Handlers) {
  const [user, setUser] = useState<User | null>(null);
  // Vrai dès qu'on sait si quelqu'un est connecté (la session est lue au démarrage)
  const [ready, setReady] = useState(false);
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; });

  useEffect(() => {
    const signedIn = (u: User, source: "start" | "event") => handlersRef.current.onSignedIn(u, source);

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      setReady(true);
      if (u) signedIn(u, "start");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) signedIn(u, "event");
      else handlersRef.current.onSignedOut();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Rafraîchit la session toutes les 5 min pour que Plus suive vite les changements du webhook
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase.auth.refreshSession();
      const u = data.session?.user ?? null;
      if (u) setUser(u);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { user, ready };
}
