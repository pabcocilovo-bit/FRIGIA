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

## Pas encore fait

1. Notifications natives (les notifications web ne marchent pas dans l'app).
2. Achat de Frigia Plus masqué dans l'app (Apple et Google refusent Stripe).
3. Fiches des stores.
