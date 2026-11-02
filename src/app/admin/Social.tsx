// Le dashboard de suivi > Réseaux (Hugo, 2 novembre) : les comptes Instagram, TikTok, YouTube de Frigia et des créateurs UGC,
// leurs abonnés et leurs vues jour par jour, et ce que chaque créateur rapporte avec son code.
// Les chiffres viennent d'une capture d'écran lue par Claude (vérifiée avant d'enregistrer) ou d'une saisie à la main.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { compressImage } from "../../lib/scan";
import {
  type CaptureRead, type Platform, type Social, type SocialAccount, type SocialStat,
  deleteAccount, deleteStat, loadSocial, readCapture, saveAccount, saveStat,
} from "./admin";

const PLATFORMS: Record<Platform, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", autre: "Autre" };
const KIND = { frigia: "Frigia", createur: "Créateur" } as const;
const SOURCES = { capture: "capture", manuel: "à la main", api: "compte lié" } as const;

const nf = new Intl.NumberFormat("fr-FR");
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const big = (v: number | null | undefined) => (v == null ? "–" : v >= 100_000 ? compact.format(v) : nf.format(v));
const plus = (v: number | null) => (v == null ? "" : v >= 0 ? `+${big(v)}` : `−${big(-v)}`);
const today = () => new Date().toLocaleDateString("sv-SE");
const dayLabel = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const ageDays = (iso: string) => Math.round((Date.parse(today()) - Date.parse(iso)) / 86_400_000);
const shiftDay = (iso: string, d: number) => new Date(Date.parse(iso + "T12:00:00") + d * 86_400_000).toLocaleDateString("sv-SE");

type Num = "followers" | "views" | "likes" | "posts";
const last = (a: SocialAccount) => a.stats[a.stats.length - 1] ?? null;
const latest = (a: SocialAccount, k: Num | "views_30d") => [...a.stats].reverse().find(s => s[k] != null)?.[k] ?? null;
/** Ce qui a bougé en `days` jours : le dernier chiffre moins le dernier relevé d'avant (null sans relevé assez ancien) */
function gain(a: SocialAccount, k: Num, days: number): number | null {
  const now = [...a.stats].reverse().find(s => s[k] != null);
  if (!now) return null;
  const before = [...a.stats].reverse().find(s => s[k] != null && s.day <= shiftDay(now.day, -days));
  return before ? (now[k] as number) - (before[k] as number) : null;
}
/** Vues sur 30 jours : celles affichées par le réseau, sinon le gain des vues cumulées */
const views30 = (a: SocialAccount) => latest(a, "views_30d") ?? gain(a, "views", 30);
const sumOf = (list: (number | null)[]) => (list.some(v => v != null) ? list.reduce<number>((t, v) => t + (v ?? 0), 0) : null);

/** Une valeur par jour sur `days` jours : la somme des derniers chiffres connus de chaque compte à cette date */
function carried(accounts: SocialAccount[], k: Num, days: number): { day: string; v: number }[] {
  const end = today();
  const out: { day: string; v: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = shiftDay(end, -i);
    let v = 0, any = false;
    for (const a of accounts) {
      const s = [...a.stats].reverse().find(x => x.day <= day && x[k] != null);
      if (s) { v += s[k] as number; any = true; }
    }
    if (any) out.push({ day, v });
  }
  return out;
}

export default function SocialView({ wide }: { wide?: boolean }) {
  const [ask, setAsk] = useState(0);
  const [state, setState] = useState<{ ask: number; r: Awaited<ReturnType<typeof loadSocial>> } | null>(null);
  useEffect(() => {
    let live = true;
    void loadSocial().then(r => { if (live) setState({ ask, r }); });
    return () => { live = false; };
  }, [ask]);
  const reload = () => setAsk(a => a + 1);
  const [entry, setEntry] = useState<{ capture: boolean; account?: SocialAccount } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  if (!state) return <p className="adm-muted">Chargement des réseaux…</p>;
  if (!state.r.ok) return <p className="adm-note">{state.r.message}</p>;
  const data = state.r.data;
  const open = data.comptes.find(a => a.id === openId) ?? null;
  const frigia = data.comptes.filter(a => a.kind === "frigia");
  const creators = data.comptes.filter(a => a.kind === "createur");

  return (
    <div className="adm-stack">
      <div className="adm-row adm-wrap">
        <button type="button" className="adm-btn" onClick={() => setEntry({ capture: true })}>Lire une capture</button>
        <button type="button" className="adm-btn line" onClick={() => setEntry({ capture: false })}>Saisir à la main</button>
      </div>
      {data.comptes.length === 0
        ? <p className="adm-note">Aucun compte pour l'instant. Fais une capture d'écran d'un profil (abonnés, vues) et clique sur « Lire une capture » : Claude remplit les chiffres, tu vérifies, et le compte est créé.</p>
        : <>
          <SocialKpis frigia={frigia} creators={creators} />
          <div className={wide ? "adm-grid2" : "adm-stack"}>
            <div className="adm-card adm-panel">
              <div className="adm-ph"><h3>Abonnés des comptes Frigia</h3><span className="adm-muted adm-small">90 derniers jours</span></div>
              <LineChart points={carried(frigia, "followers", 90)} label="abonnés" height={wide ? 170 : 150} />
            </div>
            <div className="adm-card adm-panel">
              <div className="adm-ph"><h3>Vues cumulées, tous comptes</h3><span className="adm-muted adm-small">90 derniers jours</span></div>
              <LineChart points={carried(data.comptes, "views", 90)} label="vues" height={wide ? 170 : 150} />
            </div>
          </div>
          {wide
            ? <div className="adm-card adm-panel"><AccountsTable list={data.comptes} onOpen={setOpenId} /></div>
            : data.comptes.map(a => <AccountCard key={a.id} a={a} onOpen={() => setOpenId(a.id)} />)}
          <p className="adm-muted adm-small">Un relevé par compte et par jour : refais une capture chaque semaine pour suivre l'évolution. Les inscriptions viennent du code créateur mis sur le compte.</p>
        </>}
      {entry && <Entry data={data} capture={entry.capture} account={entry.account} wide={wide}
        onClose={() => setEntry(null)} onSaved={() => { setEntry(null); reload(); }} />}
      {open && !entry && <AccountDrawer a={open} data={data} wide={wide} onClose={() => setOpenId(null)} onChanged={reload}
        onAdd={() => setEntry({ capture: true, account: open })} />}
    </div>
  );
}

function SocialKpis({ frigia, creators }: { frigia: SocialAccount[]; creators: SocialAccount[] }) {
  const all = [...frigia, ...creators];
  const followers = sumOf(frigia.map(a => latest(a, "followers")));
  const subs = creators.reduce((t, a) => t + a.abonnes, 0);
  const cost = creators.reduce((t, a) => t + a.cost_eur, 0);
  const tiles: { label: string; value: string; sub: string }[] = [
    { label: "Abonnés Frigia", value: big(followers), sub: `${plus(sumOf(frigia.map(a => gain(a, "followers", 7)))) || "–"} en 7 jours` },
    { label: "Vues 30 jours", value: big(sumOf(all.map(views30))), sub: `dont ${big(sumOf(creators.map(views30)))} chez les créateurs` },
    { label: "Créateurs", value: nf.format(creators.length), sub: `${big(sumOf(creators.map(a => latest(a, "followers"))))} abonnés au total` },
    { label: "Inscriptions via codes", value: nf.format(creators.reduce((t, a) => t + a.inscrits, 0)), sub: `${nf.format(subs)} devenus abonnés` },
    { label: "Coût par abonné", value: subs > 0 ? eur.format(cost / subs) : "–", sub: `${eur.format(cost)} payés aux créateurs` },
  ];
  return (
    <div className="adm-kpis adm-kpis5">
      {tiles.map(t => (
        <div key={t.label} className="adm-card adm-kpi">
          <span className="adm-muted">{t.label}</span>
          <b>{t.value}</b>
          <span className="adm-small adm-muted">{t.sub}</span>
        </div>
      ))}
    </div>
  );
}

const Handle = ({ a }: { a: SocialAccount }) => (
  <span className="adm-row adm-gap6">
    <span className={`adm-tag pf-${a.platform}`}>{PLATFORMS[a.platform]}</span>
    <b className="adm-break">@{a.handle}</b>
  </span>
);

function Freshness({ a }: { a: SocialAccount }) {
  const s = last(a);
  if (!s) return <span className="adm-muted">aucun relevé</span>;
  const age = ageDays(s.day);
  return <span className={age > 7 ? "adm-warn" : "adm-muted"}>{age === 0 ? "aujourd'hui" : age === 1 ? "hier" : `il y a ${age} j`}</span>;
}

const perSub = (a: SocialAccount) => (a.abonnes > 0 ? eur.format(a.cost_eur / a.abonnes) : "–");

function AccountsTable({ list, onOpen }: { list: SocialAccount[]; onOpen: (id: string) => void }) {
  return (
    <table className="adm-table">
      <thead><tr>
        <th>Compte</th><th>Type</th><th>Abonnés</th><th>7 jours</th><th>Vues 30 j</th><th>Dernier relevé</th>
        <th>Code</th><th>Inscrits</th><th>Abonnés Plus</th><th>Coût</th><th>Par abonné</th>
      </tr></thead>
      <tbody>
        {list.map(a => (
          <tr key={a.id} className="adm-click adm-rowlink" tabIndex={0} onClick={() => onOpen(a.id)} onKeyDown={e => { if (e.key === "Enter") onOpen(a.id); }}>
            <td><Handle a={a} />{a.name && <div className="adm-muted adm-small">{a.name}</div>}</td>
            <td>{KIND[a.kind]}</td>
            <td><b>{big(latest(a, "followers"))}</b></td>
            <td className="adm-muted">{plus(gain(a, "followers", 7)) || "–"}</td>
            <td>{big(views30(a))}</td>
            <td className="adm-nowrap"><Freshness a={a} /></td>
            <td className="adm-mono">{a.code ?? "–"}</td>
            <td>{a.code ? nf.format(a.inscrits) : "–"}</td>
            <td>{a.code ? nf.format(a.abonnes) : "–"}</td>
            <td>{a.cost_eur > 0 ? eur.format(a.cost_eur) : "–"}</td>
            <td>{perSub(a)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AccountCard({ a, onOpen }: { a: SocialAccount; onOpen: () => void }) {
  return (
    <button type="button" className="adm-card adm-item adm-click adm-full" onClick={onOpen}>
      <div className="adm-row adm-between"><Handle a={a} /><span className="adm-tag">{KIND[a.kind]}</span></div>
      <div className="adm-row adm-between adm-small">
        <span><b>{big(latest(a, "followers"))}</b> abonnés <span className="adm-muted">{plus(gain(a, "followers", 7))}</span></span>
        <span><b>{big(views30(a))}</b> vues 30 j</span>
      </div>
      {a.code && <p className="adm-small adm-muted">Code {a.code} : {nf.format(a.inscrits)} inscrits · {nf.format(a.abonnes)} abonné{a.abonnes > 1 ? "s" : ""} · {perSub(a)} par abonné</p>}
      <p className="adm-small">Relevé <Freshness a={a} /></p>
    </button>
  );
}

/** Une courbe (chiffres cumulés) ; survol ou toucher : le jour et sa valeur */
function LineChart({ points, label, height }: { points: { day: string; v: number }[]; label: string; height: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return <p className="adm-empty">Pas encore de relevé.</p>;
  const W = 600, H = height, top = 10, bottom = 22;
  const vs = points.map(p => p.v);
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const pad = (hi - lo) * 0.1 || Math.max(1, hi * 0.05);
  const min = Math.max(0, lo - pad), max = hi + pad;
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W);
  const y = (v: number) => H - bottom - ((H - bottom - top) * (v - min)) / (max - min);
  const shown = hover != null ? points[hover] : points[points.length - 1];
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const pick = (clientX: number, rect: DOMRect) => setHover(Math.round(((clientX - rect.left) / rect.width) * (points.length - 1)));
  return (
    <div className="adm-chart">
      <div className="adm-tip" aria-live="polite"><b>{nf.format(shown.v)}</b> {label} · {dayLabel(shown.day)}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} par jour`} preserveAspectRatio="none"
        onMouseMove={e => pick(e.clientX, e.currentTarget.getBoundingClientRect())} onMouseLeave={() => setHover(null)}
        onTouchMove={e => pick(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}>
        <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} className="adm-axis" />
        <path d={`${line} L${x(points.length - 1)},${H - bottom} L${x(0)},${H - bottom} Z`} className="adm-area" />
        <path d={line} className="adm-line" />
        {hover != null && <circle cx={x(hover)} cy={y(points[hover].v)} r="4" className="adm-pt" />}
      </svg>
      <div className="adm-xl">
        <span style={{ left: 0 }}>{dayLabel(points[0].day)}</span>
        {points.length > 1 && <span style={{ left: "100%" }}>{dayLabel(points[points.length - 1].day)}</span>}
      </div>
    </div>
  );
}

// ─── Fenêtres ────────────────────────────────────────────────────────────────

function Sheet({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="adm-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`adm-drawer adm-sheet${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="adm-dh"><h3>{title}</h3><button type="button" className="adm-icon" onClick={onClose} aria-label="Fermer">×</button></div>
        <div className="adm-dbody">{children}</div>
      </div>
    </div>
  );
}

type Form = {
  accountId: string; platform: Platform; handle: string; kind: "frigia" | "createur";
  day: string; followers: string; views: string; views_30d: string; likes: string; posts: string;
};
const NUMS: { key: Num | "views_30d"; label: string; hint?: string }[] = [
  { key: "followers", label: "Abonnés" },
  { key: "views", label: "Vues cumulées", hint: "toutes les vidéos" },
  { key: "views_30d", label: "Vues 30 jours", hint: "statistiques du compte pro" },
  { key: "likes", label: "J'aime" },
  { key: "posts", label: "Publications" },
];
const toNum = (s: string) => { const v = Number(s.replace(/[\s\u202f.]/g, "").replace(",", ".")); return s.trim() === "" || !Number.isFinite(v) ? null : Math.round(v); };
const str = (v: number | null | undefined) => (v == null ? "" : String(v));

/** Ajouter des chiffres : depuis une capture lue par Claude (on vérifie avant d'enregistrer) ou à la main */
function Entry({ data, capture, account, wide, onClose, onSaved }: {
  data: Social; capture: boolean; account?: SocialAccount; wide?: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [step, setStep] = useState<"pick" | "reading" | "form">(capture ? "pick" : "form");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<Form>({
    accountId: account?.id ?? "new", platform: account?.platform ?? "instagram", handle: account?.handle ?? "", kind: account?.kind ?? "frigia",
    day: today(), followers: "", views: "", views_30d: "", likes: "", posts: "",
  });
  const set = (p: Partial<Form>) => setF(x => ({ ...x, ...p }));

  async function onFiles(files: FileList | null) {
    const list = [...(files ?? [])].slice(0, 3);
    if (list.length === 0) return;
    setError(null); setStep("reading");
    try {
      const images = await Promise.all(list.map(compressImage));
      const r = await readCapture(images);
      if (typeof r === "string") { setError(r); setStep("pick"); return; }
      fill(r);
      setStep("form");
    } catch { setError("Cette image ne se lit pas. Essaie en PNG ou JPEG."); setStep("pick"); }
  }

  function fill(r: CaptureRead) {
    // Le compte déjà suivi qui a ce réseau et ce nom ; sinon un nouveau compte, prérempli
    const match = account ?? data.comptes.find(a => r.handle && a.handle.toLowerCase() === r.handle.toLowerCase() && (!r.platform || a.platform === r.platform));
    set({
      ...(match ? { accountId: match.id, platform: match.platform, handle: match.handle, kind: match.kind }
        : { accountId: "new", platform: r.platform ?? "instagram", handle: r.handle ?? "" }),
      followers: str(r.followers), views: str(r.views), views_30d: str(r.views_30d), likes: str(r.likes), posts: str(r.posts),
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const stat = { day: f.day, followers: toNum(f.followers), views: toNum(f.views), views_30d: toNum(f.views_30d), likes: toNum(f.likes), posts: toNum(f.posts) };
    if (Object.values(stat).slice(1).every(v => v == null)) { setError("Mets au moins un chiffre."); return; }
    setSaving(true); setError(null);
    let id = f.accountId;
    if (id === "new") {
      if (!f.handle.trim()) { setError("Mets le nom du compte."); setSaving(false); return; }
      const r = await saveAccount({ platform: f.platform, handle: f.handle, name: null, kind: f.kind, code: null, cost_eur: 0 });
      if ("error" in r) { setError(r.error); setSaving(false); return; }
      id = r.id;
    }
    const err = await saveStat(id, { ...stat, source: capture ? "capture" : "manuel" });
    setSaving(false);
    if (err) { setError(err); return; }
    onSaved();
  }

  return (
    <Sheet title={capture ? "Lire une capture" : "Saisir des chiffres"} wide={wide} onClose={onClose}>
      {step === "pick" && <div className="adm-stack">
        <p>Fais une capture d'écran du profil (abonnés, j'aime, grille des vidéos avec les vues) ou des statistiques du compte pro. Jusqu'à 3 captures du même compte.</p>
        <label className="adm-drop">
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={e => void onFiles(e.target.files)} />
          <b>Choisir les captures</b>
          <span className="adm-muted adm-small">PNG ou JPEG, depuis ton téléphone ou ton ordinateur</span>
        </label>
        {error && <p className="adm-warn">{error}</p>}
      </div>}
      {step === "reading" && <p className="adm-muted">Claude lit la capture…</p>}
      {step === "form" && <form className="adm-stack" onSubmit={e => void submit(e)}>
        {capture && <p className="adm-note">Vérifie les chiffres lus par Claude avant d'enregistrer.</p>}
        <label className="adm-field"><span>Compte</span>
          <select value={f.accountId} onChange={e => {
            const a = data.comptes.find(x => x.id === e.target.value);
            set(a ? { accountId: a.id, platform: a.platform, handle: a.handle, kind: a.kind } : { accountId: "new" });
          }}>
            {data.comptes.map(a => <option key={a.id} value={a.id}>{PLATFORMS[a.platform]} · @{a.handle}</option>)}
            <option value="new">Nouveau compte…</option>
          </select>
        </label>
        {f.accountId === "new" && <div className="adm-fields">
          <label className="adm-field"><span>Réseau</span>
            <select value={f.platform} onChange={e => set({ platform: e.target.value as Platform })}>
              {(Object.keys(PLATFORMS) as Platform[]).map(p => <option key={p} value={p}>{PLATFORMS[p]}</option>)}
            </select>
          </label>
          <label className="adm-field"><span>Nom du compte</span>
            <input value={f.handle} onChange={e => set({ handle: e.target.value })} placeholder="frigia.app" autoCapitalize="none" />
          </label>
          <label className="adm-field"><span>C'est un compte</span>
            <select value={f.kind} onChange={e => set({ kind: e.target.value as Form["kind"] })}>
              <option value="frigia">de Frigia</option><option value="createur">d'un créateur</option>
            </select>
          </label>
        </div>}
        <label className="adm-field"><span>Date du relevé</span><input type="date" value={f.day} max={today()} onChange={e => set({ day: e.target.value })} /></label>
        <div className="adm-fields">
          {NUMS.map(x => (
            <label key={x.key} className="adm-field"><span>{x.label}{x.hint && <em className="adm-muted"> · {x.hint}</em>}</span>
              <input inputMode="numeric" value={f[x.key]} onChange={e => set({ [x.key]: e.target.value } as Partial<Form>)} placeholder="–" />
            </label>
          ))}
        </div>
        {error && <p className="adm-warn">{error}</p>}
        <div className="adm-row">
          <button type="submit" className="adm-btn" disabled={saving}>{saving ? "…" : "Enregistrer"}</button>
          {capture && <button type="button" className="adm-btn line" onClick={() => setStep("pick")}>Autre capture</button>}
        </div>
      </form>}
    </Sheet>
  );
}

/** Un compte : ses courbes, ses relevés, son code créateur et ce qu'il a coûté */
function AccountDrawer({ a, data, wide, onClose, onChanged, onAdd }: {
  a: SocialAccount; data: Social; wide?: boolean; onClose: () => void; onChanged: () => void; onAdd: () => void;
}) {
  const [name, setName] = useState(a.name ?? "");
  const [kind, setKind] = useState(a.kind);
  const [code, setCode] = useState(a.code ?? "");
  const [cost, setCost] = useState(a.cost_eur ? String(a.cost_eur) : "");
  const [msg, setMsg] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const known = data.codes.some(c => c.code === code.toUpperCase());

  async function save(e: FormEvent) {
    e.preventDefault();
    const r = await saveAccount({ platform: a.platform, handle: a.handle, name, kind, code: code || null, cost_eur: Number(cost.replace(",", ".")) || 0 }, a.id);
    setMsg("error" in r ? r.error : "Enregistré.");
    if (!("error" in r)) onChanged();
  }
  async function remove() {
    if (!sure) { setSure(true); return; }
    const err = await deleteAccount(a.id);
    if (err) { setMsg(err); return; }
    onClose(); onChanged();
  }
  async function removeStat(s: SocialStat) {
    const err = await deleteStat(a.id, s.day);
    if (err) setMsg(err); else onChanged();
  }
  const rows = [...a.stats].reverse();
  const series = (k: Num) => a.stats.filter(s => s[k] != null).map(s => ({ day: s.day, v: s[k] as number }));

  return (
    <Sheet title={`@${a.handle}`} wide={wide} onClose={onClose}>
      <div className="adm-stack">
        <div className="adm-row adm-wrap">
          <span className={`adm-tag pf-${a.platform}`}>{PLATFORMS[a.platform]}</span>
          <span className="adm-tag">{KIND[a.kind]}</span>
          <span className="adm-small">Dernier relevé <Freshness a={a} /></span>
          <button type="button" className="adm-btn adm-push" onClick={onAdd}>Ajouter des chiffres</button>
        </div>
        <div className={wide ? "adm-grid2" : "adm-stack"}>
          <div className="adm-card adm-panel"><div className="adm-ph"><h3>Abonnés</h3></div><LineChart points={series("followers")} label="abonnés" height={140} /></div>
          <div className="adm-card adm-panel"><div className="adm-ph"><h3>Vues cumulées</h3></div><LineChart points={series("views")} label="vues" height={140} /></div>
        </div>

        <form className="adm-card adm-panel adm-stack" onSubmit={e => void save(e)}>
          <h3>Infos du compte</h3>
          <div className="adm-fields">
            <label className="adm-field"><span>Nom ou prénom</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Marie" /></label>
            <label className="adm-field"><span>C'est un compte</span>
              <select value={kind} onChange={e => setKind(e.target.value as typeof kind)}><option value="frigia">de Frigia</option><option value="createur">d'un créateur</option></select>
            </label>
            <label className="adm-field"><span>Code créateur</span>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} list="adm-codes" placeholder="MARIE" autoCapitalize="characters" />
              <datalist id="adm-codes">{data.codes.map(c => <option key={c.code} value={c.code}>{c.creator ?? ""}</option>)}</datalist>
            </label>
            <label className="adm-field"><span>Coût total (€)</span><input inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)} placeholder="0" /></label>
          </div>
          {code && !known && <p className="adm-small adm-warn">Ce code n'existe pas encore dans la table codes : les inscriptions resteront à 0.</p>}
          {a.code && <p className="adm-small">Avec le code {a.code} : <b>{nf.format(a.inscrits)}</b> inscriptions, <b>{nf.format(a.abonnes)}</b> abonnés Plus · {perSub(a)} par abonné.</p>}
          {msg && <p className="adm-small">{msg}</p>}
          <div className="adm-row"><button type="submit" className="adm-btn">Enregistrer</button></div>
        </form>

        <div className="adm-card adm-panel">
          <div className="adm-ph"><h3>Relevés</h3><span className="adm-muted adm-small">{rows.length} sur 180 jours</span></div>
          {rows.length === 0 ? <p className="adm-empty">Pas encore de relevé.</p> : (
            <table className="adm-table">
              <thead><tr><th>Date</th><th>Abonnés</th><th>Vues</th>{wide && <><th>Vues 30 j</th><th>J'aime</th><th>Posts</th><th>Source</th></>}<th /></tr></thead>
              <tbody>
                {rows.map(s => (
                  <tr key={s.day}>
                    <td className="adm-nowrap">{dayLabel(s.day)}</td>
                    <td>{big(s.followers)}</td><td>{big(s.views)}</td>
                    {wide && <><td>{big(s.views_30d)}</td><td>{big(s.likes)}</td><td>{big(s.posts)}</td><td className="adm-muted">{SOURCES[s.source]}</td></>}
                    <td><button type="button" className="adm-link" onClick={() => void removeStat(s)} aria-label={`Supprimer le relevé du ${dayLabel(s.day)}`}>Supprimer</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="adm-row">
          <button type="button" className={`adm-btn line${sure ? " adm-danger" : ""}`} onClick={() => void remove()}>
            {sure ? "Confirmer : supprimer le compte et ses relevés" : "Supprimer ce compte"}
          </button>
          {sure && <button type="button" className="adm-link" onClick={() => setSure(false)}>Annuler</button>}
        </div>
      </div>
    </Sheet>
  );
}
