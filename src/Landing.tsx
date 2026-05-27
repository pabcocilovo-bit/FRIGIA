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

  const submit = async () => {
    if (!email || !pw) { setMsg("Remplissez tous les champs."); return; }
    setLoading(true); setMsg("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
        setMsg("✓ Compte créé ! Connectez-vous maintenant.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        onClose();
      }
    } catch (e: any) {
      setMsg(e.message || "Une erreur est survenue.");
    } finally { setLoading(false); }
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

        <div style={{ textAlign:"center",marginBottom:32 }}>
          <div style={{ fontSize:38,marginBottom:10 }}>🥗</div>
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
            <button key={m} onClick={() => setMode(m)} style={{
              flex:1,padding:"9px",borderRadius:10,border:"none",
              background: mode===m ? "rgba(255,255,255,.1)" : "transparent",
              color: mode===m ? C.text : C.muted,
              fontWeight: mode===m ? 700 : 400, fontSize:14,
            }}>
              {m === "signup" ? "Créer un compte" : "Connexion"}
            </button>
          ))}
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
      padding:"16px 48px",
      background: scrolled ? "rgba(7,7,14,.92)" : "transparent",
      backdropFilter: scrolled ? "blur(22px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,.06)" : "none",
      transition:"all .35s",
      display:"flex",alignItems:"center",justifyContent:"space-between",
    }}>
      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
        <div style={{ width:34,height:34,borderRadius:10,background:grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17 }}>🥗</div>
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
function Hero({ onOpen }: { onOpen: () => void }) {
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

  return (
    <section style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"120px 48px 80px",position:"relative",overflow:"hidden" }}>
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

          <h1 style={{ fontSize:"clamp(38px,5.2vw,68px)",fontWeight:900,lineHeight:1.06,letterSpacing:-2,marginBottom:24,fontFamily:"Georgia,serif",color:C.text,animation:"fadeIn .8s ease .08s both" }}>
            Prenez votre frigo<br />en photo.{" "}
            <span style={gradText}>L'IA cuisine<br />pour vous.</span>
          </h1>

          <p style={{ fontSize:18,color:C.muted,lineHeight:1.78,marginBottom:42,animation:"fadeIn .8s ease .18s both" }}>
            Des recettes générées instantanément<br />à partir des aliments que vous avez déjà.
          </p>

          <div style={{ display:"flex",gap:14,flexWrap:"wrap",marginBottom:52,animation:"fadeIn .8s ease .28s both" }}>
            <button onClick={onOpen} style={{ padding:"16px 34px",background:grad,border:"none",borderRadius:100,color:"#fff",fontWeight:800,fontSize:16,boxShadow:"0 10px 38px rgba(255,107,53,.38)" }}>
              Démarrer 4 jours gratuits
            </button>
            <button style={{ padding:"16px 34px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:100,color:C.text,fontWeight:700,fontSize:16 }}>
              ▶ Voir une démo
            </button>
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
          <div style={{ position:"absolute",top:78,right:-96,background:"rgba(16,16,26,.94)",backdropFilter:"blur(18px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,whiteSpace:"nowrap",animation:"floatY 3.3s ease-in-out infinite" }}>
            <span style={{ fontSize:20 }}>🥦</span>
            <div><div style={{ fontWeight:700,color:C.text,fontSize:11 }}>Brocoli détecté</div><div style={{ color:"#2ECC71",fontSize:10 }}>96% confiance</div></div>
          </div>
          <div style={{ position:"absolute",bottom:108,left:-96,background:"rgba(16,16,26,.94)",backdropFilter:"blur(18px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,whiteSpace:"nowrap",animation:"floatY 3.9s ease-in-out .5s infinite" }}>
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
  const items = ["📸 Scan IA ultra-précis","🤖 Chef IA 24h/24","🥗 Recettes sur-mesure","⏰ Alertes péremption","💚 Zéro gaspillage","📊 Suivi nutritionnel","✨ 120 000+ recettes","⭐ 4,9/5 App Store","🔒 Données sécurisées","🌱 Anti-gaspi certifié"];
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
  const data = [["4 800+","Utilisateurs actifs"],["98%","Précision IA"],["120k+","Recettes générées"],["2,3 kg","Gaspillage évité/mois"]];
  return (
    <section style={{ background:"rgba(255,255,255,.016)",borderTop:"1px solid rgba(255,255,255,.06)",borderBottom:"1px solid rgba(255,255,255,.06)",padding:"72px 48px" }}>
      <div style={{ maxWidth:960,margin:"0 auto",display:"flex",flexWrap:"wrap" }}>
        {data.map(([n,l],i)=>(
          <R key={i} delay={i*.09} style={{ flex:1,minWidth:180,textAlign:"center",padding:"28px 20px",borderRight:i<3?"1px solid rgba(255,255,255,.06)":"none" }}>
            <div style={{ fontSize:44,fontWeight:900,...gradText,marginBottom:8 }}>{n}</div>
            <div style={{ fontSize:13,color:C.muted }}>{l}</div>
          </R>
        ))}
      </div>
    </section>
  );
}

// ── Feature block ─────────────────────────────────────────────────────────────
function Feat({ eyebrow, title, desc, points, icon, reverse }: {
  eyebrow: string; title: string; desc: string; points: string[]; icon: string; reverse?: boolean;
}) {
  const [ref, vis] = useReveal(.08);
  return (
    <div ref={ref} className="land-feat" style={{
      display:"flex",gap:70,alignItems:"center",flexWrap:"wrap",
      flexDirection: reverse ? "row-reverse" : "row",
      marginBottom:110,
      opacity: vis ? 1 : 0,
      transform: vis ? "none" : "translateY(44px)",
      transition:"opacity .85s ease, transform .85s ease",
    }}>
      <div style={{ flex:1,minWidth:300 }}>
        <div style={{ fontSize:11,fontWeight:700,color:"#2ECC71",letterSpacing:3,textTransform:"uppercase",marginBottom:16 }}>{eyebrow}</div>
        <h2 style={{ fontSize:"clamp(26px,3.4vw,44px)",fontWeight:900,letterSpacing:-1,color:C.text,marginBottom:16,lineHeight:1.18 }}>{title}</h2>
        <p style={{ fontSize:16,color:C.muted,lineHeight:1.82,marginBottom:28 }}>{desc}</p>
        <ul style={{ listStyle:"none",display:"flex",flexDirection:"column",gap:12 }}>
          {points.map((p,i)=>(
            <li key={i} style={{ display:"flex",gap:12,alignItems:"flex-start",fontSize:15,color:C.text }}>
              <span style={{ color:"#2ECC71",fontWeight:900,marginTop:2,flexShrink:0 }}>✓</span>{p}
            </li>
          ))}
        </ul>
      </div>
      <div style={{
        flex:1,minWidth:280,maxWidth:380,aspectRatio:"1",
        background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",
        borderRadius:32,display:"flex",alignItems:"center",justifyContent:"center",
        opacity: vis ? 1 : 0,
        transform: vis ? "none" : `translateX(${reverse?-44:44}px)`,
        transition:"opacity .85s ease .18s, transform .85s ease .18s",
      }}>
        <span style={{ fontSize:96,animation:"floatY 4.5s ease-in-out infinite" }}>{icon}</span>
      </div>
    </div>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────────────
function Testimonials() {
  const t = [
    { name:"Sophie M.",role:"Maman de 3 enfants",text:"Je cuisine maintenant avec ce que j'ai. Fini le gaspillage et les repas répétitifs. Frigia a changé mon quotidien.",stars:5 },
    { name:"Thomas D.",role:"Étudiant en médecine",text:"Je mange sain avec un budget serré et sans planification. L'IA génère des recettes créatives en quelques secondes.",stars:5 },
    { name:"Amélie R.",role:"Chef amateur",text:"Les recettes sont vraiment créatives. J'ai découvert des combinaisons auxquelles je n'aurais jamais pensé seule.",stars:5 },
  ];
  return (
    <section style={{ padding:"100px 48px" }}>
      <R style={{ textAlign:"center",marginBottom:64 }}>
        <div style={{ fontSize:11,fontWeight:700,color:C.orange,letterSpacing:4,textTransform:"uppercase",marginBottom:16 }}>Témoignages</div>
        <h2 style={{ fontSize:"clamp(28px,4vw,50px)",fontWeight:900,letterSpacing:-1,color:C.text }}>
          Ils <span style={gradText}>adorent</span> Frigia
        </h2>
      </R>
      <div style={{ maxWidth:1020,margin:"0 auto",display:"flex",gap:22,flexWrap:"wrap",justifyContent:"center" }}>
        {t.map((r,i)=>(
          <R key={i} delay={i*.12} style={{ flex:1,minWidth:290,maxWidth:320 }}>
            <div style={{ background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:24,padding:28,height:"100%" }}>
              <div style={{ color:"#FFB800",fontSize:16,marginBottom:14,letterSpacing:2 }}>{"★".repeat(r.stars)}</div>
              <p style={{ fontSize:15,color:C.text,lineHeight:1.78,marginBottom:22,fontStyle:"italic" }}>"{r.text}"</p>
              <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                <div style={{ width:40,height:40,borderRadius:"50%",background:grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>👤</div>
                <div>
                  <div style={{ fontWeight:700,color:C.text,fontSize:14 }}>{r.name}</div>
                  <div style={{ fontSize:12,color:C.muted }}>{r.role}</div>
                </div>
              </div>
            </div>
          </R>
        ))}
      </div>
    </section>
  );
}

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
            {["Scans IA illimités","Recettes personnalisées illimitées","Chat Chef IA 24h/24","Suivi nutritionnel avancé","Alertes péremption intelligentes","Toutes futures fonctionnalités incluses"].map((f,i)=>(
              <li key={i} style={{ display:"flex",gap:12,alignItems:"flex-start",fontSize:15,color:C.text }}>
                <span style={{ color:"#2ECC71",fontWeight:900 }}>✓</span>{f}
              </li>
            ))}
          </ul>
          <button onClick={onOpen} style={{ width:"100%",padding:"16px",borderRadius:100,fontWeight:800,fontSize:16,border:"none",background:grad,color:"#fff",boxShadow:"0 8px 32px rgba(255,107,53,.3)" }}>
            Commencer 4 jours gratuits →
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
function CTA({ onOpen }: { onOpen: () => void }) {
  return (
    <section style={{ padding:"120px 48px",textAlign:"center",position:"relative",overflow:"hidden",background:"linear-gradient(180deg,transparent,rgba(255,107,53,.055) 50%,transparent)" }}>
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",backgroundImage:"linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px)",backgroundSize:"90px 90px" }} />
      <R style={{ position:"relative",zIndex:1 }}>
        <h2 style={{ fontSize:"clamp(34px,5.5vw,68px)",fontWeight:900,letterSpacing:-2.5,marginBottom:20,color:C.text,lineHeight:1.04 }}>
          Votre frigo cache des{" "}
          <span style={gradText}>recettes<br />extraordinaires</span>
        </h2>
        <p style={{ color:C.muted,fontSize:18,marginBottom:46,lineHeight:1.65 }}>
          4 jours gratuits · Puis 7,99€/mois · Résiliable à tout moment.
        </p>
        <div style={{ display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap" }}>
          <button onClick={onOpen} style={{ padding:"18px 46px",background:grad,border:"none",borderRadius:100,color:"#fff",fontWeight:800,fontSize:18,boxShadow:"0 14px 50px rgba(255,107,53,.42)" }}>
            Démarrer gratuitement
          </button>
          <button style={{ padding:"18px 46px",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:100,color:C.text,fontWeight:700,fontSize:18 }}>
            Télécharger l'app
          </button>
        </div>
        <p style={{ color:C.muted,fontSize:13,marginTop:22 }}>✓ 4 jours gratuits · ✓ Sans engagement · ✓ Résiliable en un clic</p>
      </R>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  const cols = [
    { title:"Produit",links:["Fonctionnalités","Tarifs","Roadmap","Changelog"] },
    { title:"Ressources",links:["Blog recettes","Guide nutrition","Centre d'aide"] },
    { title:"Légal",links:["CGU","Confidentialité","Cookies","RGPD"] },
  ];
  return (
    <footer style={{ borderTop:"1px solid rgba(255,255,255,.07)",padding:"60px 48px 32px",background:"rgba(0,0,0,.28)" }}>
      <div style={{ maxWidth:1100,margin:"0 auto" }}>
        <div style={{ display:"flex",gap:48,flexWrap:"wrap",marginBottom:48 }}>
          <div style={{ flex:2,minWidth:220 }}>
            <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
              <div style={{ width:34,height:34,borderRadius:10,background:grad,display:"flex",alignItems:"center",justifyContent:"center" }}>🥗</div>
              <span style={{ fontWeight:900,fontSize:22,color:C.text,fontFamily:"Georgia,serif" }}>Frigia</span>
            </div>
            <p style={{ color:C.muted,fontSize:14,lineHeight:1.75,maxWidth:260 }}>
              Votre Chef IA personnel.<br />4 jours gratuits, puis 7,99€/mois.
            </p>
          </div>
          {cols.map(col=>(
            <div key={col.title} style={{ flex:1,minWidth:140 }}>
              <div style={{ fontWeight:700,fontSize:11,color:C.text,marginBottom:16,textTransform:"uppercase",letterSpacing:1 }}>{col.title}</div>
              {col.links.map(l=><div key={l} style={{ marginBottom:10 }}><a href="#" style={{ color:C.muted,fontSize:14,transition:"color .2s" }} onMouseEnter={e=>(e.currentTarget.style.color=C.text)} onMouseLeave={e=>(e.currentTarget.style.color=C.muted)}>{l}</a></div>)}
            </div>
          ))}
        </div>
        <div style={{ borderTop:"1px solid rgba(255,255,255,.07)",paddingTop:24,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:16,fontSize:13,color:C.muted }}>
          <span>© 2026 Frigia. Tous droits réservés.</span>
          <span>RGPD compliant · Fait avec ❤️ en France</span>
        </div>
      </div>
    </footer>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────
export default function Landing() {
  const [authOpen, setAuthOpen] = useState(false);
  const open = useCallback(() => setAuthOpen(true), []);

  return (
    <div style={{ background:C.bg,minHeight:"100vh",color:C.text,overflowX:"hidden" }}>
      <style>{CSS}</style>
      <Nav onOpen={open} />
      <Hero onOpen={open} />
      <Marquee />
      <HowItWorks />
      <Stats />
      <section style={{ padding:"100px 48px",maxWidth:1100,margin:"0 auto" }}>
        <Feat
          eyebrow="Intelligence artificielle"
          icon="🤖"
          title="Détection IA ultra-précise"
          desc="Notre IA analyse votre frigo en quelques secondes et identifie chaque aliment avec une précision de 98%."
          points={["Reconnaissance de +200 types d'aliments","Détection des dates de péremption","Estimation des quantités","Mise à jour en temps réel"]}
        />
        <Feat
          eyebrow="Recettes personnalisées"
          icon="🍽️"
          title="Des recettes faites pour vous"
          desc="Chaque suggestion est adaptée à vos ingrédients, vos préférences alimentaires et votre niveau en cuisine."
          points={["Filtres : vegan, gluten-free, keto…","Tri par temps et calories","Étapes détaillées avec photos","Partage facile avec la famille"]}
          reverse
        />
        <Feat
          eyebrow="Chef IA"
          icon="👨‍🍳"
          title="Votre assistant culinaire 24h/24"
          desc="Posez n'importe quelle question à votre Chef IA. Il connaît des milliers de recettes et s'adapte à chaque situation."
          points={["Conseils en temps réel","Substitution d'ingrédients","Suggestions anti-gaspi","Mémorisation de vos préférences"]}
        />
      </section>
      <Testimonials />
      <Pricing onOpen={open} />
      <FAQ />
      <CTA onOpen={open} />
      <Footer />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
