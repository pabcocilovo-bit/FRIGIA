// Point d'entrée : la page s'affiche tout de suite (texte HTML),
// puis on décide si on charge la 3D ou si on garde la version simple.
import './style.css'

const $ = (s) => document.querySelector(s)
const dom = {
  scene: $('#experience'),
  canvas: $('#scene3d'),
  flash: $('.flash'),
  hero: $('.hero-texte'),
}

// Peut-on afficher la 3D ?
const mouvementReduit = matchMedia('(prefers-reduced-motion: reduce)').matches
const webgl = (() => {
  try { return !!document.createElement('canvas').getContext('webgl2') } catch { return false }
})()
const appareilFaible =
  (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)

if (mouvementReduit || !webgl || appareilFaible) {
  passerEnVersionSimple()
} else {
  // La 3D se charge en arrière-plan, quand le navigateur a fini l'essentiel
  const lancer = () =>
    import('./three/app.js')
      .then((m) => m.demarrer({ canvas: dom.canvas, dom }))
      .catch((err) => { console.error(err); passerEnVersionSimple() })
  if ('requestIdleCallback' in window) requestIdleCallback(lancer, { timeout: 1500 })
  else setTimeout(lancer, 300)
}

function passerEnVersionSimple() {
  document.documentElement.classList.add('sans-3d')
}
