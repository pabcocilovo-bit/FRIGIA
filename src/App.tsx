import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { Analytics } from "@vercel/analytics/react";
const Landing = lazy(() => import("./Landing"));
const COLORS = {
  orangeStart: "#FF6B35",
  orangeEnd: "#FF9A3C",
  greenStart: "#2ECC71",
  greenEnd: "#1ABC9C",
  dark: "#0A0A0F",
  darkCard: "#12121A",
  white: "#FAFAFA",
  muted: "#6B7280",
};

// ─── Theme ───────────────────────────────────────────────────────────────────
type Theme = "dark" | "light";

function getThemeVars(theme: Theme) {
  if (theme === "light") {
    return {
      bg: "#F4F4F0",
      bgCard: "rgba(255,255,255,0.9)",
      border: "rgba(0,0,0,0.08)",
      text: "#0A0A0F",
      muted: "#6B7280",
      navBg: "rgba(244,244,240,0.85)",
      inputBg: "rgba(0,0,0,0.04)",
      inputBorder: "rgba(0,0,0,0.12)",
      cardBg: "rgba(255,255,255,0.8)",
      sectionBg: "rgba(0,0,0,0.025)",
    };
  }

  return {
    bg: "#0A0A0F",
    bgCard: "rgba(255,255,255,0.03)",
    border: "rgba(255,255,255,0.07)",
    text: "#FAFAFA",
    muted: "#6B7280",
    navBg: "rgba(10,10,15,0.85)",
    inputBg: "rgba(255,255,255,0.05)",
    inputBorder: "rgba(255,255,255,0.10)",
    cardBg: "rgba(255,255,255,0.03)",
    sectionBg: "rgba(255,255,255,0.015)",
  };
}
  

const gradientText: React.CSSProperties = {
  background: "linear-gradient(135deg, #FF6B35 0%, #FF9A3C 40%, #2ECC71 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

function glassCard(theme: Theme): React.CSSProperties {
  const v = getThemeVars(theme);
  return {
    background: v.bgCard,
    backdropFilter: "blur(20px)",
    border: `1px solid ${v.border}`,
    borderRadius: "24px",
  };
}

type RecipeIngredient = { name: string; qty: string };
type DetectedIngredient = { name: string; icon: string; conf: number };
type GeneratedRecipe = {
  emoji: string;
  title: string;
  time: string;
  cal: number;
  diff: string;
  imageSearch?: string;
  steps?: string[];
  recipeIngredients?: RecipeIngredient[];
};
type HistoryEntry = {
  id: string;
  date: Date;
  ingredients: DetectedIngredient[];
  recipes: GeneratedRecipe[];
  servings: number;
};
// ─── Share helper ────────────────────────────────────────────────────────────
function buildShareText(r: GeneratedRecipe): string {
  const lines: string[] = [];
  lines.push(r.title);
  lines.push(`⏱ ${r.time}  🔥 ${r.cal} kcal  📊 ${r.diff}`);
  if (r.recipeIngredients && r.recipeIngredients.length > 0) {
    lines.push("");
    lines.push("🛒 Ingrédients :");
    r.recipeIngredients.forEach(ing => lines.push(`${ingredientIcon(ing.name)} ${ing.name}${ing.qty ? ` — ${ing.qty}` : ""}`));
  }
  if (r.steps && r.steps.length > 0) {
    lines.push("");
    lines.push("👨‍🍳 Étapes :");
    r.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
  }
  lines.push("");
  lines.push("———");
  lines.push("Recette générée avec Frigia 🍽️");
  lines.push("Votre chef IA personnel — frigia.app");
  return lines.join("\n");
}

// ─── Animations ──────────────────────────────────────────────────────────────
function GlobalStyles({ theme }: { theme: Theme }) {
  const v = getThemeVars(theme);
  return (
    <style>{`
      @keyframes scanDown { 0%{top:10%;opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{top:90%;opacity:0} }
      @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
      @keyframes slideIn { from{transform:translateX(-20px);opacity:0} to{transform:translateX(0);opacity:1} }
      @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,20px) scale(1.08)} }
      @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-35px,-25px) scale(1.1)} }
      @keyframes modalIn { from{opacity:0;transform:translateY(40px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      @keyframes imgFadeIn { from{opacity:0;transform:scale(1.04)} to{opacity:1;transform:scale(1)} }
      body { margin:0; background:${v.bg}; transition: background 0.3s; }
      * { box-sizing:border-box; }
      button { transition:transform 0.2s,opacity 0.2s,background 0.2s; }
      button:hover { opacity:0.9; }
      a:hover { color:${v.text} !important; }
      input, textarea { transition: border 0.2s; }
      input:focus, textarea:focus { outline: none; border-color: rgba(255,107,53,0.5) !important; }
      @media (max-width:780px) {
        nav { padding:14px 18px !important; }
        .nav-links { display:none !important; }
        .nav-actions { display:none !important; }
      }
      @media (max-width:767px) {
        input, textarea, select { font-size:16px !important; }
        * { -webkit-tap-highlight-color:transparent; }
        .hide-scrollbar::-webkit-scrollbar { display:none; }
      }
    `}</style>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ScanLine() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: "inherit",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: "2px",
          background: "linear-gradient(90deg,transparent,#2ECC71,transparent)",
          boxShadow: "0 0 20px #2ECC71,0 0 40px #2ECC71",
          animation: "scanDown 2.5s ease-in-out infinite",
        }}
      />
    </div>
  );
}

function Brackets({ color = "#2ECC71", size = 16 }) {
  const s: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    borderColor: color,
    borderStyle: "solid",
  };
  return (
    <>
      <span style={{ ...s, top: 8, left: 8, borderWidth: "2px 0 0 2px" }} />
      <span style={{ ...s, top: 8, right: 8, borderWidth: "2px 2px 0 0" }} />
      <span style={{ ...s, bottom: 8, left: 8, borderWidth: "0 0 2px 2px" }} />
      <span style={{ ...s, bottom: 8, right: 8, borderWidth: "0 2px 2px 0" }} />
    </>
  );
}


function ingredientIcon(name: string) {
  const l = name.toLowerCase();
  if (l.includes("œuf") || l.includes("oeuf")) return "🥚";
  if (l.includes("tomate")) return "🍅";
  if (l.includes("fromage") || l.includes("emmental") || l.includes("mozza") || l.includes("parmesan") || l.includes("comté") || l.includes("gruyère")) return "🧀";
  if (l.includes("lait") || l.includes("crème") || l.includes("creme")) return "🥛";
  if (l.includes("brocoli")) return "🥦";
  if (l.includes("citron")) return "🍋";
  if (l.includes("orange")) return "🍊";
  if (l.includes("salade") || l.includes("laitue") || l.includes("épinard") || l.includes("spinard")) return "🥬";
  if (l.includes("poulet") || l.includes("dinde")) return "🍗";
  if (l.includes("bœuf") || l.includes("boeuf") || l.includes("steak") || l.includes("viande") || l.includes("bifteck")) return "🥩";
  if (l.includes("porc") || l.includes("bacon") || l.includes("jambon") || l.includes("lardons")) return "🥓";
  if (l.includes("pâte") || l.includes("pasta") || l.includes("spaghetti") || l.includes("linguine") || l.includes("tagliatelle")) return "🍝";
  if (l.includes("riz")) return "🍚";
  if (l.includes("carotte")) return "🥕";
  if (l.includes("avocat")) return "🥑";
  if (l.includes("pain") || l.includes("baguette")) return "🍞";
  if (l.includes("poisson") || l.includes("saumon") || l.includes("cabillaud") || l.includes("thon") || l.includes("dorade")) return "🐟";
  if (l.includes("crevette") || l.includes("moule") || l.includes("homard")) return "🦐";
  if (l.includes("ail")) return "🧄";
  if (l.includes("oignon") || l.includes("échalote")) return "🧅";
  if (l.includes("pomme de terre") || l.includes("patate")) return "🥔";
  if (l.includes("champignon")) return "🍄";
  if (l.includes("poivron")) return "🫑";
  if (l.includes("concombre")) return "🥒";
  if (l.includes("courgette")) return "🥒";
  if (l.includes("aubergine")) return "🍆";
  if (l.includes("maïs") || l.includes("mais")) return "🌽";
  if (l.includes("pomme")) return "🍎";
  if (l.includes("fraise")) return "🍓";
  if (l.includes("banane")) return "🍌";
  if (l.includes("beurre") || l.includes("margarine")) return "🧈";
  if (l.includes("huile")) return "🫙";
  if (l.includes("farine")) return "🌾";
  if (l.includes("sucre") || l.includes("miel")) return "🍯";
  if (l.includes("chocolat")) return "🍫";
  if (l.includes("herbe") || l.includes("basilic") || l.includes("persil") || l.includes("thym") || l.includes("romarin") || l.includes("coriandre")) return "🌿";
  if (l.includes("piment") || l.includes("paprika") || l.includes("curry") || l.includes("épice") || l.includes("cumin")) return "🌶️";
  if (l.includes("sel") || l.includes("poivre")) return "🧂";
  if (l.includes("bouillon") || l.includes("sauce")) return "🫕";
  if (l.includes("tofu")) return "🫘";
  if (l.includes("lentille") || l.includes("pois") || l.includes("haricot") || l.includes("fève")) return "🫘";
  if (l.includes("noix") || l.includes("amande") || l.includes("noisette") || l.includes("pistache")) return "🥜";
  return "🌱";
}

function recipeIcon(title: string) {
  const l = title.toLowerCase();
  if (l.includes("omelette") || l.includes("œuf") || l.includes("oeuf"))
    return "🍳";
  if (l.includes("salade") || l.includes("bowl")) return "🥗";
  if (l.includes("pasta") || l.includes("pâte")) return "🍝";
  if (l.includes("soupe")) return "🥣";
  if (l.includes("poulet")) return "🍗";
  if (l.includes("wrap")) return "🌯";
  if (l.includes("gratin")) return "🧀";
  if (l.includes("poêlée") || l.includes("poelee")) return "🥘";
  return "🍽️";
}


// Module-level cache — survives re-renders, resets on page reload
const mealImageCache: Record<string, string> = {};

async function fetchTheMealImage(query: string): Promise<string | null> {
  const trySearch = async (q: string) => {
    try {
      const r = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`);
      const d = await r.json() as { meals?: { strMealThumb: string }[] };
      if (d.meals?.[0]) return d.meals[0].strMealThumb;
    } catch {}
    return null;
  };
  const url = await trySearch(query);
  if (url) return url;
  // Fallback: try just the first keyword
  const firstWord = query.split(" ")[0];
  if (firstWord && firstWord !== query) return trySearch(firstWord);
  return null;
}

function RecipeImage({
  title,
  imageSearch,
  style,
}: {
  title: string;
  imageSearch?: string;
  style?: React.CSSProperties;
}) {
  const query = imageSearch || title;
  const isDirectUrl = query.startsWith("http");
  const [src, setSrc] = useState<string | null>(isDirectUrl ? query : (mealImageCache[query] || null));
  const [loaded, setLoaded] = useState(isDirectUrl || !!mealImageCache[query]);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (isDirectUrl || mealImageCache[query]) return;
    let cancelled = false;
    fetchTheMealImage(query).then((url) => {
      if (cancelled) return;
      if (url) { mealImageCache[query] = url; setSrc(url); }
      else setErrored(true);
    });
    return () => { cancelled = true; };
  }, [query, isDirectUrl]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}>
      {!loaded && !errored && (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(255,107,53,0.07) 0%,rgba(255,255,255,0.13) 40%,rgba(46,204,113,0.07) 70%,rgba(255,107,53,0.07) 100%)", backgroundSize: "250% 100%", animation: "shimmer 2.2s ease-in-out infinite" }} />
      )}
      {errored && (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(255,107,53,0.15),rgba(46,204,113,0.15))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
          {recipeIcon(title)}
        </div>
      )}
      {src && (
        <img
          src={src}
          alt={title}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: loaded ? 1 : 0, animation: loaded ? "imgFadeIn 0.55s ease both" : "none", transition: "opacity 0.45s ease" }}
          onLoad={() => setLoaded(true)}
          onError={() => { setSrc(null); setErrored(true); }}
        />
      )}
    </div>
  );
}

// ─── CropModal ────────────────────────────────────────────────────────────────
function CropModal({ imageSrc, onConfirm, onCancel }: {
  imageSrc: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
}) {
  const SIZE = 260;
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const dragging = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const lastPinchDist = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    const initScale = Math.max(SIZE / w, SIZE / h);
    setScale(initScale);
    setImgSize({ w, h });
  };

  const clampOffset = (ox: number, oy: number, sc: number): { x: number; y: number } => {
    const w = imgSize.w * sc;
    const h = imgSize.h * sc;
    const maxX = Math.max(0, (w - SIZE) / 2);
    const maxY = Math.max(0, (h - SIZE) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, ox)), y: Math.min(maxY, Math.max(-maxY, oy)) };
  };

  const startDrag = (x: number, y: number) => {
    dragging.current = { startX: x, startY: y, ox: offset.x, oy: offset.y };
  };
  const moveDrag = (x: number, y: number) => {
    if (!dragging.current) return;
    setOffset(clampOffset(dragging.current.ox + x - dragging.current.startX, dragging.current.oy + y - dragging.current.startY, scale));
  };
  const endDrag = () => { dragging.current = null; };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || imgSize.w === 0) return;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    const img = new Image();
    img.onload = () => {
      const renderedW = imgSize.w * scale;
      const renderedH = imgSize.h * scale;
      ctx.drawImage(img, (SIZE - renderedW) / 2 + offset.x, (SIZE - renderedH) / 2 + offset.y, renderedW, renderedH);
      ctx.restore();
      onConfirm(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = imageSrc;
  };

  const renderedW = imgSize.w * scale;
  const renderedH = imgSize.h * scale;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <img src={imageSrc} alt="" style={{ display: "none" }} onLoad={onImgLoad} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={{ fontWeight: 700, color: "#fff", fontSize: 17, marginBottom: 6 }}>Centrez votre photo</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 30, textAlign: "center" }}>
        Glissez pour positionner · Pincez ou molette pour zoomer
      </div>

      <div
        style={{ position: "relative", width: SIZE, height: SIZE, cursor: "grab", touchAction: "none", userSelect: "none" }}
        onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
        onMouseMove={(e) => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={(e) => {
          if (e.touches.length === 1) { startDrag(e.touches[0].clientX, e.touches[0].clientY); lastPinchDist.current = null; }
          else if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; lastPinchDist.current = Math.sqrt(dx*dx + dy*dy); }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 1) { moveDrag(e.touches[0].clientX, e.touches[0].clientY); }
          else if (e.touches.length === 2 && lastPinchDist.current != null) {
            const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.sqrt(dx*dx + dy*dy); const ratio = dist / lastPinchDist.current;
            const minSc = Math.max(SIZE / Math.max(imgSize.w, 1), SIZE / Math.max(imgSize.h, 1));
            const newSc = Math.min(4, Math.max(minSc, scale * ratio));
            setScale(newSc); setOffset(prev => clampOffset(prev.x * ratio, prev.y * ratio, newSc)); lastPinchDist.current = dist;
          }
        }}
        onTouchEnd={endDrag}
        onWheel={(e) => {
          const minSc = Math.max(SIZE / Math.max(imgSize.w, 1), SIZE / Math.max(imgSize.h, 1));
          const newSc = Math.min(4, Math.max(minSc, scale * (1 - e.deltaY * 0.002)));
          setScale(newSc); setOffset(prev => clampOffset(prev.x, prev.y, newSc));
        }}
      >
        {/* Image clipped to circle */}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden" }}>
          {imgSize.w > 0 && (
            <img src={imageSrc} alt="" draggable={false}
              style={{ position: "absolute", width: renderedW, height: renderedH, left: (SIZE - renderedW) / 2 + offset.x, top: (SIZE - renderedH) / 2 + offset.y, pointerEvents: "none" }}
            />
          )}
        </div>
        {/* Dark overlay with circular hole + orange border */}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid #FF6B35", pointerEvents: "none", boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)" }} />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
        <button onClick={onCancel} style={{ padding: "13px 30px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.25)", background: "none", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Annuler</button>
        <button onClick={handleConfirm} disabled={imgSize.w === 0}
          style={{ padding: "13px 30px", borderRadius: 100, border: "none", background: imgSize.w === 0 ? "rgba(255,255,255,0.15)" : "linear-gradient(135deg,#FF6B35,#2ECC71)", color: "#fff", fontWeight: 800, cursor: imgSize.w === 0 ? "not-allowed" : "pointer", fontSize: 14 }}>
          ✓ Confirmer
        </button>
      </div>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
type SettingsTab =
  | "profile"
  | "subscription"
  | "appearance"
  | "notifications"
  | "security";

type LegalPage = "mentions" | "cgu" | "privacy" | "cookies" | "rgpd";

const LEGAL_CONTENT: Record<LegalPage, { title: string; body: React.ReactNode }> = {
  mentions: {
    title: "Mentions légales",
    body: (
      <div>
        <h3>Éditeur</h3>
        <p>Frigia est édité par Pablo Cocilovo, particulier.</p>
        <p>Contact : <a href="mailto:frigia.contact@gmail.com">frigia.contact@gmail.com</a></p>

        <h3>Hébergement</h3>
        <p>L'application est hébergée par <strong>Vercel Inc.</strong>, 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — <a href="https://vercel.com" target="_blank" rel="noreferrer">vercel.com</a></p>

        <h3>Propriété intellectuelle</h3>
        <p>L'ensemble du contenu de Frigia (textes, images, logo, code) est la propriété exclusive de l'éditeur. Toute reproduction sans autorisation écrite est interdite.</p>

        <h3>Responsabilité</h3>
        <p>Les recettes générées par intelligence artificielle sont fournies à titre indicatif. L'éditeur ne saurait être tenu responsable d'allergies, d'intolérances ou de problèmes de santé liés à leur consommation. Consultez un professionnel de santé en cas de doute.</p>
      </div>
    ),
  },
  cgu: {
    title: "Conditions Générales d'Utilisation",
    body: (
      <div>
        <h3>1. Objet</h3>
        <p>Les présentes CGU régissent l'utilisation de l'application Frigia, service de génération de recettes par intelligence artificielle.</p>

        <h3>2. Accès au service</h3>
        <p>L'accès à Frigia nécessite la création d'un compte. Une période d'essai gratuite de 4 jours est proposée, suivie d'un abonnement à 7,99 €/mois.</p>

        <h3>3. Utilisation</h3>
        <p>L'utilisateur s'engage à utiliser Frigia conformément aux lois en vigueur et à ne pas tenter de contourner les mesures de sécurité de l'application.</p>

        <h3>4. Contenu généré</h3>
        <p>Les recettes sont générées par IA et peuvent contenir des erreurs. L'éditeur ne garantit pas leur exactitude nutritionnelle. L'utilisateur est seul responsable de l'usage qu'il en fait.</p>

        <h3>5. Résiliation</h3>
        <p>L'utilisateur peut résilier son abonnement à tout moment depuis les paramètres de son compte. Aucun remboursement ne sera effectué pour la période en cours.</p>

        <h3>6. Modification des CGU</h3>
        <p>L'éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les modifications prennent effet à compter de leur publication dans l'application.</p>

        <h3>Contact</h3>
        <p><a href="mailto:frigia.contact@gmail.com">frigia.contact@gmail.com</a></p>
      </div>
    ),
  },
  privacy: {
    title: "Politique de confidentialité",
    body: (
      <div>
        <h3>Responsable du traitement</h3>
        <p>Pablo Cocilovo — <a href="mailto:frigia.contact@gmail.com">frigia.contact@gmail.com</a></p>

        <h3>Données collectées</h3>
        <ul>
          <li><strong>Compte :</strong> adresse e-mail, mot de passe (chiffré), photo de profil (optionnelle)</li>
          <li><strong>Utilisation :</strong> photos de frigo scannées, ingrédients détectés, recettes générées, favoris</li>
          <li><strong>Technique :</strong> logs de connexion, type d'appareil, langue</li>
        </ul>

        <h3>Finalités</h3>
        <p>Les données sont utilisées pour fournir le service, améliorer les suggestions de recettes et assurer la sécurité des comptes. Elles ne sont jamais vendues à des tiers.</p>

        <h3>Conservation</h3>
        <p>Les données sont conservées pendant la durée de l'abonnement actif + 12 mois. Elles sont ensuite supprimées définitivement.</p>

        <h3>Vos droits (RGPD)</h3>
        <p>Vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Pour exercer ces droits, contactez : <a href="mailto:frigia.contact@gmail.com">frigia.contact@gmail.com</a></p>

        <h3>Sous-traitants</h3>
        <ul>
          <li><strong>Supabase</strong> — base de données et authentification</li>
          <li><strong>Vercel</strong> — hébergement</li>
          <li><strong>Anthropic / Google</strong> — génération de recettes par IA</li>
        </ul>
      </div>
    ),
  },
  cookies: {
    title: "Politique de cookies",
    body: (
      <div>
        <h3>Qu'est-ce qu'un cookie ?</h3>
        <p>Un cookie est un petit fichier stocké sur votre appareil lors de la visite d'un site ou d'une application web.</p>

        <h3>Cookies utilisés par Frigia</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Nom</th>
              <th style={{ textAlign: "left", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Type</th>
              <th style={{ textAlign: "left", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>Finalité</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ padding: "6px 0" }}>sb-auth-token</td><td>Essentiel</td><td>Session d'authentification Supabase</td></tr>
            <tr><td style={{ padding: "6px 0" }}>frigia_theme</td><td>Fonctionnel</td><td>Mémorisation du thème choisi</td></tr>
            <tr><td style={{ padding: "6px 0" }}>frigia_avatar</td><td>Fonctionnel</td><td>Cache de la photo de profil</td></tr>
          </tbody>
        </table>

        <h3>Cookies tiers</h3>
        <p>Vercel peut déposer des cookies techniques nécessaires au bon fonctionnement de l'hébergement. Aucun cookie publicitaire ou de tracking n'est utilisé.</p>

        <h3>Gestion</h3>
        <p>Vous pouvez bloquer ou supprimer les cookies depuis les paramètres de votre navigateur. Le blocage des cookies essentiels peut empêcher la connexion à votre compte.</p>
      </div>
    ),
  },
  rgpd: {
    title: "Conformité RGPD",
    body: (
      <div>
        <h3>Base légale des traitements</h3>
        <ul>
          <li><strong>Exécution du contrat</strong> — fourniture du service de recettes</li>
          <li><strong>Intérêt légitime</strong> — sécurité et amélioration du service</li>
          <li><strong>Consentement</strong> — communications optionnelles</li>
        </ul>

        <h3>Vos droits</h3>
        <ul>
          <li><strong>Accès :</strong> obtenir une copie de vos données</li>
          <li><strong>Rectification :</strong> corriger des données inexactes</li>
          <li><strong>Suppression :</strong> demander l'effacement de votre compte</li>
          <li><strong>Portabilité :</strong> recevoir vos données dans un format lisible</li>
          <li><strong>Opposition :</strong> vous opposer à certains traitements</li>
        </ul>

        <h3>Exercer vos droits</h3>
        <p>Envoyez votre demande à <a href="mailto:frigia.contact@gmail.com">frigia.contact@gmail.com</a>. Réponse sous 30 jours.</p>

        <h3>Réclamation</h3>
        <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la <strong>CNIL</strong> (Commission Nationale de l'Informatique et des Libertés) — <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">cnil.fr</a></p>

        <h3>Transferts hors UE</h3>
        <p>Certains sous-traitants (Vercel, Anthropic) sont basés aux États-Unis. Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne.</p>
      </div>
    ),
  },
};

function LegalModal({ page, theme, onClose }: { page: LegalPage; theme: Theme; onClose: () => void }) {
  const v = getThemeVars(theme);
  const content = LEGAL_CONTENT[page];
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...glassCard(theme), width: "100%", maxWidth: 680, maxHeight: "80vh", display: "flex", flexDirection: "column", borderRadius: 20, overflow: "hidden" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${v.border}` }}>
          <span style={{ fontWeight: 800, fontSize: 18, color: v.text }}>{content.title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: v.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div
          style={{ padding: "24px", overflowY: "auto", color: v.muted, fontSize: 14, lineHeight: 1.8 }}
          className="legal-content"
        >
          {content.body}
        </div>
        <div style={{ padding: "12px 24px", borderTop: `1px solid ${v.border}`, fontSize: 12, color: v.muted, textAlign: "center" }}>
          Contact : <a href="mailto:frigia.contact@gmail.com" style={{ color: "#FF6B35" }}>frigia.contact@gmail.com</a> — © 2026 Frigia
        </div>
      </div>
    </div>
  );
}

function SettingsModal({
  theme,
  onClose,
  onThemeChange,
  user,
  avatarSrc,
  onAvatarChange,
}: {
  theme: Theme;
  onClose: () => void;
  onThemeChange: (t: Theme) => void;
  user: any;
  avatarSrc: string | null;
  onAvatarChange: (dataUrl: string) => void;
}) {
  const v = getThemeVars(theme);
  const [tab, setTab] = useState<SettingsTab>("profile");

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const isOAuthUser = !user?.identities?.some((i: any) => i.provider === "email");

  // Profile state — initialized from Supabase user data
  const [profile, setProfile] = useState({
    name: user?.user_metadata?.full_name || user?.user_metadata?.name || "",
    email: user?.email || "",
    phone: user?.user_metadata?.phone || "",
    bio: user?.user_metadata?.bio || "",
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // Password state
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [pwMsg, setPwMsg] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);

  const openPortal = async () => {
    setPortalLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch("/api/customer-portal", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const json = await r.json();
    if (json.url) window.location.href = json.url;
    setPortalLoading(false);
  };

  const deleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteMsg("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Non authentifié");
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur serveur");
      await supabase.auth.signOut();
      onClose();
    } catch (err: any) {
      setDeleteMsg(err.message || "Une erreur est survenue.");
      setDeleteLoading(false);
    }
  };



  const [isMobileSettings, setIsMobileSettings] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobileSettings(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const tabs: { id: SettingsTab; icon: string; label: string }[] = [
    { id: "profile", icon: "👤", label: "Profil" },
    { id: "subscription", icon: "💳", label: "Abonnement" },
    { id: "appearance", icon: "🎨", label: "Apparence" },
    { id: "security", icon: "🔒", label: "Sécurité" },
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onloadend = () => setCropImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (croppedDataUrl: string) => {
    const key = user?.id ? `frigia_avatar_${user.id}` : null;
    if (key) localStorage.setItem(key, croppedDataUrl);
    onAvatarChange(croppedDataUrl);
    setCropImageSrc(null);
  };

  const saveProfile = async () => {
    setProfileLoading(true);
    setProfileMsg("");
    const updates: any = {
      data: {
        full_name: profile.name,
        phone: profile.phone,
        bio: profile.bio,
      },
    };
    if (profile.email && profile.email !== user?.email) {
      updates.email = profile.email;
    }
    const { error } = await supabase.auth.updateUser(updates);
    setProfileLoading(false);
    if (error) {
      setProfileMsg("Erreur : " + error.message);
      return;
    }
    if (profile.email && profile.email !== user?.email) {
      setProfileMsg("✓ Sauvegardé ! Vérifiez votre email pour confirmer le changement d'adresse.");
    } else {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    }
  };

  const savePassword = async () => {
    if (!isOAuthUser && !passwords.current) {
      setPwMsg("Entrez votre mot de passe actuel.");
      return;
    }
    if (passwords.next.length < 8) {
      setPwMsg("Le nouveau mot de passe doit contenir 8 caractères minimum.");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPwMsg("Les mots de passe ne correspondent pas.");
      return;
    }
    setPwLoading(true);
    setPwMsg("");
    if (!isOAuthUser && passwords.current) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: passwords.current,
      });
      if (signInError) {
        setPwMsg("Mot de passe actuel incorrect.");
        setPwLoading(false);
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({ password: passwords.next });
    setPwLoading(false);
    if (error) {
      setPwMsg("Erreur : " + error.message);
      return;
    }
    setPwMsg("✓ Mot de passe mis à jour avec succès !");
    setPasswords({ current: "", next: "", confirm: "" });
    setTimeout(() => setPwMsg(""), 3000);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    background: v.inputBg,
    border: `1px solid ${v.inputBorder}`,
    color: v.text,
    fontSize: 14,
    marginTop: 6,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: v.muted,
    letterSpacing: 1,
    textTransform: "uppercase",
  };

  const field = (
    label: string,
    key: keyof typeof profile,
    type = "text",
    multiline = false
  ) => (
    <div style={{ marginBottom: 20 }}>
      <div style={labelStyle}>{label}</div>
      {multiline ? (
        <textarea
          value={profile[key]}
          onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
          style={{
            ...inputStyle,
            resize: "vertical",
            minHeight: 80,
            fontFamily: "inherit",
          }}
        />
      ) : (
        <input
          type={type}
          value={profile[key]}
          onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
          style={inputStyle}
        />
      )}
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: isMobileSettings
          ? theme === "light" ? "rgba(244,244,240,0.99)" : "rgba(14,14,20,0.99)"
          : "rgba(0,0,0,0.7)",
        backdropFilter: isMobileSettings ? "none" : "blur(8px)",
        display: "flex",
        alignItems: isMobileSettings ? "stretch" : "center",
        justifyContent: "center",
        padding: isMobileSettings ? 0 : 20,
      }}
      onClick={(e) => !isMobileSettings && e.target === e.currentTarget && onClose()}
    >
      {cropImageSrc && <CropModal imageSrc={cropImageSrc} onConfirm={handleCropConfirm} onCancel={() => setCropImageSrc(null)} />}
      <div
        style={{
          ...glassCard(theme),
          width: "100%",
          maxWidth: isMobileSettings ? "100%" : 820,
          maxHeight: isMobileSettings ? "100vh" : "90vh",
          height: isMobileSettings ? "100vh" : undefined,
          display: "flex",
          flexDirection: isMobileSettings ? "column" : "row",
          overflow: "hidden",
          animation: "modalIn 0.35s ease both",
          background: theme === "light" ? "rgba(244,244,240,0.99)" : "rgba(14,14,20,0.99)",
          borderRadius: isMobileSettings ? 0 : 24,
        }}
      >
        {isMobileSettings ? (
          <>
            {/* Mobile: header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:"calc(16px + env(safe-area-inset-top))", paddingBottom:"16px", paddingLeft:"20px", paddingRight:"20px", borderBottom:`1px solid ${v.border}`, flexShrink:0 }}>
              <div style={{ fontWeight:900, fontSize:18, color:v.text, fontFamily:"Georgia, serif" }}>⚙️ Paramètres</div>
              <button onClick={onClose} style={{ background:"none", border:`1px solid ${v.border}`, color:v.muted, cursor:"pointer", borderRadius:10, padding:"7px 14px", fontSize:13 }}>✕ Fermer</button>
            </div>
            {/* Mobile: horizontal tabs */}
            <div className="hide-scrollbar" style={{ display:"flex", gap:6, overflowX:"auto", padding:"10px 16px", borderBottom:`1px solid ${v.border}`, flexShrink:0, scrollbarWidth:"none" }}>
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ padding:"8px 14px", borderRadius:100, border:`1px solid ${tab===t.id ? "#FF6B35" : v.border}`, background: tab===t.id ? "rgba(255,107,53,0.15)" : "none", color: tab===t.id ? "#FF6B35" : v.text, cursor:"pointer", fontSize:13, fontWeight: tab===t.id ? 700 : 400, whiteSpace:"nowrap", flexShrink:0, transition:"all 0.2s" }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          /* Desktop: sidebar */
          <div style={{ width: 220, borderRight: `1px solid ${v.border}`, padding: "28px 0", flexShrink: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "0 24px 24px", fontWeight: 900, fontSize: 18, color: v.text, fontFamily: "Georgia, serif" }}>
              ⚙️ Paramètres
            </div>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 24px", background: tab===t.id ? "linear-gradient(90deg,rgba(255,107,53,0.15),rgba(46,204,113,0.1))" : "none", border:"none", borderLeft: tab===t.id ? "3px solid #FF6B35" : "3px solid transparent", color: tab===t.id ? v.text : v.muted, cursor:"pointer", fontSize:14, fontWeight: tab===t.id ? 700 : 400, textAlign:"left" }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span> {t.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={{ margin:"0 16px 16px", padding:"10px", borderRadius:12, border:`1px solid ${v.border}`, background:"none", color:v.muted, cursor:"pointer", fontSize:13 }}>
              ✕ Fermer
            </button>
          </div>
        )}

        {/* Content - shared desktop + mobile */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobileSettings ? "24px 20px" : "36px 36px" }}>
          {/* ── PROFIL ── */}
          {tab === "profile" && (
            <div style={{ animation: "fadeUp 0.3s ease both" }}>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: v.text,
                  marginBottom: 8,
                }}
              >
                Mes informations
              </h2>
              <p style={{ color: v.muted, fontSize: 14, marginBottom: 32 }}>
                Modifiez vos informations personnelles à tout moment.
              </p>

              {/* Avatar */}
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileSelect} />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  marginBottom: 32,
                  padding: 20,
                  borderRadius: 16,
                  background:
                    theme === "light"
                      ? "rgba(0,0,0,0.04)"
                      : "rgba(255,255,255,0.04)",
                  border: `1px solid ${v.border}`,
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 30,
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  {avatarSrc
                    ? <img src={avatarSrc} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : "👤"}
                </div>
                <div>
                  <div
                    style={{ fontWeight: 700, color: v.text, marginBottom: 6 }}
                  >
                    {profile.name || profile.email}
                  </div>
                  <div
                    style={{ fontSize: 12, color: v.muted, marginBottom: 10 }}
                  >
                    {profile.email}
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 100,
                      border: `1px solid ${v.border}`,
                      background: "none",
                      color: v.text,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    📷 Changer la photo
                  </button>
                </div>
              </div>

              {field("Nom complet", "name")}
              {field("Adresse e-mail", "email", "email")}
              {field("Téléphone", "phone", "tel")}
              {field("Bio", "bio", "text", true)}

              {profileMsg && (
                <div style={{ fontSize: 13, color: profileMsg.startsWith("✓") ? "#2ECC71" : "#FF5050", marginBottom: 12 }}>
                  {profileMsg}
                </div>
              )}
              <button
                onClick={saveProfile}
                disabled={profileLoading}
                style={{
                  padding: "13px 28px",
                  background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                  border: "none",
                  borderRadius: 100,
                  color: "#fff",
                  fontWeight: 800,
                  cursor: profileLoading ? "not-allowed" : "pointer",
                  fontSize: 15,
                  opacity: profileLoading ? 0.7 : 1,
                }}
              >
                {profileLoading ? "Sauvegarde..." : profileSaved ? "✓ Sauvegardé !" : "Sauvegarder les modifications"}
              </button>
            </div>
          )}

          {/* ── ABONNEMENT ── */}
          {tab === "subscription" && (() => {
            const meta = user?.user_metadata || {};
            const status = meta.subscription_status;
            const isWhitelisted = meta.is_whitelisted;
            const created = user ? new Date(user.created_at) : new Date();
            const daysUsed = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
            const trialDaysLeft = Math.max(0, 4 - daysUsed);
            const isTrialing = status === "trialing" || (!status && daysUsed <= 4);
            const isActive = status === "active";
            const hasBilling = isActive || isTrialing;

            return (
              <div style={{ animation: "fadeUp 0.3s ease both" }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: v.text, marginBottom: 8 }}>Mon abonnement</h2>
                <p style={{ color: v.muted, fontSize: 14, marginBottom: 32 }}>Gérez votre abonnement et votre facturation.</p>

                {/* Status card */}
                <div style={{ borderRadius: 20, background: "linear-gradient(135deg,rgba(255,107,53,0.15),rgba(46,204,113,0.12))", border: "1px solid rgba(255,107,53,0.3)", padding: 28, marginBottom: 24 }}>
                  {isWhitelisted ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#2ECC71", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Accès offert</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: v.text }}>Frigia Premium</div>
                      <div style={{ color: v.muted, fontSize: 14, marginTop: 6 }}>Accès illimité sans frais.</div>
                    </>
                  ) : isActive ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#2ECC71", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Abonnement actif</div>
                      <div style={{ fontSize: 24, fontWeight: 900, color: v.text }}>Frigia Premium — 7,99€/mois</div>
                      <div style={{ color: v.muted, fontSize: 14, marginTop: 6 }}>Renouvellement automatique chaque mois.</div>
                    </>
                  ) : isTrialing ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#FF6B35", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Essai gratuit</div>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 24, fontWeight: 900, color: v.text }}>4 jours gratuits</div>
                          <div style={{ color: v.muted, fontSize: 14, marginTop: 6 }}>Puis <strong style={{ color: v.text }}>7,99€/mois</strong></div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 36, fontWeight: 900, color: "#2ECC71" }}>{trialDaysLeft}j</div>
                          <div style={{ fontSize: 12, color: v.muted }}>restants</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 16, height: 8, borderRadius: 100, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(daysUsed / 4) * 100}%`, background: "linear-gradient(90deg,#FF6B35,#2ECC71)", borderRadius: 100 }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#FF5050", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Aucun abonnement</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: v.text, marginBottom: 16 }}>Accédez à Frigia Premium</div>
                      <button onClick={() => { onClose(); }} style={{ padding: "12px 24px", borderRadius: 100, border: "none", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                        S'abonner pour 7,99€/mois
                      </button>
                    </>
                  )}
                </div>

                {/* Manage billing via Stripe portal */}
                {hasBilling && !isWhitelisted && (
                  <div style={{ ...glassCard(theme), padding: 24, marginBottom: 24 }}>
                    <div style={{ fontWeight: 700, color: v.text, marginBottom: 8 }}>💳 Gérer la facturation</div>
                    <div style={{ fontSize: 13, color: v.muted, marginBottom: 16 }}>Modifiez votre carte, consultez vos factures ou résiliez depuis le portail Stripe.</div>
                    <button
                      onClick={openPortal}
                      disabled={portalLoading}
                      style={{ padding: "11px 22px", borderRadius: 100, border: `1px solid ${v.border}`, background: "none", color: v.text, cursor: portalLoading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, opacity: portalLoading ? 0.7 : 1 }}
                    >
                      {portalLoading ? "Chargement..." : "Ouvrir le portail de facturation →"}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── APPARENCE ── */}
          {tab === "appearance" && (
            <div style={{ animation: "fadeUp 0.3s ease both" }}>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: v.text,
                  marginBottom: 8,
                }}
              >
                Apparence
              </h2>
              <p style={{ color: v.muted, fontSize: 14, marginBottom: 32 }}>
                Personnalisez l'interface selon vos préférences.
              </p>

              <div style={{ marginBottom: 32 }}>
                <div style={{ ...labelStyle, marginBottom: 16 }}>Thème</div>
                <div style={{ display: "flex", gap: 16 }}>
                  {(["dark", "light"] as Theme[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => onThemeChange(t)}
                      style={{
                        flex: 1,
                        padding: 24,
                        borderRadius: 20,
                        cursor: "pointer",
                        border:
                          theme === t
                            ? "2px solid #FF6B35"
                            : `2px solid ${v.border}`,
                        background: t === "dark" ? "#0A0A0F" : "#F4F4F0",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 12,
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ fontSize: 36 }}>
                        {t === "dark" ? "🌙" : "☀️"}
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          color: t === "dark" ? "#FAFAFA" : "#0A0A0F",
                          fontSize: 15,
                        }}
                      >
                        {t === "dark" ? "Mode sombre" : "Mode clair"}
                      </div>
                      {theme === t && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#FF6B35",
                            fontWeight: 700,
                          }}
                        >
                          ✓ Actif
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ── SÉCURITÉ ── */}
          {tab === "security" && (
            <div style={{ animation: "fadeUp 0.3s ease both" }}>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: v.text,
                  marginBottom: 8,
                }}
              >
                Sécurité
              </h2>
              <p style={{ color: v.muted, fontSize: 14, marginBottom: 32 }}>
                Protégez votre compte Frigia.
              </p>

              <div
                style={{ ...glassCard(theme), padding: 24, marginBottom: 24 }}
              >
                <div
                  style={{ fontWeight: 700, color: v.text, marginBottom: 20 }}
                >
                  🔑 Changer le mot de passe
                </div>

                {isOAuthUser ? (
                  <div style={{ fontSize: 13, color: v.muted, padding: "12px 16px", background: v.inputBg, borderRadius: 12, border: `1px solid ${v.border}` }}>
                    Vous êtes connecté via Google. La modification du mot de passe n'est pas disponible pour les comptes OAuth.
                  </div>
                ) : (
                  <>
                    {[
                      { label: "Mot de passe actuel", key: "current" as const },
                      { label: "Nouveau mot de passe", key: "next" as const },
                      { label: "Confirmer le nouveau", key: "confirm" as const },
                    ].map(({ label, key }) => (
                      <div key={key} style={{ marginBottom: 16 }}>
                        <div style={labelStyle}>{label}</div>
                        <input
                          type="password"
                          value={passwords[key]}
                          onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })}
                          style={inputStyle}
                          placeholder="••••••••"
                        />
                      </div>
                    ))}

                    {pwMsg && (
                      <div
                        style={{
                          fontSize: 13,
                          color: pwMsg.startsWith("✓") ? "#2ECC71" : "#FF5050",
                          marginBottom: 12,
                        }}
                      >
                        {pwMsg}
                      </div>
                    )}

                    <button
                      onClick={savePassword}
                      disabled={pwLoading}
                      style={{
                        padding: "12px 24px",
                        background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                        border: "none",
                        borderRadius: 100,
                        color: "#fff",
                        fontWeight: 700,
                        cursor: pwLoading ? "not-allowed" : "pointer",
                        opacity: pwLoading ? 0.7 : 1,
                      }}
                    >
                      {pwLoading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
                    </button>
                  </>
                )}
              </div>

              <div
                style={{
                  padding: 20,
                  borderRadius: 16,
                  border: "1px solid rgba(255,80,80,0.2)",
                  background: "rgba(255,80,80,0.05)",
                }}
              >
                <div
                  style={{ fontWeight: 700, color: "#FF5050", marginBottom: 6 }}
                >
                  ⚠️ Zone dangereuse
                </div>
                <div style={{ fontSize: 13, color: v.muted, marginBottom: 14 }}>
                  La suppression de votre compte est irréversible. Toutes vos
                  données seront effacées définitivement.
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 100,
                    border: "1px solid rgba(255,80,80,0.4)",
                    background: "none",
                    color: "#FF5050",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Supprimer mon compte
                </button>
              </div>

              <div style={{ ...glassCard(theme), padding: 24, marginTop: 16 }}>
                <div style={{ fontWeight: 700, color: v.text, marginBottom: 8 }}>✉️ Nous contacter</div>
                <p style={{ fontSize: 13, color: v.muted, marginBottom: 12 }}>Un problème ? Une question ? Notre équipe vous répond rapidement.</p>
                <a href="mailto:frigia.contact@gmail.com" style={{ display: "inline-block", padding: "10px 20px", borderRadius: 100, background: v.inputBg, border: `1px solid ${v.border}`, color: v.text, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                  frigia.contact@gmail.com
                </a>
              </div>
            </div>
          )}

          {/* ── MODALE CONFIRMATION SUPPRESSION ── */}
          {showDeleteConfirm && (
            <div style={{ position: "fixed", inset: 0, zIndex: 4000, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <div style={{ width: "100%", maxWidth: 420, background: theme === "light" ? "#F4F4F0" : "#0E0E1A", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 24, padding: 32 }}>
                <div style={{ fontSize: 32, textAlign: "center", marginBottom: 16 }}>⚠️</div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: "#FF5050", textAlign: "center", marginBottom: 12 }}>Supprimer mon compte</h3>
                <p style={{ fontSize: 14, color: v.muted, textAlign: "center", lineHeight: 1.6, marginBottom: 28 }}>
                  Cette action est <strong style={{ color: v.text }}>irréversible</strong>. Tout votre historique, vos favoris et vos données seront supprimés définitivement.
                </p>
                {deleteMsg && (
                  <div style={{ fontSize: 13, color: "#FF5050", textAlign: "center", marginBottom: 16 }}>{deleteMsg}</div>
                )}
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteMsg(""); }}
                    disabled={deleteLoading}
                    style={{ flex: 1, padding: "12px", borderRadius: 100, border: `1px solid ${v.border}`, background: "none", color: v.text, cursor: "pointer", fontWeight: 600, fontSize: 14 }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={deleteAccount}
                    disabled={deleteLoading}
                    style={{ flex: 1, padding: "12px", borderRadius: 100, border: "none", background: "#FF5050", color: "#fff", cursor: deleteLoading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 14, opacity: deleteLoading ? 0.7 : 1 }}
                  >
                    {deleteLoading ? "Suppression..." : "Oui, supprimer"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── OnboardingScreen ────────────────────────────────────────────────────────
function OnboardingScreen({ onContinue, loading }: { onContinue: () => void; loading?: boolean }) {
  const grad = "linear-gradient(135deg,#FF6B35,#2ECC71)";
  const features = [
    "Scans IA illimités",
    "Recettes personnalisées illimitées",
    "Suivi nutritionnel avancé",
    "Toutes futures fonctionnalités incluses",
  ];
  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"#07070E", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{`html,body{margin:0;background:#07070E;overflow:hidden!important;}`}</style>

      {/* Orbs */}
      <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,107,53,.18) 0%,transparent 70%)", top:"-15%", right:"-15%", pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle,rgba(46,204,113,.13) 0%,transparent 70%)", bottom:"-10%", left:"-10%", pointerEvents:"none" }} />

      {/* Header */}
      <div style={{ padding:"calc(18px + env(safe-area-inset-top)) 24px 16px", display:"flex", alignItems:"center", gap:10, position:"relative", zIndex:1 }}>
        <img src="/logo.png" alt="Frigia" style={{ width:38, height:38, borderRadius:10, objectFit:"contain" }} />
        <span style={{ fontWeight:900, fontSize:20, color:"#FAFAFA", fontFamily:"Georgia,serif" }}>Frigia</span>
      </div>

      {/* Card */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 20px calc(24px + env(safe-area-inset-bottom))", position:"relative", zIndex:1 }}>
        <div style={{ background:"linear-gradient(135deg,rgba(255,107,53,.1),rgba(46,204,113,.08))", border:"1px solid rgba(255,107,53,.35)", borderRadius:28, padding:"32px 24px 24px", position:"relative" }}>

          {/* Badge */}
          <div style={{ position:"absolute", top:-18, left:"50%", transform:"translateX(-50%)", background:grad, borderRadius:100, padding:"7px 22px", fontSize:14, fontWeight:800, color:"#fff", whiteSpace:"nowrap", boxShadow:"0 6px 20px rgba(255,107,53,.35)" }}>🎉 4 jours gratuits inclus</div>

          {/* Title */}
          <div style={{ fontSize:11, fontWeight:700, color:"#FF6B35", letterSpacing:3, textTransform:"uppercase", textAlign:"center", marginBottom:10 }}>Frigia Premium</div>

          {/* Price */}
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:6, marginBottom:6 }}>
            <span style={{ fontSize:64, fontWeight:900, color:"#FAFAFA", lineHeight:1 }}>7,99€</span>
            <span style={{ color:"#6B7280", fontSize:16 }}>/mois</span>
          </div>

          {/* Tagline */}
          <div style={{ textAlign:"center", color:"#2ECC71", fontSize:14, fontWeight:600, marginBottom:24 }}>✓ Résiliable à tout moment</div>

          {/* Features */}
          <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:28 }}>
            {features.map(f => (
              <div key={f} style={{ display:"flex", alignItems:"center", gap:14 }}>
                <span style={{ color:"#2ECC71", fontWeight:900, fontSize:16, flexShrink:0 }}>✓</span>
                <span style={{ fontSize:15, color:"#FAFAFA" }}>{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button onClick={onContinue} disabled={loading} style={{ width:"100%", padding:"17px", borderRadius:100, border:"none", background:grad, color:"#fff", fontWeight:800, fontSize:16, cursor:loading?"not-allowed":"pointer", opacity:loading?0.7:1, boxShadow:"0 8px 28px rgba(255,107,53,.35)", marginBottom:14 }}>
            {loading ? "Redirection..." : "Commencer 4j gratuit →"}
          </button>

          {/* Disclaimers */}
          <div style={{ textAlign:"center", fontSize:12, color:"#6B7280", lineHeight:1.7 }}>
            Aucune carte bancaire requise pendant l'essai<br />
            Résiliation en 1 clic
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── QuestionnaireScreen ─────────────────────────────────────────────────────
const Q_GRAD = "linear-gradient(135deg,#FF6B35,#2ECC71)";
const Q_C = { bg:"#0A0A0F", text:"#FAFAFA", muted:"#6B7280", orange:"#FF6B35" };

function QuestionnaireScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [diet, setDiet] = useState<string[]>([]);
  const [time, setTime] = useState("");

  const steps = [
    {
      id:"equipment", optional:true, multi:true,
      title:"Tu as un équipement\nparticulier ?",
      sub:"On adaptera les recettes à ce que tu as",
      options:[
        { id:"airfryer",  icon:"🔥", label:"AirFryer"  },
        { id:"moulinex",  icon:"🥣", label:"Moulinex"  },
        { id:"thermomix", icon:"⚙️", label:"Thermomix" },
        { id:"autre",     icon:"✏️", label:"Autre"      },
      ],
    },
    {
      id:"goal", optional:false, multi:false,
      title:"Ton objectif\nprincipal ?",
      sub:"On se concentrera sur ce qui compte pour toi",
      options:[
        { id:"healthy", icon:"🥗", label:"Manger sain"     },
        { id:"nogaspi", icon:"♻️", label:"Zéro gaspillage" },
        { id:"quick",   icon:"⚡", label:"Gagner du temps" },
      ],
    },
    {
      id:"diet", optional:false, multi:true,
      title:"Tu manges\ncomment ?",
      sub:"On te proposera uniquement des recettes adaptées",
      options:[
        { id:"all",        icon:"🍖", label:"Tout"        },
        { id:"veggie",     icon:"🥦", label:"Végétarien"  },
        { id:"vegan",      icon:"🌱", label:"Vegan"       },
        { id:"glutenfree", icon:"🌾", label:"Sans gluten" },
      ],
    },
    {
      id:"time", optional:false, multi:false,
      title:"Combien de temps\npour cuisiner ?",
      sub:"On calibre la complexité des recettes",
      options:[
        { id:"15min", icon:"⚡",  label:"Moins de 15 min" },
        { id:"30min", icon:"🕐",  label:"30 minutes"      },
        { id:"any",   icon:"👨‍🍳", label:"Peu importe"    },
      ],
    },
  ];

  const cur = steps[step];

  const isSelected = (id: string) => {
    if (cur.id === "equipment") return equipment.includes(id);
    if (cur.id === "goal") return goal === id;
    if (cur.id === "diet") return diet.includes(id);
    if (cur.id === "time") return time === id;
    return false;
  };

  const toggle = (id: string) => {
    if (cur.id === "equipment") {
      setEquipment(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
    } else if (cur.id === "goal") {
      setGoal(id);
    } else if (cur.id === "diet") {
      if (id === "all") { setDiet(p => p.includes("all") ? [] : ["all"]); return; }
      setDiet(p => { const w = p.filter(x => x !== "all"); return w.includes(id) ? w.filter(x => x !== id) : [...w, id]; });
    } else if (cur.id === "time") {
      setTime(id);
    }
  };

  const canContinue = () => {
    if (cur.optional) return true;
    if (cur.id === "goal") return !!goal;
    if (cur.id === "diet") return diet.length > 0;
    if (cur.id === "time") return !!time;
    return true;
  };

  const goNext = () => {
    if (!canContinue()) return;
    if (step < steps.length - 1) setStep(s => s + 1);
    else onComplete();
  };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:500,background:Q_C.bg,display:"flex",flexDirection:"column",overflow:"hidden" }}>
      <style>{`html,body{margin:0;background:#0A0A0F;overflow-x:hidden!important;}`}</style>
      <div style={{ position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,107,53,.12) 0%,transparent 70%)",top:"-10%",right:"-10%",pointerEvents:"none" }} />
      <div style={{ position:"absolute",width:360,height:360,borderRadius:"50%",background:"radial-gradient(circle,rgba(46,204,113,.09) 0%,transparent 70%)",bottom:"5%",left:"-8%",pointerEvents:"none" }} />

      <div style={{ padding:"calc(52px + env(safe-area-inset-top)) 28px 0",position:"relative",zIndex:1 }}>
        <div style={{ display:"flex",gap:6,marginBottom:36 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex:1,height:3,borderRadius:100,overflow:"hidden",background:"rgba(255,255,255,0.08)" }}>
              <div style={{ height:"100%",background:Q_GRAD,borderRadius:100,width:i<=step?"100%":"0%",transition:"width 0.45s ease" }} />
            </div>
          ))}
        </div>
        <div style={{ fontSize:12,color:Q_C.muted,marginBottom:10,fontWeight:600,letterSpacing:1 }}>
          {step+1} / {steps.length}
          {cur.optional && <span style={{ marginLeft:10,color:"rgba(255,255,255,0.2)",fontSize:11 }}>· Facultatif</span>}
        </div>
        <h2 style={{ fontSize:"clamp(28px,7vw,40px)",fontWeight:900,color:Q_C.text,lineHeight:1.12,letterSpacing:-1.5,whiteSpace:"pre-line",marginBottom:8 }}>
          {cur.title}
        </h2>
        <p style={{ fontSize:14,color:Q_C.muted,lineHeight:1.6 }}>{cur.sub}</p>
      </div>

      <div style={{ flex:1,padding:"28px 28px 0",display:"flex",flexDirection:"column",gap:11,overflowY:"auto",position:"relative",zIndex:1 }}>
        {cur.options.map(opt => {
          const sel = isSelected(opt.id);
          return (
            <button key={opt.id} onClick={() => toggle(opt.id)} style={{ display:"flex",alignItems:"center",gap:16,padding:"17px 20px",borderRadius:20,background:sel?"rgba(255,107,53,0.1)":"rgba(255,255,255,0.04)",border:`1.5px solid ${sel?"rgba(255,107,53,0.55)":"rgba(255,255,255,0.07)"}`,color:Q_C.text,textAlign:"left",width:"100%",transition:"all 0.2s",boxShadow:sel?"0 4px 20px rgba(255,107,53,0.12)":"none" }}>
              <div style={{ width:44,height:44,borderRadius:14,background:sel?"rgba(255,107,53,0.18)":"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>
                {opt.icon}
              </div>
              <span style={{ fontWeight:700,fontSize:16,flex:1 }}>{opt.label}</span>
              <div style={{ width:22,height:22,borderRadius:"50%",border:`2px solid ${sel?Q_C.orange:"rgba(255,255,255,0.15)"}`,background:sel?Q_C.orange:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s" }}>
                {sel && <span style={{ color:"#fff",fontSize:12,fontWeight:900 }}>✓</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ padding:"20px 28px calc(28px + env(safe-area-inset-bottom))",position:"relative",zIndex:1 }}>
        <button onClick={goNext} style={{ width:"100%",padding:"17px",borderRadius:100,border:"none",background:canContinue()?Q_GRAD:"rgba(255,255,255,0.07)",color:canContinue()?"#fff":"rgba(255,255,255,0.3)",fontWeight:800,fontSize:17,transition:"all 0.25s",boxShadow:canContinue()?"0 10px 32px rgba(255,107,53,0.28)":"none" }}>
          {step === steps.length-1 ? "Commencer !" : "Continuer →"}
        </button>
        {step > 0 && (
          <button onClick={() => setStep(s => s-1)} style={{ width:"100%",marginTop:12,padding:"10px",background:"none",border:"none",color:Q_C.muted,fontSize:14,fontWeight:500 }}>
            ← Retour
          </button>
        )}
      </div>
    </div>
  );
}

// ─── ServingsModal ────────────────────────────────────────────────────────────
function ServingsModal({
  theme,
  onConfirm,
  onSkip,
}: {
  theme: Theme;
  onConfirm: (n: number) => void;
  onSkip: () => void;
}) {
  const v = getThemeVars(theme);
  const [servings, setServings] = useState(2);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          ...glassCard(theme),
          padding: 40,
          maxWidth: 420,
          width: "100%",
          animation: "modalIn 0.35s ease both",
          background:
            theme === "light"
              ? "rgba(244,244,240,0.97)"
              : "rgba(14,14,20,0.97)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 16 }}>👨‍👩‍👧‍👦</div>
        <h3
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: v.text,
            marginBottom: 8,
          }}
        >
          Pour combien de personnes ?
        </h3>
        <p style={{ color: v.muted, fontSize: 14, marginBottom: 32 }}>
          Les quantités des recettes seront ajustées automatiquement.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            marginBottom: 28,
          }}
        >
          <button
            onClick={() => setServings(Math.max(1, servings - 1))}
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: `1px solid ${v.border}`,
              background: v.inputBg,
              color: v.text,
              fontSize: 24,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            −
          </button>
          <div
            style={{
              fontSize: 52,
              fontWeight: 900,
              color: v.text,
              minWidth: 64,
              textAlign: "center",
              lineHeight: 1,
            }}
          >
            {servings}
          </div>
          <button
            onClick={() => setServings(Math.min(10, servings + 1))}
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: `1px solid ${v.border}`,
              background: v.inputBg,
              color: v.text,
              fontSize: 24,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            +
          </button>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            marginBottom: 28,
            flexWrap: "wrap",
          }}
        >
          {[1, 2, 3, 4, 6].map((n) => (
            <button
              key={n}
              onClick={() => setServings(n)}
              style={{
                padding: "8px 18px",
                borderRadius: 100,
                border:
                  servings === n
                    ? "2px solid #FF6B35"
                    : `1px solid ${v.border}`,
                background:
                  servings === n ? "rgba(255,107,53,0.15)" : v.inputBg,
                color: servings === n ? "#FF6B35" : v.muted,
                cursor: "pointer",
                fontWeight: servings === n ? 700 : 400,
                fontSize: 14,
              }}
            >
              {n} pers.
            </button>
          ))}
        </div>
        <button
          onClick={() => onConfirm(servings)}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 100,
            background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
            border: "none",
            color: "#fff",
            fontWeight: 800,
            fontSize: 16,
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          Voir les recettes pour {servings} personne{servings > 1 ? "s" : ""}
        </button>
        <button
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            color: v.muted,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Ignorer
        </button>
      </div>
    </div>
  );
}

// ─── RecipeDetailModal ────────────────────────────────────────────────────────
function RecipeDetailModal({
  theme,
  recipe,
  servings,
  onClose,
}: {
  theme: Theme;
  recipe: GeneratedRecipe;
  servings: number;
  onClose: () => void;
}) {
  const v = getThemeVars(theme);
  const baseServings = 2;
  const ratio = servings / baseServings;

  const steps = recipe.steps?.length
    ? recipe.steps
    : [
        "Préparez et lavez tous vos ingrédients avant de commencer.",
        "Faites chauffer une poêle à feu moyen avec un filet d'huile ou de beurre.",
        "Ajoutez les ingrédients principaux et cuisez en remuant régulièrement.",
        "Assaisonnez selon votre goût, dressez et servez chaud.",
      ];

  const ingredients = recipe.recipeIngredients || [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        overflowY: "auto",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          ...glassCard(theme),
          width: "100%",
          maxWidth: 660,
          animation: "modalIn 0.35s ease both",
          background:
            theme === "light"
              ? "rgba(244,244,240,0.97)"
              : "rgba(14,14,20,0.97)",
          overflow: "hidden",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* Hero */}
        <div style={{ height: 240, position: "relative", overflow: "hidden", flexShrink: 0 }}>
          <RecipeImage title={recipe.title} imageSearch={recipe.imageSearch} />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75) 100%)",
            }}
          />
          <button
            onClick={onClose}
            style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.55)", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
          >✕</button>
          <div style={{ position: "absolute", bottom: 20, left: 24 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>{recipe.emoji}</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: 0, lineHeight: 1.3 }}>
              {recipe.title}
            </h2>
          </div>
        </div>

        <div style={{ padding: 28 }}>
          {/* Meta chips */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 28,
              flexWrap: "wrap",
            }}
          >
            {[
              { icon: "⏱", label: recipe.time },
              { icon: "🔥", label: `${recipe.cal} kcal` },
              { icon: "📊", label: recipe.diff },
              { icon: "👥", label: `${servings} pers.` },
            ].map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 100,
                  background: v.inputBg,
                  border: `1px solid ${v.border}`,
                }}
              >
                <span>{m.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: v.text }}>
                  {m.label}
                </span>
              </div>
            ))}
          </div>

          {/* Ingredients */}
          {ingredients.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: v.text,
                  marginBottom: 14,
                }}
              >
                Ingrédients{" "}
                <span
                  style={{
                    color: v.muted,
                    fontWeight: 400,
                    fontSize: 13,
                  }}
                >
                  pour {servings} personne{servings > 1 ? "s" : ""}
                </span>
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {ingredients.map((ing, i) => {
                  const numMatch = ing.qty.match(/^([\d.]+)/);
                  const unit = ing.qty.replace(/^[\d.]+\s*/, "");
                  const adjustedQty = numMatch
                    ? `${
                        Math.round(
                          parseFloat(numMatch[1]) * ratio * 10
                        ) / 10
                      }${unit ? " " + unit : ""}`
                    : ing.qty;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 14px",
                        borderRadius: 12,
                        background: v.inputBg,
                        border: `1px solid ${v.border}`,
                      }}
                    >
                      <span style={{ fontSize: 22 }}>
                        {ingredientIcon(ing.name)}
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: v.text,
                          }}
                        >
                          {ing.name}
                        </div>
                        <div style={{ fontSize: 12, color: v.muted }}>
                          {adjustedQty}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Steps */}
          <div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: v.text,
                marginBottom: 16,
              }}
            >
              Étapes de préparation
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {steps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                    animation: `fadeUp 0.4s ease ${i * 0.08}s both`,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background:
                        "linear-gradient(135deg,#FF6B35,#2ECC71)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 14,
                      fontWeight: 900,
                      color: "#fff",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      paddingTop: 6,
                      fontSize: 14,
                      color: v.text,
                      lineHeight: 1.65,
                    }}
                  >
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────
function HistoryTab({
  theme,
  history,
  onDeleteScan,
  onRecipeClick,
  isFavorite,
  onToggleFavorite,
}: {
  theme: Theme;
  history: HistoryEntry[];
  onDeleteScan: (entryId: string) => void;
  onRecipeClick: (recipe: GeneratedRecipe, servings: number) => void;
  isFavorite: (recipe: GeneratedRecipe) => boolean;
  onToggleFavorite: (recipe: GeneratedRecipe) => void;
}) {
  const v = getThemeVars(theme);
  const [openIngredients, setOpenIngredients] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const toggleIngredients = (id: string) => setOpenIngredients(prev => ({ ...prev, [id]: !prev[id] }));

  if (history.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
        <h3
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: v.text,
            marginBottom: 8,
          }}
        >
          Aucun historique pour l'instant
        </h3>
        <p style={{ color: v.muted, fontSize: 14 }}>
          Scannez votre frigo pour commencer à construire votre historique de
          recettes.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {history.map((entry) => (
        <div key={entry.id} style={{ ...glassCard(theme), padding: 24, position: "relative" }}>
          {/* Trash button — top-right corner */}
          {confirmDeleteId === entry.id ? (
            <div style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#e74c3c", fontWeight: 600 }}>Supprimer ?</span>
              <button
                onClick={() => { onDeleteScan(entry.id); setConfirmDeleteId(null); }}
                style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#e74c3c", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >Oui</button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "none", color: v.muted, fontSize: 12, cursor: "pointer" }}
              >Non</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteId(entry.id)}
              title="Supprimer ce scan"
              style={{ position: "absolute", top: 16, right: 16, width: 30, height: 30, borderRadius: "50%", border: "1px solid rgba(231,76,60,0.3)", background: "rgba(231,76,60,0.08)", color: "#e74c3c", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
            >🗑️</button>
          )}
          {/* Entry header */}
          <div style={{ marginBottom: 16, paddingRight: 42 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: v.text }}>
              {entry.date.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              à{" "}
              {entry.date.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div style={{ fontSize: 13, color: v.muted, marginTop: 3 }}>
              👥 {entry.servings} personne{entry.servings > 1 ? "s" : ""}{" "}
              · 🛒 {entry.ingredients.length} ingrédients détectés ·{" "}
              🍽️ {entry.recipes.length} recette
              {entry.recipes.length > 1 ? "s" : ""}
            </div>
          </div>

          {/* Ingredients accordion */}
          {entry.ingredients.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => toggleIngredients(entry.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(46,204,113,0.08)", border: "1px solid rgba(46,204,113,0.2)", borderRadius: 100, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#2ECC71" }}
              >
                Aliments détectés ({entry.ingredients.length})
                <span style={{ fontSize: 10, transition: "transform 0.2s", display: "inline-block", transform: openIngredients[entry.id] ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
              </button>
              {openIngredients[entry.id] && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {entry.ingredients.map((ing) => (
                    <div
                      key={ing.name}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: "rgba(46,204,113,0.1)", border: "1px solid rgba(46,204,113,0.2)", borderRadius: 100, fontSize: 12, color: v.text }}
                    >
                      <span>{ing.icon}</span>
                      <span style={{ fontWeight: 600 }}>{ing.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Recipe cards grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {entry.recipes.map((recipe) => (
              <div
                key={recipe.title}
                style={{
                  position: "relative",
                  ...glassCard(theme),
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "transform 0.2s",
                }}
                onClick={() => onRecipeClick(recipe, entry.servings)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div
                  style={{
                    height: 110,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <RecipeImage title={recipe.title} imageSearch={recipe.imageSearch} />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5) 100%)",
                    }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(recipe); }}
                    style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: "50%", background: isFavorite(recipe) ? "rgba(255,107,53,0.9)" : "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "none", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >{isFavorite(recipe) ? "❤️" : "🤍"}</button>
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: v.text, marginBottom: 4, lineHeight: 1.3 }}>
                    {recipe.title}
                  </div>
                  <div style={{ fontSize: 11, color: v.muted, marginBottom: 8 }}>
                    {recipe.time} · {recipe.cal} kcal
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRecipeClick(recipe, entry.servings); }}
                      style={{ flex: 1, padding: "6px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >Voir →</button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const text = buildShareText(recipe);
                        if (navigator.share) { navigator.share({ title: recipe.title, text }).catch(() => {}); }
                        else { navigator.clipboard.writeText(text).catch(() => {}); }
                      }}
                      style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid rgba(255,255,255,0.1)`, background: "none", color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}
                    >↗</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Nav({
  theme,
  onSettingsOpen,
}: {
  theme: Theme;
  onSettingsOpen: () => void;
}) {
  const v = getThemeVars(theme);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: "16px 40px",
        background: scrolled ? v.navBg : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? `1px solid ${v.border}` : "none",
        transition: "all 0.3s",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/logo.png" alt="Frigia" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} />
        <span
          style={{
            fontWeight: 800,
            fontSize: 22,
            color: v.text,
            fontFamily: "Georgia, serif",
          }}
        >
          Frigia
        </span>
      </div>

      <div
        className="nav-actions"
        style={{ display: "flex", gap: 12, alignItems: "center" }}
      >
        <button
          onClick={onSettingsOpen}
          style={{
            padding: "10px 16px",
            background: "none",
            border: `1px solid ${v.border}`,
            borderRadius: 100,
            color: v.text,
            cursor: "pointer",
            fontSize: 16,
          }}
          title="Paramètres"
        >
          ⚙️
        </button>
      </div>
    </nav>
  );
}

// ─── IPhone Mockup ────────────────────────────────────────────────────────────
function IPhoneMockup() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setStep((s) => (s + 1) % 3), 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        width: 280,
        height: 570,
        borderRadius: 44,
        background: "#0D0D14",
        border: "2px solid rgba(255,255,255,0.12)",
        boxShadow:
          "0 40px 80px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.1)",
        position: "relative",
        overflow: "hidden",
        animation: "float 4s ease-in-out infinite",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          width: 92,
          height: 24,
          background: "#000",
          borderRadius: "0 0 18px 18px",
          zIndex: 5,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 6,
          borderRadius: 38,
          overflow: "hidden",
          background: "#080810",
        }}
      >
        <img
          src="/images/frigo.jpg"
          alt="frigo"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.75,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(160deg,rgba(0,20,0,0.4) 0%,rgba(0,10,0,0.25) 100%)",
          }}
        />
        {step === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
            }}
          >
            <ScanLine />
            <Brackets color="#2ECC71" size={24} />
            <div
              style={{
                position: "absolute",
                bottom: 60,
                left: 0,
                right: 0,
                textAlign: "center",
                fontSize: 11,
                color: "#2ECC71",
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                animation: "pulse 1s infinite",
              }}
            >
              Analyse en cours…
            </div>
          </div>
        )}
        {step === 1 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.72)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#2ECC71",
                fontWeight: 700,
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              INGRÉDIENTS DÉTECTÉS
            </div>
            {[
              ["🥛", "Lait"],
              ["🍅", "Tomates"],
              ["🥚", "Œufs"],
              ["🧀", "Fromage"],
            ].map(([ic, nm], i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(46,204,113,0.15)",
                  border: "1px solid rgba(46,204,113,0.3)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 12,
                  color: "#fff",
                  animation: `slideIn 0.3s ease ${i * 0.1}s both`,
                }}
              >
                <span>{ic}</span>
                <span>{nm}</span>
                <span
                  style={{ marginLeft: "auto", color: "#2ECC71", fontSize: 10 }}
                >
                  97%
                </span>
              </div>
            ))}
          </div>
        )}
        {step === 2 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#080810",
              padding: 18,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: COLORS.orangeStart,
                fontWeight: 700,
                letterSpacing: 2,
                marginTop: 38,
                marginBottom: 18,
              }}
            >
              RECETTES SUGGÉRÉES
            </div>
            {[
              {
                img: "/images/omelette-tomates.jpg",
                t: "Omelette aux tomates",
                kcal: "320 kcal",
                time: "8 min",
              },
              {
                img: "/images/salade-caprese.jpg",
                t: "Salade fraîche",
                kcal: "180 kcal",
                time: "5 min",
              },
              {
                img: "/images/pasta-legumes.jpg",
                t: "Pasta express",
                kcal: "520 kcal",
                time: "20 min",
              },
            ].map((r, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16,
                  padding: "8px",
                  marginBottom: 10,
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  animation: `fadeUp 0.4s ease ${i * 0.15}s both`,
                }}
              >
                <img
                  src={r.img}
                  alt={r.t}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>
                    {r.t}
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.muted }}>
                    {r.time} · {r.kcal}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Showcase Recipes ────────────────────────────────────────────────────────

const SHOWCASE_RECIPES: GeneratedRecipe[] = [
  {
    emoji: "🍔",
    title: "Smash Burger Maison",
    time: "20 min",
    cal: 680,
    diff: "Facile",
    imageSearch: "https://www.themealdb.com/images/media/meals/44bzep1761848278.jpg",
    steps: [
      "Diviser la viande hachée en deux boules de 150g sans trop la travailler. Placer au frigo 10 min.",
      "Couper les brioches en deux et les griller à sec dans la poêle 1 min côté mie jusqu'à dorure.",
      "Chauffer une poêle en fonte à feu très fort 3 minutes. Aucune matière grasse — la chaleur est clé.",
      "Déposer une boule de viande, écraser immédiatement avec une spatule large pendant 10 secondes pour obtenir une galette fine de 12 cm.",
      "Saler et poivrer. Cuire 2 min sans toucher pour créer une belle croûte caramélisée sur les bords.",
      "Retourner la galette, déposer le cheddar, couvrir 30 secondes pour faire fondre.",
      "Mélanger mayo + ketchup + moutarde + paprika fumé + cornichon haché. Tartiner généreusement les deux faces.",
      "Monter : brioche base → laitue → tomate → oignon rouge → galette → brioche chapeau. Servir immédiatement.",
    ],
    recipeIngredients: [
      { name: "Steak haché 15% MG", qty: "300g" },
      { name: "Pain brioche burger", qty: "2" },
      { name: "Cheddar tranches", qty: "2" },
      { name: "Laitue", qty: "3 feuilles" },
      { name: "Tomate", qty: "1 grosse" },
      { name: "Oignon rouge", qty: "½" },
      { name: "Cornichons", qty: "4" },
      { name: "Mayonnaise", qty: "2 cs" },
      { name: "Ketchup", qty: "1 cs" },
      { name: "Moutarde", qty: "1 cc" },
      { name: "Paprika fumé", qty: "1 cc" },
    ],
  },
  {
    emoji: "🌯",
    title: "Wraps Healthy Poulet",
    time: "15 min",
    cal: 390,
    diff: "Très facile",
    imageSearch: "https://www.themealdb.com/images/media/meals/swo87v1763595282.jpg",
    steps: [
      "Couper le blanc de poulet en lanières fines. Mélanger avec cumin, paprika, sel, poivre et un filet d'huile d'olive.",
      "Chauffer une poêle antiadhésive à feu vif. Cuire les lanières 3-4 min en remuant — légère coloration dorée.",
      "Écraser l'avocat à la fourchette avec le jus de citron, sel et une pincée d'ail en poudre.",
      "Réchauffer les tortillas 30 sec au micro-ondes ou 10 sec de chaque côté à sec dans la poêle.",
      "Étaler le guacamole sur toute la surface, laisser 2 cm de bord pour rouler facilement.",
      "Disposer les lanières de poulet, la salade ciselée, les tomates cerises coupées et le maïs.",
      "Rouler en serrant fermement, couper en biais à mi-longueur. Servir avec une sauce yaourt-menthe fraîche.",
    ],
    recipeIngredients: [
      { name: "Blancs de poulet", qty: "300g" },
      { name: "Tortillas complètes larges", qty: "2" },
      { name: "Avocat mûr", qty: "1" },
      { name: "Salade mélangée", qty: "50g" },
      { name: "Tomates cerises", qty: "8" },
      { name: "Maïs égoutté", qty: "50g" },
      { name: "Citron", qty: "½" },
      { name: "Cumin moulu", qty: "1 cc" },
      { name: "Paprika doux", qty: "1 cc" },
      { name: "Yaourt grec", qty: "2 cs" },
      { name: "Menthe fraîche", qty: "quelques feuilles" },
    ],
  },
  {
    emoji: "🍛",
    title: "Riz Poulet Curry Coco",
    time: "30 min",
    cal: 520,
    diff: "Facile",
    imageSearch: "https://www.themealdb.com/images/media/meals/vwrpps1503068729.jpg",
    steps: [
      "Rincer le riz basmati 3 fois à l'eau froide jusqu'à ce que l'eau soit claire. Égoutter.",
      "Cuire le riz dans 400 ml d'eau bouillante salée avec une feuille de laurier, à couvert feu doux 12 min. Éteindre et laisser gonfler 5 min.",
      "Couper le poulet en cubes de 3 cm. Émincer finement l'oignon et l'ail. Couper le poivron en lanières.",
      "Faire revenir l'oignon dans l'huile de coco 3 min à feu moyen jusqu'à translucidité dorée.",
      "Ajouter l'ail, la poudre de curry et le gingembre râpé. Mélanger 1 min pour libérer tous les arômes.",
      "Ajouter le poulet, faire dorer 4-5 min sur toutes les faces à feu vif.",
      "Verser le lait de coco et les tomates concassées, ajouter le poivron. Porter à ébullition puis mijoter à couvert 12 min à feu doux.",
      "Ajuster le sel. Servir sur le riz, parsemer de coriandre fraîche ciselée et d'un filet de citron vert.",
    ],
    recipeIngredients: [
      { name: "Riz basmati", qty: "200g" },
      { name: "Blanc de poulet", qty: "400g" },
      { name: "Lait de coco", qty: "400 ml" },
      { name: "Tomates concassées", qty: "200g" },
      { name: "Poudre de curry", qty: "2 cs" },
      { name: "Oignon", qty: "1" },
      { name: "Ail", qty: "3 gousses" },
      { name: "Gingembre frais", qty: "2 cm" },
      { name: "Poivron rouge", qty: "1" },
      { name: "Huile de coco", qty: "1 cs" },
      { name: "Coriandre fraîche", qty: "1 bouquet" },
      { name: "Citron vert", qty: "½" },
    ],
  },
];

function ShowcaseRecipeCard({
  recipe,
  theme,
  onClick,
}: {
  recipe: GeneratedRecipe;
  theme: Theme;
  onClick: () => void;
}) {
  const v = getThemeVars(theme);
  const [shared, setShared] = useState(false);
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = buildShareText(recipe);
    if (navigator.share) {
      try { await navigator.share({ title: recipe.title, text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };
  const tagline: Record<string, string> = {
    "Smash Burger Maison": "Croûte caramélisée, cheddar fondant, sauce secrète maison",
    "Wraps Healthy Poulet": "Léger, frais et rassasiant — prêt en 15 minutes",
    "Riz Poulet Curry Coco": "Onctueux, parfumé et réconfortant comme au resto",
  };
  const gradients: Record<string, string> = {
    "Smash Burger Maison": "linear-gradient(135deg,#FF6B35,#c0392b)",
    "Wraps Healthy Poulet": "linear-gradient(135deg,#2ECC71,#16a085)",
    "Riz Poulet Curry Coco": "linear-gradient(135deg,#f39c12,#e74c3c)",
  };
  const gradient = gradients[recipe.title] || "linear-gradient(135deg,#FF6B35,#2ECC71)";

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: 20,
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        background: v.bgCard,
        border: `1px solid ${v.border}`,
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 14px 40px rgba(0,0,0,0.25)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.18)"; }}
    >
      {/* Image header */}
      <div style={{ height: 190, position: "relative", overflow: "hidden" }}>
        <img
          src={recipe.imageSearch}
          alt={recipe.title}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* Gradient overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 55%)" }} />
        {/* Emoji badge */}
        <div style={{ position: "absolute", top: 14, left: 14, width: 42, height: 42, borderRadius: 13, background: gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
          {recipe.emoji}
        </div>
        {/* Difficulty badge */}
        <div style={{ position: "absolute", top: 14, left: 64, padding: "4px 10px", borderRadius: 100, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", fontSize: 11, fontWeight: 700, color: "#fff" }}>
          {recipe.diff}
        </div>
        {/* Title overlay */}
        <div style={{ position: "absolute", bottom: 14, left: 16, right: 16 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", lineHeight: 1.2, fontFamily: "Georgia, serif", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
            {recipe.title}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 18px" }}>
        <p style={{ fontSize: 13, color: v.muted, margin: "0 0 14px", lineHeight: 1.5 }}>
          {tagline[recipe.title]}
        </p>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { icon: "⏱️", label: recipe.time },
            { icon: "🔥", label: `${recipe.cal} kcal` },
            { icon: "📋", label: `${recipe.steps?.length ?? 0} étapes` },
          ].map(({ icon, label }) => (
            <div key={label} style={{ flex: 1, background: v.inputBg, borderRadius: 10, padding: "7px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 15 }}>{icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: v.text, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", cursor: "pointer", background: gradient, color: "#fff", fontWeight: 800, fontSize: 14 }} onClick={onClick}>
            Voir →
          </button>
          <button onClick={handleShare} style={{ padding: "11px 16px", borderRadius: 12, border: `1px solid ${v.border}`, background: "none", color: shared ? "#2ECC71" : v.muted, cursor: "pointer", fontSize: 14, transition: "color 0.2s" }}>
            {shared ? "✓" : "↗"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FridgeAIScanner ──────────────────────────────────────────────────────────
function FridgeAIScanner({
  theme,
  onRecipesGenerated,
  onRecipeClick,
}: {
  theme: Theme;
  onRecipesGenerated: (r: GeneratedRecipe[], i: DetectedIngredient[]) => void;
  onRecipeClick?: (r: GeneratedRecipe) => void;
}) {
  const v = getThemeVars(theme);
  const gc = glassCard(theme);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [ingredients, setIngredients] = useState<DetectedIngredient[]>([]);
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [error, setError] = useState("");

  const handleImage = (file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImage(url);
    setIngredients([]);
    setRecipes([]);
    setError("");
    setAnalyzing(true);
    const compressImage = (f: File): Promise<{ base64: string; type: string }> =>
      new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(f);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const MAX = 1200;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve({ base64: dataUrl.split(",")[1], type: "image/jpeg" });
        };
        img.src = objectUrl;
      });

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const { base64: imageBase64, type: mediaType } = await compressImage(file);
        const { data: { session: scanSession } } = await supabase.auth.getSession();
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${scanSession?.access_token}` },
          body: JSON.stringify({ imageBase64, mediaType }),
        });
        const data = await response.json();
        if (response.status === 401 || response.status === 403) {
          await supabase.auth.signOut();
          return;
        }
        if (!response.ok) throw new Error("unclear_photo");
        const detected: DetectedIngredient[] = (data.ingredients || []).map(
          (i: any) => ({
            name: String(i.name || "Aliment"),
            icon: ingredientIcon(String(i.name || "")),
            conf: Number(i.confidence) || 90,
          })
        );
        const generated: GeneratedRecipe[] = (data.recipes || []).map(
          (r: any) => ({
            emoji: recipeIcon(String(r.title || "")),
            title: String(r.title || "Recette"),
            time: String(r.time || "15 min"),
            cal: Number(r.calories) || 350,
            diff: String(r.difficulty || "Facile"),
            imageSearch: String(r.imageUrl || r.imageSearch || r.title || ""),
            steps: Array.isArray(r.steps) ? r.steps.map(String) : undefined,
            recipeIngredients: Array.isArray(r.ingredients)
              ? r.ingredients.map((i: any) => ({
                  name: String(i.name || ""),
                  qty: String(i.qty || "1"),
                }))
              : undefined,
          })
        );
        setIngredients(detected);
        setRecipes(generated);
        setAnalyzing(false);
        onRecipesGenerated(generated, detected);
      } catch {
        setError("unclear_photo");
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 40,
        flexWrap: "wrap",
        alignItems: "flex-start",
      }}
    >
      <div style={{ flex: 1, minWidth: 300 }}>
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            ...gc,
            padding: 24,
            position: "relative",
            minHeight: 340,
            cursor: "pointer",
            overflow: "hidden",
            background:
              "linear-gradient(135deg,rgba(46,204,113,0.06),rgba(10,10,15,0.85))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"

            style={{ display: "none" }}
            onChange={(e) => handleImage(e.target.files?.[0])}
          />
          {!image && (
            <img
              src="/images/frigo.jpg"
              alt="frigo"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.3,
              }}
            />
          )}
          {image && (
            <img
              src={image}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: analyzing ? 0.45 : 0.65,
              }}
            />
          )}
          {(analyzing || !image) && (
            <>
              <ScanLine />
              <Brackets color="#2ECC71" size={22} />
            </>
          )}
          <div style={{ textAlign: "center", zIndex: 2 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>
              {image ? "🤖" : "📷"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#2ECC71",
                fontWeight: 800,
                letterSpacing: 2,
                animation: analyzing ? "pulse 1s infinite" : "none",
              }}
            >
              {analyzing
                ? "SCAN EN COURS..."
                : image
                ? "ANALYSE TERMINÉE"
                : "CLIQUER POUR SCANNER MON FRIGO"}
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>
              {analyzing ? "Détection des aliments et génération des recettes…" : "Photo du frigo → aliments détectés → recettes personnalisées"}
            </div>
            {!analyzing && (
              <button
                type="button"
                style={{
                  marginTop: 22,
                  padding: "12px 22px",
                  borderRadius: 100,
                  border: "none",
                  background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {image ? "Scanner une autre photo" : "Scanner mon frigo"}
              </button>
            )}
          </div>
        </div>
        {error && (
          <div style={{ marginTop: 16, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,107,53,0.3)", background: "rgba(255,107,53,0.06)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,107,53,0.2)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>📸</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: COLORS.orangeStart }}>Photo difficile à analyser</div>
                <div style={{ fontSize: 12, color: v.muted, marginTop: 2 }}>Les aliments ne sont pas assez visibles. Suivez ces conseils :</div>
              </div>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: "💡", tip: "Ouvrez bien le frigo et allumez la lumière intérieure" },
                { icon: "📏", tip: "Reculez pour cadrer toutes les étagères" },
                { icon: "☀️", tip: "Photographiez dans une pièce bien éclairée, sans flash" },
                { icon: "🔲", tip: "Visez le contenu, pas la porte ni les bords" },
              ].map(({ icon, tip }) => (
                <div key={tip} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: v.text }}>
                  <span style={{ flexShrink: 0 }}>{icon}</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,107,53,0.2)" }}>
              <button
                onClick={() => { setError(""); setImage(null); inputRef.current?.click(); }}
                style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#FF6B35,#FF9A3C)", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
              >
                Réessayer avec une meilleure photo
              </button>
            </div>
          </div>
        )}
        {ingredients.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 20,
            }}
          >
            {ingredients.map((i) => (
              <div
                key={i.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  background: "rgba(46,204,113,0.1)",
                  border: "1px solid rgba(46,204,113,0.25)",
                  borderRadius: 100,
                  fontSize: 13,
                  color: v.text,
                  animation: "slideIn 0.4s ease both",
                }}
              >
                <span style={{ fontSize: 16 }}>{i.icon}</span>
                <span style={{ fontWeight: 600 }}>{i.name}</span>
                <span style={{ fontSize: 11, color: "#2ECC71", marginLeft: 4 }}>
                  {i.conf}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 300 }}>
        <div style={{ ...gc, padding: 24 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: COLORS.orangeStart,
              letterSpacing: 3,
              textTransform: "uppercase",
              marginBottom: 18,
            }}
          >
            Recettes créées par l'IA
          </div>
          {recipes.length === 0 ? (
            <p style={{ color: v.muted, fontSize: 14, lineHeight: 1.7 }}>
              Ajoutez une photo de votre frigo. L'IA détectera les aliments et
              générera des recettes adaptées.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {recipes.map((r, i) => (
                <div
                  key={r.title}
                  style={{
                    ...gc,
                    padding: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    animation: `fadeUp 0.4s ease ${i * 0.12}s both`,
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 14,
                      overflow: "hidden",
                      flexShrink: 0,
                      position: "relative",
                    }}
                  >
                    <RecipeImage title={r.title} imageSearch={r.imageSearch} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ fontWeight: 800, fontSize: 15, color: v.text }}
                    >
                      {r.title}
                    </div>
                    <div style={{ fontSize: 12, color: v.muted, marginTop: 4 }}>
                      {r.time} · {r.cal} kcal · {r.diff}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRecipeClick?.(r)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 100,
                      border: `1px solid ${v.border}`,
                      background: `rgba(255,255,255,0.06)`,
                      color: v.text,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Voir →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RecipeCard ───────────────────────────────────────────────────────────────
function RecipeCard({
  theme,
  emoji,
  title,
  time,
  cal,
  diff,
  imageSearch,
  steps,
  recipeIngredients,
  delay = 0,
  onClick,
}: GeneratedRecipe & { theme: Theme; delay?: number; onClick?: () => void }) {
  const v = getThemeVars(theme);
  const [liked, setLiked] = useState(false);
  const [shared, setShared] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = buildShareText({ emoji, title, time, cal, diff, imageSearch, steps, recipeIngredients } as GeneratedRecipe);
    if (navigator.share) {
      try { await navigator.share({ title, text }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };
  return (
    <div
      onClick={onClick}
      style={{
        ...glassCard(theme),
        padding: 0,
        overflow: "hidden",
        cursor: "pointer",
        transition: "transform 0.3s,box-shadow 0.3s",
        animation: `fadeUp 0.6s ease ${delay}s both`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-6px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ height: 180, position: "relative", overflow: "hidden" }}>
        <RecipeImage title={title} imageSearch={imageSearch} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.55) 100%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            borderRadius: 100,
            padding: "4px 10px",
            fontSize: 11,
            color: "#fff",
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          {diff}
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 14,
            fontSize: 26,
            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))",
          }}
        >
          {emoji}
        </div>
      </div>
      <div style={{ padding: "16px 18px" }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: v.text,
            marginBottom: 8,
            lineHeight: 1.4,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: v.muted }}>
          <span>⏱ {time}</span>
          <span>🔥 {cal} kcal</span>
        </div>
      </div>
      <div style={{ display: "flex", borderTop: `1px solid ${v.border}` }}>
        <button
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          style={{ flex: 2, padding: "12px", background: "none", border: "none", color: "#FF6B35", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
        >
          Voir la recette →
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
          style={{ padding: "12px 14px", background: "none", border: "none", borderLeft: `1px solid ${v.border}`, color: liked ? "#FF6B35" : v.muted, cursor: "pointer", fontSize: 16 }}
        >
          {liked ? "♥" : "♡"}
        </button>
        <button
          onClick={handleShare}
          style={{ padding: "12px 14px", background: "none", border: "none", borderLeft: `1px solid ${v.border}`, color: shared ? "#2ECC71" : v.muted, cursor: "pointer", fontSize: 14, transition: "color 0.2s" }}
        >
          {shared ? "✓" : "↗"}
        </button>
      </div>
    </div>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────
function FAQItem({ theme, q, a }: { theme: Theme; q: string; a: string }) {
  const v = getThemeVars(theme);
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        ...glassCard(theme),
        padding: 0,
        overflow: "hidden",
        cursor: "pointer",
        marginBottom: 12,
        borderColor: open ? "rgba(255,107,53,0.3)" : v.border,
      }}
      onClick={() => setOpen(!open)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 24px",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15, color: v.text }}>
          {q}
        </span>
        <span
          style={{
            color: COLORS.orangeStart,
            fontSize: 22,
            transform: open ? "rotate(45deg)" : "rotate(0)",
            transition: "transform 0.3s",
          }}
        >
          +
        </span>
      </div>
      {open && (
        <div
          style={{
            padding: "0 24px 20px",
            fontSize: 14,
            color: v.muted,
            lineHeight: 1.7,
          }}
        >
          {a}
        </div>
      )}
    </div>
  );
}

// ─── localStorage cache helpers ──────────────────────────────────────────────
function getCachedHistory(userId: string): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(`frigia_history_${userId}`);
    if (!raw) return [];
    return (JSON.parse(raw) as any[]).map((e) => ({ ...e, date: new Date(e.date) }));
  } catch { return []; }
}
function setCachedHistory(userId: string, history: HistoryEntry[]) {
  localStorage.setItem(`frigia_history_${userId}`, JSON.stringify(history));
}
function getCachedFavorites(userId: string): GeneratedRecipe[] {
  try { return JSON.parse(localStorage.getItem(`frigia_favorites_${userId}`) || "[]"); } catch { return []; }
}
function setCachedFavorites(userId: string, favorites: GeneratedRecipe[]) {
  localStorage.setItem(`frigia_favorites_${userId}`, JSON.stringify(favorites));
}

// ─── Supabase data helpers ────────────────────────────────────────────────────
async function loadHistoryFromSupabase(userId: string): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from("user_history")
    .select("*")
    .eq("user_id", userId)
    .order("scan_date", { ascending: false });
  if (error || !data) return [];
  return data.map((row: any) => ({
    id: row.id,
    date: new Date(row.scan_date),
    ingredients: row.ingredients || [],
    recipes: row.recipes || [],
    servings: row.servings || 2,
  }));
}

async function loadFavoritesFromSupabase(userId: string): Promise<GeneratedRecipe[]> {
  const { data, error } = await supabase
    .from("user_favorites")
    .select("recipe")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row: any) => row.recipe);
}

async function dbInsertHistoryEntry(userId: string, entry: HistoryEntry) {
  await supabase.from("user_history").insert({
    id: entry.id,
    user_id: userId,
    scan_date: entry.date.toISOString(),
    ingredients: entry.ingredients,
    recipes: entry.recipes,
    servings: entry.servings,
  });
}


async function dbDeleteHistoryEntry(entryId: string) {
  await supabase.from("user_history").delete().eq("id", entryId);
}

async function dbInsertFavorite(userId: string, recipe: GeneratedRecipe) {
  await supabase.from("user_favorites").upsert(
    { user_id: userId, recipe, recipe_title: recipe.title },
    { onConflict: "user_id,recipe_title" }
  );
}

async function dbDeleteFavorite(userId: string, recipeTitle: string) {
  await supabase.from("user_favorites").delete()
    .eq("user_id", userId)
    .eq("recipe_title", recipeTitle);
}

// ─── Checkout Success Modal ───────────────────────────────────────────────────
function CheckoutSuccessModal({ onClose }: { onClose: () => void }) {
  const grad = "linear-gradient(135deg,#FF6B35,#2ECC71)";
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9000, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(12px)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:400, textAlign:"center" }}>
        <div style={{ width:80, height:80, borderRadius:"50%", background:grad, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px", fontSize:36 }}>✓</div>
        <h2 style={{ fontSize:28, fontWeight:900, color:"#F0EEF8", marginBottom:12, fontFamily:"Georgia,serif" }}>
          Bienvenue dans Frigia Premium !
        </h2>
        <p style={{ fontSize:15, color:"#6B7280", lineHeight:1.7, marginBottom:32 }}>
          Votre essai de 4 jours commence maintenant.<br />Aucun débit avant la fin de la période.
        </p>
        <ul style={{ listStyle:"none", textAlign:"left", marginBottom:36, display:"flex", flexDirection:"column", gap:10 }}>
          {["Scans IA illimités","Recettes personnalisées","Historique & favoris sur tous vos appareils","Annulable à tout moment"].map((f,i) => (
            <li key={i} style={{ display:"flex", gap:12, alignItems:"center", fontSize:14, color:"#F0EEF8" }}>
              <span style={{ color:"#2ECC71", fontWeight:900 }}>✓</span>{f}
            </li>
          ))}
        </ul>
        <button
          onClick={onClose}
          style={{ width:"100%", padding:"16px", borderRadius:100, border:"none", background:grad, color:"#fff", fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:"0 8px 32px rgba(255,107,53,0.35)" }}
        >
          Commencer à scanner 📸
        </button>
      </div>
    </div>
  );
}

// ─── Paywall Modal ────────────────────────────────────────────────────────────
function PaywallModal({ onSubscribe, onManageBilling, onLogout, loading, isCanceled, isPaymentFailed }: { onSubscribe: () => void; onManageBilling: () => void; onLogout: () => void; loading: boolean; isCanceled?: boolean; isPaymentFailed?: boolean }) {
  const grad = "linear-gradient(135deg,#FF6B35,#2ECC71)";
  const title = isPaymentFailed ? "Paiement échoué" : isCanceled ? "Réactiver votre abonnement" : "Commencer votre essai gratuit";
  const description = isPaymentFailed ? (
    <>Le prélèvement de <strong style={{ color:"#F0EEF8" }}>7,99€</strong> a échoué.<br />Mettez à jour votre carte pour retrouver l'accès.</>
  ) : isCanceled ? (
    <>Votre abonnement a été résilié.<br /><strong style={{ color:"#F0EEF8" }}>7,99€/mois</strong>, annulable à tout moment.</>
  ) : (
    <><strong style={{ color:"#F0EEF8" }}>4 jours gratuits</strong>, puis 7,99€/mois.<br />Votre carte ne sera pas débitée avant la fin de l'essai. Annulable à tout moment.</>
  );
  const btnLabel = loading ? "Redirection..." : isPaymentFailed ? "Mettre à jour ma carte →" : isCanceled ? "Se réabonner — 7,99€/mois →" : "Démarrer 4 jours gratuits →";
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9000, background:"#07070E", display:"flex", alignItems:"center", justifyContent:"center", padding:24, flexDirection:"column" }}>
      <div style={{ width:"100%", maxWidth:420, textAlign:"center" }}>
        <img src="/logo.png" alt="Frigia" style={{ width:72, height:72, borderRadius:18, objectFit:"contain", marginBottom:24 }} />
        <h2 style={{ fontSize:26, fontWeight:900, color:"#F0EEF8", marginBottom:12, fontFamily:"Georgia,serif" }}>{title}</h2>
        <p style={{ fontSize:15, color:"#6B7280", lineHeight:1.7, marginBottom:36 }}>{description}</p>
        {!isPaymentFailed && (
          <ul style={{ listStyle:"none", textAlign:"left", marginBottom:36, display:"flex", flexDirection:"column", gap:10 }}>
            {["Scans IA illimités","Recettes personnalisées","Historique & favoris sauvegardés","Accès sur tous vos appareils"].map((f,i) => (
              <li key={i} style={{ display:"flex", gap:12, alignItems:"center", fontSize:14, color:"#F0EEF8" }}>
                <span style={{ color:"#2ECC71", fontWeight:900 }}>✓</span>{f}
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={isPaymentFailed ? onManageBilling : onSubscribe}
          disabled={loading}
          style={{ width:"100%", padding:"16px", borderRadius:100, border:"none", background: isPaymentFailed ? "#e74c3c" : grad, color:"#fff", fontWeight:800, fontSize:16, cursor:loading?"not-allowed":"pointer", opacity:loading?0.7:1, marginBottom:14, boxShadow:"0 8px 32px rgba(255,107,53,0.35)" }}
        >
          {btnLabel}
        </button>
        <button onClick={onLogout} style={{ background:"none", border:"none", color:"#6B7280", fontSize:13, cursor:"pointer" }}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function Frigia() {
  const [user, setUser] = useState<any>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [showSettings, setShowSettings] = useState(false);
  const [showLegal, setShowLegal] = useState<LegalPage | null>(null);
  const [aiRecipes, setAiRecipes] = useState<GeneratedRecipe[]>([]);
  const [, setDetectedIngredients] = useState<DetectedIngredient[]>([]);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [recipesSubTab, setRecipesSubTab] = useState<"history" | "popular" | "favorites">("history");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<GeneratedRecipe[]>([]);
  const [servings, setServings] = useState(2);
  const [showServingsModal, setShowServingsModal] = useState(false);
  const [pendingData, setPendingData] = useState<{ recipes: GeneratedRecipe[]; ingredients: DetectedIngredient[] } | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<{ recipe: GeneratedRecipe; servings: number } | null>(null);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [mobileTab, setMobileTab] = useState<"scan" | "recipes" | "profile">("scan");
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(() => {
    const isSuccess = new URLSearchParams(window.location.search).get("checkout") === "success";
    if (isSuccess) localStorage.setItem("frigia_checkout_pending", Date.now().toString());
    return isSuccess;
  });

  const hasAccess = (u: any) => {
    if (!u) return false;
    const meta = u.user_metadata || {};
    if (meta.is_whitelisted) return true;
    if (meta.subscription_status === "active" || meta.subscription_status === "trialing") {
      localStorage.removeItem("frigia_checkout_pending");
      return true;
    }
    if (new URLSearchParams(window.location.search).get("checkout") === "success") return true;
    const pending = localStorage.getItem("frigia_checkout_pending");
    if (pending && Date.now() - parseInt(pending) < 3600000) return true;
    return false;
  };

  const openCustomerPortal = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/customer-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else setCheckoutLoading(false);
    } catch { setCheckoutLoading(false); }
  };

  const startCheckout = async () => {
    if (!user) return;
    setCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else setCheckoutLoading(false);
    } catch {
      setCheckoutLoading(false);
    }
  };


  const v = getThemeVars(theme);
  const gc = glassCard(theme);
  const isMobile = windowWidth < 768;
const loadUserData = async (u: any) => {
  const cachedHist = getCachedHistory(u.id);
  const cachedFavs = getCachedFavorites(u.id);
  setHistory(cachedHist);
  setFavorites(cachedFavs);
  setAvatarSrc(localStorage.getItem(`frigia_avatar_${u.id}`));
  const [hist, favs] = await Promise.all([
    loadHistoryFromSupabase(u.id),
    loadFavoritesFromSupabase(u.id),
  ]);
  // One-time migration: if Supabase is empty but localStorage has data, migrate it
  if (hist.length === 0 && cachedHist.length > 0) {
    await Promise.all(cachedHist.map((entry: HistoryEntry) => dbInsertHistoryEntry(u.id, entry)));
    setCachedHistory(u.id, cachedHist);
  } else {
    setHistory(hist);
    setCachedHistory(u.id, hist);
  }
  if (favs.length === 0 && cachedFavs.length > 0) {
    await Promise.all(cachedFavs.map((recipe: GeneratedRecipe) => dbInsertFavorite(u.id, recipe)));
    setCachedFavorites(u.id, cachedFavs);
  } else {
    setFavorites(favs);
    setCachedFavorites(u.id, favs);
  }
};

useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    const u = data.session?.user ?? null;
    setUser(u);
    if (u) {
      loadUserData(u);
      const pending = localStorage.getItem("frigia_checkout_pending");
      if (!localStorage.getItem(`frigia_onboarded_${u.id}`) && !pending) {
        setShowQuestionnaire(true);
      } else if (pending) {
        localStorage.setItem(`frigia_onboarded_${u.id}`, "1");
      }
    }
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user ?? null;
    setUser(u);
    if (u) {
      setMobileTab("scan");
      loadUserData(u);
      const pending = localStorage.getItem("frigia_checkout_pending");
      if (!localStorage.getItem(`frigia_onboarded_${u.id}`) && !pending) {
        setShowQuestionnaire(true);
      } else if (pending) {
        localStorage.setItem(`frigia_onboarded_${u.id}`, "1");
      }
    } else {
      setHistory([]);
      setFavorites([]);
      setAvatarSrc(null);
    }
  });

  return () => subscription.unsubscribe();
}, []);

useEffect(() => {
  const onResize = () => setWindowWidth(window.innerWidth);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);

async function signOut() {
  await supabase.auth.signOut();
}

  const toggleFavorite = (recipe: GeneratedRecipe) => {
    setFavorites(prev => {
      const isFav = prev.some(f => f.title === recipe.title);
      const next = isFav ? prev.filter(f => f.title !== recipe.title) : [recipe, ...prev];
      if (user) {
        setCachedFavorites(user.id, next);
        if (isFav) dbDeleteFavorite(user.id, recipe.title);
        else dbInsertFavorite(user.id, recipe);
      }
      return next;
    });
  };
  const isFavorite = (recipe: GeneratedRecipe) => favorites.some(f => f.title === recipe.title);

  const finishScan = (newEntry: HistoryEntry) => {
    const next = [newEntry, ...history];
    setHistory(next);
    if (user) {
      setCachedHistory(user.id, next);
      dbInsertHistoryEntry(user.id, newEntry);
    }
    setPendingData(null);
    setShowServingsModal(false);
    setMobileTab("recipes");
    setRecipesSubTab("history");
    setScanSuccess(true);
  };

  const confirmServings = (n: number) => {
    setServings(n);
    if (pendingData) {
      setAiRecipes(pendingData.recipes);
      setDetectedIngredients(pendingData.ingredients);
      finishScan({ id: Date.now().toString(), date: new Date(), ingredients: pendingData.ingredients, recipes: pendingData.recipes, servings: n });
    } else {
      setShowServingsModal(false);
    }
  };

  const skipServings = () => {
    if (pendingData) {
      setAiRecipes(pendingData.recipes);
      setDetectedIngredients(pendingData.ingredients);
      finishScan({ id: Date.now().toString(), date: new Date(), ingredients: pendingData.ingredients, recipes: pendingData.recipes, servings });
    } else {
      setShowServingsModal(false);
    }
  };

  useEffect(() => {
    if (!scanSuccess) return;
    const t = setTimeout(() => setScanSuccess(false), 2500);
    return () => clearTimeout(t);
  }, [scanSuccess]);

  const deleteScan = (entryId: string) => {
    setHistory((prev) => {
      const next = prev.filter((entry) => entry.id !== entryId);
      if (user) {
        setCachedHistory(user.id, next);
        dbDeleteHistoryEntry(entryId);
      }
      return next;
    });
  };

if (!user) {
  return <><Analytics /><Suspense fallback={<div style={{background:"#07070E",minHeight:"100vh"}}/>}><Landing /></Suspense></>;
}

if (showQuestionnaire) {
  return <QuestionnaireScreen onComplete={() => { setShowQuestionnaire(false); setShowOnboarding(true); }} />;
}

if (showOnboarding) {
  return (
    <OnboardingScreen
      loading={checkoutLoading}
      onContinue={() => {
        localStorage.setItem(`frigia_onboarded_${user.id}`, "1");
        setShowOnboarding(false);
        startCheckout();
      }}
    />
  );
}

if (!hasAccess(user)) {
  return <PaywallModal
    onSubscribe={startCheckout}
    onManageBilling={openCustomerPortal}
    loading={checkoutLoading}
    onLogout={async () => { await supabase.auth.signOut(); }}
    isCanceled={user?.user_metadata?.subscription_status === "canceled"}
    isPaymentFailed={user?.user_metadata?.subscription_status === "past_due"}
  />;
}

// ─── MOBILE LAYOUT ───────────────────────────────────────────────────────────
if (isMobile) {
  const mobileTabs = [
    { id: "scan" as const,    icon: "📷", label: "Scanner"  },
    { id: "recipes" as const, icon: "🍽️", label: "Recettes" },
    { id: "profile" as const, icon: "👤", label: "Profil"   },
  ];

  return (
    <div style={{ background: v.bg, minHeight: "100vh", fontFamily: "Helvetica Neue, Arial, sans-serif", color: v.text, overflowX: "hidden" }}>
      <GlobalStyles theme={theme} />
      {showServingsModal && <ServingsModal theme={theme} onConfirm={confirmServings} onSkip={skipServings} />}
      {selectedRecipe && <RecipeDetailModal theme={theme} recipe={selectedRecipe.recipe} servings={selectedRecipe.servings} onClose={() => setSelectedRecipe(null)} />}
      {showSettings && <SettingsModal theme={theme} onClose={() => setShowSettings(false)} onThemeChange={setTheme} user={user} avatarSrc={avatarSrc} onAvatarChange={setAvatarSrc} />}
      {showCheckoutSuccess && <CheckoutSuccessModal onClose={() => { setShowCheckoutSuccess(false); window.history.replaceState({}, "", "/"); }} />}

      {/* ── HEADER ── */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: "calc(56px + env(safe-area-inset-top))", display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "env(safe-area-inset-top)", paddingLeft: 20, paddingRight: 20, background: v.navBg, backdropFilter: "blur(20px)", borderBottom: `1px solid ${v.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/logo.png" alt="Frigia" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover" }} />
          <span style={{ fontWeight: 800, fontSize: 19, color: v.text, fontFamily: "Georgia, serif" }}>Frigia</span>
        </div>
        <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "none", color: v.muted, fontSize: 22, cursor: "pointer", padding: "6px 8px" }}>⚙️</button>
      </header>

      {/* ── CONTENT ── */}
      <main style={{ paddingTop: "calc(56px + env(safe-area-inset-top))", paddingBottom: "calc(74px + env(safe-area-inset-bottom))", minHeight: "100vh" }}>

        {/* SCANNER TAB */}
        {mobileTab === "scan" && (
          <div style={{ padding: "20px 16px" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2ECC71", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>Scan IA</div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: v.text, margin: 0, fontFamily: "Georgia, serif", lineHeight: 1.2 }}>Votre frigo intelligent</h1>
            </div>
            <FridgeAIScanner
              theme={theme}
              onRecipesGenerated={(recipes, ingredients) => { setPendingData({ recipes, ingredients }); setShowServingsModal(true); }}
              onRecipeClick={(r) => setSelectedRecipe({ recipe: r, servings })}
            />
          </div>
        )}

        {/* RECETTES TAB */}
        {mobileTab === "recipes" && (
          <div style={{ padding: "20px 16px" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: v.text, margin: 0, fontFamily: "Georgia, serif" }}>Recettes</h1>
            </div>

            {/* Sub-tab switcher */}
            <div style={{ display: "flex", borderRadius: 14, overflow: "hidden", border: `1px solid ${v.border}`, marginBottom: 20 }}>
              {([
                { id: "history" as const, label: `📋 Historique${history.length > 0 ? ` (${history.length})` : ""}` },
                { id: "favorites" as const, label: `❤️ Favoris${favorites.length > 0 ? ` (${favorites.length})` : ""}` },
                { id: "popular" as const, label: "⭐ Populaires" },
              ]).map((tab) => (
                <button key={tab.id} onClick={() => setRecipesSubTab(tab.id)} style={{ flex: 1, padding: "10px 4px", border: "none", cursor: "pointer", background: recipesSubTab === tab.id ? "linear-gradient(135deg,#FF6B35,#2ECC71)" : v.inputBg, color: recipesSubTab === tab.id ? "#fff" : v.muted, fontWeight: recipesSubTab === tab.id ? 700 : 400, fontSize: 12, transition: "all 0.2s" }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Recettes populaires */}
            {recipesSubTab === "popular" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {SHOWCASE_RECIPES.map((r) => (
                  <ShowcaseRecipeCard key={r.title} recipe={r} theme={theme} onClick={() => setSelectedRecipe({ recipe: r, servings })} />
                ))}
              </div>
            )}

            {/* Historique */}
            {recipesSubTab === "history" && (
              <HistoryTab theme={theme} history={history} onDeleteScan={deleteScan} onRecipeClick={(r, s) => setSelectedRecipe({ recipe: r, servings: s })} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
            )}

            {/* Favoris */}
            {recipesSubTab === "favorites" && (
              favorites.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>🤍</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: v.text, marginBottom: 8 }}>Aucun favori pour l'instant</div>
                  <div style={{ fontSize: 13, color: v.muted }}>Appuyez sur ❤️ sur une recette pour la sauvegarder ici.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {favorites.map((r) => (
                    <div key={r.title} style={{ ...glassCard(theme), padding: 0, overflow: "hidden", borderRadius: 16, cursor: "pointer" }} onClick={() => setSelectedRecipe({ recipe: r, servings })}>
                      <div style={{ position: "relative", height: 130 }}>
                        <RecipeImage title={r.title} imageSearch={r.imageSearch} />
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.6) 100%)" }} />
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(r); }}
                          style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,107,53,0.9)", border: "none", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}
                        >❤️</button>
                      </div>
                      <div style={{ padding: "12px 14px 8px" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: v.text, marginBottom: 4 }}>{r.title}</div>
                        <div style={{ fontSize: 12, color: v.muted, marginBottom: 10 }}>{r.time} · {r.cal} kcal · {r.diff}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedRecipe({ recipe: r, servings }); }}
                            style={{ flex: 1, padding: "8px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
                          >Voir →</button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const text = buildShareText(r);
                              if (navigator.share) { navigator.share({ title: r.title, text }).catch(() => {}); }
                              else { navigator.clipboard.writeText(text).catch(() => {}); }
                            }}
                            style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${v.border}`, background: "none", color: v.muted, cursor: "pointer", fontSize: 13 }}
                          >↗</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* PROFIL TAB */}
        {mobileTab === "profile" && (
          <div style={{ padding: "28px 16px" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ width: 84, height: 84, borderRadius: "50%", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, margin: "0 auto 14px", overflow: "hidden", flexShrink: 0 }}>
                {avatarSrc ? <img src={avatarSrc} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
              </div>
              <div style={{ fontWeight: 800, fontSize: 20, color: v.text, marginBottom: 4 }}>
                {user?.user_metadata?.full_name || user?.user_metadata?.name || "Mon compte"}
              </div>
              <div style={{ fontSize: 13, color: v.muted, marginBottom: 8 }}>{user?.email}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", background: "rgba(46,204,113,0.1)", border: "1px solid rgba(46,204,113,0.25)", borderRadius: 100, fontSize: 12, color: "#2ECC71", fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2ECC71", display: "inline-block" }} />
                Essai gratuit en cours
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                { icon: "⚙️", label: "Paramètres", sub: "Profil, abonnement, sécurité", onClick: () => setShowSettings(true) },
                { icon: theme === "dark" ? "☀️" : "🌙", label: theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre", sub: "Changer l'apparence", onClick: () => setTheme(theme === "dark" ? "light" : "dark") },
              ] as { icon: string; label: string; sub: string; onClick: () => void }[]).map((item) => (
                <button key={item.label} onClick={item.onClick} style={{ ...gc, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, border: "none", cursor: "pointer", textAlign: "left", width: "100%", borderRadius: 16 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,107,53,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: v.text }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: v.muted, marginTop: 2 }}>{item.sub}</div>
                  </div>
                  <span style={{ color: v.muted, fontSize: 20 }}>›</span>
                </button>
              ))}
              <button onClick={signOut} style={{ padding: "16px 18px", borderRadius: 16, border: "1px solid rgba(255,80,80,0.25)", background: "rgba(255,80,80,0.06)", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", width: "100%", textAlign: "left" }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,80,80,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🚪</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#FF5050" }}>Déconnexion</div>
                  <div style={{ fontSize: 12, color: v.muted, marginTop: 2 }}>Se déconnecter de Frigia</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── SCAN SUCCESS TOAST ── */}
      {scanSuccess && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: "linear-gradient(135deg,#2ECC71,#27ae60)", color: "#fff", padding: "12px 24px", borderRadius: 100, fontWeight: 700, fontSize: 15, boxShadow: "0 4px 20px rgba(46,204,113,0.4)", display: "flex", alignItems: "center", gap: 8, animation: "fadeUp 0.3s ease" }}>
          ✅ Scan terminé !
        </div>
      )}

      {/* ── BOTTOM NAV ── */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: v.navBg, backdropFilter: "blur(20px)", borderTop: `1px solid ${v.border}`, display: "flex", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {mobileTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMobileTab(tab.id)}
            style={{ flex: 1, padding: "10px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, borderTop: `2px solid ${mobileTab === tab.id ? "#FF6B35" : "transparent"}`, transition: "all 0.2s" }}
          >
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, fontWeight: mobileTab === tab.id ? 700 : 400, color: mobileTab === tab.id ? "#FF6B35" : v.muted, transition: "color 0.2s" }}>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

return (
    <div
      style={{
        background: v.bg,
        minHeight: "100vh",
        fontFamily: "Helvetica Neue, Arial, sans-serif",
        color: v.text,
        transition: "background 0.3s, color 0.3s",
      }}
    >
      <GlobalStyles theme={theme} />
      <Nav theme={theme} onSettingsOpen={() => setShowSettings(true)} />
      {showSettings && (
        <SettingsModal
          theme={theme}
          onClose={() => setShowSettings(false)}
          onThemeChange={setTheme}
          user={user}
          avatarSrc={avatarSrc}
          onAvatarChange={setAvatarSrc}
        />
      )}
      {showLegal && <LegalModal page={showLegal} theme={theme} onClose={() => setShowLegal(null)} />}
      {showServingsModal && (
        <ServingsModal
          theme={theme}
          onConfirm={confirmServings}
          onSkip={skipServings}
        />
      )}
      {selectedRecipe && (
        <RecipeDetailModal
          theme={theme}
          recipe={selectedRecipe.recipe}
          servings={selectedRecipe.servings}
          onClose={() => setSelectedRecipe(null)}
        />
      )}

      {/* ── HERO ── */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "120px 40px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle,rgba(255,107,53,0.12) 0%,transparent 70%)",
            top: "5%",
            left: "-10%",
            animation: "orb1 8s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle,rgba(46,204,113,0.1) 0%,transparent 70%)",
            bottom: "5%",
            right: "-5%",
            animation: "orb2 10s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            maxWidth: 1200,
            width: "100%",
            display: "flex",
            gap: 80,
            alignItems: "center",
            flexWrap: "wrap",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 300,
              maxWidth: 580,
              animation: "fadeUp 0.8s ease both",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 16px",
                background: "rgba(46,204,113,0.1)",
                border: "1px solid rgba(46,204,113,0.25)",
                borderRadius: 100,
                fontSize: 13,
                color: "#2ECC71",
                marginBottom: 28,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#2ECC71",
                }}
              />
              4 jours gratuits · Puis 7,99€/mois
            </div>

            <h1
              style={{
                fontSize: "clamp(38px,5vw,64px)",
                fontWeight: 900,
                lineHeight: 1.08,
                letterSpacing: -2,
                marginBottom: 24,
                fontFamily: "Georgia, serif",
                color: v.text,
              }}
            >
              Prenez votre frigo en photo.{" "}
              <span style={gradientText}>L'IA cuisine pour vous.</span>
            </h1>

            <p
              style={{
                fontSize: 18,
                color: v.muted,
                lineHeight: 1.7,
                marginBottom: 40,
              }}
            >
              Des recettes intelligentes générées instantanément à partir des
              aliments que vous avez déjà chez vous.
            </p>

            <div
              style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                marginBottom: 48,
              }}
            >
              <button
                type="button"
                style={{
                  padding: "16px 32px",
                  background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                  border: "none",
                  borderRadius: 100,
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: "pointer",
                  boxShadow: "0 8px 32px rgba(255,107,53,0.35)",
                }}
              >
                Démarrer 4 jours gratuits
              </button>
              <button
                type="button"
                style={{
                  padding: "16px 32px",
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${v.border}`,
                  borderRadius: 100,
                  color: v.text,
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                ▶ Voir une démo
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex" }}>
                {["👩", "👨", "🧑", "👩‍🍳", "👨‍🍳"].map((e, i) => (
                  <div
                    key={i}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: `hsl(${i * 40},70%,45%)`,
                      border: "2px solid transparent",
                      marginLeft: i === 0 ? 0 : -8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                    }}
                  >
                    {e}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 14, color: v.muted }}>
                <span style={{ color: v.text, fontWeight: 700 }}>4 800+</span>{" "}
                chefs amateurs
                <div style={{ color: "#FFB800" }}>★★★★★</div>
              </div>
            </div>
          </div>

          <div
            style={{
              position: "relative",
              animation: "fadeUp 0.8s ease 0.2s both",
            }}
          >
            <IPhoneMockup />
            <div
              style={{
                position: "absolute",
                top: 80,
                right: -80,
                ...gc,
                padding: "12px 16px",
                borderRadius: 16,
                fontSize: 13,
                animation: "float 3s ease-in-out infinite",
                display: "flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 20 }}>🥦</span>
              <div>
                <div style={{ fontWeight: 700, color: v.text, fontSize: 12 }}>
                  Brocoli détecté
                </div>
                <div style={{ color: "#2ECC71", fontSize: 11 }}>
                  96% confiance
                </div>
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 100,
                left: -90,
                ...gc,
                padding: "12px 16px",
                borderRadius: 16,
                fontSize: 13,
                animation: "float 3.5s ease-in-out infinite",
                display: "flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 20 }}>🍳</span>
              <div>
                <div style={{ fontWeight: 700, color: v.text, fontSize: 12 }}>
                  Recette générée
                </div>
                <div style={{ color: COLORS.orangeStart, fontSize: 11 }}>
                  8 min
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ padding: "40px 40px 80px" }}>
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            ...gc,
            overflow: "hidden",
          }}
        >
          {[
            ["4 800+", "Utilisateurs actifs"],
            ["98%", "Précision IA"],
            ["120 000+", "Recettes générées"],
            ["2,3 kg", "Gaspillage évité/mois"],
          ].map(([n, l], i) => (
            <div
              key={i}
              style={{
                flex: 1,
                minWidth: 180,
                padding: "32px 24px",
                textAlign: "center",
                borderRight: i < 3 ? `1px solid ${v.border}` : "none",
              }}
            >
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  ...gradientText,
                  marginBottom: 4,
                }}
              >
                {n}
              </div>
              <div style={{ fontSize: 13, color: v.muted }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        style={{ padding: "80px 40px", maxWidth: 1100, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.orangeStart,
              letterSpacing: 4,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Comment ça marche
          </div>
          <h2
            style={{
              fontSize: "clamp(28px,4vw,48px)",
              fontWeight: 900,
              letterSpacing: -1,
              color: v.text,
            }}
          >
            4 étapes. Zéro prise de tête.
          </h2>
        </div>
        <div
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {[
            {
              step: "01",
              icon: "📸",
              title: "Photographiez votre frigo",
              desc: "Prenez une photo claire de vos aliments.",
            },
            {
              step: "02",
              icon: "🤖",
              title: "L'IA analyse vos aliments",
              desc: "Frigia détecte les ingrédients disponibles.",
            },
            {
              step: "03",
              icon: "🍽️",
              title: "Recettes personnalisées",
              desc: "Recevez des idées adaptées à vos goûts.",
            },
            {
              step: "04",
              icon: "✨",
              title: "Cuisinez & savourez",
              desc: "Suivez les étapes et réduisez le gaspillage.",
            },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                ...gc,
                padding: "36px 28px",
                flex: 1,
                minWidth: 220,
                maxWidth: 260,
                animation: `fadeUp 0.6s ease ${i * 0.1}s both`,
                position: "relative",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: v.muted,
                  marginBottom: 14,
                }}
              >
                {s.step}
              </div>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{s.icon}</div>
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  marginBottom: 12,
                  lineHeight: 1.3,
                  color: v.text,
                }}
              >
                {s.title}
              </h3>
              <p style={{ fontSize: 14, color: v.muted, lineHeight: 1.7 }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SCANNER ── */}
      <section
        style={{
          padding: "80px 40px",
          background: v.sectionBg,
          borderTop: `1px solid ${v.border}`,
          borderBottom: `1px solid ${v.border}`,
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#2ECC71",
                letterSpacing: 4,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Scan IA
            </div>
            <h2
              style={{
                fontSize: "clamp(28px,4vw,48px)",
                fontWeight: 900,
                letterSpacing: -1,
                color: v.text,
              }}
            >
              Votre frigo devient intelligent
            </h2>
            <p style={{ color: v.muted, fontSize: 16, marginTop: 16 }}>
              Prenez une photo de votre frigo. L'IA détecte les aliments et
              génère des recettes instantanément.
            </p>
          </div>
          <FridgeAIScanner
            theme={theme}
            onRecipesGenerated={(recipes, ingredients) => {
              setPendingData({ recipes, ingredients });
              setShowServingsModal(true);
            }}
            onRecipeClick={(r) =>
              setSelectedRecipe({ recipe: r, servings })
            }
          />
        </div>
      </section>

      {/* ── RECIPES ── */}
      <section
        style={{ padding: "80px 40px", maxWidth: 1100, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.orangeStart,
              letterSpacing: 4,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Recettes
          </div>
          <h2
            style={{
              fontSize: "clamp(28px,4vw,48px)",
              fontWeight: 900,
              letterSpacing: -1,
              color: v.text,
            }}
          >
            Suggestions générées par IA
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
            gap: 20,
          }}
        >
          {aiRecipes.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", color: v.muted }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Pas de recette générée pour le moment</div>
              <div style={{ fontSize: 13, marginTop: 8, opacity: 0.7 }}>Scannez votre frigo pour obtenir des suggestions</div>
            </div>
          ) : aiRecipes.map((r, i) => (
            <RecipeCard
              key={r.title}
              theme={theme}
              {...r}
              delay={i * 0.05}
              onClick={() => setSelectedRecipe({ recipe: r, servings })}
            />
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section
        style={{ padding: "80px 40px", maxWidth: 860, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.orangeStart,
              letterSpacing: 4,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Tarifs
          </div>
          <h2
            style={{
              fontSize: "clamp(28px,4vw,48px)",
              fontWeight: 900,
              letterSpacing: -1,
              color: v.text,
            }}
          >
            Simple et transparent
          </h2>
          <p style={{ color: v.muted, fontSize: 16, marginTop: 12 }}>
            4 jours gratuits, puis un seul plan sans surprise.
          </p>
        </div>

        {/* Single pricing card */}
        <div style={{ maxWidth: 480, margin: "0 auto", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: -16,
              left: "50%",
              transform: "translateX(-50%)",
              background: "linear-gradient(90deg,#FF6B35,#2ECC71)",
              borderRadius: 100,
              padding: "6px 24px",
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
              whiteSpace: "nowrap",
              zIndex: 1,
            }}
          >
            🎉 4 jours gratuits inclus
          </div>
          <div
            style={{
              ...gc,
              padding: "48px 40px",
              background:
                theme === "light"
                  ? "rgba(255,255,255,0.9)"
                  : "linear-gradient(135deg,rgba(255,107,53,0.1),rgba(46,204,113,0.1))",
              border: "1px solid rgba(255,107,53,0.35)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: v.muted,
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 12,
              }}
            >
              Frigia Premium
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 56, fontWeight: 900, color: v.text }}>
                7,99€
              </span>
              <span style={{ color: v.muted, fontSize: 15 }}>/mois</span>
            </div>
            <div style={{ fontSize: 14, color: v.muted, marginBottom: 8 }}>
              Prélèvement automatique — sans engagement
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#2ECC71",
                fontWeight: 700,
                marginBottom: 32,
              }}
            >
              ✓ Résiliable à tout moment depuis les paramètres
            </div>

            <div
              style={{ height: 1, background: v.border, margin: "0 0 28px" }}
            />

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 36px",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {[
                "Scans IA illimités de votre frigo",
                "Recettes personnalisées illimitées",
                "Suivi nutritionnel avancé",
                "Toutes les futures fonctionnalités incluses",
              ].map((f, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    fontSize: 15,
                    color: v.text,
                  }}
                >
                  <span style={{ color: "#2ECC71", fontWeight: 900 }}>✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: 100,
                fontWeight: 800,
                fontSize: 16,
                cursor: "pointer",
                border: "none",
                background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                color: "#fff",
              }}
            >
              Commencer 4 jours gratuits →
            </button>
            <p style={{ fontSize: 12, color: v.muted, marginTop: 14 }}>
              Aucune carte bancaire requise pendant l'essai
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section
        style={{
          padding: "80px 40px",
          background: v.sectionBg,
          borderTop: `1px solid ${v.border}`,
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: COLORS.orangeStart,
                letterSpacing: 4,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              FAQ
            </div>
            <h2
              style={{
                fontSize: "clamp(28px,4vw,44px)",
                fontWeight: 900,
                letterSpacing: -1,
                color: v.text,
              }}
            >
              Questions fréquentes
            </h2>
          </div>
          {[
            {
              q: "Comment fonctionne l'essai gratuit ?",
              a: "Vous avez accès à toutes les fonctionnalités pendant 4 jours, sans aucune carte bancaire requise. Au 5ème jour, le prélèvement automatique de 7,99€/mois démarre si vous choisissez de continuer.",
            },
            {
              q: "Comment résilier mon abonnement ?",
              a: "Vous pouvez résilier à tout moment depuis votre espace Paramètres → Abonnement. L'accès reste actif jusqu'à la fin de la période payée. Aucune pénalité, aucune complication.",
            },
            {
              q: "Comment fonctionne la détection IA ?",
              a: "Frigia analyse votre photo pour identifier les ingrédients visibles et proposer des recettes adaptées à ce que vous avez chez vous.",
            },
            {
              q: "Mes données sont-elles sécurisées ?",
              a: "Oui. Vos photos sont analysées puis supprimées automatiquement. Nous ne conservons aucune image de votre frigo sur nos serveurs.",
            },
            {
              q: "Puis-je modifier mes informations personnelles ?",
              a: "Oui, depuis Paramètres → Profil, vous pouvez modifier votre nom, email, téléphone et photo de profil à tout moment.",
            },
          ].map((f) => (
            <FAQItem key={f.q} theme={theme} {...f} />
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        style={{
          padding: "100px 40px",
          textAlign: "center",
          position: "relative",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(32px,5vw,60px)",
            fontWeight: 900,
            letterSpacing: -2,
            marginBottom: 20,
            color: v.text,
          }}
        >
          Votre frigo cache des{" "}
          <span style={gradientText}>recettes extraordinaires</span>
        </h2>
        <p style={{ color: v.muted, fontSize: 18, marginBottom: 40 }}>
          4 jours gratuits · Puis 7,99€/mois · Résiliable à tout moment.
        </p>
        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            style={{
              padding: "18px 40px",
              background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
              border: "none",
              borderRadius: 100,
              color: "#fff",
              fontWeight: 800,
              fontSize: 17,
              cursor: "pointer",
              boxShadow: "0 12px 40px rgba(255,107,53,0.4)",
            }}
          >
            Démarrer gratuitement
          </button>
          <button
            type="button"
            style={{
              padding: "18px 40px",
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${v.border}`,
              borderRadius: 100,
              color: v.text,
              fontWeight: 700,
              fontSize: 17,
              cursor: "pointer",
            }}
          >
            Télécharger l'app
          </button>
        </div>
        <p style={{ color: v.muted, fontSize: 13, marginTop: 20 }}>
          ✓ 4 jours gratuits · ✓ Sans engagement · ✓ Résiliable en un clic
        </p>
      </section>

      {/* ── FOOTER ── */}
      <footer
        style={{
          borderTop: `1px solid ${v.border}`,
          padding: "60px 40px 30px",
          background: "rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              gap: 48,
              flexWrap: "wrap",
              marginBottom: 48,
            }}
          >
            <div style={{ flex: 2, minWidth: 220 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <img src="/logo.png" alt="Frigia" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} />
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 22,
                    color: v.text,
                    fontFamily: "Georgia, serif",
                  }}
                >
                  Frigia
                </span>
              </div>
              <p
                style={{
                  color: v.muted,
                  fontSize: 14,
                  lineHeight: 1.7,
                  maxWidth: 280,
                }}
              >
                Votre Chef IA personnel. 4 jours gratuits, puis 7,99€/mois.
              </p>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: v.text, marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>
                Légal
              </div>
              {[
                { label: "Mentions légales", page: "mentions" as LegalPage },
                { label: "CGU", page: "cgu" as LegalPage },
                { label: "Politique de confidentialité", page: "privacy" as LegalPage },
                { label: "Cookies", page: "cookies" as LegalPage },
                { label: "RGPD", page: "rgpd" as LegalPage },
              ].map((l) => (
                <div key={l.label} style={{ marginBottom: 10 }}>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); setShowLegal(l.page); }}
                    style={{ color: v.muted, fontSize: 14, textDecoration: "none" }}
                  >
                    {l.label}
                  </a>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              borderTop: `1px solid ${v.border}`,
              paddingTop: 24,
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <span style={{ color: v.muted, fontSize: 13 }}>
              © 2026 Frigia. Tous droits réservés.
            </span>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <button
                onClick={() => setShowSettings(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: v.muted,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                ⚙️ Paramètres
              </button>
              <span style={{ color: v.muted, fontSize: 13 }}>Français</span>
              <span style={{ color: v.muted, fontSize: 13 }}>
                RGPD compliant
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
