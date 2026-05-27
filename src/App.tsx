import React, { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import Landing from "./Landing";
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
type ChatMessage = { role: "ai" | "user"; text: string };

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
  if (l.includes("fromage") || l.includes("emmental") || l.includes("mozza"))
    return "🧀";
  if (l.includes("lait")) return "🥛";
  if (l.includes("brocoli")) return "🥦";
  if (l.includes("citron")) return "🍋";
  if (l.includes("salade") || l.includes("laitue")) return "🥬";
  if (l.includes("poulet")) return "🍗";
  if (l.includes("pâte") || l.includes("pasta")) return "🍝";
  if (l.includes("riz")) return "🍚";
  if (l.includes("carotte")) return "🥕";
  if (l.includes("avocat")) return "🥑";
  if (l.includes("pain")) return "🍞";
  if (l.includes("poisson") || l.includes("saumon")) return "🐟";
  return "🍽️";
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
  const [src, setSrc] = useState<string | null>(mealImageCache[query] || null);
  const [loaded, setLoaded] = useState(!!mealImageCache[query]);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (mealImageCache[query]) return;
    let cancelled = false;
    fetchTheMealImage(query).then((url) => {
      if (cancelled) return;
      if (url) { mealImageCache[query] = url; setSrc(url); }
      else setErrored(true);
    });
    return () => { cancelled = true; };
  }, [query]);

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

// ─── Settings Modal ───────────────────────────────────────────────────────────
type SettingsTab =
  | "profile"
  | "subscription"
  | "appearance"
  | "notifications"
  | "security";

function SettingsModal({
  theme,
  onClose,
  onThemeChange,
}: {
  theme: Theme;
  onClose: () => void;
  onThemeChange: (t: Theme) => void;
}) {
  const v = getThemeVars(theme);
  const [tab, setTab] = useState<SettingsTab>("profile");

  // Profile state
  const [profile, setProfile] = useState({
    name: "Sophie Martin",
    email: "sophie.martin@email.com",
    phone: "+33 6 12 34 56 78",
    bio: "Passionnée de cuisine saine et créative 🍃",
  });
  const [profileSaved, setProfileSaved] = useState(false);

  // Password state
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [pwMsg, setPwMsg] = useState("");

  // Subscription state
  const [cancelStep, setCancelStep] = useState(0); // 0=normal, 1=confirm, 2=done
  const [trialDays] = useState(2); // days used out of 4

  // Notifications state
  const [notifs, setNotifs] = useState({
    recipes: true,
    peremption: true,
    newsletter: false,
    tips: true,
  });

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
    { id: "notifications", icon: "🔔", label: "Notifications" },
    { id: "security", icon: "🔒", label: "Sécurité" },
  ];

  const saveProfile = () => {
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const savePassword = () => {
    if (!passwords.current) {
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
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:`1px solid ${v.border}`, flexShrink:0 }}>
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
                  }}
                >
                  👩‍🍳
                </div>
                <div>
                  <div
                    style={{ fontWeight: 700, color: v.text, marginBottom: 6 }}
                  >
                    {profile.name}
                  </div>
                  <div
                    style={{ fontSize: 12, color: v.muted, marginBottom: 10 }}
                  >
                    Membre depuis janvier 2026
                  </div>
                  <button
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

              <button
                onClick={saveProfile}
                style={{
                  padding: "13px 28px",
                  background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                  border: "none",
                  borderRadius: 100,
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontSize: 15,
                }}
              >
                {profileSaved
                  ? "✓ Sauvegardé !"
                  : "Sauvegarder les modifications"}
              </button>
            </div>
          )}

          {/* ── ABONNEMENT ── */}
          {tab === "subscription" && (
            <div style={{ animation: "fadeUp 0.3s ease both" }}>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: v.text,
                  marginBottom: 8,
                }}
              >
                Mon abonnement
              </h2>
              <p style={{ color: v.muted, fontSize: 14, marginBottom: 32 }}>
                Gérez votre essai gratuit et votre facturation.
              </p>

              {/* Trial card */}
              <div
                style={{
                  borderRadius: 20,
                  overflow: "hidden",
                  background:
                    "linear-gradient(135deg,rgba(255,107,53,0.15),rgba(46,204,113,0.12))",
                  border: "1px solid rgba(255,107,53,0.3)",
                  padding: 28,
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 16,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#FF6B35",
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      Essai gratuit en cours
                    </div>
                    <div
                      style={{ fontSize: 28, fontWeight: 900, color: v.text }}
                    >
                      4 jours gratuits
                    </div>
                    <div style={{ color: v.muted, fontSize: 14, marginTop: 6 }}>
                      Puis{" "}
                      <strong style={{ color: v.text }}>7,99 € / mois</strong> —
                      prélèvement automatique
                    </div>
                    <div style={{ color: v.muted, fontSize: 13, marginTop: 4 }}>
                      Prochain prélèvement le{" "}
                      <strong style={{ color: v.text }}>27 mai 2026</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: 40,
                        fontWeight: 900,
                        color: "#2ECC71",
                      }}
                    >
                      {4 - trialDays}j
                    </div>
                    <div style={{ fontSize: 12, color: v.muted }}>restants</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    marginTop: 20,
                    height: 8,
                    borderRadius: 100,
                    background: "rgba(255,255,255,0.1)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(trialDays / 4) * 100}%`,
                      background: "linear-gradient(90deg,#FF6B35,#2ECC71)",
                      borderRadius: 100,
                      transition: "width 0.4s",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: v.muted,
                    marginTop: 6,
                  }}
                >
                  <span>Jour 1</span>
                  <span>Jour 4</span>
                </div>
              </div>

              {/* What's included */}
              <div
                style={{ ...glassCard(theme), padding: 24, marginBottom: 24 }}
              >
                <div
                  style={{ fontWeight: 700, color: v.text, marginBottom: 16 }}
                >
                  ✨ Inclus dans votre abonnement à 7,99€/mois
                </div>
                {[
                  "Scans IA illimités de votre frigo",
                  "Recettes personnalisées illimitées",
                  "Chat Chef IA disponible 24h/24",
                  "Suivi nutritionnel avancé",
                  "Alertes de péremption intelligentes",
                  "Accès à toutes les futures fonctionnalités",
                ].map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: i < 5 ? `1px solid ${v.border}` : "none",
                    }}
                  >
                    <span style={{ color: "#2ECC71", fontWeight: 700 }}>✓</span>
                    <span style={{ fontSize: 14, color: v.text }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* Billing info */}
              <div
                style={{ ...glassCard(theme), padding: 24, marginBottom: 24 }}
              >
                <div
                  style={{ fontWeight: 700, color: v.text, marginBottom: 16 }}
                >
                  💳 Informations de paiement
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "14px 18px",
                    borderRadius: 12,
                    background:
                      theme === "light"
                        ? "rgba(0,0,0,0.04)"
                        : "rgba(255,255,255,0.04)",
                    border: `1px solid ${v.border}`,
                  }}
                >
                  <span style={{ fontSize: 24 }}>💳</span>
                  <div>
                    <div
                      style={{ fontWeight: 600, color: v.text, fontSize: 14 }}
                    >
                      Visa •••• 4242
                    </div>
                    <div style={{ fontSize: 12, color: v.muted }}>
                      Expire 09/2028
                    </div>
                  </div>
                  <button
                    style={{
                      marginLeft: "auto",
                      padding: "7px 14px",
                      borderRadius: 100,
                      border: `1px solid ${v.border}`,
                      background: "none",
                      color: v.muted,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Modifier
                  </button>
                </div>
              </div>

              {/* Cancel zone */}
              {cancelStep === 0 && (
                <div
                  style={{
                    padding: 20,
                    borderRadius: 16,
                    border: "1px solid rgba(255,80,80,0.2)",
                    background: "rgba(255,80,80,0.05)",
                  }}
                >
                  <div
                    style={{ fontWeight: 700, color: v.text, marginBottom: 6 }}
                  >
                    Résilier l'abonnement
                  </div>
                  <div
                    style={{ fontSize: 13, color: v.muted, marginBottom: 16 }}
                  >
                    Vous conserverez l'accès jusqu'à la fin de votre période en
                    cours. Aucun remboursement ne sera effectué.
                  </div>
                  <button
                    onClick={() => setCancelStep(1)}
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
                    Résilier mon abonnement
                  </button>
                </div>
              )}

              {cancelStep === 1 && (
                <div
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    border: "1px solid rgba(255,80,80,0.4)",
                    background: "rgba(255,80,80,0.08)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      color: "#FF5050",
                      marginBottom: 10,
                    }}
                  >
                    ⚠️ Confirmer la résiliation
                  </div>
                  <div
                    style={{ fontSize: 14, color: v.muted, marginBottom: 20 }}
                  >
                    Vous êtes sur le point de résilier votre abonnement Frigia.
                    Vous perdrez l'accès à toutes les fonctionnalités premium à
                    la fin de la période actuelle.
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={() => setCancelStep(2)}
                      style={{
                        padding: "11px 22px",
                        borderRadius: 100,
                        border: "none",
                        background: "#FF5050",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      Oui, résilier
                    </button>
                    <button
                      onClick={() => setCancelStep(0)}
                      style={{
                        padding: "11px 22px",
                        borderRadius: 100,
                        border: `1px solid ${v.border}`,
                        background: "none",
                        color: v.text,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {cancelStep === 2 && (
                <div
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    border: "1px solid rgba(46,204,113,0.3)",
                    background: "rgba(46,204,113,0.08)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: "#2ECC71",
                      marginBottom: 8,
                    }}
                  >
                    ✓ Résiliation confirmée
                  </div>
                  <div style={{ fontSize: 14, color: v.muted }}>
                    Votre abonnement sera actif jusqu'au{" "}
                    <strong style={{ color: v.text }}>27 mai 2026</strong>. Nous
                    espérons vous revoir bientôt !
                  </div>
                </div>
              )}
            </div>
          )}

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

              <div style={{ marginBottom: 28 }}>
                <div style={{ ...labelStyle, marginBottom: 16 }}>
                  Taille du texte
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {["Petit", "Normal", "Grand"].map((s, i) => (
                    <button
                      key={s}
                      style={{
                        flex: 1,
                        padding: "12px 0",
                        borderRadius: 12,
                        border:
                          i === 1
                            ? "2px solid #FF6B35"
                            : `1px solid ${v.border}`,
                        background: i === 1 ? "rgba(255,107,53,0.1)" : "none",
                        color: i === 1 ? "#FF6B35" : v.muted,
                        cursor: "pointer",
                        fontWeight: i === 1 ? 700 : 400,
                        fontSize: 13 + i * 2,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{ ...glassCard(theme), padding: 20, borderRadius: 16 }}
              >
                <div
                  style={{ fontWeight: 700, color: v.text, marginBottom: 16 }}
                >
                  Aperçu
                </div>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: theme === "dark" ? "#12121A" : "#fff",
                    border: `1px solid ${v.border}`,
                  }}
                >
                  <div
                    style={{ fontWeight: 700, color: v.text, marginBottom: 4 }}
                  >
                    Omelette aux tomates 🍳
                  </div>
                  <div style={{ fontSize: 13, color: v.muted }}>
                    8 min · 320 kcal · Facile
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {tab === "notifications" && (
            <div style={{ animation: "fadeUp 0.3s ease both" }}>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: v.text,
                  marginBottom: 8,
                }}
              >
                Notifications
              </h2>
              <p style={{ color: v.muted, fontSize: 14, marginBottom: 32 }}>
                Choisissez les notifications que vous souhaitez recevoir.
              </p>

              {(
                [
                  {
                    key: "recipes" as const,
                    icon: "🍽️",
                    title: "Nouvelles recettes",
                    desc: "Recevez des suggestions personnalisées chaque semaine",
                  },
                  {
                    key: "peremption" as const,
                    icon: "⏰",
                    title: "Alertes de péremption",
                    desc: "Soyez prévenu avant que vos aliments expirent",
                  },
                  {
                    key: "tips" as const,
                    icon: "💡",
                    title: "Conseils culinaires",
                    desc: "Astuces et techniques pour cuisiner mieux",
                  },
                  {
                    key: "newsletter" as const,
                    icon: "📧",
                    title: "Newsletter Frigia",
                    desc: "Nos actualités et nouveautés par email",
                  },
                ] as {
                  key: keyof typeof notifs;
                  icon: string;
                  title: string;
                  desc: string;
                }[]
              ).map((n) => (
                <div
                  key={n.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "18px 0",
                    borderBottom: `1px solid ${v.border}`,
                  }}
                >
                  <span style={{ fontSize: 24 }}>{n.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{ fontWeight: 600, color: v.text, fontSize: 15 }}
                    >
                      {n.title}
                    </div>
                    <div style={{ fontSize: 13, color: v.muted }}>{n.desc}</div>
                  </div>
                  <div
                    onClick={() =>
                      setNotifs({ ...notifs, [n.key]: !notifs[n.key] })
                    }
                    style={{
                      width: 48,
                      height: 26,
                      borderRadius: 100,
                      cursor: "pointer",
                      position: "relative",
                      background: notifs[n.key]
                        ? "linear-gradient(135deg,#FF6B35,#2ECC71)"
                        : v.inputBg,
                      border: `1px solid ${v.border}`,
                      transition: "background 0.3s",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 3,
                        left: notifs[n.key] ? 24 : 3,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#fff",
                        transition: "left 0.3s",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                      }}
                    />
                  </div>
                </div>
              ))}
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

                {[
                  "Mot de passe actuel",
                  "Nouveau mot de passe",
                  "Confirmer le nouveau",
                ].map((label, i) => {
                  const keys: (keyof typeof passwords)[] = [
                    "current",
                    "next",
                    "confirm",
                  ];
                  return (
                    <div key={label} style={{ marginBottom: 16 }}>
                      <div style={labelStyle}>{label}</div>
                      <input
                        type="password"
                        value={passwords[keys[i]]}
                        onChange={(e) =>
                          setPasswords({
                            ...passwords,
                            [keys[i]]: e.target.value,
                          })
                        }
                        style={inputStyle}
                        placeholder="••••••••"
                      />
                    </div>
                  );
                })}

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
                  style={{
                    padding: "12px 24px",
                    background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                    border: "none",
                    borderRadius: 100,
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Mettre à jour le mot de passe
                </button>
              </div>

              <div
                style={{ ...glassCard(theme), padding: 24, marginBottom: 24 }}
              >
                <div
                  style={{ fontWeight: 700, color: v.text, marginBottom: 8 }}
                >
                  🛡️ Authentification à deux facteurs
                </div>
                <div style={{ fontSize: 13, color: v.muted, marginBottom: 16 }}>
                  Ajoutez une couche de sécurité supplémentaire à votre compte.
                </div>
                <button
                  style={{
                    padding: "11px 22px",
                    borderRadius: 100,
                    border: `1px solid ${v.border}`,
                    background: "none",
                    color: v.text,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Activer la 2FA
                </button>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── OnboardingScreen ────────────────────────────────────────────────────────
function OnboardingScreen({ onContinue }: { onContinue: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"#0A0A0F", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"24px 20px", overflowY:"auto" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Logo */}
      <div style={{ animation:"fadeUp 0.4s ease both", textAlign:"center", marginBottom:32 }}>
        <div style={{ width:64, height:64, borderRadius:18, background:"linear-gradient(135deg,#FF6B35,#2ECC71)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto 14px" }}>🥗</div>
        <div style={{ fontWeight:900, fontSize:26, color:"#FAFAFA", fontFamily:"Georgia, serif" }}>Bienvenue sur Frigia</div>
        <div style={{ color:"#6B7280", fontSize:15, marginTop:6 }}>Votre chef IA personnel vous attend</div>
      </div>

      {/* Pricing card */}
      <div style={{ animation:"fadeUp 0.4s 0.1s ease both", width:"100%", maxWidth:420, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,107,53,0.35)", borderRadius:24, padding:28, marginBottom:20, position:"relative" }}>
        <div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)", background:"linear-gradient(135deg,#FF6B35,#2ECC71)", borderRadius:100, padding:"5px 20px", fontSize:13, fontWeight:800, color:"#fff", whiteSpace:"nowrap" }}>🎉 4 jours gratuits inclus</div>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#FF6B35", letterSpacing:3, textTransform:"uppercase", marginBottom:8 }}>Plan unique</div>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:4 }}>
            <span style={{ fontSize:58, fontWeight:900, color:"#FAFAFA", lineHeight:1 }}>7,99€</span>
            <span style={{ color:"#6B7280", fontSize:15 }}>/mois</span>
          </div>
          <div style={{ color:"#6B7280", fontSize:13, marginTop:6 }}>Après 4 jours d'essai gratuit</div>
        </div>
        {[
          "Scans IA illimités de votre frigo",
          "Recettes personnalisées illimitées",
          "Chef IA disponible 24h/24",
          "Suivi nutritionnel & alertes péremption",
        ].map((f) => (
          <div key={f} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ color:"#2ECC71", fontWeight:700, fontSize:15 }}>✓</span>
            <span style={{ fontSize:14, color:"#FAFAFA" }}>{f}</span>
          </div>
        ))}
        <div style={{ color:"#6B7280", fontSize:12, textAlign:"center", marginTop:16 }}>Aucune carte bancaire requise pendant l'essai</div>
      </div>

      {/* Checkbox */}
      <div style={{ animation:"fadeUp 0.4s 0.2s ease both", width:"100%", maxWidth:420, marginBottom:20 }}>
        <label style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer", padding:"14px 16px", borderRadius:14, border:`1px solid ${checked ? "rgba(46,204,113,0.4)" : "rgba(255,255,255,0.1)"}`, background: checked ? "rgba(46,204,113,0.08)" : "rgba(255,255,255,0.03)", transition:"all 0.2s" }}>
          <div onClick={() => setChecked(!checked)} style={{ width:22, height:22, borderRadius:6, border:`2px solid ${checked ? "#2ECC71" : "rgba(255,255,255,0.3)"}`, background: checked ? "#2ECC71" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.2s" }}>
            {checked && <span style={{ color:"#fff", fontSize:14, fontWeight:900 }}>✓</span>}
          </div>
          <span style={{ fontSize:14, color:"#FAFAFA", lineHeight:1.5 }}>Je commence mon essai gratuit de 4 jours — sans engagement, sans carte bancaire</span>
        </label>
      </div>

      {/* CTA */}
      <div style={{ animation:"fadeUp 0.4s 0.3s ease both", width:"100%", maxWidth:420 }}>
        <button
          onClick={() => checked && onContinue()}
          style={{ width:"100%", padding:"16px", borderRadius:100, border:"none", background: checked ? "linear-gradient(135deg,#FF6B35,#2ECC71)" : "rgba(255,255,255,0.08)", color: checked ? "#fff" : "#6B7280", fontWeight:800, fontSize:16, cursor: checked ? "pointer" : "not-allowed", transition:"all 0.3s", letterSpacing:0.5 }}
        >
          Accéder à Frigia →
        </button>
        <div style={{ textAlign:"center", marginTop:12, fontSize:12, color:"#6B7280" }}>
          ✓ Sans engagement · ✓ Résiliable à tout moment
        </div>
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
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.55)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
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
  onDeleteRecipe,
  onRecipeClick,
}: {
  theme: Theme;
  history: HistoryEntry[];
  onDeleteRecipe: (entryId: string, recipeTitle: string) => void;
  onRecipeClick: (recipe: GeneratedRecipe, servings: number) => void;
}) {
  const v = getThemeVars(theme);

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
        <div key={entry.id} style={{ ...glassCard(theme), padding: 24 }}>
          {/* Entry header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div>
              <div
                style={{ fontWeight: 800, fontSize: 15, color: v.text }}
              >
                📅{" "}
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
              <div
                style={{ fontSize: 13, color: v.muted, marginTop: 3 }}
              >
                👥 {entry.servings} personne{entry.servings > 1 ? "s" : ""}{" "}
                · 🛒 {entry.ingredients.length} ingrédients détectés ·{" "}
                🍽️ {entry.recipes.length} recette
                {entry.recipes.length > 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {/* Ingredients */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {entry.ingredients.map((ing) => (
              <div
                key={ing.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  background: "rgba(46,204,113,0.1)",
                  border: "1px solid rgba(46,204,113,0.2)",
                  borderRadius: 100,
                  fontSize: 12,
                  color: v.text,
                }}
              >
                <span>{ing.icon}</span>
                <span style={{ fontWeight: 600 }}>{ing.name}</span>
              </div>
            ))}
          </div>

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
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRecipe(entry.id, recipe.title);
                  }}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    zIndex: 10,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.65)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                  }}
                  title="Supprimer"
                >
                  ✕
                </button>
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
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      color: v.text,
                      marginBottom: 4,
                      lineHeight: 1.3,
                    }}
                  >
                    {recipe.emoji} {recipe.title}
                  </div>
                  <div style={{ fontSize: 11, color: v.muted }}>
                    {recipe.time} · {recipe.cal} kcal
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
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          🥗
        </div>
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
        className="nav-links"
        style={{ display: "flex", gap: 24, fontSize: 14 }}
      >
        {["Fonctionnalités", "Comment ça marche", "Tarifs", "FAQ"].map((l) => (
          <a
            key={l}
            href="#"
            style={{ color: v.muted, textDecoration: "none" }}
          >
            {l}
          </a>
        ))}
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
        <button
          style={{
            padding: "10px 20px",
            background: "none",
            border: `1px solid ${v.border}`,
            borderRadius: 100,
            color: v.text,
            cursor: "pointer",
          }}
        >
          Connexion
        </button>
        <button
          style={{
            padding: "10px 20px",
            background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
            border: "none",
            borderRadius: 100,
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Essayer
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
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const imageBase64 = (reader.result as string).split(",")[1];
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64, mediaType: file.type || "image/jpeg" }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || data.error || "Erreur serveur");
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
            imageSearch: String(r.imageSearch || r.title || ""),
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
      } catch (err) {
        setError(String((err as any)?.message || err));
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
            capture="environment"
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
                ? "ANALYSE IA DU FRIGO..."
                : image
                ? "ANALYSE TERMINÉE"
                : "CLIQUER POUR SCANNER MON FRIGO"}
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>
              Photo du frigo → aliments détectés → recettes personnalisées
            </div>
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
          </div>
        </div>
        {error && (
          <p
            style={{ color: COLORS.orangeStart, fontSize: 14, lineHeight: 1.6 }}
          >
            {error}
          </p>
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
  delay = 0,
  onClick,
}: GeneratedRecipe & { theme: Theme; delay?: number; onClick?: () => void }) {
  const v = getThemeVars(theme);
  const [liked, setLiked] = useState(false);
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
          onClick={() => setLiked(!liked)}
          style={{
            flex: 1,
            padding: "12px",
            background: "none",
            border: "none",
            color: liked ? "#FF6B35" : v.muted,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {liked ? "♥" : "♡"} Sauvegarder
        </button>
        <button
          style={{
            flex: 1,
            padding: "12px",
            background: "none",
            border: "none",
            borderLeft: `1px solid ${v.border}`,
            color: v.muted,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          ↗ Partager
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

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function Frigia() {
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [showSettings, setShowSettings] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [aiRecipes, setAiRecipes] = useState<GeneratedRecipe[]>([]);
  const [, setDetectedIngredients] = useState<DetectedIngredient[]>([]);
  const [scannerTab, setScannerTab] = useState<"scanner" | "history">("scanner");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [servings, setServings] = useState(2);
  const [showServingsModal, setShowServingsModal] = useState(false);
  const [pendingData, setPendingData] = useState<{ recipes: GeneratedRecipe[]; ingredients: DetectedIngredient[] } | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<{ recipe: GeneratedRecipe; servings: number } | null>(null);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [mobileTab, setMobileTab] = useState<"scan" | "recipes" | "chat" | "profile">("scan");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      text: "Bonjour ! Je suis votre Chef IA personnel. Dites-moi ce que vous souhaitez cuisiner.",
    },
  ]);

  const v = getThemeVars(theme);
  const gc = glassCard(theme);
  const isMobile = windowWidth < 768;
useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    const u = data.session?.user ?? null;
    setUser(u);
    if (u && !localStorage.getItem(`frigia_onboarded_${u.id}`)) {
      setShowOnboarding(true);
    }
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user ?? null;
    setUser(u);
    if (u && !localStorage.getItem(`frigia_onboarded_${u.id}`)) {
      setShowOnboarding(true);
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
  const defaultRecipes: GeneratedRecipe[] = [
    {
      emoji: "🍳",
      title: "Omelette tomates-basilic",
      time: "8 min",
      cal: 320,
      diff: "Facile",
    },
    {
      emoji: "🥗",
      title: "Salade caprese légère",
      time: "5 min",
      cal: 180,
      diff: "Très facile",
    },
    {
      emoji: "🍝",
      title: "Pasta aux légumes grillés",
      time: "20 min",
      cal: 520,
      diff: "Moyen",
    },
    {
      emoji: "🧀",
      title: "Gratin de courgettes",
      time: "35 min",
      cal: 410,
      diff: "Moyen",
    },
    {
      emoji: "🥦",
      title: "Soupe détox verte",
      time: "15 min",
      cal: 150,
      diff: "Facile",
    },
    {
      emoji: "🌯",
      title: "Wrap protéiné maison",
      time: "10 min",
      cal: 440,
      diff: "Facile",
    },
  ];

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages((m) => [...m, { role: "user", text: msg }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setChatMessages((m) => [
        ...m,
        {
          role: "ai",
          text: "Excellente idée ! Avec vos ingrédients disponibles, je vous suggère une omelette tomate-fromage, prête en 8 minutes.",
        },
      ]);
    }, 1200);
  };

  const confirmServings = (n: number) => {
    setServings(n);
    if (pendingData) {
      setAiRecipes(pendingData.recipes);
      setDetectedIngredients(pendingData.ingredients);
      setHistory((prev) => [
        {
          id: Date.now().toString(),
          date: new Date(),
          ingredients: pendingData.ingredients,
          recipes: pendingData.recipes,
          servings: n,
        },
        ...prev,
      ]);
      setPendingData(null);
    }
    setShowServingsModal(false);
  };

  const skipServings = () => {
    if (pendingData) {
      setAiRecipes(pendingData.recipes);
      setDetectedIngredients(pendingData.ingredients);
      setHistory((prev) => [
        {
          id: Date.now().toString(),
          date: new Date(),
          ingredients: pendingData.ingredients,
          recipes: pendingData.recipes,
          servings,
        },
        ...prev,
      ]);
      setPendingData(null);
    }
    setShowServingsModal(false);
  };

  const deleteRecipe = (entryId: string, recipeTitle: string) => {
    setHistory((prev) =>
      prev
        .map((entry) =>
          entry.id === entryId
            ? { ...entry, recipes: entry.recipes.filter((r) => r.title !== recipeTitle) }
            : entry
        )
        .filter((entry) => entry.recipes.length > 0)
    );
  };

if (!user) {
  return <Landing />;
}

if (showOnboarding) {
  return (
    <OnboardingScreen
      onContinue={() => {
        localStorage.setItem(`frigia_onboarded_${user.id}`, "1");
        setShowOnboarding(false);
      }}
    />
  );
}

// ─── MOBILE LAYOUT ───────────────────────────────────────────────────────────
if (isMobile) {
  const mobileTabs = [
    { id: "scan" as const,    icon: "📷", label: "Scanner"  },
    { id: "recipes" as const, icon: "🍽️", label: "Recettes" },
    { id: "chat" as const,    icon: "🤖", label: "Chef IA"  },
    { id: "profile" as const, icon: "👤", label: "Profil"   },
  ];

  return (
    <div style={{ background: v.bg, minHeight: "100vh", fontFamily: "Helvetica Neue, Arial, sans-serif", color: v.text, overflowX: "hidden" }}>
      <GlobalStyles theme={theme} />
      {showServingsModal && <ServingsModal theme={theme} onConfirm={confirmServings} onSkip={skipServings} />}
      {selectedRecipe && <RecipeDetailModal theme={theme} recipe={selectedRecipe.recipe} servings={selectedRecipe.servings} onClose={() => setSelectedRecipe(null)} />}
      {showSettings && <SettingsModal theme={theme} onClose={() => setShowSettings(false)} onThemeChange={setTheme} />}

      {/* ── HEADER ── */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", background: v.navBg, backdropFilter: "blur(20px)", borderBottom: `1px solid ${v.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#FF6B35,#2ECC71)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🥗</div>
          <span style={{ fontWeight: 800, fontSize: 19, color: v.text, fontFamily: "Georgia, serif" }}>Frigia</span>
        </div>
        <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "none", color: v.muted, fontSize: 22, cursor: "pointer", padding: "6px 8px" }}>⚙️</button>
      </header>

      {/* ── CONTENT ── */}
      <main style={{ paddingTop: 56, paddingBottom: 74, minHeight: "100vh" }}>

        {/* SCANNER TAB */}
        {mobileTab === "scan" && (
          <div style={{ padding: "20px 16px" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2ECC71", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>Scan IA</div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: v.text, margin: 0, fontFamily: "Georgia, serif", lineHeight: 1.2 }}>Votre frigo intelligent</h1>
            </div>
            <div style={{ display: "flex", borderRadius: 14, overflow: "hidden", border: `1px solid ${v.border}`, marginBottom: 20 }}>
              {(["scanner", "history"] as const).map((tab) => (
                <button key={tab} onClick={() => setScannerTab(tab)} style={{ flex: 1, padding: "12px", border: "none", cursor: "pointer", background: scannerTab === tab ? "linear-gradient(135deg,#FF6B35,#2ECC71)" : v.inputBg, color: scannerTab === tab ? "#fff" : v.muted, fontWeight: scannerTab === tab ? 700 : 400, fontSize: 14, transition: "all 0.2s" }}>
                  {tab === "scanner" ? "📷 Scanner" : `📋 Historique${history.length > 0 ? ` (${history.length})` : ""}`}
                </button>
              ))}
            </div>
            {scannerTab === "scanner" ? (
              <FridgeAIScanner
                theme={theme}
                onRecipesGenerated={(recipes, ingredients) => { setPendingData({ recipes, ingredients }); setShowServingsModal(true); }}
                onRecipeClick={(r) => setSelectedRecipe({ recipe: r, servings })}
              />
            ) : (
              <HistoryTab theme={theme} history={history} onDeleteRecipe={deleteRecipe} onRecipeClick={(recipe, s) => setSelectedRecipe({ recipe, servings: s })} />
            )}
          </div>
        )}

        {/* RECETTES TAB */}
        {mobileTab === "recipes" && (
          <div style={{ padding: "20px 16px" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.orangeStart, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>Suggestions</div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: v.text, margin: 0, fontFamily: "Georgia, serif" }}>Recettes IA</h1>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(aiRecipes.length > 0 ? aiRecipes : defaultRecipes).map((r, i) => (
                <RecipeCard key={r.title} theme={theme} {...r} delay={i * 0.05} onClick={() => setSelectedRecipe({ recipe: r, servings })} />
              ))}
            </div>
          </div>
        )}

        {/* CHAT TAB */}
        {mobileTab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)" }}>
            <div style={{ padding: "14px 16px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2ECC71", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>Chef IA</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: v.text, fontFamily: "Georgia, serif" }}>Votre assistant cuisine</div>
            </div>
            <div style={{ ...gc, margin: "0 16px", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${v.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🤖</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: v.text }}>Chef IA Frigia</div>
                  <div style={{ fontSize: 11, color: "#2ECC71" }}>En ligne · Répond en secondes</div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {chatMessages.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8, animation: "fadeUp 0.3s ease both" }}>
                    {m.role === "ai" && <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>🤖</div>}
                    <div style={{ maxWidth: "78%", padding: "10px 14px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: m.role === "user" ? "linear-gradient(135deg,#FF6B35,#FF9A3C)" : v.inputBg, fontSize: 14, lineHeight: 1.55, color: v.text }}>{m.text}</div>
                  </div>
                ))}
                {typing && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", flexShrink: 0 }} />
                    <div style={{ ...gc, padding: "10px 14px", borderRadius: 18, display: "flex", gap: 4 }}>
                      {[0, 0.2, 0.4].map((d, idx) => <div key={idx} style={{ width: 6, height: 6, borderRadius: "50%", background: v.muted, animation: `pulse 1s ease ${d}s infinite` }} />)}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: "8px 12px 12px", borderTop: `1px solid ${v.border}` }}>
                <div className="hide-scrollbar" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
                  {["Repas rapide", "Peu de calories", "Protéiné"].map((p) => (
                    <button key={p} onClick={() => setChatInput(p)} style={{ padding: "5px 12px", borderRadius: 100, border: `1px solid ${v.border}`, background: v.inputBg, color: v.muted, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>{p}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Demandez à votre Chef IA…" style={{ flex: 1, background: v.inputBg, border: `1px solid ${v.inputBorder}`, borderRadius: 100, padding: "10px 16px", color: v.text, fontSize: 14, outline: "none" }} />
                  <button onClick={sendMessage} style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", border: "none", cursor: "pointer", fontSize: 17, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>↑</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROFIL TAB */}
        {mobileTab === "profile" && (
          <div style={{ padding: "28px 16px" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ width: 84, height: 84, borderRadius: "50%", background: "linear-gradient(135deg,#FF6B35,#2ECC71)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, margin: "0 auto 14px" }}>👩‍🍳</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: v.text, marginBottom: 8 }}>Mon compte</div>
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

      {/* ── BOTTOM NAV ── */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: v.navBg, backdropFilter: "blur(20px)", borderTop: `1px solid ${v.border}`, display: "flex" }}>
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
<button
  onClick={signOut}
  style={{
    position: "fixed",
    top: 20,
    right: 20,
    zIndex: 9999,
    padding: "10px 18px",
    borderRadius: 12,
    border: "none",
    background: "#FF6B35",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
  }}
>
  Déconnexion
</button>
      {showSettings && (
        <SettingsModal
          theme={theme}
          onClose={() => setShowSettings(false)}
          onThemeChange={setTheme}
        />
      )}
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
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: 0,
              marginBottom: 40,
              borderRadius: 14,
              overflow: "hidden",
              border: `1px solid ${v.border}`,
              maxWidth: 340,
              margin: "0 auto 40px",
            }}
          >
            {(["scanner", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setScannerTab(tab)}
                style={{
                  flex: 1,
                  padding: "13px 20px",
                  border: "none",
                  cursor: "pointer",
                  background:
                    scannerTab === tab
                      ? "linear-gradient(135deg,#FF6B35,#2ECC71)"
                      : v.inputBg,
                  color: scannerTab === tab ? "#fff" : v.muted,
                  fontWeight: scannerTab === tab ? 700 : 400,
                  fontSize: 14,
                  transition: "all 0.2s",
                }}
              >
                {tab === "scanner" ? "📷 Scanner" : `📋 Historique${history.length > 0 ? ` (${history.length})` : ""}`}
              </button>
            ))}
          </div>

          {scannerTab === "scanner" ? (
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
          ) : (
            <HistoryTab
              theme={theme}
              history={history}
              onDeleteRecipe={deleteRecipe}
              onRecipeClick={(recipe, s) =>
                setSelectedRecipe({ recipe, servings: s })
              }
            />
          )}
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
          {(aiRecipes.length > 0 ? aiRecipes : defaultRecipes).map((r, i) => (
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

      {/* ── CHAT ── */}
      <section
        style={{
          padding: "80px 40px",
          background: v.sectionBg,
          borderTop: `1px solid ${v.border}`,
          borderBottom: `1px solid ${v.border}`,
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
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
              Chef IA
            </div>
            <h2
              style={{
                fontSize: "clamp(28px,4vw,48px)",
                fontWeight: 900,
                letterSpacing: -1,
                color: v.text,
              }}
            >
              Discutez avec votre assistant cuisine
            </h2>
          </div>
          <div style={{ ...gc, overflow: "hidden" }}>
            <div
              style={{
                padding: "16px 24px",
                borderBottom: `1px solid ${v.border}`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                🤖
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: v.text }}>
                  Chef IA Frigia
                </div>
                <div style={{ fontSize: 12, color: "#2ECC71" }}>
                  En ligne · Répond en secondes
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
                minHeight: 260,
              }}
            >
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent:
                      m.role === "user" ? "flex-end" : "flex-start",
                    gap: 10,
                    animation: "fadeUp 0.3s ease both",
                  }}
                >
                  {m.role === "ai" && (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                      }}
                    >
                      🤖
                    </div>
                  )}
                  <div
                    style={{
                      maxWidth: "72%",
                      padding: "12px 16px",
                      borderRadius:
                        m.role === "user"
                          ? "18px 18px 4px 18px"
                          : "18px 18px 18px 4px",
                      background:
                        m.role === "user"
                          ? "linear-gradient(135deg,#FF6B35,#FF9A3C)"
                          : v.inputBg,
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: v.text,
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                    }}
                  />
                  <div
                    style={{ ...gc, padding: "12px 16px", borderRadius: 18 }}
                  >
                    <div style={{ display: "flex", gap: 4 }}>
                      {[0, 0.2, 0.4].map((d, i) => (
                        <div
                          key={i}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: v.muted,
                            animation: `pulse 1s ease ${d}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                padding: "0 24px 16px",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {[
                "Je veux un repas rapide",
                "Peu de calories",
                "Plat protéiné",
                "Avec des œufs",
              ].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setChatInput(p)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 100,
                    border: `1px solid ${v.border}`,
                    background: v.inputBg,
                    color: v.muted,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderTop: `1px solid ${v.border}`,
                display: "flex",
                gap: 12,
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Demandez quelque chose à votre Chef IA…"
                style={{
                  flex: 1,
                  background: v.inputBg,
                  border: `1px solid ${v.inputBorder}`,
                  borderRadius: 100,
                  padding: "12px 20px",
                  color: v.text,
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={sendMessage}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#fff",
                }}
              >
                ↑
              </button>
            </div>
          </div>
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
                "Chat Chef IA disponible 24h/24",
                "Suivi nutritionnel avancé",
                "Alertes de péremption intelligentes",
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
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "linear-gradient(135deg,#FF6B35,#2ECC71)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  🥗
                </div>
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
            {[
              {
                title: "Produit",
                links: ["Fonctionnalités", "Tarifs", "Roadmap", "Changelog"],
              },
              {
                title: "Ressources",
                links: ["Blog recettes", "Guide nutrition", "Centre d'aide"],
              },
              {
                title: "Légal",
                links: [
                  "CGU",
                  "Politique de confidentialité",
                  "Cookies",
                  "RGPD",
                ],
              },
            ].map((col) => (
              <div key={col.title} style={{ flex: 1, minWidth: 140 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: v.text,
                    marginBottom: 16,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {col.title}
                </div>
                {col.links.map((l) => (
                  <div key={l} style={{ marginBottom: 10 }}>
                    <a
                      href="#"
                      style={{
                        color: v.muted,
                        fontSize: 14,
                        textDecoration: "none",
                      }}
                    >
                      {l}
                    </a>
                  </div>
                ))}
              </div>
            ))}
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
