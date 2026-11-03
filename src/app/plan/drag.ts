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

  // Au doigt, on suit les évènements tactiles plutôt que les « pointer events » : sur iPhone et Android, le navigateur
  // peut annuler ces derniers (pointercancel) dès qu'il croit à un défilement ou à un appui long, et le plat retombe.
  const start = (el: HTMLElement, from: Spot, x0: number, y0: number, mouse: boolean, id: number) => {
    if (!enabled || live.current.active) return;
    const frame = el.closest(".fa");
    let x = x0, y = y0, over: Spot | null = from, raf = 0, scroller: HTMLElement | null = null;

    const show = () => setDrag({ from, x, y, over });
    // Entre deux cases (le petit espace entre midi et soir, ou entre deux jours), on garde la dernière case visée
    const inList = (px: number, py: number) => {
      const r = el.closest(".days")?.getBoundingClientRect();
      const top = Math.max(0, frame?.querySelector(".rhead")?.getBoundingClientRect().bottom ?? 0);
      const bottom = frame?.querySelector(".tabbar")?.getBoundingClientRect().top ?? window.innerHeight;
      return !!r && px >= r.left && px <= r.right && py >= Math.max(r.top, top) && py <= Math.min(r.bottom, bottom);
    };
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
        if (scroller.scrollTop !== before) { over = spotAt(x, y) ?? (inList(x, y) ? over : null); show(); }
      }
      raf = requestAnimationFrame(tick);
    };
    const timer = mouse ? 0 : window.setTimeout(lift, HOLD);

    const at = (nx: number, ny: number) => {
      x = nx; y = ny;
      if (!live.current.active) {
        if (Math.hypot(x - x0, y - y0) < SLOP) return;
        if (mouse) lift(); else { end(); return; }
      }
      over = spotAt(x, y) ?? (inList(x, y) ? over : null);
      show();
    };
    const release = () => {
      if (live.current.active) {
        live.current.dropped = Date.now();
        if (over && !same(over, from)) drop.current(from, over);
      }
      end();
    };
    const finger = (ev: TouchEvent) => [...ev.changedTouches].find(t => t.identifier === id);
    const tMove = (ev: TouchEvent) => { const t = finger(ev); if (t) at(t.clientX, t.clientY); };
    const tEnd = (ev: TouchEvent) => { if (finger(ev)) release(); };
    const pMove = (ev: PointerEvent) => { if (ev.pointerId === id) at(ev.clientX, ev.clientY); };
    const pUp = (ev: PointerEvent) => { if (ev.pointerId === id) release(); };
    const pCancel = (ev: PointerEvent) => { if (ev.pointerId === id) end(); };
    const on: [string, EventListener][] = mouse
      ? [["pointermove", pMove as EventListener], ["pointerup", pUp as EventListener], ["pointercancel", pCancel as EventListener]]
      : [["touchmove", tMove as EventListener], ["touchend", tEnd as EventListener], ["touchcancel", end]];
    function end() {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      live.current.active = false;
      setDrag(null);
      on.forEach(([t, f]) => window.removeEventListener(t, f));
    }
    on.forEach(([t, f]) => window.addEventListener(t, f, { passive: true }));
  };

  /** À poser sur la carte qu'on peut soulever. */
  const handle = (from: Spot) => enabled ? {
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
      const t = e.changedTouches[0];
      if (e.touches.length === 1 && t) start(e.currentTarget, from, t.clientX, t.clientY, false, t.identifier);
    },
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "touch" && e.button === 0) start(e.currentTarget, from, e.clientX, e.clientY, true, e.pointerId);
    },
    // Le clic qui suit un glisser n'ouvre pas la recette ; l'appui long n'ouvre pas le menu du navigateur
    onClickCapture: (e: React.MouseEvent) => { if (Date.now() - live.current.dropped < 300) { e.preventDefault(); e.stopPropagation(); } },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
  } : {};

  return { drag, handle };
}
