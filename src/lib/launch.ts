// Inscriptions fermées tant que l'appli n'est pas ouverte à tous (Hugo, 28 octobre) : la landing, la connexion et
// l'appli installée mènent à la liste d'attente, les écrans d'inscription renvoient vers elle. La connexion reste.
// VITE_SIGNUP_OPEN=true (Vercel, environnement Preview par exemple) les rouvre.
// Le vrai verrou est côté Supabase : Authentication > Sign In / Providers > « Allow new users to sign up » coupé.
export const SIGNUP_OPEN = import.meta.env.VITE_SIGNUP_OPEN === "true";

/** La landing avec la liste d'attente ouverte */
export const WAITLIST_URL = "/?liste";
