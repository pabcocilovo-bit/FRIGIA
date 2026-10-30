// Le dashboard de suivi (/admin, demandé par Hugo le 30 octobre) : comment tourne l'appli et ce qui coince.
// Deux affichages : ordinateur (menu à gauche, tout sur une page, tableaux) et téléphone (onglets, cartes).
// Réservé aux comptes avec app_metadata.admin (src/App.tsx), les chiffres : src/app/admin/admin.ts.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { type Day, type Dashboard, type Loaded, loadDashboard } from "./admin";
import "./admin.css";

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];

const SERIES: { key: keyof Omit<Day, "jour">; label: string }[] = [
  { key: "inscriptions", label: "Inscriptions" },
  { key: "scans", label: "Scans" },
  { key: "cuisines", label: "Recettes cuisinées" },
  { key: "liste_attente", label: "Liste d'attente" },
];

const KINDS = { bug: "Bug", contact: "Contact", idea: "Idée" } as const;

const nf = new Intl.NumberFormat("fr-FR");
const n = (v: number) => nf.format(v);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "–");
const dayLabel = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const sum = (days: Day[], k: keyof Omit<Day, "jour">) => days.reduce((t, d) => t + d[k], 0);

/** Ordinateur à partir de 900 px de large */
function useWide() {
  const query = "(min-width: 900px)";
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return wide;
}

export default function Admin() {
  const wide = useWide();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>(30);
  // « Actualiser » relance le chargement ; loading tant que la réponse n'est pas celle de la demande en cours
  const [ask, setAsk] = useState(0);
  const [state, setState] = useState<{ key: string; r: Loaded } | null>(null);
  const key = `${period}:${ask}`;
  const loading = state?.key !== key;
  useEffect(() => {
    let live = true;
    void loadDashboard(period).then(r => { if (live) setState({ key: `${period}:${ask}`, r }); });
    return () => { live = false; };
  }, [period, ask]);
  const refresh = useCallback(() => setAsk(a => a + 1), []);

  const exit = () => navigate("/");
  const props = { period, onPeriod: setPeriod, onRefresh: refresh, loading, onExit: exit };

  if (!state) return <div className="adm adm-center"><p className="adm-muted">Chargement des chiffres…</p></div>;
  const res = state.r;
  if (res.status !== "ok") {
    return (
      <div className="adm adm-center">
        <div className="adm-card adm-msg">
          <h1>{res.status === "denied" ? "Accès réservé" : "Les chiffres n'ont pas pu être chargés"}</h1>
          <p>{res.status === "denied"
            ? "Ce compte n'a pas l'accès admin. Déconnecte-toi puis reconnecte-toi si tu viens de te le donner."
            : res.message}</p>
          <div className="adm-row">
            <button type="button" className="adm-btn" onClick={refresh}>Réessayer</button>
            <button type="button" className="adm-btn line" onClick={exit}>Retour à l'appli</button>
          </div>
        </div>
      </div>
    );
  }
  return wide ? <Desktop data={res.data} {...props} /> : <Mobile data={res.data} {...props} />;
}

type ViewProps = {
  data: Dashboard; period: Period; onPeriod: (p: Period) => void; onRefresh: () => void; loading: boolean; onExit: () => void;
};

// ─── Ordinateur ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "resume", label: "Vue d'ensemble" },
  { id: "activite", label: "Activité" },
  { id: "problemes", label: "Problèmes" },
  { id: "abus", label: "Abus d'essai" },
];

function Desktop({ data, period, onPeriod, onRefresh, loading, onExit }: ViewProps) {
  const go = (id: string) => document.getElementById(`adm-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const problems = data.support_7j.bug + data.abus.connexions.length;
  return (
    <div className="adm adm-wide">
      <aside className="adm-side">
        <div className="adm-brand">Frigia <em>suivi</em></div>
        <nav>
          {SECTIONS.map(s => (
            <button key={s.id} type="button" onClick={() => go(s.id)}>
              {s.label}
              {s.id === "problemes" && data.support_7j.bug > 0 && <span className="adm-dot">{data.support_7j.bug}</span>}
              {s.id === "abus" && data.abus.connexions.length > 0 && <span className="adm-dot">{data.abus.connexions.length}</span>}
            </button>
          ))}
        </nav>
        <button type="button" className="adm-btn line adm-exit" onClick={onExit}>Retour à l'appli</button>
      </aside>

      <main className="adm-main">
        <header className="adm-top">
          <div>
            <h1>Tableau de <em>bord</em></h1>
            <p className="adm-muted">
              Mis à jour à {time(data.genere_le)}
              {problems > 0 ? ` · ${problems} point${problems > 1 ? "s" : ""} à regarder` : " · rien d'anormal"}
            </p>
          </div>
          <div className="adm-row">
            <Periods value={period} onChange={onPeriod} />
            <button type="button" className="adm-btn" onClick={onRefresh} disabled={loading}>{loading ? "…" : "Actualiser"}</button>
          </div>
        </header>

        <section id="adm-resume">
          <Kpis data={data} />
          <div className="adm-grid2">
            <Panel title="Essais et abonnements"><Funnel data={data} /></Panel>
            <Panel title="Utilisation"><Usage data={data} /></Panel>
          </div>
        </section>

        <section id="adm-activite">
          <h2>Activité · {period} derniers jours</h2>
          <div className="adm-grid2">
            {SERIES.map(s => (
              <Panel key={s.key} title={s.label} aside={`${n(sum(data.par_jour, s.key))} au total`}>
                <BarChart days={data.par_jour} k={s.key} label={s.label} height={150} />
              </Panel>
            ))}
          </div>
        </section>

        <section id="adm-problemes">
          <h2>Problèmes remontés</h2>
          <SupportCounts data={data} />
          <Panel title="Derniers messages (Aide › Nous écrire)"><SupportTable list={data.support} /></Panel>
        </section>

        <section id="adm-abus">
          <h2>Abus d'essai</h2>
          <div className="adm-grid2">
            <Panel title="Connexions partagées par 3 comptes ou plus" aside="Regarde surtout l'appareil et les dates : une IP 4G peut être partagée">
              <SharedTable list={data.abus.connexions} />
            </Panel>
            <Panel title="Comptes recréés (sans essai)" aside={`${n(data.comptes.recrees_sans_essai)} au total`}>
              <RecreatedTable list={data.abus.recrees} />
            </Panel>
          </div>
        </section>
      </main>
    </div>
  );
}

// ─── Téléphone ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "resume", label: "Résumé" },
  { id: "activite", label: "Activité" },
  { id: "problemes", label: "Problèmes" },
  { id: "abus", label: "Abus" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function Mobile({ data, period, onPeriod, onRefresh, loading, onExit }: ViewProps) {
  const [tab, setTab] = useState<Tab>("resume");
  const [serie, setSerie] = useState<(typeof SERIES)[number]["key"]>("inscriptions");
  const current = SERIES.find(s => s.key === serie)!;
  const badge = (id: Tab) => (id === "problemes" ? data.support_7j.bug : id === "abus" ? data.abus.connexions.length : 0);
  return (
    <div className="adm adm-phone">
      <header className="adm-ptop">
        <div className="adm-row adm-between">
          <button type="button" className="adm-icon" onClick={onExit} aria-label="Retour à l'appli">‹</button>
          <div className="adm-brand">Frigia <em>suivi</em></div>
          <button type="button" className="adm-icon" onClick={onRefresh} disabled={loading} aria-label="Actualiser">{loading ? "…" : "↻"}</button>
        </div>
        <div className="adm-tabs" role="tablist">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); window.scrollTo(0, 0); }}>
              {t.label}{badge(t.id) > 0 && <span className="adm-dot">{badge(t.id)}</span>}
            </button>
          ))}
        </div>
      </header>

      <main className="adm-pmain">
        <p className="adm-muted adm-small">Mis à jour à {time(data.genere_le)}</p>
        {tab === "resume" && <>
          <Kpis data={data} />
          <Panel title="Essais et abonnements"><Funnel data={data} /></Panel>
          <Panel title="Utilisation"><Usage data={data} /></Panel>
        </>}

        {tab === "activite" && <>
          <Periods value={period} onChange={onPeriod} />
          <div className="adm-chips">
            {SERIES.map(s => (
              <button key={s.key} type="button" aria-pressed={serie === s.key} onClick={() => setSerie(s.key)}>{s.label}</button>
            ))}
          </div>
          <Panel title={current.label} aside={`${n(sum(data.par_jour, serie))} sur ${period} jours`}>
            <BarChart days={data.par_jour} k={serie} label={current.label} height={190} />
          </Panel>
          <Panel title="Sur la période">
            <ul className="adm-stats">
              {SERIES.map(s => <li key={s.key}><span>{s.label}</span><b>{n(sum(data.par_jour, s.key))}</b></li>)}
            </ul>
          </Panel>
        </>}

        {tab === "problemes" && <>
          <SupportCounts data={data} />
          <h2>Derniers messages</h2>
          <SupportCards list={data.support} />
        </>}

        {tab === "abus" && <>
          <h2>Connexions partagées</h2>
          <p className="adm-muted adm-small">3 comptes ou plus sur la même IP et le même appareil. Une IP 4G peut être partagée : regarde les dates.</p>
          {data.abus.connexions.length === 0
            ? <Empty>Aucune connexion partagée.</Empty>
            : data.abus.connexions.map(c => (
              <article key={c.ip + c.user_agent} className="adm-card adm-item">
                <div className="adm-row adm-between"><b>{c.comptes} comptes</b><span className="adm-tag">{c.abonnes} abonné{c.abonnes > 1 ? "s" : ""}</span></div>
                <p className="adm-mono">{c.ip}</p>
                <p className="adm-muted adm-small">{device(c.user_agent)} · dernier le {when(c.dernier)}</p>
                <p className="adm-small adm-break">{c.emails}</p>
              </article>
            ))}
          <h2>Comptes recréés <span className="adm-muted">({n(data.comptes.recrees_sans_essai)})</span></h2>
          {data.abus.recrees.length === 0
            ? <Empty>Aucun compte recréé.</Empty>
            : <Panel><ul className="adm-stats">
              {data.abus.recrees.map(r => <li key={r.email + r.created_at}><span className="adm-break">{r.email}</span><b className="adm-small">{when(r.created_at)}</b></li>)}
            </ul></Panel>}
        </>}
      </main>
    </div>
  );
}

// ─── Briques communes ────────────────────────────────────────────────────────

function Panel({ title, aside, children }: { title?: string; aside?: string; children: ReactNode }) {
  return (
    <div className="adm-card adm-panel">
      {title && <div className="adm-ph"><h3>{title}</h3>{aside && <span className="adm-muted adm-small">{aside}</span>}</div>}
      {children}
    </div>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <p className="adm-empty">{children}</p>;

function Periods({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="adm-seg" role="radiogroup" aria-label="Période">
      {PERIODS.map(p => <button key={p} type="button" role="radio" aria-checked={p === value} onClick={() => onChange(p)}>{p} j</button>)}
    </div>
  );
}

function Kpis({ data }: { data: Dashboard }) {
  const c = data.comptes;
  const paying = c.abonnes + c.abonnes_essai;
  const tiles: { label: string; value: number; sub: string; warn?: boolean }[] = [
    { label: "Comptes", value: c.total, sub: `+${n(c.nouveaux_7j)} en 7 jours · +${n(c.nouveaux_jour)} aujourd'hui` },
    { label: "Abonnés", value: paying, sub: `${pct(paying, c.total)} des comptes` },
    { label: "En essai", value: c.essai, sub: `${n(c.essai_fini_sans_payer)} essais finis sans payer` },
    { label: "Actifs 7 jours", value: data.actifs_7j, sub: `ont scanné ou cuisiné · ${pct(data.actifs_7j, c.total)}` },
    { label: "Scans 7 jours", value: data.usage.scans_7j, sub: `${n(data.usage.scans)} au total` },
    { label: "Liste d'attente", value: data.liste_attente.total, sub: `+${n(data.liste_attente.nouveaux_7j)} en 7 jours · ${n(data.liste_attente.invites)} invités` },
  ];
  return (
    <div className="adm-kpis">
      {tiles.map(t => (
        <div key={t.label} className="adm-card adm-kpi">
          <span className="adm-muted">{t.label}</span>
          <b>{n(t.value)}</b>
          <span className="adm-small adm-muted">{t.sub}</span>
        </div>
      ))}
    </div>
  );
}

/** Où en sont les comptes : une barre par état, à l'échelle du total */
function Funnel({ data }: { data: Dashboard }) {
  const c = data.comptes;
  const rows = [
    { label: "En essai", v: c.essai },
    { label: "Abonnés", v: c.abonnes },
    { label: "Abonnés en période d'essai Stripe", v: c.abonnes_essai },
    { label: "Comptes offerts", v: c.offerts },
    { label: "Essai fini sans payer", v: c.essai_fini_sans_payer },
    { label: "Paiement refusé", v: c.paiement_refuse, warn: true },
  ];
  const total = c.total || 1;
  return (
    <ul className="adm-bars">
      {rows.map(r => (
        <li key={r.label}>
          <div className="adm-row adm-between"><span>{r.label}</span><b className={r.warn && r.v > 0 ? "adm-warn" : undefined}>{n(r.v)} <span className="adm-muted adm-small">{pct(r.v, c.total)}</span></b></div>
          <div className="adm-track"><i className={r.warn ? "warn" : undefined} style={{ width: `${(r.v / total) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function Usage({ data }: { data: Dashboard }) {
  const u = data.usage;
  const rows: [string, string][] = [
    ["Recettes cuisinées", `${n(u.cuisines)} · +${n(u.cuisines_7j)} en 7 j`],
    ["Nourriture sauvée", `${nf.format(u.kg_sauves)} kg · ${n(u.eur_sauves)} €`],
    ["Recettes en favori", n(u.favoris)],
    ["Connectés en 7 jours", n(data.comptes.connectes_7j)],
    ["Notifications activées", n(u.notifs_actives)],
    ["Réponses au questionnaire", n(u.avis_beta)],
  ];
  return <ul className="adm-stats">{rows.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}</ul>;
}

/** Une barre par jour, une seule couleur ; survol (ou toucher) : le jour et sa valeur */
function BarChart({ days, k, label, height }: { days: Day[]; k: keyof Omit<Day, "jour">; label: string; height: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = height, top = 8, bottom = 22;
  const max = Math.max(1, ...days.map(d => d[k]));
  const step = W / Math.max(1, days.length);
  const bw = Math.max(2, step - 2);
  const y = (v: number) => H - bottom - ((H - bottom - top) * v) / max;
  const ticks = [0, Math.floor(days.length / 2), days.length - 1].filter((v, i, a) => a.indexOf(v) === i && days[v]);
  const shown = hover != null ? days[hover] : null;
  return (
    <div className="adm-chart">
      <div className="adm-tip" aria-live="polite">
        {shown ? <><b>{n(shown[k])}</b> {label.toLowerCase()} · {dayLabel(shown.jour)}</> : <span className="adm-muted">Max {n(max)} par jour</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} par jour`} preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
        <line x1="0" x2={W} y1={y(max)} y2={y(max)} className="adm-grid" />
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} className="adm-axis" />
        {days.map((d, i) => {
          const x = i * step + (step - bw) / 2, yy = y(d[k]), h = H - bottom - yy, r = Math.min(4, bw / 2, h);
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

function SupportCounts({ data }: { data: Dashboard }) {
  const s = data.support_7j;
  return (
    <div className="adm-kpis adm-kpis3">
      {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map(k => (
        <div key={k} className="adm-card adm-kpi">
          <span className="adm-muted">{KINDS[k]}s · 7 jours</span>
          <b className={k === "bug" && s[k] > 0 ? "adm-warn" : undefined}>{n(s[k])}</b>
        </div>
      ))}
    </div>
  );
}

function SupportTable({ list }: { list: Dashboard["support"] }) {
  if (!list.length) return <Empty>Aucun message pour l'instant.</Empty>;
  return (
    <table className="adm-table">
      <thead><tr><th>Date</th><th>Type</th><th>Sujet</th><th>Message</th><th>Email</th></tr></thead>
      <tbody>
        {list.map(m => (
          <tr key={m.id}>
            <td className="adm-nowrap">{when(m.created_at)}</td>
            <td><span className={`adm-tag ${m.kind}`}>{KINDS[m.kind]}</span></td>
            <td>{m.topic ?? "–"}</td>
            <td className="adm-msgcell">{m.message}</td>
            <td className="adm-break">{m.email ? <a href={`mailto:${m.email}`}>{m.email}</a> : "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SupportCards({ list }: { list: Dashboard["support"] }) {
  if (!list.length) return <Empty>Aucun message pour l'instant.</Empty>;
  return <>{list.map(m => (
    <article key={m.id} className="adm-card adm-item">
      <div className="adm-row adm-between">
        <span className={`adm-tag ${m.kind}`}>{KINDS[m.kind]}{m.topic ? ` · ${m.topic}` : ""}</span>
        <span className="adm-muted adm-small">{when(m.created_at)}</span>
      </div>
      <p>{m.message}</p>
      {m.email && <a className="adm-small adm-break" href={`mailto:${m.email}`}>{m.email}</a>}
    </article>
  ))}</>;
}

/** iPhone, Android, Mac… plutôt que tout le user_agent */
function device(ua: string | null): string {
  if (!ua) return "Appareil inconnu";
  const s = ua.toLowerCase();
  const os = s.includes("iphone") ? "iPhone" : s.includes("ipad") ? "iPad" : s.includes("android") ? "Android"
    : s.includes("mac os") ? "Mac" : s.includes("windows") ? "Windows" : s.includes("linux") ? "Linux" : "Autre";
  const app = s.includes("crios") || s.includes("chrome") ? "Chrome" : s.includes("firefox") || s.includes("fxios") ? "Firefox" : s.includes("safari") ? "Safari" : "";
  return app ? `${os} · ${app}` : os;
}

function SharedTable({ list }: { list: Dashboard["abus"]["connexions"] }) {
  if (!list.length) return <Empty>Aucune connexion partagée.</Empty>;
  return (
    <table className="adm-table">
      <thead><tr><th>IP</th><th>Appareil</th><th>Comptes</th><th>Abonnés</th><th>Emails</th></tr></thead>
      <tbody>
        {list.map(c => (
          <tr key={c.ip + c.user_agent}>
            <td className="adm-mono">{c.ip}</td>
            <td title={c.user_agent ?? ""}>{device(c.user_agent)}</td>
            <td><b>{c.comptes}</b></td>
            <td>{c.abonnes}</td>
            <td className="adm-break adm-small">{c.emails}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RecreatedTable({ list }: { list: Dashboard["abus"]["recrees"] }) {
  if (!list.length) return <Empty>Aucun compte recréé.</Empty>;
  return (
    <table className="adm-table">
      <thead><tr><th>Email</th><th>Créé le</th><th>Abonnement</th></tr></thead>
      <tbody>
        {list.map(r => (
          <tr key={r.email + r.created_at}>
            <td className="adm-break">{r.email}</td>
            <td className="adm-nowrap">{when(r.created_at)}</td>
            <td>{r.status === "active" ? "Abonné" : r.status ?? "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
