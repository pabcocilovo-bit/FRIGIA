// 25 · Ton bilan (prototype V3, Plus) : ce que tu as sauvé ce mois-ci, comparé au mois d'avant, sur trois mois,
// avec le compteur de la communauté, le détail du calcul et ce qui a le plus servi. On remonte jusqu'à un an.
// Pas de « Restes réutilisés » : un repas de restes ne passe pas par « J'ai cuisiné ça », on ne sait pas le compter.
// Ce qui a été jeté : les produits notés « Jeté » dans Ma cuisine (date passée), et la part sauvée (sauvé / sauvé + jeté).
import { useEffect, useState } from "react";
import { type Budget, monthTossed } from "../../lib/budget";
import type { CookedMeal } from "../../lib/cooked";
import { Icon, Pill, RoundButton, ScreenHeader } from "../../ui/components";
import { useBack } from "../nav";
import { showToast } from "../toast";
import { kilos } from "../scan/savings";
import { plural } from "../format";
import { shareStory, storyImage } from "../scan/story";
import { cmFmt, useCommunity } from "./community";
import { eur, eurShort, mealsOf, report } from "./report";
import { isEn, t } from "../../lib/i18n";
import "../library/library.css";
import "../settings/settings.css";
import "./report.css";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Le compteur monte de 97 % à sa valeur en arrivant sur l'écran */
function useCountUp(target: number | null) {
  const [v, setV] = useState<number | null>(target == null ? null : target * 0.97);
  useEffect(() => {
    if (target == null) return;
    let raf = 0, t0 = 0;
    const from = target * 0.97;
    const step = (ts: number) => {
      t0 ||= ts;
      const k = Math.min(1, (ts - t0) / 1100);
      setV(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

export function Report({ meals, budget }: { meals: CookedMeal[]; budget: Budget }) {
  const back = useBack();
  // ?mois=2026-09 : ouvert depuis « Ton bilan de septembre est prêt »
  const [off, setOff] = useState(() => {
    const m = new URLSearchParams(window.location.search).get("mois")?.match(/^(\d{4})-(\d{2})$/);
    const d = new Date();
    return m ? Math.max(0, (d.getFullYear() - Number(m[1])) * 12 + d.getMonth() + 1 - Number(m[2])) : 0;
  });
  const community = useCommunity();
  const shown = useCountUp(community?.kg ?? null);
  const r = report(meals, off);
  const { sum, mode } = r;
  const now = r.off === 0;
  const saved = mode === "saved";
  const when = now ? t("ce mois-ci", "this month") : t(`en ${r.name}`, `in ${r.name}`);
  const sep = isEn ? "." : ",";
  const [whole, cents] = eur(sum.eur).split(sep);
  const d = new Date();
  const tossed = monthTossed(budget, new Date(d.getFullYear(), d.getMonth() - r.off, 1));
  const tossedEur = Math.round(tossed.reduce((n, x) => n + x.eur, 0) * 100) / 100;
  const part = saved && tossedEur > 0 ? Math.round((sum.eur / (sum.eur + tossedEur)) * 100) : null;

  // Graphique : la barre la plus haute (ou la projection) à 88 % de la hauteur, pour garder la place des étiquettes
  const mx = Math.max(...r.chart.map(b => b.eur), r.proj ?? 0) / 0.88 || 1;
  const pct = (n: number) => Math.round((n / mx) * 100);

  const share = async () => {
    const m = mealsOf(meals, new Date(), r.off).find(x => x.image);
    const badge = saved ? t(`${eur(sum.eur)} sauvés en ${r.name}`, `${eur(sum.eur)} saved in ${r.name}`) : t(`${kilos(sum.kg)} de mon frigo cuisinés en ${r.name}`, `${kilos(sum.kg)} from my fridge cooked in ${r.name}`);
    const title = saved ? t(`${kilos(sum.kg)} de nourriture en moins à la poubelle`, `${kilos(sum.kg)} less food in the bin`) : t(`${sum.meals} repas avec ce que j'avais`, `${sum.meals} meal${sum.meals > 1 ? "s" : ""} with what I had`);
    const blob = await storyImage(m?.image ?? null, badge, title, t("Mon bilan du mois avec Frigia · frigia.fr", "My month with Frigia · frigia.fr"));
    if (!blob) { showToast(t("La carte n'a pas pu être créée", "The card couldn't be created")); return; }
    const res = await shareStory(blob, t("Mon bilan Frigia", "My Frigia report"), false);
    if (res === "saved") showToast(t("Carte enregistrée : partage-la où tu veux", "Card saved: share it wherever you like"));
  };

  return (
    <div className="fa fa-app rp-page" aria-label={t("Ton bilan du mois", "Your monthly report")}>
      <ScreenHeader title={t(<>Ton <em>bilan</em></>, <>Your <em>report</em></>)}
        left={<RoundButton icon="back" label={t("Retour", "Back")} big onClick={back} />}
        right={<RoundButton icon="share" label={t("Partager mon bilan", "Share my report")} big onClick={() => void share()} />}>
        <div className="rp-month">
          <button type="button" aria-label={t("Mois précédent", "Previous month")} disabled={r.off >= r.months - 1} onClick={() => setOff(r.off + 1)}><Icon name="back" /></button>
          <b aria-live="polite">{cap(r.name)}</b>
          <button type="button" aria-label={t("Mois suivant", "Next month")} disabled={now} onClick={() => setOff(r.off - 1)}><Icon name="next" /></button>
        </div>
      </ScreenHeader>

      <div className="rp-body">
        <div className="rp-hero">
          <span className="label">{saved ? t(`Sauvés ${when}`, `Saved ${when}`) : t(`De ton frigo, ${when}`, `From your fridge, ${when}`)}</span>
          <div className="rp-tot">{whole}<small>{sep}{cents}</small></div>
          {r.cmp && (
            <span className={"rp-cmp" + (r.cmp.diff < 0 ? " down" : "")}><Icon name="arrow" />
              <span>{r.cmp.diff === 0 ? t(`Autant qu'${r.cmp.vs}`, `As much as ${r.cmp.vs}`) : t(`${eur(Math.abs(r.cmp.diff))} de ${r.cmp.diff > 0 ? "plus" : "moins"} qu'${r.cmp.vs}`, `${eur(Math.abs(r.cmp.diff))} ${r.cmp.diff > 0 ? "more" : "less"} than ${r.cmp.vs}`)}</span></span>
          )}
          {r.chart.length > 1 && (
            <div className="rp-chart" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${r.chart.length},1fr)` }}>
              {r.chart.map(b => {
                const h = pct(b.eur), on = b.off === r.off, ph = on && r.proj ? pct(r.proj - b.eur) / Math.max(h, 1) * 100 : 0;
                return (
                  <div key={b.off} className={"rp-col" + (on ? " on" : "")} onClick={() => setOff(b.off)}>
                    <span className="rp-bar" style={{ height: `${h}%` }}>
                      {ph > 0 && <><span className="rp-proj-bar" style={{ height: `${ph}%` }} /><em className="rp-pl" style={{ bottom: `calc(100% + ${ph}% + 4px)` }}>≈ {eurShort(r.proj!)}</em></>}
                      <i>{eurShort(b.eur)}</i>
                    </span>
                    <small>{b.label}</small>
                  </div>
                );
              })}
              {r.avg != null && <span className="rp-avg" style={{ bottom: `calc(26px + ${r.avg / mx} * (100% - 26px))` }}><span>{t("moyenne", "average")} {eurShort(r.avg)}</span></span>}
            </div>
          )}
          {r.proj != null && <p className="rp-proj">{t(`En pointillé : à ce rythme, environ ${r.proj} € fin ${r.name}.`, `Dotted: at this rate, about ${eurShort(r.proj)} by the end of ${r.name}.`)}</p>}
        </div>

        <div className="rp-tiles">
          {saved
            ? <div className="rp-tile"><span className="label">{t("À la poubelle", "In the bin")}</span><b>{sum.kg > 0 ? "−" : ""}{kilos(sum.kg)}</b><span>{t("de nourriture en moins", "less food")}</span></div>
            : <div className="rp-tile"><span className="label">{t("De ton frigo", "From your fridge")}</span><b>{kilos(sum.kg)}</b><span>{t("de produits frais cuisinés", "of fresh food cooked")}</span></div>}
          <div className="rp-tile"><span className="label">{t("Repas", "Meals")}</span><b>{sum.meals}</b><span>{t("cuisinés avec ton frigo", "cooked with your fridge")}</span></div>
        </div>

        {community && (
          <div className="cm-card">
            <svg className="cm-art" viewBox="0 0 120 120" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="60" cy="60" r="44" fill="rgba(247,241,230,.08)" stroke="rgba(247,241,230,.35)" strokeWidth="2" />
              <path d="M16 60h88M60 16c14 14 14 74 0 88M60 16c-14 14-14 74 0 88" stroke="rgba(247,241,230,.25)" strokeWidth="2" />
              <g className="cm-dots" fill="#E0A44A"><circle cx="38" cy="40" r="4" /><circle cx="78" cy="34" r="3" /><circle cx="86" cy="66" r="4" /><circle cx="50" cy="78" r="3" /><circle cx="66" cy="56" r="5" fill="#F7F1E6" /></g>
            </svg>
            <span className="label">{t("La communauté Frigia", "The Frigia community")}</span>
            <div className="cm-big"><b className="cmN">{cmFmt(shown ?? community.kg)}</b><small>kg</small></div>
            <p>{t(<>sauvés de la poubelle depuis le lancement, par <b>{cmFmt(community.households)}</b> foyer{community.households > 1 ? "s" : ""}.</>, <>saved from the bin since launch, by <b>{cmFmt(community.households)}</b> household{community.households > 1 ? "s" : ""}.</>)}</p>
            {saved && sum.kg > 0 && <span className="cm-you"><Icon name="heart-f" /><span>{t("Ta part : ", "Your share: ")}<b>{kilos(sum.kg)}</b> {when}</span></span>}
          </div>
        )}

        {saved && <>
          <span className="st-sec">{t("Comment on compte", "How we count")}</span>
          <div className="st-card rp-calc">
            {sum.ingredients != null && <div className="rp-row"><span className="pi"><Icon name="leaf" /></span><span>{t("Ingrédients sauvés", "Ingredients saved")}</span><b>{sum.ingredients}</b></div>}
            <div className="rp-row"><span className="pi"><Icon name="cart" /></span><span>{t("Courses évitées", "Shopping avoided")}</span><b>{eur(sum.eur)}</b></div>
            <div className="rp-row rp-sum"><span>{t(`Sauvés ${when}`, `Saved ${when}`)}</span><b>{eur(sum.eur)}</b></div>
          </div>
        </>}

        {tossed.length > 0 && <>
          <span className="st-sec">{t("Ce qui a été jeté", "What was thrown away")}</span>
          <div className="st-card rp-calc">
            <div className="rp-row"><span className="pi"><Icon name="trash" /></span><span>{t("Jeté, date passée · ", "Thrown away, past its date · ")}{plural(tossed.length, "produit", "product")}</span><b>{eur(tossedEur)}</b></div>
            {part != null && <div className="rp-row rp-sum"><span>{t(`Part sauvée ${when}`, `Share saved ${when}`)}</span><b>{t(`${part} %`, `${part}%`)}</b></div>}
          </div>
        </>}

        {sum.top.length > 0 && <>
          <span className="st-sec">{t("Ce qui a le plus servi", "What you used most")}</span>
          <div className="st-card rp-top">
            {sum.top.map(tp => (
              <div key={tp.name} className="rp-ti">
                <div><b>{tp.name}</b><span>{t(`${tp.n} fois`, `${tp.n} time${tp.n > 1 ? "s" : ""}`)} · {eur(tp.eur)}</span></div>
                <i><u style={{ width: `${Math.round((tp.n / sum.top[0].n) * 100)}%` }} /></i>
              </div>
            ))}
          </div>
        </>}

        <p className="rp-note">{saved
          ? t("Estimations à partir de prix moyens en supermarché : ce que tu aurais sans doute jeté, puis racheté. Compte ce qui était « À finir » (marqué au scan, ou proche de sa date) et ce que tu as noté « Mangé » dans Ma cuisine.",
            "Estimates based on average supermarket prices: what you would probably have thrown away, then bought again. Counts what was marked \"Use up\" (at the scan, or close to its date) and what you marked \"Eaten\" in My kitchen.")
          : t("Rien n'est encore compté comme sauvé : marque « À finir » au scan ce qui doit partir vite. Estimations à partir de prix moyens en supermarché.",
            "Nothing counts as saved yet: mark \"Use up\" at the scan for what needs eating soon. Estimates based on average supermarket prices.")}</p>
        <Pill block icon="share" onClick={() => void share()}>{t("Partager mon bilan", "Share my report")}</Pill>
      </div>
    </div>
  );
}
