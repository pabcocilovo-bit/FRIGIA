import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { GeneratedRecipe, HistoryEntry, User } from "./lib/types";
import { buildShareText, fetchTheMealImage, mealImageCache, recipeIcon } from "./lib/recipes";
import { customerPortalUrl, fetchScanQuota, quotaText, getCachedQuota, isPlus as hasPlus, paymentFailed, quotaTotal, scansLeft, setCachedQuota, type ScanQuota } from "./lib/billing";
import {
  changePassword, clearLocalData, deleteAccount as deleteAccountRequest, displayName, getAvatar, getPrefs,
  isOAuthUser as isOAuthAccount, setAvatar, signOut, updateProfile,
} from "./lib/account";
import { useLibrary } from "./hooks/useLibrary";
import { useSession } from "./hooks/useSession";
import { isStandalone } from "./landing/browser";
import { Analytics } from "@vercel/analytics/react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { AppFrame } from "./app/AppFrame";
import { Home } from "./app/Home";
import { Courses, Planning } from "./app/Lists";
import { Family } from "./app/Family";
import { LegacyPage } from "./app/LegacyPage";
import { useBack } from "./app/nav";
import { showToast } from "./app/toast";
import {
  EMPTY_PROFILE, clearPendingProfile, fetchProfile, hasPendingProfile, fromOldPrefs, getCachedProfile, saveProfile, takePendingProfile, type Profile,
} from "./lib/profile";
import { Camera, EmailSignup, Forgot, Login, QDiet, QGoal, QTime, Ready, Signup, VerifyEmail, Welcome } from "./app/onboarding/Onboarding";
import { takeOAuthIntent } from "./app/onboarding/oauth";
import { resetAnswers } from "./app/onboarding/answers";
import { firstName } from "./app/format";
import { Cancel, HelloSheet, Paywall, PayReturn, PlusWelcome } from "./app/plus/Plus";
import { useOpenScan } from "./app/offline";
import { ScanCamera } from "./app/scan/ScanCamera";
import { Crop } from "./app/scan/Crop";
import { ScanFail } from "./app/scan/ScanFail";
import { AddIngredient } from "./app/scan/AddIngredient";
import { Ingredients } from "./app/scan/Ingredients";
import { Prep } from "./app/scan/Prep";
import { Results } from "./app/scan/Results";
import { Recipe, type RecipeState } from "./app/scan/Recipe";
import { guideState } from "./app/scan/guideSteps";

// Écrans de l'inscription et de la connexion (étape 4). Connecté, seuls les questions, la caméra
// et le mot de passe oublié (le code connecte avant le nouveau mot de passe) restent ouverts.
const OB_PATHS = ["/bienvenue", "/questions/1", "/questions/2", "/questions/3", "/pret", "/compte", "/compte/email", "/compte/code", "/connexion", "/mot-de-passe", "/camera"];
const OB_SIGNED_IN = ["/questions/1", "/questions/2", "/questions/3", "/mot-de-passe", "/camera"];

/** Prénom donné à Google (ou à l'inscription), pour le profil. */
const metaFirstName = (u: User): string | null =>
  u.user_metadata?.given_name || (displayName(u).trim().split(/\s+/)[0] || null);
const Landing = lazy(() => import("./Landing"));

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
    try {
      const json = await customerPortalUrl();
      if (json.url) window.location.href = json.url;
    } catch (e) { showToast((e as Error).message); }
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
                <a href="mailto:contact@frigia.fr" style={{ display: "inline-block", padding: "10px 20px", borderRadius: 100, background: v.inputBg, border: `1px solid ${v.border}`, color: v.text, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                  contact@frigia.fr
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
  const openScan = useOpenScan();
  // Goûts du compte (table profiles). missing : pas encore de goûts, on pose les 3 questions.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const profileFor = useRef<string | null>(null);
  // Compte tout neuf : on passe par l'accès à la caméra avant l'accueil
  const [goCamera, setGoCamera] = useState(false);
  // Scans gratuits utilisés (formule Gratuit), comptés par le serveur
  const [quota, setQuota] = useState<ScanQuota | null>(null);

  const [userId, setUserId] = useState<string | undefined>();
  const library = useLibrary(userId);
  const { history, favorites, toggleFavorite, isFavorite, deleteScan, updateScanRecipes } = library;

  /** Charge les goûts du compte, une fois par connexion. Juste après l'inscription, les réponses aux questions deviennent le profil. */
  const loadProfile = async (u: User) => {
    if (profileFor.current === u.id) return;
    profileFor.current = u.id;
    const cached = getCachedProfile(u.id);
    setProfile(cached);
    setProfileMissing(false);
    const pending = takePendingProfile();
    const remote = await fetchProfile(u.id);
    if (profileFor.current !== u.id) return;
    if (remote) { setProfile(remote); return; }
    if (remote === undefined && cached) return; // la base ne répond pas : la copie du téléphone suffit
    const old = getPrefs(u.id);
    const p = pending ? { ...pending, first_name: pending.first_name || metaFirstName(u) }
      : cached ?? (old ? fromOldPrefs(old, metaFirstName(u)) : null);
    if (p) { setProfile(p); void saveProfile(u.id, p); } else setProfileMissing(true);
  };

  const { user, ready: sessionReady } = useSession({
    onSignedIn: (u) => {
      if (profileFor.current !== u.id) {
        setQuota(getCachedQuota(u.id));
        void fetchScanQuota(u.id).then(q => { if (q && profileFor.current === u.id) setQuota(q); });
      }
      setUserId(u.id);
      void library.load(u.id);
      setAvatarSrc(getAvatar(u.id));
      // Réponses aux questions en attente : c'est un compte tout neuf (même rendu que la connexion, pas de passage par l'accueil)
      if (profileFor.current !== u.id && hasPendingProfile()) setGoCamera(true);
      void loadProfile(u);
      const oauth = takeOAuthIntent();
      if (oauth === "signup") showToast("Compte Google relié : pas d'email à confirmer");
      if (oauth === "login") { const n = firstName(u); showToast(n ? `Bon retour, ${n}` : "Bon retour"); }
    },
    onSignedOut: () => {
      setUserId(undefined);
      profileFor.current = null;
      setGoCamera(false);
      setProfile(null);
      setProfileMissing(false);
      setQuota(null);
      // Supabase annonce aussi « personne de connecté » à l'ouverture : on ne sort pas des écrans d'inscription
      if (!OB_PATHS.includes(window.location.pathname)) navigate("/", { replace: true });
      library.clear();
      setAvatarSrc(null);
    },
  });

  // Connecté : la copie pré-rendue de la landing (index.html) n'a plus lieu d'être, et l'appli garde
  // son zoom bloqué comme avant (le site public, lui, laisse zoomer pour l'accessibilité)
  const obPath = OB_PATHS.includes(location.pathname);
  useEffect(() => {
    if (obPath) document.getElementById("prerender")?.remove();
  }, [obPath]);
  useEffect(() => {
    if (!user) return;
    document.getElementById("prerender")?.remove();
    document.querySelector('meta[name="viewport"]')?.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover");
  }, [user]);

  // Renouvellement de Plus refusé (carte expirée…) : « Paiement refusé » une fois par visite, en arrivant sur l'accueil
  useEffect(() => {
    if (!paymentFailed(user) || location.pathname !== "/") return;
    try {
      if (sessionStorage.getItem("frigia_payfail_seen")) return;
      sessionStorage.setItem("frigia_payfail_seen", "1");
    } catch { return; }
    navigate("/plus/paiement?refus=1");
  }, [user, location.pathname, navigate]);

/** Enregistre les goûts (questions remplies une fois connecté, ou « Modifier » depuis Famille). */
const saveTastes = async (p: Profile) => {
  if (!user) return;
  setProfile(p);
  setProfileMissing(false);
  await saveProfile(user.id, p);
};

if (user && goCamera && location.pathname !== "/camera") {
  return <Navigate to="/camera" replace />;
}

// Pas connecté, ou en plein parcours d'inscription : la landing (ou Bienvenue dans l'appli installée) et les écrans du compte
if (!user || obPath) {
  const open = (path: string) => !user || OB_SIGNED_IN.includes(path);
  const screens: [string, React.ReactNode][] = [
    ["/bienvenue", <Welcome />],
    ["/questions/1", <QGoal />],
    ["/questions/2", <QDiet onSave={user ? saveTastes : undefined} />],
    ["/questions/3", <QTime onSave={user ? saveTastes : undefined} />],
    ["/pret", <Ready />],
    ["/compte", <Signup />],
    ["/compte/email", <EmailSignup />],
    ["/compte/code", <VerifyEmail />],
    ["/connexion", <Login />],
    ["/mot-de-passe", <Forgot />],
    ["/camera", user
      ? <Camera onDone={() => { setGoCamera(false); navigate("/", { replace: true, state: { hello: true } }); }} />
      : <Navigate to="/" replace />],
  ];
  return (
    <AppFrame splash={sessionReady ? !!user || isStandalone() : undefined} guest={!user}>
      <Routes>
        {screens.map(([path, el]) => <Route key={path} path={path} element={open(path) ? el : <Navigate to="/" replace />} />)}
        <Route path="/" element={isStandalone()
          ? <Navigate to="/bienvenue" replace />
          : <><Analytics /><Suspense fallback={null}><Landing
              onStart={() => { resetAnswers(); navigate("/questions/1"); }}
              onLogin={() => { clearPendingProfile(); navigate("/connexion"); }}
            /></Suspense></>} />
        {/* Tant que la session n'est pas lue, une page de l'appli (/famille…) attend au lieu de renvoyer à l'accueil */}
        <Route path="*" element={sessionReady ? <Navigate to="/" replace /> : null} />
      </Routes>
    </AppFrame>
  );
}

// Formule Gratuit ou Frigia Plus (plus d'essai de 4 jours ni de mur de paiement à l'entrée)
const isPlus = hasPlus(user);

// Compte sans goûts (connexion Google sans passer par les questions…) : les 3 questions d'abord
if (profileMissing && !isPlus) {
  return <Navigate to="/questions/1" replace />;
}

// ─── NOUVELLE APPLI (prototype V3) ───────────────────────────────────────────
// Les écrans pas encore refaits (tes scans, tes favoris, réglages) restent les anciens, en clair,
// le temps des étapes 7 et 8.
const noScansLeft = !isPlus && scansLeft(quota) <= 0;
const name = profile?.first_name || firstName(user);
/** Le serveur a compté le scan : on suit les scans gratuits qui restent. */
const onScansLeft = (left: number) => {
  const q = { used: Math.max(0, quotaTotal(quota) - left), bonus: quota?.bonus ?? 0 };
  setQuota(q);
  setCachedQuota(user.id, q);
};
/** Formule Gratuit : le scan est compté, on rappelle ceux qui restent (comme le prototype en arrivant sur la liste). */
const onCounted = (left: number) => {
  onScansLeft(left);
  showToast(quotaText({ used: Math.max(0, quotaTotal(quota) - left), bonus: quota?.bonus ?? 0 }));
};
const onOutOfScans = () => { onScansLeft(0); navigate("/plus", { replace: true, state: { why: "quota" } }); };
const recipeState = location.state as { hello?: boolean } | null;
const openRecipe = (recipe: GeneratedRecipe, servings?: number) => navigate("/recette", { state: { recipe, servings } satisfies RecipeState });
// Premier scan guidé : juste après l'inscription, tant qu'aucun scan n'est fait et que les bulles n'ont pas été passées
const guide = guideState(user.id);

return (
  // Retour de la page Stripe : « On attend ta banque » tout de suite, sans l'écran d'ouverture
  <AppFrame splash={location.pathname !== "/plus/paiement"}>
    <Routes>
      <Route path="/" element={<Home user={user} isPlus={isPlus} quota={quota} avatar={avatarSrc} history={history} favorites={favorites} onOpenRecipe={r => openRecipe(r)} />} />
      <Route path="/planning" element={<Planning isPlus={isPlus} lastScan={history[0]?.date} />} />
      <Route path="/courses" element={<Courses isPlus={isPlus} />} />
      <Route path="/famille" element={<Family user={user} isPlus={isPlus} avatar={avatarSrc} profile={profile}
        onEditTastes={q => { resetAnswers(profile ?? EMPTY_PROFILE); navigate(`/questions/${q ?? 1}`, { state: { edit: true, only: !!q } }); }} />} />
      <Route path="/plus" element={isPlus ? <Navigate to="/" replace /> : <Paywall />} />
      <Route path="/plus/paiement" element={<PayReturn />} />
      <Route path="/plus/bienvenue" element={<PlusWelcome user={user} name={name} />} />
      <Route path="/resilier" element={<Cancel user={user} />} />
      {/* Les 15 scans gratuits sont utilisés : « Passe à Plus » à la place du scan */}
      <Route path="/scan" element={noScansLeft ? <Navigate to="/plus" replace state={{ why: "quota" }} /> :
        <ScanCamera userId={user.id} guide={guide === "" && history.length === 0} onCounted={onCounted} onOutOfScans={onOutOfScans} />} />
      <Route path="/scan/recadrer" element={<Crop />} />
      <Route path="/scan/rate" element={<ScanFail />} />
      <Route path="/scan/ajouter" element={<AddIngredient />} />
      <Route path="/scan/ingredients" element={<Ingredients isPlus={isPlus} name={name} avatar={avatarSrc} profile={profile} guide={guide === "ingr"} userId={user.id} />} />
      <Route path="/scan/preparation" element={<Prep isPlus={isPlus} onReady={library.addScan} onCounted={onCounted} onOutOfScans={onOutOfScans} />} />
      <Route path="/recettes/:id" element={<Results history={history} isPlus={isPlus} onNewIdeas={updateScanRecipes} />} />
      <Route path="/recettes/:id/:n" element={<Recipe history={history} isPlus={isPlus} name={name} avatar={avatarSrc} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />} />
      <Route path="/recette" element={<Recipe history={history} isPlus={isPlus} name={name} avatar={avatarSrc} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />} />
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
    {recipeState?.hello && location.pathname === "/" && !isPlus && (
      <HelloSheet name={name} onScan={openScan} onClose={() => navigate("/", { replace: true })} />
    )}
  </AppFrame>
);
}
