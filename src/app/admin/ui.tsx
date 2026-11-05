// Briques communes du dashboard de suivi : panneau, message vide, barres par jour.
import { useState, type ReactNode } from "react";

const nf = new Intl.NumberFormat("fr-FR");
const n = (v: number) => nf.format(v);
const dayLabel = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

export type Point = { jour: string; v: number };

export function Panel({ title, aside, children }: { title?: string; aside?: string; children: ReactNode }) {
  return (
    <div className="adm-card adm-panel">
      {title && <div className="adm-ph"><h3>{title}</h3>{aside && <span className="adm-muted adm-small">{aside}</span>}</div>}
      {children}
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="adm-empty">{children}</p>;

/** Une barre par jour, une seule couleur ; survol (ou toucher) : le jour et sa valeur */
export function BarChart({ days, label, height, fmt = n }: { days: Point[]; label: string; height: number; fmt?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height, top = 8, bottom = 22;
  // Pas de plancher à 1 : un jour de Claude coûte quelques centimes
  const max = Math.max(0, ...days.map(d => d.v)) || 1;
  const step = W / Math.max(1, days.length);
  const bw = Math.max(2, step - 2);
  const y = (v: number) => H - bottom - ((H - bottom - top) * v) / max;
  const ticks = [0, Math.floor(days.length / 2), days.length - 1].filter((v, i, a) => a.indexOf(v) === i && days[v]);
  const shown = hover != null ? days[hover] : null;
  return (
    <div className="adm-chart">
      <div className="adm-tip" aria-live="polite">
        {shown ? <><b>{fmt(shown.v)}</b> {label.toLowerCase()} · {dayLabel(shown.jour)}</> : <span className="adm-muted">Max {fmt(max)} par jour</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} par jour`} preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
        <line x1="0" x2={W} y1={y(max)} y2={y(max)} className="adm-grid" />
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} className="adm-axis" />
        {days.map((d, i) => {
          const x = i * step + (step - bw) / 2, yy = y(d.v), h = H - bottom - yy, r = Math.min(4, bw / 2, h);
          return (
            <g key={d.jour} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={i * step} y={0} width={step} height={H - bottom} fill="transparent" />
              {h > 0 && <path className={hover === i ? "on" : undefined}
                d={`M${x},${H - bottom} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${H - bottom} Z`} />}
            </g>
          );
        })}
      </svg>
      <div className="adm-xl">
        {ticks.map(i => <span key={i} style={{ left: `${((i + 0.5) / days.length) * 100}%` }}>{dayLabel(days[i].jour)}</span>)}
      </div>
    </div>
  );
}
