// Premier scan guidé : des bulles qui montrent quoi toucher, une fois, juste après l'inscription.
// Trois sur la caméra (pour quand, le cadre, le déclencheur), puis deux sur « C'est bien ça ? ».
// « Passer » arrête tout, et ça ne revient plus.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Icon } from "../../ui/components";
import type { GuideStep } from "./guideSteps";

type Place = { hole: { left: number; top: number; width: number; height: number; borderRadius: number }; tip: { left: number; top: number }; arr: number };

export function Guide({ host, steps, delay, onDone, onSkip }: {
  host: RefObject<HTMLElement | null>; steps: GuideStep[]; delay: number;
  /** Fin des bulles (bouton de la dernière) */
  onDone: () => void;
  onSkip: () => void;
}) {
  const [on, setOn] = useState(false);
  const [i, setI] = useState(0);
  const [fade, setFade] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const st = steps[i];

  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  // La bulle se place sous, au-dessus ou au milieu de l'élément montré, le trou suit l'élément
  useLayoutEffect(() => {
    if (!on) return;
    const measure = () => {
      const h = host.current, el = h?.querySelector<HTMLElement>(st.target), tp = tip.current;
      if (!h || !el || !tp) return;
      // L'élément visé est sous le pli : on le fait remonter dans sa zone qui défile
      const sc = el.closest<HTMLElement>(".scroll");
      if (sc) {
        const er = el.getBoundingClientRect(), sr = sc.getBoundingClientRect();
        if (er.bottom > sr.bottom - 90) sc.scrollTop += er.bottom - sr.bottom + 110;
        else if (er.top < sr.top) sc.scrollTop -= sr.top - er.top + 20;
      }
      const hr = h.getBoundingClientRect(), r = el.getBoundingClientRect(), pad = st.pad ?? 6;
      const x = r.left - hr.left - pad, y = r.top - hr.top - pad, w = r.width + pad * 2, hh = r.height + pad * 2;
      const W = h.offsetWidth, H = h.offsetHeight, tw = tp.offsetWidth, th = tp.offsetHeight, cx = x + w / 2;
      const left = Math.max(16, Math.min(W - 16 - tw, cx - tw / 2));
      let top = st.pos === "down" ? y + hh + 14 : st.pos === "up" ? y - th - 14 : y + hh / 2 - th / 2;
      top = Math.max(12, Math.min(H - th - 12, top));
      setPlace({
        hole: { left: x, top: y, width: w, height: hh, borderRadius: st.r === 999 ? hh / 2 : st.r },
        tip: { left, top },
        arr: Math.max(18, Math.min(tw - 34, cx - left - 8)),
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [on, host, st]);

  const next = () => {
    if (i < steps.length - 1) {
      setFade(true);
      setTimeout(() => { setI(i + 1); setFade(false); }, 160);
    } else {
      setOn(false);
      onDone();
    }
  };

  return (
    <div className={"gd" + (on ? " on" : "")} aria-hidden={!on}>
      <span className="gd-hole" style={place?.hole} />
      <div ref={tip} className={["gd-tip", st.pos !== "down" && st.pos, fade && "fade"].filter(Boolean).join(" ")} role="dialog" aria-live="polite" aria-label={st.title} style={place?.tip}>
        <i className="gd-arr" style={place ? { left: place.arr } : undefined} />
        <span className="gd-k">{i + 1} sur {steps.length}</span>
        <b>{st.title}</b>
        <p>{st.text}</p>
        <div className="gd-f">
          <span className="gd-dots">{steps.map((_, j) => <i key={j} className={j === i ? "on" : undefined} />)}</span>
          <button type="button" className="gd-skip" onClick={() => { setOn(false); onSkip(); }}>Passer</button>
          <button type="button" className="pill sage gd-next" onClick={next}>{st.cam && <Icon name="cam" />}{st.btn ?? "Suivant"}</button>
        </div>
      </div>
    </div>
  );
}
