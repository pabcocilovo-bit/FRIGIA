// « Et les dates de péremption ? » : juste après « C'est bien ça ? » (scan du frigo ou ticket), avant le menu. Demandé par Hugo le 5 novembre.
// En haut, ce qui se garde peu (viande, poisson, fruits rouges… : 3 jours ou moins d'après lib/shelf.ts), « À vérifier » ;
// « Voir les autres aliments » montre le reste. Rien n'est obligatoire : sans date, Ma cuisine garde son estimation.
// Les dates partent dans Ma cuisine avec le scan (fromScan, quand les recettes sont prêtes).
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Icon, RoundButton } from "../../ui/components";
import type { Fridge } from "../../lib/home";
import { qtyOf } from "../../lib/fridge";
import { atNoon, daysTo } from "../../lib/shelf";
import { same } from "../../lib/shopping";
import { locale, t } from "../../lib/i18n";
import { datesStep, getScan, keepOf, setScan, useScan } from "./store";
import "./scan.css";
import "../fridge/fridge.css";

const DAY = 864e5;
/** Se garde 3 jours ou moins : à vérifier en priorité */
const URGENT = 3;
const QUICK: [string, number][] = [[t("Aujourd'hui", "Today"), 0], [t("Demain", "Tomorrow"), 1], [t("Dans 3 jours", "In 3 days"), 3], [t("Dans 1 semaine", "In 1 week"), 7]];
const iso = (at: number) => { const d = new Date(at); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const longDay = (at: number) => { const s = new Date(at).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }); return s.charAt(0).toUpperCase() + s.slice(1); };

export function Dates({ kitchen }: { kitchen: Fridge }) {
  const navigate = useNavigate();
  const scan = useScan();
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  // Déjà dans Ma cuisine avec une vraie date encore à venir : elle est reprise
  const [dates, setDates] = useState<Record<string, number>>(() => {
    const s = getScan();
    const known = Object.fromEntries(s.ingredients.flatMap(i => {
      const k = kitchen.items.find(x => same(x.name, i.name) && x.until && daysTo(x.until) >= 0);
      return k?.until ? [[i.name, k.until]] : [];
    }));
    return { ...known, ...s.dates };
  });
  if (!datesStep(scan)) return <Navigate to="/scan/menu" replace />;

  const items = scan.ingredients.map(i => ({ ...i, keep: keepOf(scan, i.name) }));
  const urgent = items.filter(i => i.keep != null && i.keep <= URGENT);
  // Le reste : ce qui se garde le moins d'abord, ce qui n'a pas d'estimation à la fin
  const others = items.filter(i => !urgent.includes(i)).sort((a, b) => (a.keep ?? 999) - (b.keep ?? 999));
  const shown = urgent.length === 0 || more ? [...urgent, ...others] : urgent;
  const set = (name: string, at: number | undefined) => {
    setDates(d => { const n = { ...d }; if (at) n[name] = at; else delete n[name]; return n; });
    setOpen(null);
  };
  const go = () => { setScan({ dates }); navigate("/scan/menu"); };
  const nUrgent = urgent.length;

  return (
    <section className="fa scan-screen scr-menu" aria-label={t("Dates de péremption", "Use-by dates")}>
      <div className="mn-head">
        <RoundButton icon="back" label={t("Retour", "Back")} tone="dark" onClick={() => { setScan({ dates }); navigate(-1); }} />
        <span className="label">{t("Après le scan", "After the scan")}</span>
        <h2>{t(<>Et les dates de <em>péremption&nbsp;?</em></>, <>And the <em>use-by dates?</em></>)}</h2>
      </div>
      <div className="mn-sheet">
        <div className="scroll">
          <div className="ingr-body">
            <p className="dt-intro">{t("Pour éviter le gaspillage, ajoute les dates des aliments qui se conservent peu de temps.", "To avoid waste, add the dates of the food that doesn't keep long.")}</p>
            <div className="dt-tip">
              <b><Icon name="cal" />{nUrgent
                ? t(`${nUrgent} aliment${nUrgent > 1 ? "s" : ""} à vérifier en priorité`, `${nUrgent} item${nUrgent > 1 ? "s" : ""} to check first`)
                : t("Rien d'urgent dans ce scan", "Nothing urgent in this scan")}</b>
              <span>{t("Les dates sont indiquées sur les emballages. Tu peux passer cette étape.", "The dates are on the packaging. You can skip this step.")}</span>
            </div>
            <div className="dt-list">
              {shown.map(it => {
                const at = dates[it.name], qty = qtyOf(it.qty), isOpen = open === it.name;
                return (
                  <div key={it.name} className="dt-card">
                    <div className="dt-h">
                      <div><b>{it.name}</b>{qty && <small>{qty}</small>}</div>
                      {at ? <span className="badge">{t("Date notée", "Date saved")}</span>
                        : it.keep != null && it.keep <= URGENT ? <span className="badge dt-warn">{t("À vérifier", "Check it")}</span> : null}
                    </div>
                    {isOpen ? <DatePick name={it.name} at={at} onDate={d => set(it.name, d)} onClose={() => setOpen(null)} /> : (
                      <button type="button" className={"dt-pick" + (at ? " on" : "")} aria-label={at ? t(`${it.name} : ${longDay(at)}. Changer`, `${it.name}: ${longDay(at)}. Change`) : t(`Choisir la date de ${it.name}`, `Pick the date of ${it.name}`)}
                        onClick={() => setOpen(it.name)}>
                        <Icon name="cal" /><span>{at ? longDay(at) : t("Choisir la date sur l'emballage", "Pick the date on the packaging")}</span><Icon name="next" className="dt-chev" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {urgent.length > 0 && others.length > 0 && (
              <button type="button" className="dt-more" aria-expanded={more} onClick={() => setMore(m => !m)}>
                {more ? t("Masquer les autres aliments", "Hide the other items") : t(`Voir les autres aliments (${others.length})`, `See the other items (${others.length})`)}
                <Icon name="next" className={more ? "up" : ""} />
              </button>
            )}
          </div>
        </div>
        <button type="button" className="gobar" onClick={go}>
          <span><b>{Object.keys(dates).length ? t("Enregistrer et continuer", "Save and continue") : t("Passer", "Skip")}</b>
            <small>{t("Tu pourras compléter les dates plus tard", "You can add the dates later")}</small></span>
          <span className="go"><Icon name="arrow" /></span>
        </button>
      </div>
    </section>
  );
}

/** Quelques choix rapides, ou la date de l'emballage (un vrai champ date et « OK », comme dans Ma cuisine : l'iPhone ouvre mal un champ caché) */
function DatePick({ name, at, onDate, onClose }: { name: string; at?: number; onDate: (at: number | undefined) => void; onClose: () => void }) {
  const [today] = useState(() => iso(Date.now()));
  const [val, setVal] = useState(() => iso(at ?? Date.now() + 3 * DAY));
  const pick = () => { const [y, m, d] = val.split("-").map(Number); if (y) onDate(new Date(y, m - 1, d, 12).getTime()); };
  return (
    <div className="dt-ed" role="group" aria-label={t(`Date de ${name}`, `Date of ${name}`)}>
      <div className="fr-due-ch">
        {QUICK.map(([label, d]) => <button key={d} type="button" onClick={() => onDate(atNoon(Date.now() + d * DAY))}>{label}</button>)}
        {at && <button type="button" className="fr-due-auto" onClick={() => onDate(undefined)}>{t("Sans date", "No date")}</button>}
      </div>
      <div className="fr-due-other">
        <input type="date" aria-label={t("Date sur l'emballage", "Date on the packaging")} min={today} value={val} onChange={e => setVal(e.target.value)} />
        <button type="button" disabled={!val} onClick={pick}>OK</button>
        <button type="button" className="dt-x" aria-label={t("Fermer", "Close")} onClick={onClose}><Icon name="x" /></button>
      </div>
    </div>
  );
}
