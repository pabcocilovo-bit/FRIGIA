// « Pas de réseau » : l'écran s'ouvre quand le téléphone perd la connexion, ou quand on veut scanner sans réseau.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

const listeners = new Set<() => void>();
export const openOffline = () => listeners.forEach(l => l());

/** L'écran « Pas de réseau » est-il ouvert ? */
export function useOfflineScreen(): [boolean, () => void] {
  const [open, setOpen] = useState(() => !navigator.onLine);
  useEffect(() => {
    const show = () => setOpen(true);
    const hide = () => setOpen(false);
    listeners.add(show);
    window.addEventListener("offline", show);
    window.addEventListener("online", hide);
    return () => {
      listeners.delete(show);
      window.removeEventListener("offline", show);
      window.removeEventListener("online", hide);
    };
  }, []);
  return [open, () => setOpen(false)];
}

/** Le réseau répond-il vraiment ? (navigator.onLine peut dire oui sans qu'aucune page ne passe) */
export async function isReallyOnline(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const r = await fetch(`/favicon.svg?ping=${Date.now()}`, { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

/** Ouvre le scan, ou « Pas de réseau » si le téléphone n'est pas connecté : seul le scan attend le réseau. */
export function useOpenScan() {
  const navigate = useNavigate();
  return () => (navigator.onLine ? navigate("/scan") : openOffline());
}
