# App mobile (iOS et Android)

L'app des stores emballe la même appli React que le site, avec [Capacitor](https://capacitorjs.com).
Un seul code : tout ce qui est ajouté au site arrive aussi dans l'app au prochain build.

## Ce qui change dans l'app

- Les fichiers de l'appli sont dans l'app. Les appels `/api/…` partent vers https://frigia.fr (`src/lib/native.ts`).
- Pas de page de présentation : l'app s'ouvre comme l'appli installée (`isStandalone()`).
- Pas de service worker (`npm run build:app` construit en mode `app`).
- Le bouton retour d'Android revient à l'écran précédent.

## Tester sur ton téléphone (sur le Mac)

Une fois : installer [Xcode](https://apps.apple.com/fr/app/xcode/id497799835) (iPhone) et/ou [Android Studio](https://developer.android.com/studio) (Android).

```bash
npm install
npm run ios       # construit l'appli, puis ouvre le projet dans Xcode
npm run android   # pareil, dans Android Studio
```

Le fichier `.env` doit contenir `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (les mêmes que le site).

- **iPhone** : branche-le, choisis-le en haut de Xcode, puis ▶. La première fois, Xcode demande de choisir ton équipe (ton compte Apple) dans *Signing & Capabilities*.
- **Android** : active le mode développeur du téléphone, branche-le, puis ▶ dans Android Studio.

Après une modification du code : `npm run build:app`, puis ▶ à nouveau.

## Icônes et écran de lancement

Sources dans `assets/` (faites depuis le logo final). Pour les refaire :

```bash
npx capacitor-assets generate --android --ios --iconBackgroundColor '#2D5E45' --splashBackgroundColor '#2D5E45' --splashBackgroundColorDark '#2D5E45'
```

## Connexion

- **Anti-robot** : Turnstile refuse les pages servies depuis le téléphone. L'app charge https://frigia.fr/captcha dans un cadre invisible, qui lui renvoie les jetons (`public/captcha.html`, `src/app/onboarding/captcha.tsx`). Cette page doit être en ligne sur frigia.fr.
- **Google et Apple** : la page de connexion s'ouvre dans le navigateur du téléphone, qui revient dans l'app par `fr.frigia.app://auth` (`src/app/onboarding/oauth.ts`). Le bouton Apple n'apparaît que sur iPhone.

À régler une fois dans Supabase (Authentication) :
1. *URL Configuration › Redirect URLs* : ajouter `fr.frigia.app://auth`.
2. *Sign In / Providers › Apple* : activer Apple (il faut le compte développeur Apple).

## Notifications

L'app reçoit les notifications d'Apple (iPhone) et de Google (Android), envoyées par `api/_native.ts`.
Les jetons des téléphones sont rangés avec les abonnements web, dans `push_subscriptions` (`apns:…` ou `fcm:…`).

À régler une fois :
1. **iPhone** (compte développeur Apple nécessaire) :
   - Dans Xcode, cible **App** › *Signing & Capabilities* › **+ Capability** › *Push Notifications*.
   - Sur developer.apple.com › *Keys* : crée une clé avec *Apple Push Notifications service (APNs)*, télécharge le fichier `.p8`.
   - Dans Vercel : `APNS_KEY` (tout le texte du `.p8`), `APNS_KEY_ID` (l'identifiant de la clé), `APNS_TEAM_ID` (ton Team ID).
2. **Android** :
   - Sur console.firebase.google.com : crée un projet, ajoute une app Android `fr.frigia.app`, télécharge `google-services.json` dans `android/app/`.
     Sans ce fichier, l'app Android plante quand on active les notifications.
   - Firebase › Paramètres du projet › *Comptes de service* › *Générer une clé privée* : dans Vercel, `FCM_SERVICE_ACCOUNT` (tout le texte du JSON).

## Achat de Frigia Plus

Apple et Google interdisent un autre paiement que le leur dans une app. Dans l'app : ni prix, ni bouton d'achat, ni code
qui débloque Plus. Un compte Plus pris sur le site est reconnu. « J'ai déjà Plus : actualiser » relit le compte.
Résilier ou mettre en pause reste possible.

## Recette en cours hors de l'app

Pendant une recette (`src/app/scan/cookingNative.ts`) :
- le minuteur sonne même app fermée ou téléphone verrouillé (notification programmée dans le téléphone) ;
- **iPhone** : l'étape, le texte de l'étape et le minuteur sur l'écran verrouillé et dans la Dynamic Island (Activité en direct) ;
- **Android** : une notification qui reste, avec l'étape et l'heure de fin du minuteur.

L'Activité en direct demande une cible en plus dans Xcode, à créer une fois :
1. Xcode › *File* › *New* › *Target…* › **Widget Extension** › *Next*.
2. Nom : `FrigiaLive`. Coche **Include Live Activity**, décoche le reste (*Configuration App Intent*, *Control*). *Finish*, puis *Activate*.
3. Dans le Terminal : `npm run live-activity` (met l'affichage de Frigia à la place des fichiers d'exemple).
4. ▶. Lance une recette avec un minuteur, puis verrouille le téléphone.

## Pas encore fait

1. Fiches des stores.
