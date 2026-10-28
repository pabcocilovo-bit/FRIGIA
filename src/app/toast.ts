// Petit message en bas de l'écran, appelable de partout : showToast("Ajouté à ta liste").
import { useEffect, useState } from "react";

type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function showToast(message: string) {
  listeners.forEach(l => l(message));
}

/** Le message affiché en ce moment (null quand il n'y en a pas). */
export function useToastMessage(duration = 2600): string | null {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const l: Listener = m => {
      setMessage(m);
      clearTimeout(t);
      t = setTimeout(() => setMessage(null), duration);
    };
    listeners.add(l);
    return () => { listeners.delete(l); clearTimeout(t); };
  }, [duration]);
  return message;
}

/** En attendant qu'un écran soit refait : dit à quelle étape du plan il arrive. */
export const comingSoon = (step: number) => showToast(`Écran à venir (étape ${step} du plan)`);
