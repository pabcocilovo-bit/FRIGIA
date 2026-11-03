// Glisser un plat d'une case à l'autre du planning (Hugo, 3 novembre). Au doigt : un appui long le soulève (un geste
// qui bouge avant reste un défilement normal) ; à la souris : on clique et on glisse. Les cases où on peut le poser
// portent data-drop="jour:repas". Près du haut ou du bas de l'écran, la page défile toute seule.
import { useEffect, useRef, useState } from "react";
import type { MealKey } from "../../lib/home";

export type Spot = { i: number; meal: MealKey };
export type DragState = { from: Spot; x: number; y: number; over: Spot | null };

const HOLD = 320, SLOP = 10, EDGE = 70;
const same = (a: Spot | null, b: Spot | null) => !!a && !!b && a.i === b.i && a.meal === b.meal;

function spotAt(x: number, y: number): Spot | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]");
  const [i, meal] = el?.dataset.drop?.split(":") ?? [];
  return el && (meal === "m" || meal === "s") ? { i: Number(i), meal } : null;
}

function scrollerOf(el: HTMLElement | null): HTMLElement {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

export function useSlotDrag(enabled: boolean, onDrop: (from: Spot, to: Spot) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const live = useRef<{ active: boolean; dropped: number }>({ active: false, dropped: 0 });
  const drop = useRef(onDrop);
  useEffect(() => { drop.current = onDrop; });

  // Une fois le plat soulevé, le doigt ne fait plus défiler la page (l'écouteur doit exister avant le geste)
  useEffect(() => {
    if (!enabled) return;
    const block = (e: TouchEvent) => { if (live.current.active && e.cancelable) e.preventDefault(); };
    window.addEventListener("touchmove", block, { passive: false });
    return () => window.removeEventListener("touchmove", block);
  }, [enabled]);

  const start = (e: React.PointerEvent<HTMLElement>, from: Spot) => {
    if (!enabled || e.button !== 0 || live.current.active) return;
    const el = e.currentTarget, x0 = e.clientX, y0 = e.clientY, id = e.pointerId, mouse = e.pointerType === "mouse";
    const frame = el.closest(".fa");
    let x = x0, y = y0, over: Spot | null = from, raf = 0, scroller: HTMLElement | null = null;

    const show = () => setDrag({ from, x, y, over });
    const lift = () => {
      live.current.active = true;
      scroller = scrollerOf(el);
      navigator.vibrate?.(12);
      show();
      raf = requestAnimationFrame(tick);
    };
    // Défilement automatique près des bords (sous l'en-tête vert, au-dessus de la barre d'onglets)
    const tick = () => {
      const top = Math.max(0, frame?.querySelector(".rhead")?.getBoundingClientRect().bottom ?? 0);
      const bottom = frame?.querySelector(".tabbar")?.getBoundingClientRect().top ?? window.innerHeight;
      const v = y < top + EDGE ? -(top + EDGE - y) : y > bottom - EDGE ? y - (bottom - EDGE) : 0;
      if (v && scroller) {
        const before = scroller.scrollTop;
        scroller.scrollTop += Math.max(-12, Math.min(12, v / 6));
        if (scroller.scrollTop !== before) { over = spotAt(x, y); show(); }
      }
      raf = requestAnimationFrame(tick);
    };
    const timer = mouse ? 0 : window.setTimeout(lift, HOLD);

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      x = ev.clientX; y = ev.clientY;
      if (!live.current.active) {
        if (Math.hypot(x - x0, y - y0) < SLOP) return;
        if (mouse) lift(); else { end(); return; }
      }
      const o = spotAt(x, y);
      over = o;
      show();
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      if (live.current.active) {
        live.current.dropped = Date.now();
        if (over && !same(over, from)) drop.current(from, over);
      }
      end();
    };
    const cancel = (ev: PointerEvent) => { if (ev.pointerId === id) end(); };
    function end() {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      live.current.active = false;
      setDrag(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  /** À poser sur la carte qu'on peut soulever. */
  const handle = (from: Spot) => enabled ? {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => start(e, from),
    // Le clic qui suit un glisser n'ouvre pas la recette ; l'appui long n'ouvre pas le menu du navigateur
    onClickCapture: (e: React.MouseEvent) => { if (Date.now() - live.current.dropped < 300) { e.preventDefault(); e.stopPropagation(); } },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
  } : {};

  return { drag, handle };
}
