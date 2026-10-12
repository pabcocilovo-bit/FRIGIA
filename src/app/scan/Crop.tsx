// Une photo de la galerie : on la recadre sur les étagères, on la tourne si besoin, puis « Analyser ».
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Navigate, useNavigate } from "react-router";
import { Icon } from "../../ui/components";
import { getScan, setScan } from "./store";
import "./scan.css";

type Ins = { t: number; l: number; r: number; b: number };
const START: Ins = { t: 6, l: 4, r: 4, b: 6 };
const MIN = 28;
const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

/** Dessine la photo comme à l'écran (remplie, tournée), puis garde ce qui est dans le cadre. */
async function cropped(img: HTMLImageElement, stage: HTMLElement, rot: number, ins: Ins): Promise<Blob | null> {
  const W = stage.offsetWidth, H = stage.offsetHeight;
  const k = Math.min(3, Math.max(1, Math.max(img.naturalWidth / W, img.naturalHeight / H)));
  const c = document.createElement("canvas");
  c.width = Math.round(W * k);
  c.height = Math.round(H * k);
  const g = c.getContext("2d")!;
  const odd = Math.abs(rot / 90) % 2 === 1;
  const sc = odd ? Math.max(H / W, W / H) : 1;
  g.translate(c.width / 2, c.height / 2);
  g.rotate((rot * Math.PI) / 180);
  g.scale(sc, sc);
  // object-fit: cover dans la scène (W×H)
  const cover = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
  const dw = img.naturalWidth * cover, dh = img.naturalHeight * cover;
  g.drawImage(img, -dw / 2, -dh / 2, dw, dh);
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
  const [sc, setSc] = useState(1);
  const stage = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ h: string; x: number; y: number; s: Ins } | null>(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  // Tournée d'un quart, la photo grandit pour remplir la scène
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    const odd = Math.abs(rot / 90) % 2 === 1;
    setSc(odd ? Math.max(st.offsetHeight / st.offsetWidth, st.offsetWidth / st.offsetHeight) : 1);
  }, [rot]);

  if (!file || !url) return <Navigate to="/scan" replace />;

  const move = (e: React.PointerEvent) => {
    const d = drag.current, st = stage.current;
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
    const blob = img.current.naturalWidth ? await cropped(img.current, stage.current, rot, ins) : null;
    // Photo que le navigateur ne sait pas dessiner : on l'envoie telle quelle
    setScan({ pick: null, pending: blob ?? file });
    navigate(-1); // retour à la caméra, qui lance l'analyse
  };

  const untouched = rot === 0 && ins.t === START.t && ins.l === START.l && ins.r === START.r && ins.b === START.b;
  const box = { "--t": `${ins.t}%`, "--l": `${ins.l}%`, "--r": `${ins.r}%`, "--b": `${ins.b}%` } as CSSProperties;

  return (
    <section className="fa scan-screen scr-crop" aria-label="Recadrer la photo">
      <div className="cr-head"><b>Recadre ta photo</b><span>Garde toutes les étagères dans le cadre</span></div>
      <div className="cr-stage" ref={stage} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <img ref={img} src={url} alt="Photo du frigo à recadrer" style={{ transform: `rotate(${rot}deg) scale(${sc})` }} />
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
