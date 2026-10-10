// Configuration Vite : chemins relatifs pour que la page marche
// aussi bien à la racine du site que dans un sous-dossier.
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: { target: 'es2020', assetsInlineLimit: 0 },
})
