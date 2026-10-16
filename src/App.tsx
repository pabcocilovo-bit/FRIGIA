import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { GeneratedRecipe, User } from "./lib/types";
import { fetchScanQuota, quotaText, getCachedQuota, isPlus as hasPlus, paymentFailed, quotaTotal, scansLeft, setCachedQuota, type ScanQuota } from "./lib/billing";
import { clearLocalData, deleteAccount, displayName, fetchAvatar, getAvatar, getPrefs, saveAvatar, signOut } from "./lib/account";
import { useLibrary } from "./hooks/useLibrary";
import { useCooked } from "./hooks/useCooked";
import { useHome } from "./hooks/useHome";
import { people } from "./lib/household";
import { addToList } from "./lib/shopping";
import type { Member as HomeMember } from "./lib/home";
import { useSession } from "./hooks/useSession";
import { isStandalone } from "./landing/browser";
import { Analytics } from "@vercel/analytics/react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { AppFrame } from "./app/AppFrame";
import { Home } from "./app/Home";
import { Courses } from "./app/Lists";
import { Planning } from "./app/plan/Planning";
import { PlanNew } from "./app/plan/PlanNew";
import { Family } from "./app/Family";
import { Member } from "./app/family/Member";
import { showToast } from "./app/toast";
import {
  EMPTY_PROFILE, clearPendingProfile, fetchProfile, hasPendingProfile, fromOldPrefs, getCachedProfile, saveProfile, takePendingProfile, type Profile,
} from "./lib/profile";
import { Camera, EmailSignup, Forgot, Login, QDiet, QGoal, QTime, Ready, Signup, VerifyEmail, Welcome } from "./app/onboarding/Onboarding";
import { takeOAuthIntent } from "./app/onboarding/oauth";
import { resetAnswers } from "./app/onboarding/answers";
import { firstName } from "./app/format";
import { Favorites } from "./app/library/Favorites";
import { Scans } from "./app/library/Scans";
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
import { Cook } from "./app/scan/Cook";
import { totalSaved } from "./lib/cooked";
import { Report } from "./app/report/Report";
import { InviteLink, Refer } from "./app/refer/Refer";
import { pendingCode, redeemCode, setPendingCode } from "./lib/codes";
import { guideState } from "./app/scan/guideSteps";
import { Account, Settings } from "./app/settings/Settings";
import { Help } from "./app/settings/Help";
import { Legal } from "./app/settings/Legal";
import { Inbox } from "./app/notifs/Inbox";
import { NotifAsk } from "./app/notifs/NotifAsk";
import { useNotifSync } from "./app/notifs/sync";

// Écrans de l'inscription et de la connexion (étape 4). Connecté, seuls les questions, la caméra
// et le mot de passe oublié (le code connecte avant le nouveau mot de passe) restent ouverts.
const OB_PATHS = ["/bienvenue", "/questions/1", "/questions/2", "/questions/3", "/pret", "/compte", "/compte/email", "/compte/code", "/connexion", "/mot-de-passe", "/camera"];
const OB_SIGNED_IN = ["/questions/1", "/questions/2", "/questions/3", "/mot-de-passe", "/camera"];

/** Prénom donné à Google (ou à l'inscription), pour le profil. */
const metaFirstName = (u: User): string | null =>
  u.user_metadata?.given_name || (displayName(u).trim().split(/\s+/)[0] || null);
const Landing = lazy(() => import("./Landing"));

export default function Frigia() {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const openScan = useOpenScan();
  // Goûts du compte (table profiles). missing : pas encore de goûts, on pose les 3 questions.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const profileFor = useRef<string | null>(null);
  const redeeming = useRef<string | null>(null);
  // Déconnexion voulue (Se déconnecter, compte supprimé) : on part sur Bienvenue, comme le prototype
  const signOutTo = useRef<string | null>(null);
  // Compte tout neuf : on passe par l'accès à la caméra avant l'accueil
  const [goCamera, setGoCamera] = useState(false);
  // Scans gratuits utilisés (formule Gratuit), comptés par le serveur
  const [quota, setQuota] = useState<ScanQuota | null>(null);

  const [userId, setUserId] = useState<string | undefined>();
  const library = useLibrary(userId);
  const { history, favorites, toggleFavorite, isFavorite, updateScanRecipes } = library;
  const cooked = useCooked(userId);
  const home = useHome(userId);

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
        setAvatarSrc(getAvatar(u.id));
        // La photo suit le compte ; une photo d'avant (gardée sur ce téléphone seulement) part sur le compte
        void fetchAvatar(u.id).then(src => {
          if (profileFor.current !== u.id || src === undefined) return;
          const local = getAvatar(u.id);
          if (src) setAvatarSrc(src);
          else if (local) void saveAvatar(u.id, local);
        });
      }
      setUserId(u.id);
      void library.load(u.id);
      void cooked.load(u.id);
      void home.load(u.id);
      // Réponses aux questions en attente : c'est un compte tout neuf (même rendu que la connexion, pas de passage par l'accueil)
      if (profileFor.current !== u.id && hasPendingProfile()) setGoCamera(true);
      void loadProfile(u);
      // Code ami ou créateur vérifié à l'inscription : il sert dès que le compte existe (gardé si le réseau manque)
      const code = pendingCode();
      // La session s'annonce plusieurs fois à l'ouverture : un seul envoi
      if (code && redeeming.current !== code) void redeemCode(redeeming.current = code).then(v => {
        setPendingCode(null);
        if (v.status === "ok") void fetchScanQuota(u.id).then(q => { if (q && profileFor.current === u.id) setQuota(q); });
      }).catch(() => { redeeming.current = null; /* réessayé à la prochaine ouverture */ });
      const oauth = takeOAuthIntent();
      if (oauth === "signup") showToast(code ? "Compte Google relié, ton code est gardé" : "Compte Google relié : pas d'email à confirmer");
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
      // Déconnexion voulue : Bienvenue, une fois la session vidée à l'écran (effet plus bas)
      if (!signOutTo.current && !OB_PATHS.includes(window.location.pathname)) navigate("/", { replace: true });
      library.clear();
      cooked.clear();
      home.clear();
      setAvatarSrc(null);
    },
  });

  // Notifications : le centre suit le compte, une notif touchée ouvre son écran
  useNotifSync(user);

  // Après « Se déconnecter » ou la suppression du compte : Bienvenue (fermé tant qu'un compte est connecté)
  useEffect(() => {
    if (user || !signOutTo.current) return;
    navigate(signOutTo.current, { replace: true });
    signOutTo.current = null;
  }, [user, navigate]);

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
        <Route path="/i/:code" element={<InviteLink />} />
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
// Réglages et compte
const onAvatar = (src: string | null) => { setAvatarSrc(src); void saveAvatar(user.id, src); };
const onName = (first_name: string) => void saveTastes({ ...(profile ?? EMPTY_PROFILE), first_name });
// Les plats de l'utilisateur, proposés comme photo de profil
const dishes = [...favorites, ...history.flatMap(h => h.recipes)]
  .filter((r, i, all) => all.findIndex(o => o.title === r.title) === i).slice(0, 3)
  .map(r => ({ title: r.title, imageSearch: r.imageSearch }));
const account = {
  user, name, avatar: avatarSrc, isPlus, savedKg: totalSaved(cooked.meals).kg,
  onSignOut: () => {
    showToast(`À bientôt, ${name}`);
    setTimeout(() => { signOutTo.current = "/bienvenue"; void signOut(); }, 700);
  },
  onDelete: deleteAccount,
  onGone: () => {
    // Le compte n'existe plus : on efface le téléphone et la session sans demander au serveur
    clearLocalData();
    signOutTo.current = "/bienvenue";
    void signOut("local").then(() => showToast("Ton compte Frigia est supprimé"));
  },
};
// Le foyer (Plus) : toi, puis tes proches. En Gratuit, toi seul.
const household = isPlus ? people(name, profile, home.members) : people(name, profile, []);
const saveMember = (m: HomeMember) =>
  home.setMembers(list => (list.some(x => x.id === m.id) ? list.map(x => (x.id === m.id ? m : x)) : [...list, m]));
/** Les manquants de recettes dans la liste de courses. Renvoie ceux qui viennent d'arriver. */
const addMissingOf = (groups: { items: { name: string; qty: string }[]; from: string }[]) => {
  const list = groups.reduce((l, g) => addToList(l, g.items, g.from).list, home.shopping);
  home.setShopping(list);
  return list.filter(x => !home.shopping.some(o => o.id === x.id)).map(x => x.id);
};
const addMissing = (items: { name: string; qty: string }[], from: string) => addMissingOf([{ items, from }]);
// La semaine (Plus) : Planning, Crée ta semaine, « Ajouter à ma semaine »
const plan = { isPlus, week: home.week, setWeek: home.setWeek, history, favorites };
const openRecipe = (recipe: GeneratedRecipe, servings?: number) => navigate("/recette", { state: { recipe, servings } satisfies RecipeState });
// Premier scan guidé : juste après l'inscription, tant qu'aucun scan n'est fait et que les bulles n'ont pas été passées
const guide = guideState(user.id);

return (
  // Retour de la page Stripe : « On attend ta banque » tout de suite, sans l'écran d'ouverture
  <AppFrame splash={location.pathname !== "/plus/paiement"}>
    <Routes>
      <Route path="/" element={<Home user={user} name={name} isPlus={isPlus} quota={quota} avatar={avatarSrc} history={history} favorites={favorites} cooked={cooked.meals} household={household}
        week={home.week} onWeek={home.setWeek} onOpenRecipe={r => openRecipe(r)} />} />
      <Route path="/planning" element={<Planning {...plan} household={household} onAddMissing={addMissingOf} />} />
      <Route path="/planning/creer" element={<PlanNew {...plan} />} />
      <Route path="/courses" element={<Courses isPlus={isPlus} items={home.shopping}
        onToggle={id => home.setShopping(l => l.map(x => (x.id === id ? { ...x, done: !x.done } : x)))}
        onClearDone={() => home.setShopping(l => l.filter(x => !x.done))} />} />
      <Route path="/famille" element={<Family user={user} name={name} isPlus={isPlus} avatar={avatarSrc} profile={profile} household={household}
        dishes={dishes} onAvatar={onAvatar} onName={onName}
        onEditTastes={q => { resetAnswers(profile ?? EMPTY_PROFILE); navigate(`/questions/${q ?? 1}`, { state: { edit: true, only: !!q } }); }} />} />
      {["/famille/proche", "/famille/proche/:id"].map(path => (
        <Route key={path} path={path} element={isPlus ? <Member household={household} onSave={saveMember}
          onRemove={id => home.setMembers(list => list.filter(x => x.id !== id))}
          onMyAllergies={allergies => void saveTastes({ ...(profile ?? EMPTY_PROFILE), allergies })} />
          : <Navigate to="/plus" replace state={{ why: "famille" }} />} />
      ))}
      <Route path="/plus" element={isPlus ? <Navigate to="/" replace /> : <Paywall onCode={() => void fetchScanQuota(user.id).then(q => { if (q) setQuota(q); })} />} />
      <Route path="/plus/paiement" element={<PayReturn />} />
      <Route path="/plus/bienvenue" element={<PlusWelcome user={user} name={name} />} />
      <Route path="/resilier" element={<Cancel user={user} />} />
      {/* Les 15 scans gratuits sont utilisés : « Passe à Plus » à la place du scan */}
      <Route path="/scan" element={noScansLeft ? <Navigate to="/plus" replace state={{ why: "quota" }} /> :
        <ScanCamera userId={user.id} guide={guide === "" && history.length === 0} onCounted={onCounted} onOutOfScans={onOutOfScans} />} />
      <Route path="/scan/recadrer" element={<Crop />} />
      <Route path="/scan/rate" element={<ScanFail isPlus={isPlus} />} />
      <Route path="/scan/ajouter" element={<AddIngredient />} />
      <Route path="/scan/ingredients" element={<Ingredients isPlus={isPlus} household={household} avatar={avatarSrc} guide={guide === "ingr"} userId={user.id} />} />
      <Route path="/scan/preparation" element={<Prep isPlus={isPlus} household={household} onReady={library.addScan} onCounted={onCounted} onOutOfScans={onOutOfScans} />} />
      <Route path="/recettes/:id" element={<Results history={history} isPlus={isPlus} household={household} week={home.week} onWeek={home.setWeek} onNewIdeas={updateScanRecipes} />} />
      <Route path="/recettes/:id/:n" element={<Recipe history={history} isPlus={isPlus} household={household} shopping={home.shopping} onAddMissing={addMissing} week={home.week} onWeek={home.setWeek} avatar={avatarSrc} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />} />
      <Route path="/recette" element={<Recipe history={history} isPlus={isPlus} household={household} shopping={home.shopping} onAddMissing={addMissing} week={home.week} onWeek={home.setWeek} avatar={avatarSrc} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />} />
      <Route path="/recettes/:id/:n/cuisine" element={<Cook history={history} isPlus={isPlus} meals={cooked.meals} onCooked={cooked.add} />} />
      <Route path="/recette/cuisine" element={<Cook history={history} isPlus={isPlus} meals={cooked.meals} onCooked={cooked.add} />} />
      <Route path="/parrainage" element={<Refer name={name} avatar={avatarSrc} isPlus={isPlus} />} />
      <Route path="/i/:code" element={<Navigate to="/" replace />} />
      <Route path="/bilan" element={isPlus ? <Report meals={cooked.meals} /> : <Navigate to="/" replace />} />
      <Route path="/scans" element={<Scans history={history} cooked={cooked.meals} isPlus={isPlus} />} />
      <Route path="/favoris" element={<Favorites favorites={favorites} history={history} isPlus={isPlus} onOpen={r => openRecipe(r, r.savedServings)} onToggleFavorite={toggleFavorite} />} />
      <Route path="/reglages" element={<Settings {...account} />} />
      <Route path="/reglages/compte" element={<Account {...account} dishes={dishes} onAvatar={onAvatar} onName={onName} />} />
      <Route path="/notifications" element={<Inbox userId={user.id} name={name} isPlus={isPlus} history={history} />} />
      <Route path="/notifications/activer" element={<NotifAsk />} />
      <Route path="/aide" element={<Help user={user} isPlus={isPlus} />} />
      <Route path="/infos-legales/:page" element={<Legal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {recipeState?.hello && location.pathname === "/" && !isPlus && (
      <HelloSheet name={name} onScan={openScan} onClose={() => navigate("/", { replace: true })} />
    )}
  </AppFrame>
);
}
