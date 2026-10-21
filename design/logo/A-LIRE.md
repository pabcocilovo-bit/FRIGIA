# Logo Frigia : fichiers finaux

Choisi le 6 octobre 2026 : le frigo crème dans un viseur menthe, sur fond vert (redessiné d'après l'image de Hugo). Le nom est en Quicksand épaissie. Dans les SVG, les lettres sont déjà dessinées : pas besoin d'installer la police.

Couleurs : vert #2D5E45 · menthe #9FCCA4 · vert moyen #5E9A6C (viseur sur fond clair) · crème #F3F0E7

## Quel fichier pour quoi

| Fichier | Usage |
|---|---|
| `frigia-logo.svg` / `.png` | Logo complet sur fond clair (site, mails, documents) |
| `frigia-logo-inverse.svg` / `.png` | Logo complet sur fond vert ou sombre |
| `frigia-symbole.svg` / `.png` | Le symbole seul, sur fond clair |
| `frigia-symbole-inverse.svg` / `.png` | Le symbole seul, sur fond sombre |
| `frigia-nom.svg` / `frigia-nom-inverse.svg` | Le nom seul |
| `frigia-icone.svg`, `frigia-icone-1024.png` | L'icône comme sur ton image, avec un léger relief (réseaux sociaux, stores) |
| `frigia-icone-plate.svg` | La même icône sans relief (impression, petits supports) |
| `favicon.svg`, `favicon.ico`, `favicon-16/32/48.png` | Onglet du navigateur (version aux traits plus épais) |
| `apple-touch-icon.png` | Icône sur l'écran d'accueil de l'iPhone (180 px) |
| `icon-192.png`, `icon-512.png` | Icônes de l'appli (PWA) |
| `icon-maskable-512.png` | Icône Android, que le téléphone découpe en rond ou en carré |

## Pour le site (à mettre dans `public/`)

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#2D5E45">
```

```json
"icons": [
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
  { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

Pour refaire les fichiers : `outils/gen_final.py` (SVG), puis `outils/render_png.js` (PNG).
