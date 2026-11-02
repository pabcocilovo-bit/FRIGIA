// Le dashboard de suivi > Réseaux : les vidéos des comptes liés (Hugo, 2 novembre).
// Classement (vues, engagement, partage, vues à 24 h et à 7 jours) et « Ce qui marche » : jour, heure et durée qui font le plus de vues.
import { useState } from "react";
import { type SocialAccount, type Video, engagement, engagementOf, shareRate } from "./admin";

const nf = new Intl.NumberFormat("fr-FR");
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const big = (v: number | null | undefined) => (v == null ? "–" : v >= 100_000 ? compact.format(v) : nf.format(v));
const pctF = (x: number | null) => (x == null ? "–" : `${(x * 100).toLocaleString("fr-FR", { maximumFractionDigits: x < 0.1 ? 1 : 0 })} %`);
const dateF = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" }) : "–");
const durF = (s: number | null) => (s == null ? "–" : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}`);

type Scope = "tous" | "frigia" | "createur";
const SCOPES: { id: Scope; label: string }[] = [{ id: "tous", label: "Tous les comptes" }, { id: "frigia", label: "Frigia" }, { id: "createur", label: "Créateurs" }];
const inScope = (scope: Scope, accounts: SocialAccount[]) => (v: Video) =>
  scope === "tous" || accounts.find(a => a.id === v.account_id)?.kind === scope;

type Sort = "views" | "engagement" | "shares" | "v24" | "v7" | "recent";
const SORTS: { id: Sort; label: string; key: (v: Video) => number | null }[] = [
  { id: "views", label: "Vues", key: v => v.views },
  { id: "engagement", label: "Engagement", key: engagement },
  { id: "shares", label: "Partage", key: shareRate },
  { id: "v24", label: "Vues 24 h", key: v => v.views_24h },
  { id: "v7", label: "Vues 7 jours", key: v => v.views_7j },
  { id: "recent", label: "Récentes", key: v => (v.published_at ? Date.parse(v.published_at) : null) },
];

/** Le classement des vidéos : `account` pour celles d'un seul compte (fiche du compte) */
export function VideosPanel({ videos, accounts, wide, account, limit = 10 }: {
  videos: Video[]; accounts: SocialAccount[]; wide?: boolean; account?: SocialAccount; limit?: number;
}) {
  const [scope, setScope] = useState<Scope>("tous");
  const [sort, setSort] = useState<Sort>("views");
  const [shown, setShown] = useState(limit);
  const key = SORTS.find(s => s.id === sort)!.key;
  // Les vidéos sans la mesure choisie (vues à 7 jours d'une vidéo trop récente…) passent à la fin
  const list = videos.filter(account ? v => v.account_id === account.id : inScope(scope, accounts))
    .sort((a, b) => (key(b) ?? -1) - (key(a) ?? -1));
  const handle = (v: Video) => accounts.find(a => a.id === v.account_id)?.handle;

  return (
    <div className="adm-card adm-panel adm-stack">
      <div className="adm-ph">
        <h3>{account ? "Ses meilleures vidéos" : "Vidéos"}</h3>
        <span className="adm-muted adm-small">{nf.format(list.length)} vidéo{list.length > 1 ? "s" : ""} · engagement = (j'aime + commentaires + partages) / vues</span>
      </div>
      {!account && <div className="adm-chips adm-chips-in">
        {SCOPES.map(s => <button key={s.id} type="button" aria-pressed={scope === s.id} onClick={() => setScope(s.id)}>{s.label}</button>)}
      </div>}
      <div className="adm-row adm-wrap adm-small">
        <span className="adm-muted">Trier par</span>
        <div className="adm-seg adm-seg-sm" role="radiogroup" aria-label="Trier par">
          {SORTS.map(s => <button key={s.id} type="button" role="radio" aria-checked={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>)}
        </div>
      </div>
      {list.length === 0
        ? <p className="adm-empty">Pas encore de vidéo : elles arrivent au premier relevé d'un compte lié.</p>
        : wide ? (
          <table className="adm-table adm-videos">
            <thead><tr>
              <th>#</th><th>Vidéo</th><th>Durée</th><th>Vues</th><th>24 h</th><th>7 jours</th><th>Engagement</th><th>Partage</th>
            </tr></thead>
            <tbody>
              {list.slice(0, shown).map((v, i) => (
                <tr key={v.account_id + v.id}>
                  <td className="adm-muted">{i + 1}</td>
                  <td><VideoTitle v={v} handle={account ? undefined : handle(v)} /></td>
                  <td className="adm-nowrap">{durF(v.duration)}</td>
                  <td><b>{big(v.views)}</b></td>
                  <td>{big(v.views_24h)}</td>
                  <td>{big(v.views_7j)}</td>
                  <td>{pctF(engagement(v))}</td>
                  <td>{pctF(shareRate(v))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="adm-stack">
            {list.slice(0, shown).map((v, i) => (
              <div key={v.account_id + v.id} className="adm-vcard">
                <span className="adm-muted adm-small">{i + 1}</span>
                <VideoTitle v={v} handle={account ? undefined : handle(v)} />
                <div className="adm-vnums adm-small">
                  <span><b>{big(v.views)}</b> vues</span>
                  <span>{pctF(engagement(v))} engag.</span>
                  <span>{pctF(shareRate(v))} partage</span>
                  {v.views_7j != null && <span>{big(v.views_7j)} à 7 j</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      {list.length > shown && <div className="adm-row"><button type="button" className="adm-btn line" onClick={() => setShown(n => n + 20)}>Voir plus</button></div>}
    </div>
  );
}

function VideoTitle({ v, handle }: { v: Video; handle?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="adm-vtitle">
      {v.cover_url && !broken
        ? <img src={v.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        : <span className="adm-vcover" aria-hidden="true" />}
      <div>
        {v.url ? <a href={v.url} target="_blank" rel="noreferrer" className="adm-clamp">{v.title || "Sans titre"}</a> : <span className="adm-clamp">{v.title || "Sans titre"}</span>}
        <div className="adm-muted adm-small">{handle && `@${handle} · `}{dateF(v.published_at)}</div>
      </div>
    </div>
  );
}

// ─── Ce qui marche ───────────────────────────────────────────────────────────

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const paris = (iso: string) => {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date(iso));
  return { day: parts.find(p => p.type === "weekday")!.value.replace(".", ""), hour: Number(parts.find(p => p.type === "hour")!.value) };
};
const DAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const DAY_LABELS: Record<string, string> = { lun: "Lundi", mar: "Mardi", mer: "Mercredi", jeu: "Jeudi", ven: "Vendredi", sam: "Samedi", dim: "Dimanche" };
const SLOTS: { label: string; from: number; to: number }[] = [
  { label: "Nuit (0 h – 7 h)", from: 0, to: 7 }, { label: "Matin (7 h – 11 h)", from: 7, to: 11 }, { label: "Midi (11 h – 14 h)", from: 11, to: 14 },
  { label: "Après-midi (14 h – 18 h)", from: 14, to: 18 }, { label: "Soirée (18 h – 21 h)", from: 18, to: 21 }, { label: "Tard (21 h – 0 h)", from: 21, to: 24 },
];
const LENGTHS: { label: string; from: number; to: number }[] = [
  { label: "Moins de 15 s", from: 0, to: 15 }, { label: "15 à 30 s", from: 15, to: 30 }, { label: "30 à 60 s", from: 30, to: 60 },
  { label: "1 à 3 min", from: 60, to: 180 }, { label: "Plus de 3 min", from: 180, to: Infinity },
];
const MIN_VIDEOS = 5;
const DAY_MS = 86_400_000;

type Group = { label: string; list: Video[] };

/** Barres : vues médianes par groupe (jour, créneau, durée), la meilleure en avant */
function GroupBars({ groups }: { groups: Group[] }) {
  const rows = groups.map(g => ({ ...g, med: median(g.list.map(v => v.views)), eng: engagementOf(g.list) }));
  const max = Math.max(1, ...rows.map(r => r.med ?? 0));
  const best = rows.reduce<typeof rows[number] | null>((b, r) => (r.list.length >= 2 && (r.med ?? 0) > (b?.med ?? -1) ? r : b), null);
  return (
    <ul className="adm-bars">
      {rows.map(r => (
        <li key={r.label}>
          <div className="adm-row adm-between">
            <span>{r.label} {r === best && <span className="adm-tag st-abonne">le meilleur</span>}</span>
            <b>{big(r.med == null ? null : Math.round(r.med))} <span className="adm-muted adm-small">· {r.list.length} vidéo{r.list.length > 1 ? "s" : ""} · {pctF(r.eng)}</span></b>
          </div>
          <div className="adm-track"><i style={{ width: `${((r.med ?? 0) / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function Insights({ videos, accounts, wide }: { videos: Video[]; accounts: SocialAccount[]; wide?: boolean }) {
  const [scope, setScope] = useState<Scope>("frigia");
  const list = videos.filter(inScope(scope, accounts)).filter(v => v.published_at);
  const [now] = useState(() => Date.now());
  const recent = list.filter(v => now - Date.parse(v.published_at!) < 30 * DAY_MS);
  const before = list.filter(v => { const age = now - Date.parse(v.published_at!); return age >= 30 * DAY_MS && age < 60 * DAY_MS; });
  const avg = (l: Video[]) => (l.length ? l.reduce((t, v) => t + v.views, 0) / l.length : null);
  const a1 = avg(recent), a0 = avg(before);
  const change = a1 != null && a0 ? (a1 - a0) / a0 : null;
  const times = list.map(v => ({ v, ...paris(v.published_at!) }));

  return (
    <div className="adm-stack">
      <div className="adm-chips adm-chips-in">
        {SCOPES.map(s => <button key={s.id} type="button" aria-pressed={scope === s.id} onClick={() => setScope(s.id)}>{s.label}</button>)}
      </div>
      {list.length < MIN_VIDEOS
        ? <p className="adm-note">Pas encore assez de vidéos ({list.length}) pour en tirer quelque chose : il en faut au moins {MIN_VIDEOS} sur des comptes liés.</p>
        : <>
          <div className="adm-kpis adm-kpis3">
            <div className="adm-card adm-kpi">
              <span className="adm-muted">Vues moyennes par vidéo</span>
              <b>{big(a1 == null ? null : Math.round(a1))}</b>
              <span className="adm-small adm-muted">
                {recent.length} vidéo{recent.length > 1 ? "s" : ""} sur 30 jours
                {change != null && <> · <span className={change < 0 ? "adm-warn" : undefined}>{change >= 0 ? "+" : "−"}{pctF(Math.abs(change))}</span> par rapport aux 30 jours d'avant</>}
              </span>
            </div>
            <div className="adm-card adm-kpi">
              <span className="adm-muted">Engagement</span>
              <b>{pctF(engagementOf(list))}</b>
              <span className="adm-small adm-muted">sur toutes les vidéos · 30 jours : {pctF(engagementOf(recent))}</span>
            </div>
            <div className="adm-card adm-kpi">
              <span className="adm-muted">Partage</span>
              <b>{pctF(shareRate({ views: list.reduce((t, v) => t + v.views, 0), shares: list.reduce((t, v) => t + v.shares, 0) }))}</b>
              <span className="adm-small adm-muted">des vues finissent en partage</span>
            </div>
          </div>
          <div className={wide ? "adm-grid3" : "adm-stack"}>
            <div className="adm-card adm-panel">
              <div className="adm-ph"><h3>Jour de publication</h3><span className="adm-muted adm-small">vues médianes</span></div>
              <GroupBars groups={DAYS.map(d => ({ label: DAY_LABELS[d], list: times.filter(t => t.day === d).map(t => t.v) }))} />
            </div>
            <div className="adm-card adm-panel">
              <div className="adm-ph"><h3>Heure de publication</h3><span className="adm-muted adm-small">heure de Paris</span></div>
              <GroupBars groups={SLOTS.map(s => ({ label: s.label, list: times.filter(t => t.hour >= s.from && t.hour < s.to).map(t => t.v) }))} />
            </div>
            <div className="adm-card adm-panel">
              <div className="adm-ph"><h3>Durée de la vidéo</h3><span className="adm-muted adm-small">vues médianes</span></div>
              <GroupBars groups={LENGTHS.map(l => ({ label: l.label, list: list.filter(v => v.duration != null && v.duration >= l.from && v.duration < l.to) }))} />
            </div>
          </div>
          <p className="adm-muted adm-small">Médiane : la moitié des vidéos fait plus, l'autre moitié moins, pour qu'une vidéo virale ne fausse pas tout. Le meilleur groupe est choisi parmi ceux d'au moins 2 vidéos. Les vidéos récentes ont eu moins de temps pour faire des vues.</p>
        </>}
    </div>
  );
}
