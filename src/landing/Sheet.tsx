import { useEffect, useRef, type ReactNode } from "react";

// Feuille modale de la landing : bas de l'écran sur mobile, centrée sur ordinateur.
// Échap ou un clic sur le voile la ferment, le défilement de la page est bloqué tant qu'elle est ouverte.
export function Sheet({ label, onClose, wide, children }: { label: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  return (
    <div className="lp-veil" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} className={wide ? "lp-sheet wide" : "lp-sheet"} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <button className="lp-x" onClick={onClose} aria-label="Fermer">✕</button>
        {children}
      </div>
    </div>
  );
}
