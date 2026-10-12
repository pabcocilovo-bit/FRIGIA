// Briques de base du nouveau design (prototype V3). Le style est dans ui.css, sous .fa.
import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ICONS, type IconName } from "./icons";
import "./ui.css";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const d = ICONS[name];
  return <svg className={cx("i", className)} viewBox={d.vb} {...d.a} aria-hidden="true" dangerouslySetInnerHTML={{ __html: d.svg }} />;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** Bouton pilule. sage = action principale, line = secondaire, cream / ghost = sur fond vert, danger = supprimer. */
export function Pill({ tone = "sage", block, icon, className, children, ...rest }: BtnProps & {
  tone?: "sage" | "cream" | "line" | "ghost" | "danger"; block?: boolean; icon?: IconName;
}) {
  return (
    <button type="button" className={cx("pill", tone, block && "block", className)} {...rest}>
      {icon && <Icon name={icon} />}{children}
    </button>
  );
}

/** Bouton rond avec une icône (retour, fermer, caméra…). Le libellé est obligatoire pour les lecteurs d'écran. */
export function RoundButton({ icon, label, tone = "cream", big, className, ...rest }: BtnProps & {
  icon: IconName; label: string; tone?: "cream" | "glass" | "dark"; big?: boolean;
}) {
  return (
    <button type="button" aria-label={label} className={cx("cbtn", tone, big && "big", className)} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

export function TextLink({ className, ...rest }: BtnProps) {
  return <button type="button" className={cx("link", className)} {...rest} />;
}

export function Chip({ on, ongreen, className, ...rest }: BtnProps & { on?: boolean; ongreen?: boolean }) {
  return <button type="button" aria-pressed={on} className={cx("chip", ongreen ? "ongreen" : "light", on && "on", className)} {...rest} />;
}

export function Chips({ children }: { children: ReactNode }) {
  return <div className="chips">{children}</div>;
}

export function Badge({ tone, icon, children }: { tone?: "warn" | "ongreen"; icon?: IconName; children: ReactNode }) {
  return <span className={cx("badge", tone)}>{icon && <Icon name={icon} />}{children}</span>;
}

/** Pastille dorée « Plus » sur ce qui est réservé à l'abonnement. */
export function LockPill({ children = "Plus" }: { children?: ReactNode }) {
  return <span className="lockpill"><Icon name="lock" />{children}</span>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("card", className)}>{children}</div>;
}

/** Bandeau vert (accueil, bilan…). */
export function Band({ label, title, children }: { label?: string; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className="band">
      {label && <span className="label">{label}</span>}
      {title && <h2>{title}</h2>}
      {children}
    </div>
  );
}

/** Pied de bandeau vert, sous un filet : jauge de scans ou personnes à table. */
export function BandFoot({ children }: { children: ReactNode }) {
  return <div className="band-foot">{children}</div>;
}

/** Jauge des scans gratuits utilisés. */
export function QuotaBar({ used, total }: { used: number; total: number }) {
  return <span className="quota-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={used}><b style={{ width: `${Math.min(100, (used / total) * 100)}%` }} /></span>;
}

/** Pastilles des initiales, qui se chevauchent (qui mange ce soir). */
export function AvatarStack({ names }: { names: string[] }) {
  return <span className="stack" aria-hidden="true">{names.map((n, i) => <i key={i}>{n.charAt(0).toUpperCase()}</i>)}</span>;
}

/** Carte d'un plat : photo ronde, nom en serif, infos, flèche. */
export function DishCard({ img, title, meta, onClick }: { img: string; title: string; meta?: string; onClick?: () => void }) {
  return (
    <button type="button" className="dish" onClick={onClick}>
      <img className="plate" src={img} alt="" />
      <span className="dish-tx"><b>{title}</b>{meta && <span>{meta}</span>}</span>
      <span className="dish-go" aria-hidden="true"><Icon name="arrow" /></span>
    </button>
  );
}

/** En-tête d'écran : boutons ronds en haut, grand titre serif avec le mot clé en italique (<em>). */
export function ScreenHeader({ title, sub, left, right, children }: {
  title: ReactNode; sub?: ReactNode; left?: ReactNode; right?: ReactNode; children?: ReactNode;
}) {
  return (
    <header className="shead">
      {(left || right) && <div className="shead-row"><span>{left}</span><span>{right}</span></div>}
      <h1 className="title">{title}</h1>
      {sub && <span className="shead-sub">{sub}</span>}
      {children}
    </header>
  );
}

export type TabId = "home" | "plan" | "list" | "family";
const TABS: { id: TabId; label: string; icon: IconName; plusOnly?: boolean }[] = [
  { id: "home", label: "Accueil", icon: "home" },
  { id: "plan", label: "Planning", icon: "cal", plusOnly: true },
  { id: "list", label: "Courses", icon: "cart", plusOnly: true },
  { id: "family", label: "Famille", icon: "users" },
];

/** Barre d'onglets verte, le scan au milieu. Un cadenas doré marque les onglets Plus quand on est en Gratuit. */
export function TabBar({ active, isPlus, onTab, onScan }: {
  active?: TabId; isPlus: boolean; onTab: (t: TabId) => void; onScan: () => void;
}) {
  const tab = (t: (typeof TABS)[number]) => (
    <button key={t.id} type="button" className={cx("tab", t.id === active && "on")} aria-current={t.id === active ? "page" : undefined} onClick={() => onTab(t.id)}>
      <span className="tic"><Icon name={t.icon} />{t.plusOnly && !isPlus && <i className="lk"><Icon name="lock" /></i>}</span>
      {t.label}
    </button>
  );
  return (
    <nav className="tabbar" aria-label="Navigation">
      {TABS.slice(0, 2).map(tab)}
      <button type="button" className="tab-scan" aria-label="Scanner mon frigo" onClick={onScan}><Icon name="cam" /></button>
      {TABS.slice(2).map(tab)}
    </nav>
  );
}

/** Champ de saisie avec son libellé, une icône et un message d'erreur. */
export function Field({ label, icon, error, after, ...input }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; icon?: IconName; error?: string; after?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={cx("input", error && "bad")}>
        {icon && <Icon name={icon} />}
        <input id={id} aria-invalid={!!error} aria-describedby={error ? id + "-err" : undefined} {...input} />
        {after}
      </div>
      {error && <span className="field-err" id={id + "-err"}>{error}</span>}
    </div>
  );
}

export function SearchField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <label className="search"><Icon name="search" /><input type="search" autoComplete="off" {...props} /></label>;
}

/** Choix exclusif entre 2 ou 3 options (Mensuel / Annuel…). */
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={cx(o.value === value && "on")} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)}><i /></button>;
}

/** Rubrique de réglages : un petit titre et une carte de lignes. */
export function ListSection({ title, children }: { title?: string; children: ReactNode }) {
  return <>{title && <span className="lsec">{title}</span>}<div className="lcard">{children}</div></>;
}

/** Ligne de réglage. Avec onClick, c'est un bouton avec un chevron ; avec `control`, l'interrupteur va à droite. */
export function ListRow({ icon, title, sub, value, control, danger, onClick }: {
  icon?: IconName; title: ReactNode; sub?: ReactNode; value?: ReactNode; control?: ReactNode; danger?: boolean; onClick?: () => void;
}) {
  const inner = (
    <>
      {icon && <span className="pi"><Icon name={icon} /></span>}
      <span className="lrow-tx"><b>{title}</b>{sub && <small>{sub}</small>}</span>
      {value && <span className="lrow-v">{value}</span>}
      {control}
      {onClick && !control && <Icon name="next" className="lrow-chev" />}
    </>
  );
  return onClick
    ? <button type="button" className={cx("lrow", danger && "danger")} onClick={onClick}>{inner}</button>
    : <div className={cx("lrow", danger && "danger")}>{inner}</div>;
}

/** État vide : un dessin (art), un titre serif, une phrase et un bouton. */
export function EmptyState({ art, title, text, action }: { art?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="es">
      {art}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
}

/** Grande feuille qui monte du bas (choisir un repas, ajouter un ingrédient…). */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  useEscape(open, onClose);
  return createPortal(
    <div className={cx("fa fa-layer", open && "open")} aria-hidden={!open} inert={!open}>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <span className="grab" />
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Petite feuille flottante (code introuvable, nous écrire…) : un rond avec une icône, un titre serif, du texte, des boutons. */
export function Dialog({ open, onClose, icon, badge, title, children }: {
  open: boolean; onClose: () => void; icon?: IconName; badge?: ReactNode; title: ReactNode; children?: ReactNode;
}) {
  useEscape(open, onClose);
  return createPortal(
    <div className={cx("fa fa-layer", open && "open")} aria-hidden={!open} inert={!open}>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true">
        <span className="grab" />
        {icon && <span className="dialog-art"><Icon name={icon} />{badge != null && <span className="dialog-badge">{badge}</span>}</span>}
        <h3>{title}</h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Petit message en bas de l'écran. Passe message = null pour le cacher. */
export function Toast({ message }: { message: string | null }) {
  return (
    <div className={cx("toast", message && "on")} role="status" aria-live="polite">
      <Icon name="check" /><span>{message}</span>
    </div>
  );
}
