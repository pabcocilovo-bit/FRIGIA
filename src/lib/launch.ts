// Inscriptions fermées tant que l'appli n'est pas ouverte à tous (Hugo, 28 octobre) : la landing, la connexion et
// l'appli installée mènent à la liste d'attente, les écrans d'inscription renvoient vers elle. La connexion reste.
// VITE_SIGNUP_OPEN=true (Vercel, environnement Preview par exemple) les rouvre.
// Le vrai verrou est dans la base : seuls les emails de la liste d'attente avec un accès créent un compte (migration 20261104000000).
export const SIGNUP_OPEN = import.meta.env.VITE_SIGNUP_OPEN === "true";

/** La landing avec la liste d'attente ouverte */
export const WAITLIST_URL = "/?liste";

// Le lien du mail de la liste d'attente (/acces?email=…, api/waitlist.ts) rouvre l'inscription sur ce téléphone (Hugo, 29 octobre).
// Ce n'est pas un verrou : la base refuse un email sans accès (migration 20261104000000).
const ACCESS = "frigia_acces";
export const setAccess = (email: string) => { try { localStorage.setItem(ACCESS, email); } catch { /* navigation privée */ } };
/** L'email du lien de la liste d'attente ouvert sur ce téléphone ("1" : le lien sans email) */
export const accessEmail = () => { try { return localStorage.getItem(ACCESS); } catch { return null; } };
/** L'inscription est ouverte : pour tout le monde, ou sur ce téléphone avec le lien de la liste d'attente */
export const signupOpen = () => {
  if (SIGNUP_OPEN) return true;
  try { return !!localStorage.getItem(ACCESS); } catch { return false; }
};
