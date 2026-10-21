// Notifications (étape 12) : ce que l'appli fait pour elles où qu'on soit.
// Le centre se recharge à chaque retour dans l'appli ; une notif touchée sur le téléphone ouvre son écran et passe en lue.
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { addWelcome, markRead, refreshNotifs, resyncPush } from "../../lib/notify";
import type { User } from "../../lib/types";

const NEW_ACCOUNT_MS = 3 * 864e5;

export function useNotifSync(user: User | null) {
  const navigate = useNavigate();
  const location = useLocation();
  const id = user?.id, created = user?.created_at;

  useEffect(() => {
    if (!id) return;
    const load = () => { if (document.visibilityState === "visible") void refreshNotifs(id); };
    load();
    void resyncPush(id);
    // « Bienvenue » dans le centre d'un compte tout neuf
    const k = `frigia_welcome_${id}`;
    let seen = true;
    try { seen = !!localStorage.getItem(k); } catch { /* navigation privée */ }
    if (!seen && created && Date.now() - Date.parse(created) < NEW_ACCOUNT_MS) {
      void addWelcome(id).then(() => { try { localStorage.setItem(k, "1"); } catch { /* navigation privée */ } void refreshNotifs(id); });
    }
    document.addEventListener("visibilitychange", load);
    return () => document.removeEventListener("visibilitychange", load);
  }, [id, created]);

  // Notif touchée pendant que l'appli est ouverte (public/push-sw.js)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const on = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: unknown } | null;
      if (d?.type === "frigia-notif" && typeof d.url === "string" && d.url.startsWith("/")) navigate(d.url);
    };
    navigator.serviceWorker.addEventListener("message", on);
    return () => navigator.serviceWorker.removeEventListener("message", on);
  }, [navigate]);

  // …?notif=<id> : ouverte depuis le téléphone, donc lue
  const notif = new URLSearchParams(location.search).get("notif");
  useEffect(() => {
    if (!notif || !id) return;
    markRead([notif]);
    const params = new URLSearchParams(location.search);
    params.delete("notif");
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true, state: location.state });
  }, [notif, id, location.pathname, location.search, location.state, navigate]);
}
