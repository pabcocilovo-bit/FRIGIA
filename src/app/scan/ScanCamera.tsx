// Scan du frigo : la caméra (pour quel repas, frigo / placard / ticket, galerie, déclencheur), puis l'analyse.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router";
import { Icon, RoundButton } from "../../ui/components";
import { detectIngredients, RATE_TEXT, type ScanIngredient, type ScanSource } from "../../lib/scan";
import { openOffline } from "../offline";
import { showToast } from "../toast";
import { getScan, setScan, useScan } from "./store";
import { same } from "../../lib/shopping";
import { Guide } from "./Guide";
import { SCAN_GUIDE, setGuideState } from "./guideSteps";
import "./scan.css";

const MODES: [ScanSource, string][] = [["frigo", "Frigo"], ["placard", "Placard"], ["ticket", "Ticket de caisse"]];
const HINTS: Record<ScanSource, string> = {
  frigo: "Ouvre bien la porte et recule d'un pas",
  placard: "Ouvre grand le placard, toutes les étagères dans le cadre",
  ticket: "Pose le ticket à plat, sous une bonne lumière",
};

type Torch = MediaTrackCapabilities & { torch?: boolean };

/** Une image de la vidéo, en JPEG : exactement ce que montre l'écran. La caméra filme souvent à l'horizontale
 *  et l'écran n'en montre que le milieu (object-fit: cover) : la photo garde ce milieu, à la verticale comme
 *  l'écran (demandé par Hugo le 23 octobre : le recadrage s'ouvrait sur une photo horizontale). */
function grab(video: HTMLVideoElement): Promise<Blob | null> {
  const vw = video.videoWidth, vh = video.videoHeight;
  const { width: ew, height: eh } = video.getBoundingClientRect();
  if (!vw || !vh) return Promise.resolve(null);
  const k = ew && eh ? Math.max(ew / vw, eh / vh) : 1;
  const sw = ew && eh ? Math.min(vw, ew / k) : vw, sh = ew && eh ? Math.min(vh, eh / k) : vh;
  const c = document.createElement("canvas");
  c.width = Math.round(sw);
  c.height = Math.round(sh);
  c.getContext("2d")!.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
}

/** Photo des placards ratée, depuis « Tes placards » : on reste sur la caméra avec une phrase */
const PLACARD_FAIL = { floue: "Photo floue : reprends-la sans bouger.", sombre: "Trop sombre : allume la lumière et reprends-la.",
  vide: "Frigia ne voit rien sur la photo. Ouvre grand le placard." } as const;

export function ScanCamera({ userId, guide, soon = [], onOutOfScans, onPlacards }: {
  userId: string;
  /** Ma cuisine : ce qui arrive à sa date (dueSoon) : retrouvé sur la photo, il est déjà marqué « À finir » */
  soon?: string[];
  /** Premier scan guidé : les bulles s'affichent */
  guide: boolean;
  /** L'essai est fini : le serveur refuse le scan */
  onOutOfScans: () => void;
  /** Depuis « Tes placards » : ce que la photo des placards a vu, à ajouter dans Ma cuisine */
  onPlacards: (found: ScanIngredient[]) => void;
}) {
  const navigate = useNavigate();
  const scan = useScan();
  const screen = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const capture = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [live, setLive] = useState(false);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  // La photo prise, en entier (pas recadrée) : sa taille à l'écran, pour y poser les pastilles au bon endroit
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [found, setFound] = useState<ScanIngredient[] | null>(null);
  const busy = useRef(false);
  // Ouverte depuis « Tes placards » : pas de choix frigo / ticket, et on y revient avec ce qui est vu
  const forPlacards = scan.forPlacards;
  const back = () => { setScan({ forPlacards: false }); navigate(-1); };
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // La caméra du téléphone, en direct. Refusée ou absente : le déclencheur ouvre l'appareil photo du téléphone.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    if (!navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then(s => {
        if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => {}); }
        setLive(true);
        const caps = (s.getVideoTracks()[0]?.getCapabilities?.() ?? {}) as Torch;
        setTorch(caps.torch ? false : null);
      })
      .catch(() => setLive(false));
    return () => { stopped = true; stream?.getTracks().forEach(t => t.stop()); };
  }, [facing]);

  const toggleTorch = () => {
    const track = (video.current?.srcObject as MediaStream | null)?.getVideoTracks()[0];
    if (!track || torch === null) return;
    const on = !torch;
    track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }).then(() => setTorch(on)).catch(() => setTorch(null));
  };

  const analyze = async (photo: Blob) => {
    if (busy.current) return;
    busy.current = true;
    if (!navigator.onLine) { busy.current = false; openOffline(); return; }
    const url = URL.createObjectURL(photo);
    setShot(url);
    setBox(null);
    setFound(null);
    setAnalyzing(true);
    const pl = getScan().forPlacards;
    const r = await detectIngredients(photo, pl ? "placard" : getScan().source);
    if (!alive.current) { busy.current = false; return; }
    if (pl && (r.status === "ok" || r.status === "unclear")) {
      if (r.status === "unclear" || !r.ingredients.length) {
        URL.revokeObjectURL(url);
        busy.current = false;
        setShot(null);
        setAnalyzing(false);
        showToast(PLACARD_FAIL[r.status === "unclear" ? r.problem : "vide"]);
        return;
      }
      setFound(r.ingredients);
      // La photo n'a servi qu'aux placards : sans photo avant (« Que cuisiner avec ? »), son jeton sert aussi aux recettes
      setTimeout(() => {
        if (!alive.current) return;
        onPlacards(r.ingredients);
        setScan({ forPlacards: false, ...(getScan().token ? {} : { token: r.token }) });
        URL.revokeObjectURL(url);
        navigate(-1);
      }, 1300 + Math.min(r.ingredients.length, 8) * 120);
    } else if (r.status === "ok") {
      const found = r.ingredients.map(i => (soon.some(n => same(n, i.name)) ? { ...i, finish: true } : i));
      setScan({ photo: url, ingredients: found, token: r.token, ticket: r.ticket ?? null, ticketOff: false, guests: 0, empty: false, merge: false, off: [],
        ...(r.seen ? { source: r.seen, switched: getScan().source } : { switched: null }) });
      setFound(found);
      // Les pastilles apparaissent sur la photo, puis la liste
      setTimeout(() => {
        if (!alive.current) return;
        navigate("/scan/ingredients");
      }, 1300 + Math.min(r.ingredients.length, 8) * 120);
    } else if (r.status === "unclear") {
      setScan({ photo: url, ingredients: [], token: null, ticket: null, made: null, problem: r.problem, empty: false,
        ...(r.seen ? { source: r.seen, switched: getScan().source } : { switched: null }) });
      navigate("/scan/rate", { replace: true });
    } else {
      URL.revokeObjectURL(url);
      busy.current = false;
      setShot(null);
      setAnalyzing(false);
      if (r.status === "quota") onOutOfScans();
      else if (r.status === "error") {
        if (!navigator.onLine) openOffline();
        else showToast(r.rate ? RATE_TEXT : "Frigia ne répond pas. Réessaie dans un instant.");
      }
    }
  };

  // Photo recadrée : l'analyse part dès l'arrivée
  useEffect(() => {
    const p = getScan().pending;
    if (p) { setScan({ pending: null }); setTimeout(() => void analyze(p), 0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Photo prise ou choisie : d'abord le recadrage (demandé par Hugo le 23 octobre), « Analyser » y lance l'analyse
  const crop = (photo: Blob) => { setScan({ pick: photo }); navigate("/scan/recadrer"); };
  const shoot = async () => {
    if (busy.current) return;
    const v = video.current;
    const photo = live && v ? await grab(v) : null;
    if (photo) crop(photo);
    else capture.current?.click();
  };

  const n = found?.length ?? 0;
  const dots = (found ?? []).filter(i => i.x != null && i.y != null).slice(0, 8);

  return (
    <section ref={screen} className={"fa scan-screen scr-scan" + (analyzing ? " analyzing" : "")} aria-label="Scan du frigo">
      <div className="cam">
        <video ref={video} playsInline muted autoPlay hidden={!live || !!shot} />
        {shot && <img className="cam-blur" src={shot} alt="" />}
      </div>
      {shot && (
        <div className="cam-shot" style={box ? { width: box.w, height: box.h } : { visibility: "hidden" }}>
          <img src={shot} alt="Photo de ton frigo" onLoad={e => {
            const im = e.currentTarget, W = screen.current?.clientWidth ?? 0, H = screen.current?.clientHeight ?? 0;
            const k = Math.min(W / im.naturalWidth, H / im.naturalHeight);
            setBox({ w: Math.round(im.naturalWidth * k), h: Math.round(im.naturalHeight * k) });
          }} />
          <div className="dots">
            {dots.map((d, k) => {
              const style = { left: `${d.x}%`, top: `${d.y}%`, "--d": `${k * 0.2}s` } as CSSProperties;
              return [<i key={"d" + k} className="dot" style={style} />, <span key={"t" + k} className={"tag" + (d.x! > 60 ? " left" : "")} style={style}>{d.name}</span>];
            })}
          </div>
        </div>
      )}
      <div className="cam-top">
        <RoundButton icon="x" label="Fermer" tone="dark" onClick={() => (forPlacards ? back() : navigate("/"))} />
        {torch !== null
          ? <RoundButton icon="flash" label={torch ? "Éteindre le flash" : "Flash"} tone="dark" aria-pressed={torch} onClick={toggleTorch} />
          : <span style={{ width: 40 }} aria-hidden="true" />}
      </div>
      <div className="hint">{HINTS[forPlacards ? "placard" : scan.source]}</div>
      <div className="frame"><i className="tl" /><i className="tr" /><i className="bl" /><i className="br" /></div>
      <div className="cam-bot">
        {forPlacards ? <div className="modes"><span className="mode on">Placards</span></div> : <div className="modes" role="tablist">
          {MODES.map(([s, label]) => (
            <button key={s} type="button" role="tab" aria-selected={scan.source === s} className={"mode" + (scan.source === s ? " on" : "")} onClick={() => setScan({ source: s })}>{label}</button>
          ))}
        </div>}
        <div className="controls">
          <button type="button" className="gal" aria-label="Choisir une photo" onClick={() => gallery.current?.click()}>
            {scan.photo ? <img src={scan.photo} alt="" /> : <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", background: "rgba(247,241,230,.12)" }}><Icon name="image" /></span>}
          </button>
          <button type="button" className="shutter" aria-label="Prendre la photo" onClick={shoot} />
          <RoundButton icon="flip" label="Changer de caméra" tone="dark" onClick={() => setFacing(f => (f === "environment" ? "user" : "environment"))} />
        </div>
      </div>
      <div className="an" aria-live="polite">
        <span className="label">Analyse en cours</span>
        <b>{found ? `${n} trouvé${n > 1 ? "s" : ""}, je vérifie les quantités…` : "Je repère tes ingrédients…"}</b>
        <div className="bar"><i className={found ? "done" : undefined} /></div>
      </div>
      <input ref={capture} type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) crop(f); }} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) crop(f); }} />
      {guide && !forPlacards && !analyzing && (
        <Guide host={screen} steps={SCAN_GUIDE} delay={520}
          onDone={() => { setGuideState(userId, "ingr"); void shoot(); }}
          onSkip={() => setGuideState(userId, "done")} />
      )}
    </section>
  );
}
