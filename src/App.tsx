import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { DetectedIngredient, GeneratedRecipe, HistoryEntry, Prefs, User } from "./lib/types";
import { buildShareText, fetchTheMealImage, ingredientIcon, mealImageCache, recipeIcon } from "./lib/recipes";
import { analyzeFridge } from "./lib/scan";
import { createCheckoutUrl, customerPortalUrl, hasAccess, subscriptionStatus } from "./lib/billing";
import { accessToken, postApi } from "./lib/api";
import {
  changePassword, clearLocalData, deleteAccount as deleteAccountRequest, displayName, getAvatar, getPrefs,
  isOAuthUser as isOAuthAccount, markOnboarded, needsQuestionnaire, setAvatar, setPrefs, signOut, updateProfile,
} from "./lib/account";
import { useLibrary } from "./hooks/useLibrary";
import { useSession } from "./hooks/useSession";
import { isStandalone, type InstallPromptEvent } from "./landing/browser";
import { Analytics } from "@vercel/analytics/react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { AppFrame } from "./app/AppFrame";
import { Home } from "./app/Home";
import { Courses, Planning } from "./app/Lists";
import { Family } from "./app/Family";
import { LegacyPage } from "./app/LegacyPage";
import { useBack } from "./app/nav";
import { showToast } from "./app/toast";
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
  

function glassCard(theme: Theme): React.CSSProperties {
  const v = getThemeVars(theme);
  return {
    background: v.bgCard,
    backdropFilter: "blur(20px)",
    border: `1px solid ${v.border}`,
    borderRadius: "24px",
  };
}


// ─── Animations ──────────────────────────────────────────────────────────────
function GlobalStyles({ theme, keyframesOnly }: { theme: Theme; keyframesOnly?: boolean }) {
  const v = getThemeVars(theme);
  const keyframes = `
      @keyframes scanDown { 0%{top:10%;opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{top:90%;opacity:0} }
      @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
      @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
      @keyframes slideIn { from{transform:translateX(-20px);opacity:0} to{transform:translateX(0);opacity:1} }
      @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,20px) scale(1.08)} }
      @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-35px,-25px) scale(1.1)} }
      @keyframes modalIn { from{opacity:0;transform:translateY(40px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      @keyframes imgFadeIn { from{opacity:0;transform:scale(1.04)} to{opacity:1;transform:scale(1)} }`;
  // Sur les nouveaux écrans (fenêtre par-dessus), seules les animations servent : le reste changerait la barre d'onglets
  if (keyframesOnly) return <style>{keyframes}</style>;
  return (
    <style>{keyframes + `
      body { margin:0; background:${v.bg}; transition: background 0.3s; }
      * { box-sizing:border-box; user-select:none; -webkit-user-select:none; }
      input, textarea, [contenteditable] { user-select:text; -webkit-user-select:text; }
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
    const timeout = setTimeout(() => { if (!cancelled) setErrored(true); }, 8000);
    fetchTheMealImage(query).then((url) => {
      if (cancelled) return;
      clearTimeout(timeout);
      if (url) { mealImageCache[query] = url; setSrc(url); }
      else setErrored(true);
    });
    return () => { cancelled = true; clearTimeout(timeout); };
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
  | "notifications"
  | "security"
  | "support";

function SettingsModal({
  theme,
  onClose,
  user,
  avatarSrc,
  onAvatarChange,
}: {
  theme: Theme;
  onClose: () => void;
  user: User | null;
  avatarSrc: string | null;
  onAvatarChange: (dataUrl: string) => void;
}) {
  const v = getThemeVars(theme);
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const isOAuthUser = isOAuthAccount(user);

  // Profile state — initialized from Supabase user data
  const [profile, setProfile] = useState({
    name: displayName(user),
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
    const json = await customerPortalUrl();
    if (json.url) window.location.href = json.url;
    setPortalLoading(false);
  };

  const deleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteMsg("");
    try {
      await deleteAccountRequest();
      // On efface les données du téléphone avant de déconnecter
      clearLocalData();
      await signOut();
      onClose();
    } catch (err) {
      setDeleteMsg((err as Error).message || "Une erreur est survenue.");
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
    { id: "support", icon: "💬", label: "FAQ" },
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
    if (user?.id) setAvatar(user.id, croppedDataUrl);
    onAvatarChange(croppedDataUrl);
    setCropImageSrc(null);
  };

  const saveProfile = async () => {
    setProfileLoading(true);
    setProfileMsg("");
    const { error, emailChanged } = await updateProfile(user, profile);
    setProfileLoading(false);
    if (error) {
      setProfileMsg("Erreur : " + error.message);
      return;
    }
    if (emailChanged) {
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
    const result = await changePassword(user, passwords.current, passwords.next);
    if (result === "wrong-current") {
      setPwMsg("Mot de passe actuel incorrect.");
      setPwLoading(false);
      return;
    }
    setPwLoading(false);
    if (result !== "ok") {
      setPwMsg("Erreur : " + result.error);
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
            const appMeta = user?.app_metadata || {};
            const status = appMeta.subscription_status;
            const isWhitelisted = appMeta.is_whitelisted;
            const created = user ? new Date(user.created_at) : new Date();
            const TRIAL_MS = 4 * 24 * 60 * 60 * 1000;
            const trialEndMs = created.getTime() + TRIAL_MS;
            const msLeft = Math.max(0, trialEndMs - now);
            const trialDaysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
            const trialPct = Math.max(0, Math.min(100, (msLeft / TRIAL_MS) * 100));
            const isTrialing = status === "trialing" || (!status && msLeft > 0);
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
                      <div style={{ fontSize: 24, fontWeight: 900, color: v.text }}>Frigia Premium — 4,99€/mois</div>
                      <div style={{ color: v.muted, fontSize: 14, marginTop: 6 }}>Renouvellement automatique chaque mois.</div>
                    </>
                  ) : isTrialing ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#FF6B35", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Essai gratuit</div>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 24, fontWeight: 900, color: v.text }}>4 jours gratuits</div>
                          <div style={{ color: v.muted, fontSize: 14, marginTop: 6 }}>Puis <strong style={{ color: v.text }}>4,99€/mois</strong></div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 36, fontWeight: 900, color: "#2ECC71" }}>{trialDaysLeft}j</div>
                          <div style={{ fontSize: 12, color: v.muted }}>restants</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 16, height: 8, borderRadius: 100, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${trialPct}%`, background: "linear-gradient(90deg,#2ECC71,#FF6B35)", borderRadius: 100, transition: "width 1s ease" }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#FF5050", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Aucun abonnement</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: v.text, marginBottom: 16 }}>Accédez à Frigia Premium</div>
                      <button onClick={() => { onClose(); }} style={{ padding: "12px 24px", borderRadius: 100, border: "none", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                        S'abonner pour 4,99€/mois
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
          {tab === "support" && (
            <div style={{ animation: "fadeUp 0.3s ease both" }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: v.text, marginBottom: 8 }}>FAQ</h2>
              <p style={{ color: v.muted, fontSize: 14, marginBottom: 24 }}>Retrouvez les réponses aux questions fréquentes.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {SUPPORT_FAQS.map((faq, i) => (
                  <SupportFAQItem key={i} theme={theme} q={faq.q} a={faq.a} />
                ))}
              </div>
            </div>
          )}

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
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  const grad = "linear-gradient(135deg,#FF6B35,#2ECC71)";
  const features = [
    "Scans IA illimités",
    "Recettes personnalisées illimitées",
    "Suivi nutritionnel avancé",
    "Toutes futures fonctionnalités incluses",
  ];
  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"#07070E", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{`html,body{margin:0;background:#07070E;}`}</style>

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
            <span style={{ fontSize:64, fontWeight:900, color:"#FAFAFA", lineHeight:1 }}>4,99€</span>
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

// ─── InstallRecoScreen ────────────────────────────────────────────────────────
function detectBrowserType(): "ios-safari" | "ios-chrome" | "chrome-android" | "other" {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  if (isIos && /crios/i.test(ua)) return "ios-chrome";
  if (isIos) return "ios-safari";
  if (/android/i.test(ua) && /chrome/i.test(ua)) return "chrome-android";
  return "other";
}

function InstallRecoScreen({ onContinue }: { onContinue: () => void }) {
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallPrompt(e as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const browser = detectBrowserType();
  const stepsMap = {
    "ios-safari": [
      { num: 1, text: "Appuyez sur le bouton", strong: "Partager", sub: "l'icône □↑ en bas de Safari" },
      { num: 2, text: "Faites défiler et appuyez sur", strong: "Sur l'écran d'accueil", sub: "" },
      { num: 3, text: "Appuyez sur", strong: "Ajouter", sub: "en haut à droite — c'est tout !" },
    ],
    "ios-chrome": [
      { num: 1, text: "Appuyez sur", strong: "le bouton Partager", sub: "icône □↑ en haut à droite" },
      { num: 2, text: "Appuyez sur", strong: "Sur l'écran d'accueil", sub: "dans la liste" },
      { num: 3, text: "Appuyez sur", strong: "Ajouter", sub: "c'est tout !" },
    ],
    "chrome-android": [
      { num: 1, text: "Appuyez sur", strong: "⋮", sub: "les 3 points en haut à droite" },
      { num: 2, text: "Appuyez sur", strong: "Ajouter à l'écran d'accueil", sub: "" },
      { num: 3, text: "Confirmez en appuyant sur", strong: "Ajouter", sub: "c'est tout !" },
    ],
    "other": [
      { num: 1, text: "Ouvrez le", strong: "menu de votre navigateur", sub: "bouton ⋮ ou ···" },
      { num: 2, text: "Cherchez", strong: "Ajouter à l'écran d'accueil", sub: "ou \"Installer l'application\"" },
      { num: 3, text: "Confirmez en appuyant sur", strong: "Ajouter", sub: "c'est tout !" },
    ],
  };
  const steps = stepsMap[browser];
  const showArrow = browser === "ios-safari" || browser === "ios-chrome";
  const arrowPos = browser === "ios-safari" ? "bottom" : "top";

  const handleInstall = async () => {
    if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "#0A0A0F", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`html,body{margin:0;background:#0A0A0F;}`}</style>
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,107,53,.12) 0%,transparent 70%)", top: "-10%", right: "-10%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle,rgba(46,204,113,.09) 0%,transparent 70%)", bottom: "5%", left: "-8%", pointerEvents: "none" }} />

      {showArrow && arrowPos === "bottom" && (
        <div style={{ position: "absolute", bottom: 12, right: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, zIndex: 10, pointerEvents: "none" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#FF6B35", letterSpacing: 0.5 }}>Appuyez ici</span>
          <span style={{ fontSize: 36, color: "#FF6B35", lineHeight: 1, animation: "pulse 1.5s ease infinite" }}>↓</span>
        </div>
      )}
      {showArrow && arrowPos === "top" && (
        <div style={{ position: "absolute", top: 12, right: 24, display: "flex", flexDirection: "column-reverse", alignItems: "center", gap: 4, zIndex: 10, pointerEvents: "none" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#FF6B35", letterSpacing: 0.5 }}>Appuyez ici</span>
          <span style={{ fontSize: 36, color: "#FF6B35", lineHeight: 1, animation: "pulse 1.5s ease infinite" }}>↑</span>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "calc(52px + env(safe-area-inset-top)) 28px 24px", display: "flex", flexDirection: "column", gap: 28, position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#FF6B35", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Recommandé</div>
          <h2 style={{ fontSize: "clamp(26px,7vw,38px)", fontWeight: 900, color: "#FAFAFA", lineHeight: 1.12, letterSpacing: -1.2, marginBottom: 12 }}>
            Pour une meilleure<br />expérience, installez l'app
          </h2>
          <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
            L'app installée démarre plus vite, fonctionne mieux et s'intègre à votre téléphone comme une vraie application.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {steps.map((step) => (
            <div key={step.num} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px", borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#fff", flexShrink: 0 }}>{step.num}</div>
              <div>
                <div style={{ fontSize: 14, color: "#FAFAFA" }}>{step.text} <strong style={{ color: "#FF6B35" }}>{step.strong}</strong></div>
                {step.sub && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{step.sub}</div>}
              </div>
            </div>
          ))}
        </div>

        {installPrompt && (
          <button onClick={handleInstall} style={{ width: "100%", padding: "17px", borderRadius: 100, border: "none", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", color: "#fff", fontWeight: 800, fontSize: 17, cursor: "pointer", boxShadow: "0 10px 32px rgba(255,107,53,0.28)" }}>
            Télécharger l'app
          </button>
        )}
      </div>

      <div style={{ padding: "12px 28px calc(24px + env(safe-area-inset-bottom))", position: "relative", zIndex: 1, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={onContinue} style={{ background: "none", border: "none", color: "#6B7280", fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>
          Continuer dans le navigateur
        </button>
      </div>
    </div>
  );
}

// ─── QuestionnaireScreen ─────────────────────────────────────────────────────
const Q_GRAD = "linear-gradient(135deg,#FF6B35,#2ECC71)";
const Q_C = { bg:"#0A0A0F", text:"#FAFAFA", muted:"#6B7280", orange:"#FF6B35" };

function QuestionnaireScreen({ onComplete }: { onComplete: (prefs: Prefs) => void }) {
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
    else onComplete({ goal, diet, time, equipment });
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
          overflowX: "hidden",
          overflowY: "auto",
          maxHeight: "92vh",
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

// ─── Showcase Recipes ────────────────────────────────────────────────────────

// ─── SupportFAQItem (used in Settings) ───────────────────────────────────────
function SupportFAQItem({ theme, q, a }: { theme: Theme; q: string; a: string }) {
  const v = getThemeVars(theme);
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(!open)} style={{ borderRadius: 14, border: `1px solid ${open ? "rgba(255,107,53,0.3)" : v.border}`, overflow: "hidden", cursor: "pointer", background: open ? "rgba(255,107,53,0.05)" : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: v.text, flex: 1, paddingRight: 12 }}>{q}</span>
        <span style={{ color: "#FF6B35", fontSize: 18, transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>+</span>
      </div>
      {open && <div style={{ padding: "0 16px 14px", fontSize: 13, color: v.muted, lineHeight: 1.6 }}>{a}</div>}
    </div>
  );
}

// ─── SupportModal ─────────────────────────────────────────────────────────────
const SUPPORT_FAQS = [
  { q: "Comment fonctionne l'essai gratuit ?", a: "Vous avez accès à toutes les fonctionnalités pendant 4 jours. Au 5ème jour, le prélèvement de 4,99€/mois démarre automatiquement." },
  { q: "Comment résilier ?", a: "Depuis Paramètres → Abonnement → Gérer la facturation. L'accès reste actif jusqu'à la fin de la période payée. Aucune pénalité." },
  { q: "Comment fonctionne la détection IA ?", a: "Frigia analyse votre photo pour identifier les ingrédients visibles et génère 3 recettes adaptées à ce que vous avez chez vous." },
  { q: "Mes photos sont-elles conservées ?", a: "Non. Vos photos sont analysées puis supprimées immédiatement. Aucune image n'est stockée sur nos serveurs." },
  { q: "La recette ne correspond pas à mes ingrédients ?", a: "Essayez de prendre la photo dans un endroit bien éclairé, avec le frigo bien ouvert. Plus la photo est nette, meilleure est la détection." },
  { q: "Comment changer mon email ou mot de passe ?", a: "Depuis Paramètres → Profil → Sécurité, vous pouvez modifier vos informations de connexion." },
  { q: "Mon paiement a échoué, que faire ?", a: "Mettez à jour votre carte depuis Paramètres → Abonnement → Gérer la facturation. L'accès sera rétabli dès que le paiement est accepté." },
];

// ─── MealTypeModal ────────────────────────────────────────────────────────────
function MealTypeModal({ theme, onConfirm, onClose }: { theme: Theme; onConfirm: (type: string) => void; onClose: () => void }) {
  const v = getThemeVars(theme);
  const [selected, setSelected] = useState("mix");
  const options = [
    { id: "protein", label: "Protéiné", sub: "3 recettes riches en protéines" },
    { id: "healthy", label: "Healthy", sub: "3 recettes légères et équilibrées" },
    { id: "gourmand", label: "Gourmand", sub: "3 recettes généreuses et savoureuses" },
    { id: "mix", label: "Une de chaque", sub: "1 protéinée, 1 healthy, 1 gourmande" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ ...glassCard(theme), padding: 32, maxWidth: 400, width: "100%", animation: "modalIn 0.35s ease both", background: theme === "light" ? "rgba(244,244,240,0.97)" : "rgba(14,14,20,0.97)" }}>
        <h3 style={{ fontSize: 20, fontWeight: 900, color: v.text, marginBottom: 6, textAlign: "center" }}>Quel type de plat ?</h3>
        <p style={{ fontSize: 13, color: v.muted, textAlign: "center", marginBottom: 24 }}>L'IA adaptera les 3 recettes à ton choix.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {options.map(opt => (
            <button key={opt.id} onClick={() => setSelected(opt.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, border: selected === opt.id ? "2px solid #FF6B35" : `1px solid ${v.border}`, background: selected === opt.id ? "rgba(255,107,53,0.1)" : v.inputBg, cursor: "pointer", textAlign: "left" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: v.text }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: v.muted, marginTop: 2 }}>{opt.sub}</div>
              </div>
              {selected === opt.id && <span style={{ marginLeft: "auto", color: "#FF6B35", fontWeight: 900, fontSize: 16 }}>✓</span>}
            </button>
          ))}
        </div>
        <button onClick={() => onConfirm(selected)} style={{ width: "100%", padding: "14px", borderRadius: 100, border: "none", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", marginBottom: 10 }}>
          Choisir une photo →
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: "10px", background: "none", border: "none", color: v.muted, fontSize: 13, cursor: "pointer" }}>Annuler</button>
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
  const [showMealTypeModal, setShowMealTypeModal] = useState(false);
  const mealTypeRef = useRef<string>("mix");

  const handleScanClick = () => { if (!analyzing) setShowMealTypeModal(true); };

  const handleImage = (file?: File) => {
    if (!file) return;
    setShowMealTypeModal(false);
    const url = URL.createObjectURL(file);
    setImage(url);
    setIngredients([]);
    setRecipes([]);
    setError("");
    setAnalyzing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const result = await analyzeFridge(file, mealTypeRef.current);
        if (result.status !== "ok") return;
        setIngredients(result.ingredients);
        setRecipes(result.recipes);
        setAnalyzing(false);
        onRecipesGenerated(result.recipes, result.ingredients);
      } catch {
        setError("unclear_photo");
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
    {showMealTypeModal && (
      <MealTypeModal
        theme={theme}
        onConfirm={(type) => { mealTypeRef.current = type; setShowMealTypeModal(false); setTimeout(() => inputRef.current?.click(), 150); }}
        onClose={() => setShowMealTypeModal(false)}
      />
    )}
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
          onClick={handleScanClick}
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
                onClick={(e) => { e.stopPropagation(); handleScanClick(); }}
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
    </>
  );
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
function CanceledScreen() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        if (await accessToken()) await postApi("/api/delete-account");
        clearLocalData();
      } catch { /* on affiche quand même l'écran de fin */ }
      setDone(true);
    };
    run();
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "#07070E", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, flexDirection: "column", textAlign: "center" }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>👋</div>
      <h2 style={{ fontSize: 26, fontWeight: 900, color: "#F0EEF8", marginBottom: 12, fontFamily: "Georgia,serif" }}>Merci d'avoir utilisé Frigia</h2>
      <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.7, marginBottom: 40, maxWidth: 320 }}>
        Ton abonnement a été résilié et ton compte supprimé.<br />On espère te revoir bientôt !
      </p>
      <button
        onClick={async () => { await signOut(); }}
        disabled={!done}
        style={{ width: "100%", maxWidth: 340, padding: "16px", borderRadius: 100, border: "none", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: done ? "pointer" : "not-allowed", opacity: done ? 1 : 0.5 }}
      >
        {done ? "Retour à l'accueil →" : "Suppression en cours…"}
      </button>
    </div>
  );
}

function PaywallModal({ onSubscribe, onManageBilling, onLogout, loading, isCanceled, isPaymentFailed }: { onSubscribe: () => void; onManageBilling: () => void; onLogout: () => void; loading: boolean; isCanceled?: boolean; isPaymentFailed?: boolean }) {
  const grad = "linear-gradient(135deg,#FF6B35,#2ECC71)";
  const title = isPaymentFailed ? "Paiement échoué" : isCanceled ? "Réactiver votre abonnement" : "Commencer votre essai gratuit";
  const description = isPaymentFailed ? (
    <>Le prélèvement de <strong style={{ color:"#F0EEF8" }}>4,99€</strong> a échoué.<br />Mettez à jour votre carte pour retrouver l'accès.</>
  ) : isCanceled ? (
    <>Votre abonnement a été résilié.<br /><strong style={{ color:"#F0EEF8" }}>4,99€/mois</strong>, annulable à tout moment.</>
  ) : (
    <><strong style={{ color:"#F0EEF8" }}>4 jours gratuits</strong>, puis 4,99€/mois.<br />Votre carte ne sera pas débitée avant la fin de l'essai. Annulable à tout moment.</>
  );
  const btnLabel = loading ? "Redirection..." : isPaymentFailed ? "Mettre à jour ma carte →" : isCanceled ? "Se réabonner — 4,99€/mois →" : "Démarrer 4 jours gratuits →";
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
/** Ancienne liste des favoris (onglet Recettes), gardée telle quelle jusqu'à l'étape 7. */
function LegacyFavorites({ theme, favorites, onOpen, onToggleFavorite }: {
  theme: Theme; favorites: GeneratedRecipe[]; onOpen: (r: GeneratedRecipe) => void; onToggleFavorite: (r: GeneratedRecipe) => void;
}) {
  const v = getThemeVars(theme);
  if (favorites.length === 0) return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🤍</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: v.text, marginBottom: 8 }}>Aucun favori pour l'instant</div>
      <div style={{ fontSize: 13, color: v.muted }}>Appuyez sur ❤️ sur une recette pour la sauvegarder ici.</div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {favorites.map((r) => (
        <div key={r.title} style={{ ...glassCard(theme), padding: 0, overflow: "hidden", borderRadius: 16, cursor: "pointer" }} onClick={() => onOpen(r)}>
          <div style={{ position: "relative", height: 130 }}>
            <RecipeImage title={r.title} imageSearch={r.imageSearch} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.6) 100%)" }} />
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(r); }}
              style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,107,53,0.9)", border: "none", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}
            >❤️</button>
          </div>
          <div style={{ padding: "12px 14px 8px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: v.text, marginBottom: 4 }}>{r.title}</div>
            <div style={{ fontSize: 12, color: v.muted, marginBottom: 10 }}>{r.time} · {r.cal} kcal · {r.diff}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={(e) => { e.stopPropagation(); onOpen(r); }}
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
  );
}

export default function Frigia() {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  // Le thème sombre part avec l'ancien écran : les anciens écrans encore utilisés s'affichent en clair
  const theme: Theme = "light";
  const navigate = useNavigate();
  const location = useLocation();
  const back = useBack();
  const [servings, setServings] = useState(2);
  const [showServingsModal, setShowServingsModal] = useState(false);
  const [pendingData, setPendingData] = useState<{ recipes: GeneratedRecipe[]; ingredients: DetectedIngredient[] } | null>(null);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [showInstallReco, setShowInstallReco] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showCheckoutSuccess, setShowCheckoutSuccess] = useState(() =>
    new URLSearchParams(window.location.search).get("checkout") === "success"
  );

  const [userId, setUserId] = useState<string | undefined>();
  const library = useLibrary(userId);
  const { history, favorites, toggleFavorite, isFavorite, deleteScan } = library;

  const user = useSession({
    onSignedIn: (u, _source, isCheckoutReturn) => {
      setUserId(u.id);
      void library.load(u.id);
      setAvatarSrc(getAvatar(u.id));
      if (needsQuestionnaire(u, isCheckoutReturn)) setShowQuestionnaire(true);
    },
    onSignedOut: () => {
      setUserId(undefined);
      navigate("/", { replace: true });
      library.clear();
      setAvatarSrc(null);
    },
  });

  // Connecté : la copie pré-rendue de la landing (index.html) n'a plus lieu d'être, et l'appli garde
  // son zoom bloqué comme avant (le site public, lui, laisse zoomer pour l'accessibilité)
  useEffect(() => {
    if (!user) return;
    document.getElementById("prerender")?.remove();
    document.querySelector('meta[name="viewport"]')?.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover");
  }, [user]);

  /** Ouvre une page Stripe (paiement ou portail), avec le message d'erreur de l'ancienne appli. */
  const goToStripe = async (getUrl: () => Promise<{ url?: string; error?: string }>, fallback: string) => {
    if (!user) return;
    setCheckoutLoading(true);
    try {
      const json = await getUrl();
      if (json.url) window.location.href = json.url;
      else {
        setCheckoutLoading(false);
        alert(json.error || fallback);
      }
    } catch {
      setCheckoutLoading(false);
      alert("Erreur de connexion. Vérifiez votre réseau et réessayez.");
    }
  };
  const openCustomerPortal = () => goToStripe(customerPortalUrl, "Impossible d'ouvrir le portail. Réessayez.");
  const startCheckout = () => goToStripe(createCheckoutUrl, "Impossible d'ouvrir le paiement. Réessayez.");

  /** Fin du scan : le scan rejoint l'historique, qu'on ouvre (comme l'ancien onglet Recettes). */
  const finishScan = (newEntry: HistoryEntry) => {
    library.addScan(newEntry);
    setPendingData(null);
    setShowServingsModal(false);
    navigate("/scans", { replace: true });
    showToast("Scan terminé !");
  };

  const confirmServings = (n: number) => {
    setServings(n);
    if (pendingData) {
      finishScan({ id: Date.now().toString(), date: new Date(), ingredients: pendingData.ingredients, recipes: pendingData.recipes, servings: n });
    } else {
      setShowServingsModal(false);
    }
  };

  const skipServings = () => {
    if (pendingData) {
      finishScan({ id: Date.now().toString(), date: new Date(), ingredients: pendingData.ingredients, recipes: pendingData.recipes, servings });
    } else {
      setShowServingsModal(false);
    }
  };

if (!user) {
  return <><Analytics /><Suspense fallback={null}><Landing /></Suspense></>;
}

if (showQuestionnaire) {
  return <QuestionnaireScreen onComplete={(prefs) => {
    setPrefs(user.id, prefs);
    setShowQuestionnaire(false);
    if (!isStandalone()) { setShowInstallReco(true); } else { setShowOnboarding(true); }
  }} />;
}

if (showInstallReco) {
  return <InstallRecoScreen onContinue={() => { setShowInstallReco(false); setShowOnboarding(true); }} />;
}

if (showOnboarding) {
  return (
    <OnboardingScreen
      loading={checkoutLoading}
      onContinue={() => {
        markOnboarded(user.id);
        setShowOnboarding(false);
        startCheckout();
      }}
    />
  );
}

const status = subscriptionStatus(user);

if (status === "canceled") {
  return <CanceledScreen />;
}

if (!hasAccess(user)) {
  return <PaywallModal
    onSubscribe={startCheckout}
    onManageBilling={openCustomerPortal}
    loading={checkoutLoading}
    onLogout={async () => { await signOut(); }}
    isCanceled={false}
    isPaymentFailed={status === "past_due"}
  />;
}

// ─── NOUVELLE APPLI (prototype V3) ───────────────────────────────────────────
// Les écrans pas encore refaits (scan, tes scans, tes favoris, réglages, fiche recette) restent les anciens,
// en clair, le temps des étapes 6 à 8.
const isPlus = hasAccess(user);
const recipeState = location.state as { recipe?: GeneratedRecipe; servings?: number } | null;
const openRecipe = (recipe: GeneratedRecipe, s = servings) => navigate(location.pathname, { state: { recipe, servings: s } });

return (
  <AppFrame>
    <Routes>
      <Route path="/" element={<Home user={user} isPlus={isPlus} avatar={avatarSrc} history={history} favorites={favorites} onOpenRecipe={r => openRecipe(r)} />} />
      <Route path="/planning" element={<Planning isPlus={isPlus} lastScan={history[0]?.date} />} />
      <Route path="/courses" element={<Courses isPlus={isPlus} />} />
      <Route path="/famille" element={<Family user={user} isPlus={isPlus} avatar={avatarSrc} prefs={getPrefs(user.id)} onManageSubscription={openCustomerPortal} />} />
      <Route path="/scan" element={
        <LegacyPage title={<>Scanner mon <em>frigo</em></>}>
          <GlobalStyles theme={theme} />
          <FridgeAIScanner
            theme={theme}
            onRecipesGenerated={(recipes, ingredients) => { setPendingData({ recipes, ingredients }); setShowServingsModal(true); }}
            onRecipeClick={(r) => openRecipe(r)}
          />
        </LegacyPage>
      } />
      <Route path="/scans" element={
        <LegacyPage title={<>Tes <em>scans</em></>}>
          <GlobalStyles theme={theme} />
          <HistoryTab theme={theme} history={history} onDeleteScan={deleteScan} onRecipeClick={(r, s) => openRecipe(r, s)} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
        </LegacyPage>
      } />
      <Route path="/favoris" element={
        <LegacyPage title={<>Tes <em>favoris</em></>}>
          <GlobalStyles theme={theme} />
          <LegacyFavorites theme={theme} favorites={favorites} onOpen={r => openRecipe(r)} onToggleFavorite={toggleFavorite} />
        </LegacyPage>
      } />
      <Route path="/reglages" element={<>
        <GlobalStyles theme={theme} />
        <SettingsModal theme={theme} onClose={back} user={user} avatarSrc={avatarSrc} onAvatarChange={setAvatarSrc} />
      </>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {recipeState?.recipe && <>
      <GlobalStyles theme={theme} keyframesOnly />
      <RecipeDetailModal theme={theme} recipe={recipeState.recipe} servings={recipeState.servings ?? servings} onClose={back} />
    </>}
    {showServingsModal && <><GlobalStyles theme={theme} keyframesOnly /><ServingsModal theme={theme} onConfirm={confirmServings} onSkip={skipServings} /></>}
    {showCheckoutSuccess && <CheckoutSuccessModal onClose={() => { setShowCheckoutSuccess(false); navigate("/", { replace: true }); }} />}
  </AppFrame>
);
}
