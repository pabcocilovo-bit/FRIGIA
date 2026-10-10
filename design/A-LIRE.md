# Nouveau design Frigia : à lire avant de coder

Cette branche contient les maquettes du nouveau design (octobre 2026). Le code de l'app n'a pas été touché : le but est de brancher la partie fonctionnelle existante (`src/App.tsx`, `src/lib/`, `api/`, Supabase, Stripe) sur ces visuels.

## Ce qu'il y a dans `design/`

| Fichier | Contenu |
|---|---|
| `prototype-v3.html` | La maquette cliquable. Ouvre-la dans un navigateur : le menu de gauche liste tous les écrans, « Voir l'app en Gratuit / Plus » change la formule, la colonne de droite explique chaque écran. |
| `tokens.css` | Couleurs et polices. À reprendre telles quelles. |
| `fondations.html` | La carte des fondations V3 : logo, couleurs, typographie, formes, composants et règles. Ouvre-la dans un navigateur (elle lit `logo/` et `img/`). |
| `ecrans-a-faire.md` | La liste de tous les écrans, avec ce qui est fait et ce qui reste à dessiner. |
| `pages-legales.md` | Les textes légaux mis à jour (prix, codes, résiliation, famille, IA). Il manque encore : statut, SIRET, médiateur. |
| `logo/` | Logo final, favicons et icônes PWA (voir `logo/A-LIRE.md`). |
| `ecran-lancement/` | Illustration de l'écran d'ouverture. |

## La direction artistique en bref

- Fond crème `#F5EFE3`, vert sauge `#527659` et `#34503B`, doré `#E0A44A` pour les accents rares (Plus, badges).
- Textes en Hanken Grotesk ; titres en Instrument Serif, avec le mot important en italique sauge (« Ton *bilan* », « Qu'est-ce qu'on mange *ce soir ?* »).
- Cartes arrondies (18 à 24 px), boutons en pilule, feuilles qui montent du bas pour les actions courtes.
- Mode clair seulement pour l'instant.
- Tutoiement partout, phrases courtes.

## Règles à garder

- 15 scans gratuits en tout (pas par semaine). Frigia Plus : 6,99 €/mois, 39,99 €/an, prix fondateur 29,99 €/an pour les 500 premiers.
- Ne jamais écrire « panier-repas » : on dit « Midi ».
- Code ami ou créateur faux : ne jamais proposer un code proche (risque qu'on devine les codes).
- Compteur de la communauté : la vraie somme des kg sauvés par tous les comptes, pas un chiffre inventé. Le cacher tant qu'il est petit (moins d'environ une tonne).
- Résilier en 3 clics, « Oui, résilier » aussi visible que « Garder Plus ».
- Notifications : les demander après le premier repas cuisiné, pas à l'inscription. Sur iPhone, une web app ne les reçoit que si elle est sur l'écran d'accueil (iOS 16.4 ou plus).

## Écrans de la maquette et code existant

« Habillage » = la fonction existe déjà, il faut seulement changer le visuel. « À créer » = la fonction n'existe pas encore dans le code.

| Écran de la maquette | Dans le code aujourd'hui | Travail |
|---|---|---|
| Ouverture (logo) | rien | À créer (simple) |
| Inscription : bienvenue, objectif, régime, temps, « ton Frigia est prêt » | `OnboardingScreen`, `QuestionnaireScreen` | Habillage |
| Crée ton compte, email, connexion | `src/lib/auth.ts` (email + mot de passe Supabase) | Habillage |
| Bouton Google | rien | À créer (Supabase OAuth) |
| Code par email, mot de passe oublié | rien | À créer (OTP / reset Supabase) |
| Accès à la caméra (explication avant la fenêtre du téléphone) | rien | À créer (simple) |
| Accueil | écran principal de `Frigia` + `Nav` | Habillage ; « plat prévu ce soir » à créer avec le planning |
| Scan du frigo, recadrer la photo | `FridgeAIScanner`, `CropModal`, `api/analyze.ts` | Habillage |
| Scan raté | gestion d'erreur de `api/analyze.ts` | Habillage d'une erreur existante |
| Pas de réseau | rien | À créer (`navigator.onLine`) |
| Ingrédients trouvés, ajouter un ingrédient | état `ingredients` de `FridgeAIScanner` | Habillage |
| Recettes en préparation | chargement de `FridgeAIScanner` | Habillage |
| Trois recettes, fiche recette, portions | `RecipeCard`, `RecipeDetailModal`, `ServingsModal` | Habillage |
| Mode cuisine (étapes, minuteur, « J'ai cuisiné ça ») | rien | À créer |
| Tes favoris, tes scans, états vides | `HistoryTab` (historique, favoris) | Habillage |
| Liste de courses | rien | À créer (table Supabase) |
| Crée ta semaine, planning, remplacer un repas | rien | À créer (table Supabase) |
| Passe à Plus, paiement refusé, bienvenue dans Plus, résilier | `PaywallModal`, `CheckoutSuccessModal`, `CanceledScreen`, `api/create-checkout.ts`, `api/customer-portal.ts`, `api/stripe-webhook.ts` | Habillage ; la pause d'un mois est à créer |
| Code ami ou créateur | rien | À créer (codes promo Stripe ou table) |
| Bilan du mois, compteur de la communauté | rien | À créer (calcul à partir des repas cuisinés) |
| Famille, ajouter un proche, « +1 invité » | rien | À créer (table foyer : prénom, âge, allergies, n'aime pas) |
| Réglages, Mon compte, photo de profil | `SettingsModal` (onglet profil), `avatarSrc` | Habillage ; changer d'email par code et relier Google à créer |
| Supprimer mon compte (glisser pour supprimer) | `api/delete-account.ts` | Habillage |
| Aide et FAQ | `SupportFAQItem`, `FAQItem` | Habillage ; la feuille « Nous écrire » est à brancher |
| Infos légales | `LegalModal` + `pages-legales.md` | Habillage + textes |
| Activer les notifications | rien | À créer (Web Push) |
| Premier scan guidé | rien | À créer (bulles, une seule fois) |

## Conseil pour avancer

1. Mettre `tokens.css`, les polices et le logo en place, puis habiller les écrans « Habillage » un par un, sans toucher à la logique.
2. Ensuite seulement, créer les fonctions nouvelles, en commençant par celles du lancement (voir `ecrans-a-faire.md`).
3. Garder `main` intact : tout se fait sur cette branche, puis une pull request.
