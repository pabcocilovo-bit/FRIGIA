// Le dashboard de suivi > Courses (Hugo, 5 novembre) : ce que les gens font de leur liste de courses.
// Les actions sont notées par l'appli (src/lib/shopEvents.ts) depuis le lancement du suivi ; les chiffres : admin_courses().
import { useEffect, useState } from "react";
import { type Shopping, type ShopDay, loadShopping } from "./admin";
import { BarChart, Empty, Panel, type Point } from "./ui";

const nf = new Intl.NumberFormat("fr-FR");
const n = (v: number) => nf.format(v);
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "–");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

const SERIES: { key: keyof Omit<ShopDay, "jour">; label: string }[] = [
  { key: "ajouts", label: "Articles ajoutés" },
  { key: "coches", label: "Articles cochés" },
  { key: "courses", label: "Courses faites" },
];
const points = (days: ShopDay[], k: keyof Omit<ShopDay, "jour">): Point[] => days.map(d => ({ jour: d.jour, v: d[k] }));

export default function CoursesView({ days, wide }: { days: number; wide?: boolean }) {
  const [res, setRes] = useState<{ days: number; r: Awaited<ReturnType<typeof loadShopping>> } | null>(null);
  const [serie, setSerie] = useState<(typeof SERIES)[number]["key"]>("ajouts");
  useEffect(() => {
    let live = true;
    void loadShopping(days).then(r => { if (live) setRes({ days, r }); });
    return () => { live = false; };
  }, [days]);

  if (!res) return <p className="adm-muted">Chargement des chiffres…</p>;
  if (!res.r.ok) return <p className="adm-note">{res.r.message}</p>;
  const d = res.r.data;
  if (!d.depuis) return <Empty>Pas encore d'action sur les listes. Les chiffres arrivent dès que quelqu'un ajoute ou coche un article.</Empty>;

  const current = SERIES.find(s => s.key === serie)!;
  return <>
    <Kpis d={d} />
    {wide
      ? <div className="adm-grid2">
          {SERIES.filter(s => s.key !== "coches").map(s => (
            <Panel key={s.key} title={s.label} aside={`${n(d.par_jour.reduce((t, x) => t + x[s.key], 0))} sur ${res.days} jours`}>
              <BarChart days={points(d.par_jour, s.key)} label={s.label} height={150} />
            </Panel>
          ))}
        </div>
      : <>
          <div className="adm-chips">
            {SERIES.map(s => <button key={s.key} type="button" aria-pressed={serie === s.key} onClick={() => setSerie(s.key)}>{s.label}</button>)}
          </div>
          <Panel title={current.label} aside={`${n(d.par_jour.reduce((t, x) => t + x[serie], 0))} sur ${res.days} jours`}>
            <BarChart days={points(d.par_jour, serie)} label={current.label} height={190} />
          </Panel>
        </>}
    <Panel title="Top 20 des produits ajoutés" aside="Tous comptes confondus, anonyme">
      <Top d={d} wide={wide} />
    </Panel>
    <p className="adm-muted adm-small">
      Suivi depuis le {date(d.depuis)}. Une course = un compte qui coche au moins 2 articles le même jour.
      Cocher un article n'est pas une preuve d'achat en caisse.
    </p>
  </>;
}

function Kpis({ d }: { d: Shopping }) {
  const f = d.fidelite;
  const tiles: { label: string; value: string; sub: string }[] = [
    { label: "Articles ajoutés", value: n(d.ajouts), sub: `${pct(d.ajouts_recette, d.ajouts)} depuis une recette (${n(d.ajouts_recette)})` },
    { label: "Articles cochés", value: n(d.coches), sub: `${pct(d.coches, d.ajouts)} des ajouts · ${n(d.decoches)} décochés` },
    { label: "Courses faites", value: n(d.courses), sub: d.articles_par_course != null ? `${nf.format(d.articles_par_course)} articles par course` : "–" },
    { label: "Refont des courses", value: pct(f.revenus, f.courses), sub: f.courses ? `dans les 7 jours · sur ${n(f.courses)} course${f.courses > 1 ? "s" : ""}` : "il faut une semaine de recul" },
    { label: "Utilisent la liste", value: n(d.utilisateurs), sub: `sur ${n(d.actifs_30j)} actifs en 30 jours` },
    { label: "Retirés sans cocher", value: n(d.retraits), sub: `${pct(d.retraits, d.ajouts)} des ajouts` },
  ];
  return (
    <div className="adm-kpis">
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

function Top({ d, wide }: { d: Shopping; wide?: boolean }) {
  if (!d.top.length) return <Empty>Aucun article ajouté sur la période.</Empty>;
  const max = d.top[0].ajouts || 1;
  if (wide) return (
    <table className="adm-table">
      <thead><tr><th>#</th><th>Produit</th><th>Ajouts</th><th>Comptes</th><th>Cochés</th></tr></thead>
      <tbody>
        {d.top.map((t, i) => (
          <tr key={t.item}>
            <td className="adm-muted">{i + 1}</td>
            <td>{cap(t.item)}</td>
            <td>{n(t.ajouts)}</td>
            <td>{n(t.comptes)}</td>
            <td>{pct(Math.min(t.coches, t.ajouts), t.ajouts)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <ul className="adm-bars">
      {d.top.map((t, i) => (
        <li key={t.item}>
          <div className="adm-row adm-between">
            <span>{i + 1}. {cap(t.item)}</span>
            <b>{n(t.ajouts)} <span className="adm-muted adm-small">{n(t.comptes)} compte{t.comptes > 1 ? "s" : ""}</span></b>
          </div>
          <div className="adm-track"><i style={{ width: `${(t.ajouts / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
