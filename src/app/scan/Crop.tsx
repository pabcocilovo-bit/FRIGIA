// Une photo prise ou choisie dans la galerie : on la recadre sur les étagères, on la tourne si besoin, puis « Analyser ».
// La photo s'affiche en entier (la maquette la remplit et coupe les bords : voir le doc des points à traiter).
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router";
import { Icon } from "../../ui/components";
import { getScan, setScan } from "./store";
import "./scan.css";

type Ins = { t: number; l: number; r: number; b: number };
const START: Ins = { t: 6, l: 4, r: 4, b: 6 };
const MIN = 28;
const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

const MAX_SIDE = 2400;
const isOdd = (rot: number) => Math.abs(rot / 90) % 2 === 1;

/** La photo entière, tournée, puis ce qui est dans le cadre (insets en % de la photo affichée). */
async function cropped(img: HTMLImageElement, rot: number, ins: Ins): Promise<Blob | null> {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const [ew, eh] = isOdd(rot) ? [nh, nw] : [nw, nh];
  const f = Math.min(1, MAX_SIDE / Math.max(ew, eh));
  const c = document.createElement("canvas");
  c.width = Math.round(ew * f);
  c.height = Math.round(eh * f);
  const g = c.getContext("2d")!;
  g.translate(c.width / 2, c.height / 2);
  g.rotate((rot * Math.PI) / 180);
  g.drawImage(img, (-nw * f) / 2, (-nh * f) / 2, nw * f, nh * f);
  const x = (ins.l / 100) * c.width, y = (ins.t / 100) * c.height;
  const w = c.width * (1 - (ins.l + ins.r) / 100), h = c.height * (1 - (ins.t + ins.b) / 100);
  const out = document.createElement("canvas");
  out.width = Math.round(w);
  out.height = Math.round(h);
  out.getContext("2d")!.drawImage(c, x, y, w, h, 0, 0, out.width, out.height);
  return new Promise(r => out.toBlob(r, "image/jpeg", 0.9));
}

export function Crop() {
  const navigate = useNavigate();
  const [file] = useState(() => getScan().pick);
  const [url] = useState(() => (file ? URL.createObjectURL(file) : null));
  const [rot, setRot] = useState(0);
  const [ins, setIns] = useState<Ins>(START);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ h: string; x: number; y: number; s: Ins } | null>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  // La place disponible, pour y faire tenir la photo entière
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    const measure = () => setArea({ w: st.clientWidth, h: st.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(st);
    return () => ro.disconnect();
  }, []);

  if (!file || !url) return <Navigate to="/scan" replace />;

  const move = (e: React.PointerEvent) => {
    const d = drag.current, st = frame.current;
    if (!d || !st) return;
    const dx = ((e.clientX - d.x) / st.offsetWidth) * 100, dy = ((e.clientY - d.y) / st.offsetHeight) * 100, c = d.s;
    setIns({
      t: d.h[0] === "t" ? clamp(c.t + dy, 100 - MIN - c.b) : c.t,
      b: d.h[0] === "b" ? clamp(c.b - dy, 100 - MIN - c.t) : c.b,
      l: d.h[1] === "l" ? clamp(c.l + dx, 100 - MIN - c.r) : c.l,
      r: d.h[1] === "r" ? clamp(c.r - dx, 100 - MIN - c.l) : c.r,
    });
  };

  const go = async () => {
    if (!img.current || !stage.current) return;
    const blob = img.current.naturalWidth ? await cropped(img.current, rot, ins) : null;
    // Photo que le navigateur ne sait pas dessiner : on l'envoie telle quelle
    setScan({ pick: null, pending: blob ?? file });
    navigate(-1); // retour à la caméra, qui lance l'analyse
  };

  const untouched = rot === 0 && ins.t === START.t && ins.l === START.l && ins.r === START.r && ins.b === START.b;
  const box = { "--t": `${ins.t}%`, "--l": `${ins.l}%`, "--r": `${ins.r}%`, "--b": `${ins.b}%` } as CSSProperties;
  // Toute la photo visible : le cadre prend la forme de la photo (tournée), au plus grand dans la scène
  const odd = isOdd(rot);
  let fit: CSSProperties = { inset: 0 }, pic: CSSProperties = { inset: 0, width: "100%", height: "100%", objectFit: "contain", transform: `rotate(${rot}deg)` };
  if (nat && area) {
    const [ew, eh] = odd ? [nat.h, nat.w] : [nat.w, nat.h];
    const k = Math.min(area.w / ew, area.h / eh);
    const fw = ew * k, fh = eh * k;
    fit = { width: fw, height: fh, left: (area.w - fw) / 2, top: (area.h - fh) / 2 };
    pic = { width: odd ? fh : fw, height: odd ? fw : fh, left: "50%", top: "50%", transform: `translate(-50%, -50%) rotate(${rot}deg)` };
  }

  return (
    <section className="fa scan-screen scr-crop" aria-label="Recadrer la photo">
      <div className="cr-head"><b>Recadre ta photo</b><span>{getScan().source === "ticket" ? "Garde tout le ticket dans le cadre" : "Garde toutes les étagères dans le cadre"}</span></div>
      <div className="cr-stage" ref={stage} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <div className="cr-frame" ref={frame} style={fit}>
          <img ref={img} src={url} alt="Photo du frigo à recadrer" style={pic}
            onLoad={e => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
          <div className="cr-box" style={box}>
            {["tl", "tr", "bl", "br"].map(h => (
              <i key={h} className={"cr-h " + h} onPointerDown={e => {
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                drag.current = { h, x: e.clientX, y: e.clientY, s: { ...ins } };
              }} />
            ))}
          </div>
        </div>
      </div>
      <div className="cr-bar">
        <button type="button" className="cr-txt" onClick={() => { setScan({ pick: null }); navigate(-1); }}>Annuler</button>
        <button type="button" className="cr-ic" aria-label="Tourner à gauche" onClick={() => setRot(r => r - 90)}><Icon name="rotl" /></button>
        <button type="button" className="cr-ic" aria-label="Revenir à la photo d'origine" disabled={untouched} onClick={() => { setRot(0); setIns(START); }}><Icon name="redo" /></button>
        <button type="button" className="cr-ic" aria-label="Tourner à droite" onClick={() => setRot(r => r + 90)}><Icon name="rotr" /></button>
        <button type="button" className="cr-txt cr-ok" onClick={go}>Analyser</button>
      </div>
    </section>
  );
}
