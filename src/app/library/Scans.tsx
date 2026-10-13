// 1 bis · Tes scans (prototype V3) : cette semaine, la semaine dernière, puis mois par mois.
// En Gratuit, les scans de plus de 7 jours sont floutés et ouvrent « Passe à Plus ».
// Cuisiné / pas cuisiné (onglets, statut, « repas cuisinés ») arrive avec le mode cuisine (étape 9).
import { Fragment } from "react";
import { useNavigate } from "react-router";
import { MAX_HISTORY } from "../../lib/library";
import type { HistoryEntry } from "../../lib/types";
import { ArtFridge } from "../../ui/art";
import { EmptyState, Icon, LockPill, Pill, RoundButton, ScreenHeader } from "../../ui/components";
import { AppTabBar } from "../AppTabBar";
import { daysAgo, plural, scanDateLine, scanDayTitle, scanGroup } from "../format";
import { useBack } from "../nav";
import { useOpenScan } from "../offline";
import { useRecipePhoto } from "../photo";
import { useOpenPaywall } from "../plus/subscription";
import "./library.css";

const Plate = ({ title, search }: { title: string; search?: string }) => {
  const photo = useRecipePhoto(title, search);
  return photo ? <img src={photo} alt="" /> : null;
};

function ScanCard({ entry, first, locked, old, onClick }: { entry: HistoryEntry; first: boolean; locked: boolean; old: boolean; onClick: () => void }) {
  const lead = entry.recipes[0];
  const photo = useRecipePhoto(lead?.title, lead?.imageSearch);
  return (
    <button type="button" className={["hs-card", old && "old", locked && "blur"].filter(Boolean).join(" ")} onClick={onClick}>
      {photo ? <img className="hs-ph" src={photo} alt="" /> : <span className="hs-ph" style={{ background: "var(--surface)" }} />}
      <span className="tx">
        <b>{scanDayTitle(entry.date, entry.meal)}</b>
        <span className="hs-date">{scanDateLine(entry.date, entry.ingredients.length)}</span>
        <span className="hs-st"><Icon name="clock" /><span>{plural(entry.recipes.length, "idée")}</span></span>
        {first && <span className="hs-first">Ton premier scan</span>}
      </span>
      <span className="hs-plates" aria-hidden="true">{entry.recipes.slice(0, 3).map(r => <Plate key={r.title} title={r.title} search={r.imageSearch} />)}</span>
    </button>
  );
}

export function Scans({ history, isPlus }: { history: HistoryEntry[]; isPlus: boolean }) {
  const back = useBack();
  const navigate = useNavigate();
  const openScan = useOpenScan();
  const openPaywall = useOpenPaywall();
  const n = history.length;
  // Le plus ancien n'est le premier scan que si l'historique n'a pas été coupé (50 scans gardés)
  const oldestId = n < MAX_HISTORY ? history[n - 1]?.id : undefined;

  // Groupes dans l'ordre : cette semaine, la semaine dernière, puis chaque mois
  const groups: { key: string; label: string; month: boolean; items: HistoryEntry[] }[] = [];
  for (const e of history) {
    const g = scanGroup(e.date);
    const last = groups[groups.length - 1];
    if (last?.key === g.key) last.items.push(e);
    else groups.push({ ...g, items: [e] });
  }
  const isOld = (e: HistoryEntry) => daysAgo(e.date) > 7;
  const firstLocked = isPlus ? undefined : history.find(isOld)?.id;

  return (
    <div className="fa fa-app" aria-label="Tes scans">
      <ScreenHeader
        title={<>Tes <em>scans</em></>}
        sub={n ? plural(n, "scan") : "Pas encore de scan"}
        left={<RoundButton icon="back" label="Retour" big onClick={back} />}
        right={<RoundButton icon="cam" label="Nouveau scan" big onClick={openScan} />} />
      {n === 0 ? (
        <EmptyState art={<ArtFridge />} title={<>Aucun <em>scan</em> pour l'instant</>}
          text="Ouvre ton frigo et prends une photo. Tes scans arrivent ici, avec ce que tu as cuisiné."
          action={<>
            <Pill icon="cam" onClick={openScan}>Scanner mon frigo</Pill>
            {!isPlus && <small className="es-hint">15 scans offerts pour commencer</small>}
          </>} />
      ) : (
        <div className="hs-list">
          {groups.map(g => (
            <div key={g.key} className="hs-grp">
              {g.month
                ? <div className="hs-sep"><i /><b>{g.label}</b><i /></div>
                : <h3 className="hs-day">{g.label}</h3>}
              {g.items.map(e => {
                const old = isOld(e), locked = old && !isPlus;
                return (
                  <Fragment key={e.id}>
                    {e.id === firstLocked && (
                      <button type="button" className="fv-lock" onClick={() => openPaywall("historique", "/scans")}>
                        <LockPill /><span><b>Retrouve tous tes scans</b>En gratuit, tu vois ceux des 7 derniers jours.</span>
                      </button>
                    )}
                    <ScanCard entry={e} first={e.id === oldestId} old={old} locked={locked}
                      onClick={() => (locked ? openPaywall("historique", "/scans") : navigate(`/recettes/${e.id}`))} />
                  </Fragment>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <AppTabBar active="home" isPlus={isPlus} />
    </div>
  );
}
