// L'alpha (Hugo, 3 novembre) : inscriptions ouvertes, Frigia Plus gratuit pour tout le monde jusqu'au 30 novembre inclus,
// et un bandeau qui le dit. Ensuite, l'essai normal (7 jours après l'inscription) puis Plus payant.
// Même date côté serveur : ALPHA_END dans api/_shared.ts.

/** 1er décembre 0 h, heure de Paris */
export const ALPHA_END = Date.UTC(2026, 10, 30, 23);
export const inAlpha = (now = Date.now()) => now < ALPHA_END;
/** « Gratuit jusqu'au 30 novembre » pendant l'alpha, « 7 jours d'essai » ensuite */
export const trialPitch = () => (inAlpha() ? "Gratuit jusqu'au 30 novembre" : "7 jours d'essai");
/** Le bouton d'inscription de la landing */
export const tryLabel = () => (inAlpha() ? "Essayer gratuitement" : "Essayer 7 jours");
