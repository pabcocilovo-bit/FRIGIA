// Le "plateau" : moteur de rendu, caméra, lumières, ombre cuite au sol.
// Il ne dessine que quand quelque chose a bougé, et se met en pause
// quand la scène n'est pas visible.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { CAMERA, CADRAGE, COULEURS, LUMIERE, OMBRE, FRIGO, PERF } from '../config.js'

export function creerPlateau(canvas) {
  const estMobile = () => window.innerWidth < CADRAGE.seuilMobile

  // Moteur de rendu
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = LUMIERE.exposition
  renderer.setClearColor(COULEURS.creme, 1)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.proche, CAMERA.loin)

  // Reflets doux : une "pièce" générée dans le code (0 Ko à télécharger)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = envRT.texture
  scene.environmentIntensity = LUMIERE.environnement
  pmrem.dispose()

  // Une lumière principale douce, sans ombre en temps réel
  const soleil = new THREE.DirectionalLight(0xfff6e8, LUMIERE.principale.intensite)
  soleil.position.set(...LUMIERE.principale.position)
  scene.add(soleil)

  // Ombre cuite sous le frigo : un dégradé dessiné une fois dans une texture
  const ombreTex = textureOmbre()
  const ombreMat = new THREE.MeshBasicMaterial({
    color: COULEURS.ombre, alphaMap: ombreTex, transparent: true,
    opacity: OMBRE.frigo.opacite, depthWrite: false, toneMapped: false,
  })
  const ombre = new THREE.Mesh(new THREE.PlaneGeometry(OMBRE.frigo.largeur, OMBRE.frigo.profondeur), ombreMat)
  ombre.rotation.x = -Math.PI / 2
  ombre.position.set(0, 0.001, FRIGO.profondeur * 0.08)
  ombre.renderOrder = -1
  scene.add(ombre)

  // ── Taille et cadrage ──
  let largeur = 1, hauteur = 1
  const cadrage = { x: 0, y: 0, facteur: 1 } // facteur : 1 = cadrage normal, 0 = centré (utilisé pendant la plongée)
  function redimensionner() {
    largeur = canvas.clientWidth || window.innerWidth
    hauteur = canvas.clientHeight || window.innerHeight
    const max = estMobile() ? PERF.pixelRatioMaxMobile : PERF.pixelRatioMax
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, max))
    renderer.setSize(largeur, hauteur, false)
    const c = estMobile() ? CADRAGE.mobile : CADRAGE.bureau
    cadrage.x = c.x
    cadrage.y = c.y
    camera.fov = c.fov || CAMERA.fov
    appliquerCadrage()
  }
  // Décale l'image pour laisser la place au texte, sans bouger la caméra
  function appliquerCadrage() {
    camera.aspect = largeur / hauteur
    const f = cadrage.facteur
    camera.setViewOffset(largeur, hauteur, -cadrage.x * f * largeur, -cadrage.y * f * hauteur, largeur, hauteur)
    camera.updateProjectionMatrix()
  }

  // ── Boucle de rendu : ne dessine que si quelque chose a changé ──
  let sale = true, actif = false, enVue = true, ongletVisible = !document.hidden
  const avantRendu = new Set()
  const marquerSale = () => { sale = true }
  function image(temps) {
    let continuer = false
    for (const f of avantRendu) continuer = f(temps) || continuer // une fonction peut demander de continuer (balancement)
    if (!sale && !continuer) return
    sale = false
    renderer.render(scene, camera)
  }
  function mettreAJourActivite() {
    const doitTourner = enVue && ongletVisible
    if (doitTourner && !actif) { renderer.setAnimationLoop(image); actif = true; sale = true }
    if (!doitTourner && actif) { renderer.setAnimationLoop(null); actif = false }
  }
  // Pause quand l'onglet est caché…
  document.addEventListener('visibilitychange', () => { ongletVisible = !document.hidden; mettreAJourActivite() })
  // … et quand la scène sort de l'écran
  const io = new IntersectionObserver((entrees) => {
    enVue = entrees[entrees.length - 1].isIntersecting
    mettreAJourActivite()
  })
  io.observe(canvas)
  // Une fois la scène épinglée, GSAP l'enveloppe dans un bloc : on observe ce bloc
  function observer(el) {
    io.disconnect()
    io.observe(el)
  }

  window.addEventListener('resize', () => { redimensionner(); sale = true })
  redimensionner()
  mettreAJourActivite()

  // Libère tout (si la page démonte la scène)
  function liberer() {
    renderer.setAnimationLoop(null)
    io.disconnect()
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose() })
    envRT.dispose()
    ombreTex.dispose()
    ombreMat.dispose()
    renderer.dispose()
  }

  return {
    renderer, scene, camera, cadrage, appliquerCadrage, marquerSale, observer,
    surChaqueImage: (f) => avantRendu.add(f),
    taille: () => ({ largeur, hauteur }),
    estMobile, liberer,
  }
}

// Dégradé doux (rectangle aux bords flous) pour l'ombre de contact
function textureOmbre() {
  const t = 256
  const c = document.createElement('canvas')
  c.width = c.height = t
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, t, t)
  g.filter = 'blur(26px)'
  g.fillStyle = '#fff'
  g.fillRect(t * 0.24, t * 0.22, t * 0.52, t * 0.52)
  g.filter = 'blur(8px)'
  g.fillRect(t * 0.27, t * 0.26, t * 0.46, t * 0.44)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  return tex
}
