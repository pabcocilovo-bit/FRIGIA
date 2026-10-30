// Le dashboard de suivi (/admin, demandé par Hugo le 30 octobre) : comment tourne l'appli et ce qui coince.
// Deux affichages : ordinateur (menu à gauche, tout sur une page, tableaux) et téléphone (onglets, cartes).
// Réservé aux comptes avec app_metadata.admin (src/App.tsx), les chiffres : src/app/admin/admin.ts.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { type Day, type Dashboard, type Finances, type ListKey, type Loaded, type Person, type WaitlistRow, loadDashboard, loadFinances, loadList } from "./admin";
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
const eurF = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const usdF = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" });
const usdSmall = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
/** Dollars : 4 décimales sous 1 $ (un jour de Haiku coûte quelques centimes) */
const usd = (v: number) => (v < 1 ? usdSmall : usdF).format(v);
/** Centimes → « 12,34 € » */
const cents = (c: number) => eurF.format(c / 100);
type Point = { jour: string; v: number };
const points = (days: Day[], k: keyof Omit<Day, "jour">): Point[] => days.map(d => ({ jour: d.jour, v: d[k] }));
/** Une valeur par jour de la période (0 les jours sans rien) */
const onDays = (days: Day[], list: { day: string; v: number }[]): Point[] =>
  days.map(d => ({ jour: d.jour, v: list.find(x => x.day === d.jour)?.v ?? 0 }));
/** L'argent : null tant qu'il charge, "error" si la route ne répond pas */
type Money = Finances | null | "error";

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
  // L'argent (Stripe, Claude) à part : plus lent, il ne retient pas le reste
  const [money, setMoney] = useState<{ key: string; m: Money } | null>(null);
  useEffect(() => {
    let live = true;
    void loadFinances(period).then(f => { if (live) setMoney({ key: `${period}:${ask}`, m: f ?? "error" }); });
    return () => { live = false; };
  }, [period, ask]);

  const exit = () => navigate("/");
  const props = { period, onPeriod: setPeriod, onRefresh: refresh, loading, onExit: exit, money: money?.key === key ? money.m : null };

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
  money: Money;
};

// ─── Ordinateur ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "resume", label: "Vue d'ensemble" },
  { id: "argent", label: "Argent" },
  { id: "activite", label: "Activité" },
  { id: "problemes", label: "Problèmes" },
  { id: "abus", label: "Abus d'essai" },
];

function Desktop({ data, period, onPeriod, onRefresh, loading, onExit, money }: ViewProps) {
  const [list, setList] = useState<ListKey | null>(null);
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
          <Kpis data={data} onOpen={setList} />
          <div className="adm-grid2">
            <Panel title="Essais et abonnements"><Funnel data={data} onOpen={setList} /></Panel>
            <Panel title="Utilisation"><Usage data={data} /></Panel>
          </div>
        </section>

        <section id="adm-argent">
          <h2>Argent · {period} derniers jours</h2>
          <MoneyView money={money} days={data.par_jour} wide />
        </section>

        <section id="adm-activite">
          <h2>Activité · {period} derniers jours</h2>
          <div className="adm-grid2">
            {SERIES.map(s => (
              <Panel key={s.key} title={s.label} aside={`${n(sum(data.par_jour, s.key))} au total`}>
                <BarChart days={points(data.par_jour, s.key)} label={s.label} height={150} />
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
      {list && <People list={list} wide onClose={() => setList(null)} />}
    </div>
  );
}

// ─── Téléphone ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "resume", label: "Résumé" },
  { id: "argent", label: "Argent" },
  { id: "activite", label: "Activité" },
  { id: "problemes", label: "Problèmes" },
  { id: "abus", label: "Abus" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function Mobile({ data, period, onPeriod, onRefresh, loading, onExit, money }: ViewProps) {
  const [list, setList] = useState<ListKey | null>(null);
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
          <Kpis data={data} onOpen={setList} />
          <Panel title="Essais et abonnements"><Funnel data={data} onOpen={setList} /></Panel>
          <Panel title="Utilisation"><Usage data={data} /></Panel>
        </>}

        {tab === "argent" && <>
          <Periods value={period} onChange={onPeriod} />
          <MoneyView money={money} days={data.par_jour} />
        </>}

        {tab === "activite" && <>
          <Periods value={period} onChange={onPeriod} />
          <div className="adm-chips">
            {SERIES.map(s => (
              <button key={s.key} type="button" aria-pressed={serie === s.key} onClick={() => setSerie(s.key)}>{s.label}</button>
            ))}
          </div>
          <Panel title={current.label} aside={`${n(sum(data.par_jour, serie))} sur ${period} jours`}>
            <BarChart days={points(data.par_jour, serie)} label={current.label} height={190} />
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
      {list && <People list={list} onClose={() => setList(null)} />}
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

function Kpis({ data, onOpen }: { data: Dashboard; onOpen: (k: ListKey) => void }) {
  const c = data.comptes;
  const paying = c.abonnes + c.abonnes_essai;
  const tiles: { label: string; value: number; sub: string; list: ListKey }[] = [
    { label: "Comptes", value: c.total, sub: `+${n(c.nouveaux_7j)} en 7 jours · +${n(c.nouveaux_jour)} aujourd'hui`, list: "comptes" },
    { label: "Abonnés", value: paying, sub: `${pct(paying, c.total)} des comptes`, list: "abonnes" },
    { label: "En essai", value: c.essai, sub: `${n(c.essai_fini_sans_payer)} essais finis sans payer`, list: "essai" },
    { label: "Actifs 7 jours", value: data.actifs_7j, sub: `ont scanné ou cuisiné · ${pct(data.actifs_7j, c.total)}`, list: "actifs_7j" },
    { label: "Scans 7 jours", value: data.usage.scans_7j, sub: `${n(data.usage.scans)} au total`, list: "scans_7j" },
    { label: "Liste d'attente", value: data.liste_attente.total, sub: `+${n(data.liste_attente.nouveaux_7j)} en 7 jours · ${n(data.liste_attente.invites)} invités`, list: "liste_attente" },
  ];
  return (
    <div className="adm-kpis">
      {tiles.map(t => (
        <button key={t.label} type="button" className="adm-card adm-kpi adm-click" onClick={() => onOpen(t.list)} aria-label={`${t.label} : voir la liste`}>
          <span className="adm-muted">{t.label}</span>
          <b>{n(t.value)}</b>
          <span className="adm-small adm-muted">{t.sub}</span>
        </button>
      ))}
    </div>
  );
}

/** Où en sont les comptes : une barre par état, à l'échelle du total */
function Funnel({ data, onOpen }: { data: Dashboard; onOpen: (k: ListKey) => void }) {
  const c = data.comptes;
  const rows: { label: string; v: number; warn?: boolean; list: ListKey }[] = [
    { label: "En essai", v: c.essai, list: "essai" },
    { label: "Abonnés", v: c.abonnes, list: "abonnes" },
    { label: "Abonnés en période d'essai Stripe", v: c.abonnes_essai, list: "abonnes" },
    { label: "Comptes offerts", v: c.offerts, list: "offerts" },
    { label: "Essai fini sans payer", v: c.essai_fini_sans_payer, list: "essai_fini" },
    { label: "Paiement refusé", v: c.paiement_refuse, warn: true, list: "refuse" },
  ];
  const total = c.total || 1;
  return (
    <ul className="adm-bars">
      {rows.map(r => (
        <li key={r.label} className="adm-click" role="button" tabIndex={0} onClick={() => onOpen(r.list)} onKeyDown={e => { if (e.key === "Enter") onOpen(r.list); }}>
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
function BarChart({ days, label, height, fmt = n }: { days: Point[]; label: string; height: number; fmt?: (v: number) => string }) {
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

const MISSING: Record<string, string> = {
  no_stripe: "Stripe n'est pas configuré sur ce déploiement.",
  stripe_error: "Stripe n'a pas répondu : réessaie dans un moment.",
  no_usage_table: "Pour le coût de Claude, lance cout-ia.sql (migration 20261106000000) dans Supabase.",
  claude_error: "Le rapport de coûts d'Anthropic n'a pas répondu (clé admin refusée ?).",
};

/** L'argent : ce que Stripe a vraiment encaissé, ce que coûte Claude, et ce qui reste */
function MoneyView({ money, days, wide }: { money: Money; days: Day[]; wide?: boolean }) {
  if (money === null) return <Panel><Empty>Chargement de Stripe et de Claude…</Empty></Panel>;
  if (money === "error") return <Panel><Empty>Les chiffres d'argent n'ont pas pu être chargés. Réessaie avec « Actualiser ».</Empty></Panel>;
  const { stripe: st, claude: cl } = money;
  const claudeEur = cl ? (cl.eur ?? null) : null;
  const left = st && claudeEur != null ? st.net / 100 - claudeEur : null;
  const tiles: { label: string; value: string; sub: string; warn?: boolean }[] = [];
  if (st) {
    tiles.push(
      { label: "Encaissé", value: cents(st.gross), sub: `${n(st.payments)} paiement${st.payments > 1 ? "s" : ""}` },
      { label: "Reçu net", value: cents(st.net), sub: `après ${cents(st.fees)} de frais Stripe${st.refunds ? ` et ${cents(st.refunds)} remboursés` : ""}` },
      { label: "Revenu mensuel", value: cents(st.mrr), sub: `${n(st.active.month)} mensuels · ${n(st.active.year)} annuels · ${n(st.active.founder)} fondateurs` },
    );
  }
  if (cl) {
    const est = cl.estimated;
    const sub = est
      ? `${usd(cl.usd)} estimés d'après ${n(est.calls)} appel${est.calls > 1 ? "s" : ""}${est.since ? `, comptés depuis le ${dayLabel(est.since.slice(0, 10))}` : ""}`
      : `${usd(cl.usd)} facturés par Anthropic`;
    tiles.push({ label: "Coût de Claude", value: claudeEur != null ? eurF.format(claudeEur) : usd(cl.usd), sub });
  }
  if (left != null) tiles.push({ label: "Il reste", value: eurF.format(left), sub: "reçu net moins Claude", warn: left < 0 });
  const notes = money.missing.map(k => MISSING[k]).filter(Boolean);
  // Rien avant le 29 octobre : les jours d'avant restent à zéro, et on le dit
  const cut = money.from && days[0] && money.from > days[0].jour ? money.from : null;
  return (
    <>
      {money.stripeTest && st && (
        <p className="adm-note adm-test"><b>Stripe en mode test</b> : ces paiements et abonnements sont fictifs. Le bandeau partira tout seul avec la vraie clé Stripe.</p>
      )}
      {tiles.length > 0 && (
        <div className={`adm-kpis${wide ? " adm-kpis5" : ""}`}>
          {tiles.map(t => (
            <div key={t.label} className="adm-card adm-kpi">
              <span className="adm-muted">{t.label}</span>
              <b className={t.warn ? "adm-warn" : undefined}>{t.value}</b>
              <span className="adm-small adm-muted">{t.sub}</span>
            </div>
          ))}
        </div>
      )}
      {notes.map(t => <p key={t} className="adm-note">{t}</p>)}
      <div className={wide ? "adm-grid2" : "adm-stack"}>
        {st && <Panel title="Encaissé par jour" aside="Stripe, avant frais">
          <BarChart days={onDays(days, st.byDay.map(d => ({ day: d.day, v: d.eur })))} label="Encaissé" height={wide ? 150 : 170} fmt={v => eurF.format(v)} />
        </Panel>}
        {cl && <Panel title="Coût de Claude par jour" aside={cl.estimated ? "Estimé d'après les tokens, en dollars" : "En dollars, comme Anthropic le facture"}>
          <BarChart days={onDays(days, cl.byDay.map(d => ({ day: d.day, v: d.usd })))} label="Coût Claude" height={wide ? 150 : 170} fmt={usd} />
        </Panel>}
      </div>
      <p className="adm-muted adm-small">{cut && `Comptés à partir du ${dayLabel(cut)}. `}Les photos des recettes (fal.ai) ne sont pas comptées : fal n'a pas de rapport de coûts. Revenu mensuel : abonnements actifs au prix catalogue, les annuels au douzième.</p>
    </>
  );
}

const LISTS: Record<ListKey, string> = {
  comptes: "Tous les comptes", nouveaux_7j: "Nouveaux comptes (7 jours)", abonnes: "Abonnés", essai: "En essai",
  essai_fini: "Essai fini sans payer", refuse: "Paiement refusé", offerts: "Comptes offerts", recrees: "Comptes recréés (sans essai)",
  connectes_7j: "Connectés en 7 jours", actifs_7j: "Actifs en 7 jours (scan ou recette)", scans_7j: "Ont scanné en 7 jours",
  liste_attente: "Liste d'attente",
};
const ETATS: Record<Person["etat"], string> = {
  essai: "En essai", abonne: "Abonné", abonne_essai: "Abonné (essai Stripe)", refuse: "Paiement refusé", offert: "Offert", fini: "Essai fini",
};
const dateOnly = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" }) : "–");
const isWaitlist = (r: Person | WaitlistRow): r is WaitlistRow => "a_un_compte" in r;

/** La liste derrière un chiffre : panneau à droite sur ordinateur, plein écran sur téléphone. Recherche par email ou prénom. */
function People({ list, wide, onClose }: { list: ListKey; wide?: boolean; onClose: () => void }) {
  const [res, setRes] = useState<{ key: ListKey; r: Awaited<ReturnType<typeof loadList>> } | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    let live = true;
    void loadList(list).then(r => { if (live) setRes({ key: list, r }); });
    return () => { live = false; };
  }, [list]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const r = res?.key === list ? res.r : null;
  const needle = q.trim().toLowerCase();
  const rows = r?.ok ? r.rows.filter(x => !needle || x.email.toLowerCase().includes(needle) || (x.prenom ?? "").toLowerCase().includes(needle)) : [];
  const copy = () => {
    void navigator.clipboard?.writeText(rows.map(x => x.email).join(", "));
  };
  return (
    <div className="adm-overlay" onClick={onClose}>
      <aside className={`adm-drawer${wide ? " wide" : ""}`} role="dialog" aria-label={LISTS[list]} onClick={e => e.stopPropagation()}>
        <header className="adm-dh">
          <div>
            <h3>{LISTS[list]}</h3>
            <span className="adm-muted adm-small">{r?.ok ? `${n(rows.length)} personne${rows.length > 1 ? "s" : ""}${r.rows.length >= 500 ? " (500 plus récentes)" : ""}` : "Chargement…"}</span>
          </div>
          <button type="button" className="adm-icon" onClick={onClose} aria-label="Fermer">×</button>
        </header>
        <div className="adm-row adm-dtools">
          <input className="adm-search" type="search" placeholder="Chercher un email ou un prénom" value={q} onChange={e => setQ(e.target.value)} />
          {rows.length > 0 && <button type="button" className="adm-btn line" onClick={copy}>Copier les emails</button>}
        </div>
        <div className="adm-dbody">
          {!r && <Empty>Chargement…</Empty>}
          {r && !r.ok && <Empty>{r.message}</Empty>}
          {r?.ok && rows.length === 0 && <Empty>Personne ici.</Empty>}
          {r?.ok && rows.length > 0 && (wide ? <PeopleTable rows={rows} /> : rows.map(x => <PersonCard key={x.email + x.created_at} r={x} />))}
        </div>
      </aside>
    </div>
  );
}

function PeopleTable({ rows }: { rows: (Person | WaitlistRow)[] }) {
  if (isWaitlist(rows[0])) {
    return (
      <table className="adm-table">
        <thead><tr><th>Email</th><th>Prénom</th><th>Inscrit le</th><th>Accès envoyé</th><th>Compte</th><th>Source</th></tr></thead>
        <tbody>{(rows as WaitlistRow[]).map(w => (
          <tr key={w.email}>
            <td className="adm-break"><a href={`mailto:${w.email}`}>{w.email}</a></td><td>{w.prenom ?? "–"}</td>
            <td className="adm-nowrap">{dateOnly(w.created_at)}</td><td className="adm-nowrap">{dateOnly(w.invite_le)}</td>
            <td>{w.a_un_compte ? "Oui" : "Non"}</td><td>{w.source ?? "–"}</td>
          </tr>
        ))}</tbody>
      </table>
    );
  }
  return (
    <table className="adm-table">
      <thead><tr><th>Email</th><th>Prénom</th><th>État</th><th>Inscrit le</th><th>Dernière connexion</th><th>Scans</th><th>Cuisinés</th><th>Dernière activité</th></tr></thead>
      <tbody>{(rows as Person[]).map(p => (
        <tr key={p.email + p.created_at}>
          <td className="adm-break"><a href={`mailto:${p.email}`}>{p.email}</a>{p.recree && <span className="adm-tag bug adm-ml">recréé</span>}</td>
          <td>{p.prenom ?? "–"}</td><td><span className={`adm-tag st-${p.etat}`}>{ETATS[p.etat]}</span></td>
          <td className="adm-nowrap">{dateOnly(p.created_at)}</td><td className="adm-nowrap">{dateOnly(p.last_sign_in_at)}</td>
          <td>{n(p.scans)}</td><td>{n(p.cuisines)}</td><td className="adm-nowrap">{dateOnly(p.derniere_activite)}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function PersonCard({ r }: { r: Person | WaitlistRow }) {
  if (isWaitlist(r)) {
    return (
      <article className="adm-card adm-item">
        <a className="adm-break" href={`mailto:${r.email}`}>{r.email}</a>
        <span className="adm-muted adm-small">{r.prenom ?? "Sans prénom"} · inscrit le {dateOnly(r.created_at)} · {r.invite_le ? `accès le ${dateOnly(r.invite_le)}` : "pas encore d'accès"} · {r.a_un_compte ? "a un compte" : "pas de compte"}</span>
      </article>
    );
  }
  return (
    <article className="adm-card adm-item">
      <div className="adm-row adm-between">
        <a className="adm-break" href={`mailto:${r.email}`}>{r.email}</a>
        <span className={`adm-tag st-${r.etat}`}>{ETATS[r.etat]}</span>
      </div>
      <span className="adm-muted adm-small">
        {r.prenom ?? "Sans prénom"} · inscrit le {dateOnly(r.created_at)}{r.recree ? " · recréé" : ""}<br />
        {n(r.scans)} scan{r.scans > 1 ? "s" : ""} · {n(r.cuisines)} cuisiné{r.cuisines > 1 ? "s" : ""} · dernière activité {dateOnly(r.derniere_activite)}
      </span>
    </article>
  );
}
