import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

// ── Tokens ────────────────────────────────────────────────────────────────────
const C = {
  bg: "#07070E",
  text: "#F0EEF8",
  muted: "#6B7280",
  border: "rgba(255,255,255,0.08)",
  orange: "#FF6B35",
  green: "#2ECC71",
};
const grad = "linear-gradient(135deg,#FF6B35 0%,#FF9A3C 40%,#2ECC71 100%)";
const gradText: React.CSSProperties = {
  background: grad,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

// ── Global CSS ────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes floatY { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
  @keyframes scanDown { 0%{top:10%;opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{top:90%;opacity:0} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
  @keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
  @keyframes orbFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(48px,28px) scale(1.09)} }
  @keyframes orbFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-38px,-22px) scale(1.07)} }
  @keyframes modalIn { from{opacity:0;transform:translateY(32px) scale(0.97)} to{opacity:1;transform:none} }
  @keyframes glow { 0%,100%{box-shadow:0 0 40px rgba(255,107,53,0.15)} 50%{box-shadow:0 0 80px rgba(255,107,53,0.3)} }
  @keyframes bounceUp { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  @keyframes slideUp { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html { scroll-behavior:smooth; }
  body { background:${C.bg}; font-family:'Helvetica Neue',Arial,sans-serif; color:${C.text}; overflow-x:hidden; }
  button { cursor:pointer; transition:transform 0.18s,opacity 0.18s; }
  button:active { transform:scale(0.97) !important; }
  a { text-decoration:none; }
  input,textarea { font-family:inherit; }
  @media(max-width:780px){
    .land-nav-links,.land-nav-actions-full { display:none !important; }
    .land-hero { flex-direction:column !important; text-align:center; }
    .land-feat { flex-direction:column !important; }
  }
`;

// ── Scroll reveal hook ────────────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, vis] as const;
}

// ── Reveal wrapper ────────────────────────────────────────────────────────────
function R({
  children, delay = 0, y = 36, style,
}: { children: React.ReactNode; delay?: number; y?: number; style?: React.CSSProperties }) {
  const [ref, vis] = useReveal();
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? "none" : `translateY(${y}px)`,
      transition: `opacity 0.75s ease ${delay}s, transform 0.75s ease ${delay}s`,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Phone mockup ──────────────────────────────────────────────────────────────
function Phone({ style }: { style?: React.CSSProperties }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % 3), 2800);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      width: 258, height: 528, borderRadius: 42,
      background: "#0C0C18",
      border: "2px solid rgba(255,255,255,0.13)",
      boxShadow: "0 52px 104px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.07)",
      position: "relative", overflow: "hidden",
      animation: "floatY 4.2s ease-in-out infinite",
      ...style,
    }}>
      <div style={{ position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",width:86,height:22,background:"#000",borderRadius:"0 0 16px 16px",zIndex:5 }} />
      <div style={{ position:"absolute",inset:5,borderRadius:37,overflow:"hidden",background:"#080812" }}>
        <img src="/images/frigo.jpg" alt="" style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:.55 }} />
        <div style={{ position:"absolute",inset:0,background:"linear-gradient(160deg,rgba(0,18,0,.5),rgba(0,0,8,.3))" }} />

        {step === 0 && (
          <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,.38)" }}>
            <div style={{ position:"absolute",left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#2ECC71,transparent)",boxShadow:"0 0 20px #2ECC71",animation:"scanDown 2.5s ease-in-out infinite" }} />
            {[{t:9,l:9,bw:"2px 0 0 2px"},{t:9,r:9,bw:"2px 2px 0 0"},{b:9,l:9,bw:"0 0 2px 2px"},{b:9,r:9,bw:"0 2px 2px 0"}].map((c,i)=>(
              <span key={i} style={{ position:"absolute",width:18,height:18,borderColor:"#2ECC71",borderStyle:"solid",borderWidth:c.bw,top:c.t,left:c.l,bottom:c.b,right:c.r }} />
            ))}
            <div style={{ position:"absolute",bottom:52,left:0,right:0,textAlign:"center",fontSize:10,color:"#2ECC71",fontWeight:700,letterSpacing:2,animation:"pulse 1.1s infinite" }}>ANALYSE EN COURS…</div>
          </div>
        )}

        {step === 1 && (
          <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,.78)",padding:18,display:"flex",flexDirection:"column",justifyContent:"center",gap:8 }}>
            <div style={{ fontSize:9,color:"#2ECC71",fontWeight:700,letterSpacing:2,marginBottom:4 }}>INGRÉDIENTS DÉTECTÉS</div>
            {[["🥛","Lait"],["🍅","Tomates"],["🥚","Œufs"],["🧀","Fromage"]].map(([ic,nm],i)=>(
              <div key={i} style={{ display:"flex",alignItems:"center",gap:8,background:"rgba(46,204,113,.13)",border:"1px solid rgba(46,204,113,.28)",borderRadius:10,padding:"7px 10px",fontSize:11,color:"#fff" }}>
                <span>{ic}</span><span style={{flex:1}}>{nm}</span><span style={{color:"#2ECC71",fontSize:10}}>97%</span>
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div style={{ position:"absolute",inset:0,background:"#070710",padding:16 }}>
            <div style={{ fontSize:9,color:"#FF6B35",fontWeight:700,letterSpacing:2,marginTop:36,marginBottom:12 }}>RECETTES SUGGÉRÉES</div>
            {[{img:"/images/omelette-tomates.jpg",t:"Omelette tomates",s:"8 min · 320 kcal"},{img:"/images/salade-caprese.jpg",t:"Salade fraîche",s:"5 min · 180 kcal"},{img:"/images/pasta-legumes.jpg",t:"Pasta express",s:"20 min · 520 kcal"}].map((r,i)=>(
              <div key={i} style={{ background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:"7px",marginBottom:8,display:"flex",gap:8,alignItems:"center" }}>
                <img src={r.img} alt={r.t} style={{ width:40,height:40,borderRadius:9,objectFit:"cover",flexShrink:0 }} />
                <div>
                  <div style={{ fontSize:10,color:"#fff",fontWeight:700 }}>{r.t}</div>
                  <div style={{ fontSize:9,color:C.muted }}>{r.s}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Auth modal ────────────────────────────────────────────────────────────────
function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"signup"|"login">("signup");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const submit = async () => {
    if (!email || !pw) { setMsg("Remplissez tous les champs."); return; }
    setMsg("");
    if (mode === "signup") {
      setReviewing(true);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      onClose();
    } catch (e: any) {
      setMsg(e.message || "Une erreur est survenue.");
    } finally { setLoading(false); }
  };

  const confirmSignup = async () => {
    setLoading(true); setMsg("");
    try {
      const { error } = await supabase.auth.signUp({ email, password: pw });
      if (error) throw error;
      onClose();
    } catch (e: any) {
      setMsg(e.message || "Une erreur est survenue.");
      setReviewing(false);
    } finally { setLoading(false); }
  };

  const signInWithGoogle = async () => {
    setLoading(true); setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setMsg(error.message); setLoading(false); }
  };

  const inp: React.CSSProperties = {
    width:"100%", padding:"14px 18px", borderRadius:14,
    border:"1px solid rgba(255,255,255,.1)", background:"rgba(255,255,255,.06)",
    color:C.text, fontSize:15, outline:"none",
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position:"fixed",inset:0,zIndex:1000,
        background:"rgba(0,0,0,.78)",backdropFilter:"blur(14px)",
        display:"flex",alignItems:"center",justifyContent:"center",padding:20,
      }}
    >
      <div style={{
        width:"100%",maxWidth:420,background:"#0E0E1A",
        border:"1px solid rgba(255,255,255,.1)",borderRadius:28,padding:40,
        position:"relative",animation:"modalIn .35s ease both",
        boxShadow:"0 40px 80px rgba(0,0,0,.65),0 0 0 1px rgba(255,107,53,.15)",
      }}>
        <button onClick={onClose} style={{ position:"absolute",top:16,right:18,background:"none",border:"none",color:C.muted,fontSize:22,lineHeight:1 }}>✕</button>

        {reviewing && (
          <div style={{ textAlign:"center", padding:"8px 0" }}>
            <div style={{ fontSize:44, marginBottom:16 }}>👀</div>
            <h2 style={{ fontSize:20, fontWeight:900, color:C.text, marginBottom:10 }}>Vérifiez vos informations</h2>
            <p style={{ fontSize:14, color:C.muted, lineHeight:1.6, marginBottom:24 }}>
              Votre compte sera créé avec cette adresse :
            </p>
            <div style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:14, padding:"14px 20px", marginBottom:8, fontSize:13, fontWeight:700, color:C.text, textAlign:"center", overflowWrap:"break-word", wordBreak:"break-word" }}>
              {email}
            </div>
            <p style={{ fontSize:12, color:C.muted, marginBottom:28 }}>
              C'est à cette adresse que vous recevrez vos reçus et que vous pourrez récupérer votre compte.
            </p>
            {msg && <div style={{ fontSize:13, color:"#FF5050", marginBottom:12 }}>{msg}</div>}
            <button
              onClick={confirmSignup}
              disabled={loading}
              style={{ width:"100%", padding:"15px", borderRadius:14, border:"none", background:grad, color:"#fff", fontWeight:800, fontSize:15, cursor:loading?"not-allowed":"pointer", opacity:loading?0.7:1, marginBottom:12 }}
            >{loading ? "Création…" : "Confirmer et démarrer →"}</button>
            <button
              onClick={() => { setReviewing(false); setMsg(""); }}
              style={{ background:"none", border:"none", color:C.muted, fontSize:13, cursor:"pointer" }}
            >← Corriger l'email</button>
          </div>
        )}

        {!reviewing && (<>

        <div style={{ textAlign:"center",marginBottom:32 }}>
          <div style={{ marginBottom:10,display:"flex",justifyContent:"center" }}><img src="/logo.png" alt="Frigia" style={{ width:64,height:64,borderRadius:16,objectFit:"contain" }} /></div>
          <h2 style={{ fontSize:22,fontWeight:900,color:C.text,marginBottom:6 }}>
            {mode === "signup" ? "Commencer gratuitement" : "Bon retour !"}
          </h2>
          <p style={{ fontSize:14,color:C.muted }}>
            {mode === "signup" ? "4 jours gratuits · Aucune carte requise." : "Connectez-vous à Frigia."}
          </p>
        </div>

        {/* Toggle */}
        <div style={{ display:"flex",gap:3,background:"rgba(255,255,255,.05)",borderRadius:12,padding:4,marginBottom:26 }}>
          {(["signup","login"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setMsg(""); }} style={{
              flex:1,padding:"9px",borderRadius:10,border:"none",
              background: mode===m ? "rgba(255,255,255,.1)" : "transparent",
              color: mode===m ? C.text : C.muted,
              fontWeight: mode===m ? 700 : 400, fontSize:14,
            }}>
              {m === "signup" ? "Créer un compte" : "Connexion"}
            </button>
          ))}
        </div>

        {/* Google OAuth */}
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          style={{
            width:"100%", padding:"14px", borderRadius:14,
            border:"1px solid rgba(255,255,255,.15)",
            background:"rgba(255,255,255,.06)",
            color:C.text, fontSize:15, fontWeight:600,
            display:"flex", alignItems:"center", justifyContent:"center", gap:12,
            marginBottom:20, opacity: loading ? 0.7 : 1,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.09-6.09C34.46 3.08 29.5 1 24 1 14.82 1 7.07 6.48 3.96 14.18l7.1 5.52C12.73 13.44 17.94 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.52 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.67c-.55 2.97-2.2 5.48-4.68 7.17l7.18 5.58C43.32 37.45 46.52 31.4 46.52 24.5z"/>
            <path fill="#FBBC05" d="M11.06 28.3A14.56 14.56 0 0 1 9.5 24c0-1.49.26-2.93.72-4.28l-7.1-5.52A23.94 23.94 0 0 0 0 24c0 3.87.92 7.53 2.54 10.76l8.52-6.46z"/>
            <path fill="#34A853" d="M24 47c5.5 0 10.12-1.82 13.49-4.96l-7.18-5.58C28.52 37.82 26.37 38.5 24 38.5c-6.06 0-11.27-3.94-13.14-9.44l-8.52 6.46C5.8 43.18 14.27 47 24 47z"/>
          </svg>
          Continuer avec Google
        </button>

        {/* Divider */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <div style={{ flex:1, height:1, background:"rgba(255,255,255,.08)" }} />
          <span style={{ fontSize:12, color:C.muted, whiteSpace:"nowrap" }}>ou avec votre email</span>
          <div style={{ flex:1, height:1, background:"rgba(255,255,255,.08)" }} />
        </div>

        <div style={{ display:"flex",flexDirection:"column",gap:13 }}>
          <input placeholder="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inp} />
          <input placeholder="Mot de passe" type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={inp} />

          {msg && <div style={{ fontSize:13,color:msg.startsWith("✓")?C.green:"#FF5050",textAlign:"center",lineHeight:1.5 }}>{msg}</div>}

          <button onClick={submit} disabled={loading} style={{
            padding:"15px",borderRadius:14,border:"none",background:grad,
            color:"#fff",fontWeight:800,fontSize:15,marginTop:4,
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "…" : mode==="signup" ? "Démarrer gratuitement →" : "Se connecter →"}
          </button>

          <p style={{ fontSize:12,color:C.muted,textAlign:"center" }}>
            ✓ Sans engagement · ✓ Résiliable à tout moment
          </p>
        </div>
        </>)}
      </div>
    </div>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ onOpen }: { onOpen: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <nav style={{
      position:"fixed",top:0,left:0,right:0,zIndex:200,
      paddingTop:"calc(16px + env(safe-area-inset-top))",
      paddingBottom:"16px",
      paddingLeft:"48px",
      paddingRight:"48px",
      background: scrolled ? "rgba(7,7,14,.92)" : "transparent",
      backdropFilter: scrolled ? "blur(22px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,.06)" : "none",
      transition:"all .35s",
      display:"flex",alignItems:"center",justifyContent:"space-between",
    }}>
      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
        <img src="/logo.png" alt="Frigia" style={{ width:34,height:34,borderRadius:10,objectFit:"contain" }} />
        <span style={{ fontWeight:900,fontSize:22,color:C.text,fontFamily:"Georgia,serif" }}>Frigia</span>
      </div>
      <div className="land-nav-links" style={{ display:"flex",gap:28,fontSize:14 }}>
        {["Fonctionnalités","Comment ça marche","Tarifs","FAQ"].map(l=>(
          <a key={l} href="#" style={{ color:C.muted,transition:"color .2s" }} onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color=C.muted)}>{l}</a>
        ))}
      </div>
      <div className="land-nav-actions-full" style={{ display:"flex",gap:12 }}>
        <button onClick={onOpen} style={{ padding:"10px 22px",background:"none",border:"1px solid rgba(255,255,255,.1)",borderRadius:100,color:C.text,fontSize:14,fontWeight:500 }}>Connexion</button>
        <button onClick={onOpen} style={{ padding:"10px 22px",background:grad,border:"none",borderRadius:100,color:"#fff",fontWeight:700,fontSize:14 }}>Essayer →</button>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function Hero({ onOpen, onInstall }: { onOpen: () => void; onInstall?: () => void }) {
  const orb1 = useRef<HTMLDivElement>(null);
  const orb2 = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - .5;
      const y = e.clientY / window.innerHeight - .5;
      if (orb1.current) orb1.current.style.transform = `translate(${x*50}px,${y*35}px)`;
      if (orb2.current) orb2.current.style.transform = `translate(${-x*36}px,${-y*26}px)`;
    };
    window.addEventListener("mousemove", h, { passive: true });
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const ua = navigator.userAgent;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isChromeIOS = /crios/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome/i.test(ua);
  const isRegularChrome = !isStandalone && !isIOS && !isChromeIOS && !isSafari && /chrome/i.test(ua);

  return (
    <section style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:isRegularChrome?"80px 48px 60px":"120px 48px 80px",position:"relative",overflow:"hidden" }}>
      {/* Orbs */}
      <div ref={orb1} style={{ position:"absolute",width:680,height:680,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,107,53,.14) 0%,transparent 70%)",top:"-18%",left:"-14%",pointerEvents:"none",transition:"transform .45s ease",animation:"orbFloat1 11s ease-in-out infinite" }} />
      <div ref={orb2} style={{ position:"absolute",width:580,height:580,borderRadius:"50%",background:"radial-gradient(circle,rgba(46,204,113,.11) 0%,transparent 70%)",bottom:"-12%",right:"-10%",pointerEvents:"none",transition:"transform .45s ease",animation:"orbFloat2 13s ease-in-out infinite" }} />

      {/* Grid */}
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(255,255,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.022) 1px,transparent 1px)",backgroundSize:"90px 90px" }} />

      <div className="land-hero" style={{ maxWidth:1200,width:"100%",display:"flex",gap:80,alignItems:"center",flexWrap:"wrap",position:"relative",zIndex:1 }}>
        {/* Copy */}
        <div style={{ flex:1,minWidth:300,maxWidth:600 }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"6px 16px",background:"rgba(46,204,113,.1)",border:"1px solid rgba(46,204,113,.22)",borderRadius:100,fontSize:13,color:"#2ECC71",fontWeight:700,marginBottom:28,animation:"fadeIn .7s ease both" }}>
            <span style={{ width:6,height:6,borderRadius:"50%",background:"#2ECC71",animation:"pulse 2s ease infinite" }} />
            4 jours gratuits · Puis 7,99€/mois
          </div>

          <h1 style={{ fontSize:"clamp(38px,5.2vw,68px)",fontWeight:900,lineHeight:1.06,letterSpacing:-2,marginBottom:isRegularChrome?16:24,fontFamily:"Georgia,serif",color:C.text,animation:"fadeIn .8s ease .08s both" }}>
            Prenez votre frigo<br />en photo.{" "}
            <span style={gradText}>L'IA cuisine<br />pour vous.</span>
          </h1>

          <p style={{ fontSize:18,color:C.muted,lineHeight:1.78,marginBottom:isRegularChrome?28:42,animation:"fadeIn .8s ease .18s both" }}>
            Des recettes générées instantanément<br />à partir des aliments que vous avez déjà.
          </p>

          <div style={{ display:"flex",flexDirection:"column",gap:12,marginBottom:isRegularChrome?36:52,animation:"fadeIn .8s ease .28s both" }}>
            {onInstall ? (
              <>
                <button onClick={onInstall} style={{ padding:"16px 34px",background:grad,border:"none",borderRadius:100,color:"#fff",fontWeight:800,fontSize:16,boxShadow:"0 10px 38px rgba(255,107,53,.38)",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                  Télécharger l'app
                </button>
                <button onClick={onOpen} style={{ background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",textDecoration:"underline",padding:"4px 0" }}>
                  Essayer dans le navigateur
                </button>
              </>
            ) : (
              <button onClick={onOpen} style={{ padding:"16px 34px",background:grad,border:"none",borderRadius:100,color:"#fff",fontWeight:800,fontSize:16,boxShadow:"0 10px 38px rgba(255,107,53,.38)" }}>
                Démarrer gratuitement
              </button>
            )}
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:14,animation:"fadeIn .8s ease .36s both" }}>
            <div style={{ display:"flex" }}>
              {["👩","👨","🧑","👩‍🍳","👨‍🍳"].map((e,i)=>(
                <div key={i} style={{ width:34,height:34,borderRadius:"50%",background:`hsl(${i*42},68%,38%)`,border:"2px solid #07070E",marginLeft:i?-8:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>{e}</div>
              ))}
            </div>
            <div style={{ fontSize:13,color:C.muted }}>
              <span style={{ color:C.text,fontWeight:700 }}>4 800+</span> chefs amateurs
              <div style={{ color:"#FFB800",fontSize:12,marginTop:2 }}>★★★★★</div>
            </div>
          </div>
        </div>

        {/* Phone */}
        <div style={{ position:"relative",animation:"fadeIn .9s ease .14s both",flexShrink:0 }}>
          <Phone />
          <div style={{ position:"absolute",top:60,right:-56,background:"rgba(16,16,26,.94)",backdropFilter:"blur(18px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,whiteSpace:"nowrap",animation:"floatY 3.3s ease-in-out infinite" }}>
            <span style={{ fontSize:20 }}>🥦</span>
            <div><div style={{ fontWeight:700,color:C.text,fontSize:11 }}>Brocoli détecté</div><div style={{ color:"#2ECC71",fontSize:10 }}>96% confiance</div></div>
          </div>
          <div style={{ position:"absolute",bottom:90,left:-56,background:"rgba(16,16,26,.94)",backdropFilter:"blur(18px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,whiteSpace:"nowrap",animation:"floatY 3.9s ease-in-out .5s infinite" }}>
            <span style={{ fontSize:20 }}>🍳</span>
            <div><div style={{ fontWeight:700,color:C.text,fontSize:11 }}>Recette générée</div><div style={{ color:"#FF6B35",fontSize:10 }}>8 min · 320 kcal</div></div>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div style={{ position:"absolute",bottom:30,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:5,color:C.muted,fontSize:10,letterSpacing:2,textTransform:"uppercase",animation:"pulse 2.5s ease infinite" }}>
        <span>Défiler</span><span style={{ fontSize:16 }}>↓</span>
      </div>
    </section>
  );
}

// ── Marquee ───────────────────────────────────────────────────────────────────
function Marquee() {
  const items = ["📸 Scan IA ultra-précis","🥗 Recettes sur-mesure","💚 Zéro gaspillage","📊 Suivi nutritionnel","✨ 120 000+ recettes","⭐ 4,9/5 App Store","🔒 Données sécurisées","🌱 Anti-gaspi certifié"];
  const all = [...items,...items];
  return (
    <div style={{ borderTop:"1px solid rgba(255,255,255,.06)",borderBottom:"1px solid rgba(255,255,255,.06)",background:"rgba(255,255,255,.018)",overflow:"hidden",padding:"17px 0",userSelect:"none" }}>
      <div style={{ display:"flex",gap:60,whiteSpace:"nowrap",animation:"marquee 28s linear infinite",width:"max-content" }}>
        {all.map((item,i)=>(
          <span key={i} style={{ fontSize:14,color:C.muted,fontWeight:500 }}>{item}</span>
        ))}
      </div>
    </div>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { n:"01",icon:"📸",title:"Photographiez votre frigo",desc:"Une photo claire depuis l'appli. Ça prend 2 secondes." },
    { n:"02",icon:"🤖",title:"L'IA analyse tout",desc:"Frigia identifie chaque aliment avec 98% de précision." },
    { n:"03",icon:"🍽️",title:"Recettes personnalisées",desc:"Recevez 5+ idées adaptées à vos ingrédients et goûts." },
    { n:"04",icon:"✨",title:"Cuisinez & savourez",desc:"Suivez les étapes, réduisez le gaspillage, mangez mieux." },
  ];
  return (
    <section style={{ padding:"100px 48px",maxWidth:1100,margin:"0 auto" }}>
      <R style={{ textAlign:"center",marginBottom:72 }}>
        <div style={{ fontSize:11,fontWeight:700,color:C.orange,letterSpacing:4,textTransform:"uppercase",marginBottom:16 }}>Comment ça marche</div>
        <h2 style={{ fontSize:"clamp(30px,4vw,52px)",fontWeight:900,letterSpacing:-1.5,color:C.text,lineHeight:1.1 }}>
          4 étapes.{" "}<span style={gradText}>Zéro prise de tête.</span>
        </h2>
      </R>
      <div style={{ display:"flex",gap:24,flexWrap:"wrap",justifyContent:"center",position:"relative" }}>
        <div style={{ position:"absolute",top:34,left:"8%",right:"8%",height:1,background:"linear-gradient(90deg,transparent,rgba(255,107,53,.35),rgba(46,204,113,.35),transparent)",pointerEvents:"none" }} />
        {steps.map((s,i)=>(
          <R key={i} delay={i*.11} style={{ flex:1,minWidth:210,maxWidth:248 }}>
            <div
              style={{ background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:24,padding:"34px 22px",textAlign:"center",transition:"border-color .3s,transform .3s" }}
              onMouseEnter={e=>{ const d=e.currentTarget; d.style.borderColor="rgba(255,107,53,.28)"; d.style.transform="translateY(-7px)"; }}
              onMouseLeave={e=>{ const d=e.currentTarget; d.style.borderColor="rgba(255,255,255,.07)"; d.style.transform="none"; }}
            >
              <div style={{ width:50,height:50,borderRadius:"50%",margin:"0 auto 16px",background:"linear-gradient(135deg,rgba(255,107,53,.18),rgba(46,204,113,.18))",border:"1px solid rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24 }}>{s.icon}</div>
              <div style={{ fontSize:11,fontWeight:700,color:C.muted,marginBottom:10,letterSpacing:1 }}>{s.n}</div>
              <h3 style={{ fontSize:16,fontWeight:800,color:C.text,marginBottom:10,lineHeight:1.3 }}>{s.title}</h3>
              <p style={{ fontSize:13,color:C.muted,lineHeight:1.75 }}>{s.desc}</p>
            </div>
          </R>
        ))}
      </div>
    </section>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function Stats() {
  return (
    <section style={{ background:"rgba(255,255,255,.016)",borderTop:"1px solid rgba(255,255,255,.06)",borderBottom:"1px solid rgba(255,255,255,.06)",padding:"72px 16px" }}>
      <div style={{ maxWidth:960,margin:"0 auto",display:"flex",justifyContent:"center" }}>
        <R delay={0} style={{ textAlign:"center",padding:"28px 16px",width:"100%",overflow:"visible" }}>
          <div style={{ fontSize:"clamp(40px,12vw,64px)",fontWeight:900,...gradText,marginBottom:8,lineHeight:1.4,paddingBottom:12,display:"inline-block" }}>2,3 kg</div>
          <div style={{ fontSize:14,color:C.muted }}>Gaspillage évité par mois</div>
        </R>
      </div>
    </section>
  );
}

// ── Testimonials Marquee ──────────────────────────────────────────────────────
function TestimonialsMarquee() {
  const items = [
    { name:"Sophie M.",role:"Maman de 3 enfants",text:"Fini le gaspillage et les repas répétitifs. Frigia a changé mon quotidien.",emoji:"👩",stars:5 },
    { name:"Thomas D.",role:"Étudiant en médecine",text:"Je mange sain avec un budget serré. L'IA génère des recettes créatives en quelques secondes.",emoji:"👨",stars:5 },
    { name:"Amélie R.",role:"Chef amateur",text:"Des combinaisons auxquelles je n'aurais jamais pensé seule. Incroyable !",emoji:"🧑",stars:5 },
    { name:"Lucas B.",role:"Sportif",text:"Les macros et calories calculées automatiquement. Mon coach est jaloux.",emoji:"👨‍🍳",stars:5 },
    { name:"Camille V.",role:"Végétarienne",text:"Enfin des recettes vegan créatives à partir de ce que j'ai déjà. Parfait.",emoji:"👩‍🍳",stars:5 },
    { name:"Marc L.",role:"Père de famille",text:"On ne jette plus rien depuis qu'on utilise Frigia. Les enfants adorent choisir les recettes.",emoji:"👨",stars:5 },
    { name:"Inès F.",role:"Étudiante",text:"Budget ultra serré, zéro gaspillage. L'app m'a sauvé la mise chaque semaine.",emoji:"👩",stars:5 },
    { name:"Kevin T.",role:"Cuisinier passionné",text:"La précision de détection est bluffante. 98% c'est vraiment exact.",emoji:"🧑",stars:5 },
  ];
  const all = [...items, ...items];
  return (
    <div style={{ overflow:"hidden", padding:"36px 0", background:"rgba(255,255,255,.012)", borderBottom:"1px solid rgba(255,255,255,.06)", userSelect:"none" }}>
      <div style={{ display:"flex", gap:20, whiteSpace:"nowrap", animation:"marquee 40s linear infinite", width:"max-content", alignItems:"stretch" }}>
        {all.map((item, i) => (
          <div key={i} style={{
            display:"inline-flex", flexDirection:"column", justifyContent:"space-between",
            width:280, whiteSpace:"normal",
            background:"rgba(255,255,255,.04)",
            border:"1px solid rgba(255,255,255,.08)",
            borderRadius:20, padding:"20px 22px",
            flexShrink:0, verticalAlign:"top",
          }}>
            <div>
              <div style={{ color:"#FFB800", fontSize:13, letterSpacing:2, marginBottom:10 }}>{"★".repeat(item.stars)}</div>
              <p style={{ fontSize:13, color:"rgba(255,255,255,.82)", lineHeight:1.7, marginBottom:14, fontStyle:"italic" }}>"{item.text}"</p>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ width:32, height:32, borderRadius:"50%", background:`hsl(${i*44},60%,35%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{item.emoji}</div>
              <div>
                <div style={{ fontWeight:700, color:C.text, fontSize:12 }}>{item.name}</div>
                <div style={{ fontSize:11, color:C.muted }}>{item.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────────────

// ── Pricing ───────────────────────────────────────────────────────────────────
function Pricing({ onOpen }: { onOpen: () => void }) {
  return (
    <section style={{ padding:"80px 48px",background:"rgba(255,255,255,.015)",borderTop:"1px solid rgba(255,255,255,.06)" }}>
      <R style={{ textAlign:"center",marginBottom:64 }}>
        <div style={{ fontSize:11,fontWeight:700,color:C.orange,letterSpacing:4,textTransform:"uppercase",marginBottom:16 }}>Tarifs</div>
        <h2 style={{ fontSize:"clamp(28px,4vw,52px)",fontWeight:900,letterSpacing:-1,color:C.text }}>Simple et transparent</h2>
        <p style={{ color:C.muted,fontSize:16,marginTop:12 }}>4 jours gratuits, puis un seul plan sans surprise.</p>
      </R>
      <R delay={.1} style={{ maxWidth:460,margin:"0 auto",position:"relative" }}>
        <div style={{ position:"absolute",top:-16,left:"50%",transform:"translateX(-50%)",background:grad,borderRadius:100,padding:"6px 24px",fontSize:13,fontWeight:800,color:"#fff",whiteSpace:"nowrap",zIndex:1 }}>🎉 4 jours gratuits inclus</div>
        <div style={{ background:"linear-gradient(135deg,rgba(255,107,53,.1),rgba(46,204,113,.1))",border:"1px solid rgba(255,107,53,.3)",borderRadius:28,padding:"52px 44px",textAlign:"center",animation:"glow 4s ease-in-out infinite" }}>
          <div style={{ fontSize:12,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:2,marginBottom:12 }}>Frigia Premium</div>
          <div style={{ display:"flex",alignItems:"baseline",justifyContent:"center",gap:6,marginBottom:6 }}>
            <span style={{ fontSize:62,fontWeight:900,color:C.text }}>7,99€</span>
            <span style={{ color:C.muted,fontSize:16 }}>/mois</span>
          </div>
          <div style={{ fontSize:13,color:"#2ECC71",fontWeight:700,marginBottom:36 }}>✓ Résiliable à tout moment</div>
          <ul style={{ listStyle:"none",textAlign:"left",marginBottom:36,display:"flex",flexDirection:"column",gap:13 }}>
            {["Scans IA illimités","Recettes personnalisées illimitées","Suivi nutritionnel avancé","Toutes futures fonctionnalités incluses"].map((f,i)=>(
              <li key={i} style={{ display:"flex",gap:12,alignItems:"flex-start",fontSize:15,color:C.text }}>
                <span style={{ color:"#2ECC71",fontWeight:900 }}>✓</span>{f}
              </li>
            ))}
          </ul>
          <button onClick={onOpen} style={{ width:"100%",padding:"16px",borderRadius:100,fontWeight:800,fontSize:16,border:"none",background:grad,color:"#fff",boxShadow:"0 8px 32px rgba(255,107,53,.3)" }}>
            Commencer gratuitement →
          </button>
          <p style={{ fontSize:12,color:C.muted,marginTop:14 }}>Aucune carte bancaire requise pendant l'essai</p>
        </div>
      </R>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number|null>(null);
  const faqs = [
    { q:"Comment fonctionne l'essai gratuit ?",a:"4 jours d'accès complet, sans carte bancaire. Au 5ème jour, le prélèvement de 7,99€/mois démarre si vous continuez." },
    { q:"Comment résilier ?",a:"Depuis Paramètres → Abonnement, en un clic. L'accès reste actif jusqu'à la fin de la période payée. Aucune pénalité." },
    { q:"Comment fonctionne la détection IA ?",a:"Frigia utilise un modèle de vision IA pour analyser vos photos et identifier les ingrédients avec 98% de précision, puis génère des recettes adaptées." },
    { q:"Mes données sont-elles sécurisées ?",a:"Vos photos sont analysées puis supprimées automatiquement. Nous ne stockons aucune image sur nos serveurs." },
    { q:"Puis-je personnaliser les recettes ?",a:"Oui — régimes, allergies, préférences, budget. Le Chef IA s'adapte à vous au fil du temps." },
  ];
  return (
    <section style={{ padding:"100px 48px",borderTop:"1px solid rgba(255,255,255,.06)" }}>
      <div style={{ maxWidth:720,margin:"0 auto" }}>
        <R style={{ textAlign:"center",marginBottom:56 }}>
          <div style={{ fontSize:11,fontWeight:700,color:C.orange,letterSpacing:4,textTransform:"uppercase",marginBottom:16 }}>FAQ</div>
          <h2 style={{ fontSize:"clamp(28px,4vw,48px)",fontWeight:900,letterSpacing:-1,color:C.text }}>Questions fréquentes</h2>
        </R>
        {faqs.map((f,i)=>(
          <R key={i} delay={i*.06}>
            <div
              onClick={()=>setOpen(open===i?null:i)}
              style={{ background:"rgba(255,255,255,.03)",border:`1px solid ${open===i?"rgba(255,107,53,.3)":"rgba(255,255,255,.07)"}`,borderRadius:18,marginBottom:11,cursor:"pointer",transition:"border-color .3s",overflow:"hidden" }}
            >
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px" }}>
                <span style={{ fontWeight:600,fontSize:15,color:C.text }}>{f.q}</span>
                <span style={{ color:C.orange,fontSize:22,transform:open===i?"rotate(45deg)":"none",transition:"transform .3s",flexShrink:0,marginLeft:12,lineHeight:1 }}>+</span>
              </div>
              {open===i && <div style={{ padding:"0 24px 20px",fontSize:14,color:C.muted,lineHeight:1.78 }}>{f.a}</div>}
            </div>
          </R>
        ))}
      </div>
    </section>
  );
}

// ── CTA ───────────────────────────────────────────────────────────────────────
// ── Legal Modal ───────────────────────────────────────────────────────────────
function LegalModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:24 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#12121A",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:40,maxWidth:680,width:"100%",maxHeight:"80vh",overflowY:"auto" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28 }}>
          <h2 style={{ fontSize:22,fontWeight:900,color:C.text }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none",border:"none",color:C.muted,fontSize:22,lineHeight:1 }}>✕</button>
        </div>
        <div style={{ color:"rgba(255,255,255,0.7)",fontSize:14,lineHeight:1.8 }}>{children}</div>
      </div>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  const [modal, setModal] = useState<"cgu"|"confidentialite"|"mentions"|null>(null);
  const s = { heading:{ fontWeight:700,color:C.text,marginTop:20,marginBottom:6,display:"block" } as React.CSSProperties };

  return (
    <>
    {modal === "mentions" && (
      <LegalModal title="Mentions légales" onClose={() => setModal(null)}>
        <span style={s.heading}>Éditeur</span>
        Frigia — Application web éditée par un particulier.<br />
        Contact : <a href="mailto:frigia.contact@gmail.com" style={{ color:C.orange }}>frigia.contact@gmail.com</a>
        <span style={s.heading}>Hébergement</span>
        Vercel Inc., 340 Pine Street Suite 900, San Francisco, CA 94104, USA.
        <span style={s.heading}>Propriété intellectuelle</span>
        L'ensemble du contenu de ce site (textes, images, logo) est protégé par le droit d'auteur. Toute reproduction est interdite sans autorisation.
      </LegalModal>
    )}
    {modal === "cgu" && (
      <LegalModal title="Conditions Générales d'Utilisation" onClose={() => setModal(null)}>
        <span style={s.heading}>1. Objet</span>
        Les présentes CGU régissent l'utilisation de l'application Frigia, service d'analyse de réfrigérateur par intelligence artificielle.
        <span style={s.heading}>2. Accès au service</span>
        L'accès à Frigia nécessite la création d'un compte et la souscription à un abonnement. Un essai gratuit de 4 jours est proposé, avec saisie des informations bancaires obligatoire. À l'issue de l'essai, l'abonnement est de 7,99€/mois.
        <span style={s.heading}>3. Résiliation</span>
        L'abonnement peut être résilié à tout moment depuis les paramètres de l'application, sans frais. La résiliation prend effet à la fin de la période en cours.
        <span style={s.heading}>4. Droit de rétractation</span>
        Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux contenus numériques fournis immédiatement après souscription.
        <span style={s.heading}>5. Responsabilité</span>
        Les recettes générées par l'IA sont fournies à titre indicatif. Frigia ne peut être tenu responsable d'une utilisation inappropriée des suggestions.
        <span style={s.heading}>6. Contact</span>
        <a href="mailto:frigia.contact@gmail.com" style={{ color:C.orange }}>frigia.contact@gmail.com</a>
      </LegalModal>
    )}
    {modal === "confidentialite" && (
      <LegalModal title="Politique de confidentialité" onClose={() => setModal(null)}>
        <span style={s.heading}>Données collectées</span>
        Frigia collecte : adresse e-mail, photos de réfrigérateur (traitées et non stockées), historique des recettes, favoris.
        <span style={s.heading}>Finalité</span>
        Ces données sont utilisées uniquement pour fournir le service (génération de recettes, historique personnel). Elles ne sont jamais vendues à des tiers.
        <span style={s.heading}>Hébergement des données</span>
        Vos données sont stockées sur Supabase (UE) et traitées par Anthropic pour l'analyse IA.
        <span style={s.heading}>Durée de conservation</span>
        Vos données sont conservées tant que votre compte est actif. Elles sont supprimées intégralement à la suppression du compte.
        <span style={s.heading}>Vos droits (RGPD)</span>
        Vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits : <a href="mailto:frigia.contact@gmail.com" style={{ color:C.orange }}>frigia.contact@gmail.com</a>
        <span style={s.heading}>Cookies</span>
        Frigia n'utilise pas de cookies de suivi ou publicitaires.
      </LegalModal>
    )}
    <footer style={{ borderTop:"1px solid rgba(255,255,255,.07)",padding:"60px 48px 32px",background:"rgba(0,0,0,.28)" }}>
      <div style={{ maxWidth:1100,margin:"0 auto" }}>
        <div style={{ display:"flex",gap:48,flexWrap:"wrap",marginBottom:48 }}>
          <div style={{ flex:2,minWidth:220 }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
              <img src="/logo.png" alt="Frigia" style={{ width:34,height:34,borderRadius:10,objectFit:"contain" }} />
              <span style={{ fontWeight:900,fontSize:22,color:C.text,fontFamily:"Georgia,serif" }}>Frigia</span>
            </div>
            <p style={{ color:C.muted,fontSize:14,lineHeight:1.75,maxWidth:260 }}>
              Votre Chef IA personnel.<br />4 jours gratuits, puis 7,99€/mois.
            </p>
            <p style={{ color:C.muted,fontSize:13,marginTop:12 }}>
              <a href="mailto:frigia.contact@gmail.com" style={{ color:C.muted }} onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color=C.muted)}>frigia.contact@gmail.com</a>
            </p>
          </div>
          <div style={{ flex:1,minWidth:140 }}>
            <div style={{ fontWeight:700,fontSize:11,color:C.text,marginBottom:16,textTransform:"uppercase",letterSpacing:1 }}>Légal</div>
            {([["Mentions légales","mentions"],["CGU","cgu"],["Confidentialité & RGPD","confidentialite"]] as const).map(([label,key])=>(
              <div key={key} style={{ marginBottom:10 }}>
                <button onClick={()=>setModal(key)} style={{ background:"none",border:"none",padding:0,color:C.muted,fontSize:14,cursor:"pointer",transition:"color .2s" }} onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color=C.muted)}>{label}</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop:"1px solid rgba(255,255,255,.07)",paddingTop:24,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:16,fontSize:13,color:C.muted }}>
          <span>© 2026 Frigia. Tous droits réservés.</span>
          <span>RGPD compliant · Fait avec ❤️ en France</span>
        </div>
      </div>
    </footer>
    </>
  );
}

// ── In-app browser detection & banner ────────────────────────────────────────
function detectInAppBrowser(): { isGoogleApp: boolean; isSocialApp: boolean; isIos: boolean; isAndroid: boolean } {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isGoogleApp = /GSA\//i.test(ua);
  const isSocialApp = /Instagram|FBAN|FBAV|FB_IAB|Snapchat|BytedanceWebview|musical_ly|TikTok|Twitter\/|Pinterest\/|LinkedInApp/i.test(ua);
  return { isGoogleApp, isSocialApp, isIos, isAndroid };
}

function openInNativeBrowser(isIos: boolean) {
  if (isIos) {
    window.location.href = "x-safari-https://frigia.fr";
  } else {
    window.location.href = "intent://frigia.fr/#Intent;scheme=https;package=com.android.chrome;end";
  }
}

function GoogleInAppBanner() {
  const { isGoogleApp, isIos, isAndroid } = detectInAppBrowser();
  const [dismissed, setDismissed] = useState(false);

  if (!isGoogleApp || dismissed || (!isIos && !isAndroid)) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "linear-gradient(135deg,#FF6B35,#FF9A3C)",
      paddingTop: "calc(12px + env(safe-area-inset-top))",
      paddingBottom: "12px",
      paddingLeft: "16px",
      paddingRight: "16px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 4px 24px rgba(255,107,53,0.4)",
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>{isIos ? "🧭" : "🌐"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
          Ouvre Frigia dans {isIos ? "Safari" : "Chrome"} pour une meilleure expérience.
        </div>
      </div>
      <button
        onClick={() => openInNativeBrowser(isIos)}
        style={{
          background: "rgba(255,255,255,0.25)", border: "1px solid rgba(255,255,255,0.5)",
          color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer",
          borderRadius: 100, padding: "6px 14px", flexShrink: 0, whiteSpace: "nowrap",
        }}
      >
        Ouvrir →
      </button>
      <button onClick={() => setDismissed(true)} style={{
        background: "none", border: "none", color: "rgba(255,255,255,0.75)",
        fontSize: 20, cursor: "pointer", lineHeight: 1, flexShrink: 0, padding: "4px",
      }}>✕</button>
    </div>
  );
}


function SocialInAppScreen() {
  const ua = navigator.userAgent;
  const isInstagram = /Instagram/i.test(ua);
  const isFacebook = /FBAN|FBAV|FB_IAB/i.test(ua);
  const isTikTok = /BytedanceWebview|musical_ly|TikTok/i.test(ua);
  const isSnapchat = /Snapchat/i.test(ua);
  const [copied, setCopied] = useState(false);

  let appName = "ce navigateur";
  if (isInstagram) appName = "Instagram";
  else if (isFacebook) appName = "Facebook";
  else if (isTikTok) appName = "TikTok";
  else if (isSnapchat) appName = "Snapchat";

  const openLabel = "Ouvrir dans le navigateur";
  const menuIcon = isInstagram || isTikTok || isFacebook ? "···" : "⋮";
  const menuPos = "en haut à droite";

  const steps = [
    { n: 1, text: "Appuie sur", strong: `${menuIcon} ${menuPos}`, sub: "dans le navigateur d'" + appName },
    { n: 2, text: "Sélectionne", strong: `"${openLabel}"`, sub: "dans le menu qui apparaît" },
    { n: 3, text: "Frigia s'ouvre dans", strong: "ton navigateur", sub: "tu peux te connecter normalement" },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText("https://frigia.fr");
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#07070E", display: "flex", flexDirection: "column", overflowY: "auto" }}>
      <style>{`body{margin:0;background:#07070E;}`}</style>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 28px 32px", textAlign: "center" }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
          <img src="/logo.png" alt="Frigia" style={{ width: 40, height: 40, borderRadius: 10, objectFit: "contain" }} />
          <span style={{ fontWeight: 900, fontSize: 22, color: C.text, fontFamily: "Georgia, serif" }}>Frigia</span>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, lineHeight: 1.25, marginBottom: 12 }}>
          Ouvre dans ton navigateur<br />pour continuer
        </h1>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.65, marginBottom: 32, maxWidth: 300 }}>
          Le navigateur d'{appName} bloque l'inscription et le paiement. Suis les étapes ci-dessous.
        </p>

        {/* Steps */}
        <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          {steps.map((s) => (
            <div key={s.n} style={{ display: "flex", alignItems: "flex-start", gap: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px", textAlign: "left" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: grad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#fff", flexShrink: 0 }}>{s.n}</div>
              <div>
                <div style={{ fontSize: 14, color: C.muted }}>{s.text} <strong style={{ color: C.text }}>{s.strong}</strong></div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Copy link button */}
        <button
          onClick={copyLink}
          style={{
            width: "100%", maxWidth: 360, padding: "16px",
            background: copied ? "rgba(46,204,113,0.15)" : "rgba(255,255,255,0.07)",
            border: `1px solid ${copied ? "rgba(46,204,113,0.5)" : "rgba(255,255,255,0.15)"}`,
            borderRadius: 100, color: copied ? "#2ECC71" : C.text,
            fontWeight: 700, fontSize: 15, cursor: "pointer", transition: "all 0.25s",
            marginBottom: 12,
          }}
        >
          {copied ? "✓ Lien copié ! Colle-le dans ton navigateur" : "📋 Copier le lien frigia.fr"}
        </button>

        {/* URL visible */}
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)", letterSpacing: 0.5 }}>
          frigia.fr
        </div>
      </div>
    </div>
  );
}

// ── Browser detection ─────────────────────────────────────────────────────────
function detectBrowser(): "ios-safari" | "ios-chrome" | "chrome-android" | "chrome-desktop" | "samsung" | "firefox-android" | "edge-mobile" | "unknown" {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isCriOS = /CriOS/i.test(ua);
  const isChrome = /chrome/i.test(ua) && !/edg\//i.test(ua);
  const isSamsung = /samsungbrowser/i.test(ua);
  const isFirefox = /firefox/i.test(ua);
  const isEdge = /edg\//i.test(ua);
  if (isIos && isCriOS) return "ios-chrome";
  if (isIos) return "ios-safari";
  if (isAndroid && isSamsung) return "samsung";
  if (isAndroid && isFirefox) return "firefox-android";
  if (isAndroid && isEdge) return "edge-mobile";
  if (isAndroid && isChrome) return "chrome-android";
  if (isChrome) return "chrome-desktop";
  return "unknown";
}

// ── Install hint modal ────────────────────────────────────────────────────────
function InstallHint({ onClose }: { onClose: () => void }) {
  const browser = detectBrowser();

  const configs = {
    "ios-safari": {
      steps: [
        { label: "Appuyez sur", strong: "···", sub: "Les 3 petits points en bas à droite de Safari", color: C.orange },
        { label: "Appuyez sur", strong: "Partager", sub: "Dans le menu qui apparaît", color: "#2ECC71" },
        { label: "Appuyez sur", strong: "En voir plus", sub: "Pour voir toutes les options", color: "#FFB800" },
        { label: "Appuyez sur", strong: "Sur l'écran d'accueil", sub: "Dans la liste qui s'affiche", color: "#2ECC71" },
        { label: "Appuyez sur", strong: "Ajouter", sub: "En haut à droite — c'est tout !", color: C.orange },
      ],
      arrow: "bottom-right" as const,
    },
    "ios-chrome": {
      steps: [
        { label: "Appuyez sur", strong: "le bouton Partager", sub: "L'icône □↑ en haut à droite de Chrome", color: C.orange },
        { label: "Appuyez sur", strong: "En voir plus", sub: "Pour voir toutes les options", color: "#FFB800" },
        { label: "Appuyez sur", strong: "Sur l'écran d'accueil", sub: "Dans la liste qui s'affiche", color: "#2ECC71" },
        { label: "Appuyez sur", strong: "Ajouter", sub: "En haut à droite — c'est tout !", color: C.orange },
      ],
      arrow: "top-right" as const,
    },
    "chrome-android": {
      steps: [
        { label: "Appuyez sur", strong: "⋮", sub: "Les 3 points en haut à droite de Chrome", color: C.orange },
        { label: "Appuyez sur", strong: "Ajouter à l'écran d'accueil", sub: "Ou \"Installer l'application\"", color: "#2ECC71" },
        { label: "Confirmez en appuyant sur", strong: "Ajouter", sub: "C'est tout !", color: "#FFB800" },
      ],
      arrow: false as const,
    },
    "samsung": {
      steps: [
        { label: "Appuyez sur", strong: "⋮", sub: "Les 3 points en bas à droite de Samsung Internet", color: C.orange },
        { label: "Appuyez sur", strong: "Ajouter page à", sub: "Puis \"Écran d'accueil\"", color: "#2ECC71" },
        { label: "Confirmez en appuyant sur", strong: "Ajouter", sub: "C'est tout !", color: "#FFB800" },
      ],
      arrow: false as const,
    },
    "firefox-android": {
      steps: [
        { label: "Appuyez sur", strong: "⋮", sub: "Le menu en bas à droite de Firefox", color: C.orange },
        { label: "Appuyez sur", strong: "Installer", sub: "Ou \"Ajouter à l'écran d'accueil\"", color: "#2ECC71" },
        { label: "Confirmez en appuyant sur", strong: "Ajouter", sub: "C'est tout !", color: "#FFB800" },
      ],
      arrow: false as const,
    },
    "edge-mobile": {
      steps: [
        { label: "Appuyez sur", strong: "···", sub: "Le menu en bas de Edge", color: C.orange },
        { label: "Appuyez sur", strong: "Ajouter à l'écran d'accueil", sub: "Dans la liste des options", color: "#2ECC71" },
        { label: "Confirmez en appuyant sur", strong: "Ajouter", sub: "C'est tout !", color: "#FFB800" },
      ],
      arrow: false as const,
    },
    "chrome-desktop": {
      steps: [
        { label: "Cliquez sur l'icône", strong: "⊕", sub: "Dans la barre d'adresse à droite", color: C.orange },
        { label: "Cliquez sur", strong: "Installer Frigia", sub: "Dans la fenêtre qui apparaît — c'est tout !", color: "#2ECC71" },
      ],
      arrow: false as const,
    },
    "unknown": {
      steps: [
        { label: "Ouvrez le", strong: "menu de votre navigateur", sub: "Bouton ⋮ ou ··· selon le navigateur", color: C.orange },
        { label: "Cherchez", strong: "Ajouter à l'écran d'accueil", sub: "Ou \"Installer l'application\"", color: "#2ECC71" },
        { label: "Confirmez en appuyant sur", strong: "Ajouter", sub: "C'est tout !", color: "#FFB800" },
      ],
      arrow: false as const,
    },
  };

  const { steps, arrow } = configs[browser] ?? configs["unknown"];
  const cardBottom = arrow ? 110 : 24;

  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.65)",backdropFilter:"blur(6px)" }}>
      {arrow === "bottom-right" && (
        <div style={{ position:"absolute",bottom:16,right:24,pointerEvents:"none",display:"flex",flexDirection:"column",alignItems:"center" }}>
          <div style={{ fontSize:40,animation:"bounceUp 1s ease-in-out infinite",color:C.orange,lineHeight:1 }}>↓</div>
        </div>
      )}
      {arrow === "top-right" && (
        <div style={{ position:"absolute",top:16,right:24,pointerEvents:"none",display:"flex",flexDirection:"column",alignItems:"center" }}>
          <div style={{ fontSize:40,animation:"bounceUp 1s ease-in-out infinite",color:C.orange,lineHeight:1 }}>↑</div>
        </div>
      )}
      <div
        onClick={e => e.stopPropagation()}
        style={{ position:"absolute",bottom:cardBottom,left:12,right:12,background:"#13131F",border:"1px solid rgba(255,255,255,0.12)",borderRadius:24,padding:"24px 20px",animation:"slideUp 0.35s ease both",boxShadow:"0 -20px 60px rgba(0,0,0,0.5)" }}
      >
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <img src="/logo.png" alt="Frigia" style={{ width:34,height:34,borderRadius:10,objectFit:"contain" }} />
            <span style={{ fontWeight:800,fontSize:17,color:C.text }}>Installer Frigia</span>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.08)",border:"none",borderRadius:"50%",width:30,height:30,color:C.muted,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>
        {steps.map((s, i) => (
          <div key={i} style={{ display:"flex",gap:14,alignItems:"flex-start",marginBottom:i < steps.length - 1 ? 16 : 0 }}>
            <div style={{ width:34,height:34,borderRadius:12,background:`${s.color}22`,border:`1px solid ${s.color}55`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:800,fontSize:14,color:s.color }}>{i + 1}</div>
            <div>
              <div style={{ fontSize:14,color:C.muted,lineHeight:1.5 }}>{s.label} <strong style={{ color:C.text }}>{s.strong}</strong></div>
              <div style={{ fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:3 }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────
export default function Landing() {
  const [authOpen, setAuthOpen] = useState(false);
  const { isGoogleApp, isSocialApp, isIos, isAndroid } = detectInAppBrowser();
  const open = useCallback(() => { setAuthOpen(true); }, []);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallHint, setShowInstallHint] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isSocialApp && (isIos || isAndroid)) {
    return <SocialInAppScreen />;
  }

  const handleInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } else {
      setShowInstallHint(true);
    }
  };

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
  const browser = detectBrowser();
  const isInstallable = !isStandalone && ["ios-safari", "ios-chrome", "chrome-android", "chrome-desktop"].includes(browser);

  return (
    <div style={{ background:C.bg,minHeight:"100vh",color:C.text,overflowX:"hidden", paddingTop: isGoogleApp && (isIos || isAndroid) ? 64 : 0 }}>
      <style>{CSS}</style>
      {showInstallHint && <InstallHint onClose={() => setShowInstallHint(false)} />}
      <GoogleInAppBanner />
      <Nav onOpen={open} />
      <Hero onOpen={open} onInstall={isInstallable ? handleInstall : undefined} />
      <Marquee />
      <HowItWorks />
      <Stats />
      <TestimonialsMarquee />
      <Pricing onOpen={open} />
      <FAQ />
      <Footer />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
