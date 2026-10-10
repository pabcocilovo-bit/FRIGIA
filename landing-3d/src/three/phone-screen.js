// L'écran du téléphone : il affiche en direct ce que "voit" l'appareil photo
// du téléphone (une 2e caméra), avec l'interface de scan Frigia par-dessus.
// Au flash, l'image se fige : c'est la photo.
import * as THREE from 'three'
import { COULEURS, TELEPHONE } from '../config.js'

export function creerEcranPhoto(plateau, ecran, aCacher) {
  const { renderer, scene } = plateau

  // Taille de l'écran, lue sur sa géométrie (marche aussi avec le futur GLB)
  ecran.geometry.computeBoundingBox()
  const bb = ecran.geometry.boundingBox
  const l = bb.max.x - bb.min.x
  const h = bb.max.y - bb.min.y
  const aspect = l / h

  // L'image de l'appareil photo est rendue dans une texture
  const hauteurPx = TELEPHONE.photo.resolution
  const cible = new THREE.WebGLRenderTarget(Math.round(hauteurPx * aspect), hauteurPx, {
    samples: 4, // anticrénelage de l'image
  })
  ecran.material = new THREE.MeshBasicMaterial({ map: cible.texture })

  // L'appareil photo du téléphone : même orientation que le téléphone,
  // il regarde donc vers le frigo (vers -z du téléphone)
  const cameraPhoto = new THREE.PerspectiveCamera(TELEPHONE.photo.fov, aspect, 0.02, 30)

  // ── Interface de scan, dessinée par-dessus l'écran ──
  const ui = new THREE.Group()
  ui.position.z = 0.0004
  ecran.add(ui)
  const matUI = new THREE.MeshBasicMaterial({ color: COULEURS.creme, toneMapped: false, transparent: true })
  const matUIsauge = new THREE.MeshBasicMaterial({ color: COULEURS.saugeClaire, toneMapped: false, transparent: true })

  // 4 coins de visée (en L), comme dans l'appli
  const coins = new THREE.Group()
  ui.add(coins)
  const trait = new THREE.PlaneGeometry(1, 1)
  const ep = l * 0.022, bras = l * 0.17
  const cx = l * 0.36, cy = h * 0.27
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const coin = new THREE.Group()
    coin.position.set(sx * cx, sy * cy + h * 0.02, 0)
    const a = new THREE.Mesh(trait, matUIsauge)
    a.scale.set(bras, ep, 1)
    a.position.set(-sx * (bras / 2 - ep / 2), 0, 0)
    const b = new THREE.Mesh(trait, matUIsauge)
    b.scale.set(ep, bras, 1)
    b.position.set(0, -sy * (bras / 2 - ep / 2), 0)
    coin.add(a, b)
    coins.add(coin)
  }

  // Bouton de déclenchement : un anneau et un disque
  const declencheur = new THREE.Group()
  declencheur.position.set(0, -h * 0.4, 0)
  const anneau = new THREE.Mesh(new THREE.RingGeometry(l * 0.085, l * 0.105, 40), matUI)
  const disque = new THREE.Mesh(new THREE.CircleGeometry(l * 0.07, 40), matUI)
  declencheur.add(anneau, disque)
  ui.add(declencheur)

  // Petite pastille "Ce soir" en haut
  const pastilleTex = textePastille('Ce soir')
  const pastille = new THREE.Mesh(
    new THREE.PlaneGeometry(l * 0.34, l * 0.34 * 0.32),
    new THREE.MeshBasicMaterial({ map: pastilleTex, toneMapped: false, transparent: true }),
  )
  pastille.position.set(0, h * 0.42, 0)
  ui.add(pastille)

  // ── Mise à jour à chaque image ──
  let figee = false
  function rendre() {
    if (figee) return
    // Place l'appareil photo là où est l'écran, orienté comme le téléphone
    ecran.updateWorldMatrix(true, false)
    ecran.getWorldPosition(cameraPhoto.position)
    ecran.getWorldQuaternion(cameraPhoto.quaternion)
    cameraPhoto.updateMatrixWorld()
    // On cache le téléphone pour que l'appareil ne se voie pas lui-même
    aCacher.visible = false
    renderer.setRenderTarget(cible)
    renderer.render(scene, cameraPhoto)
    renderer.setRenderTarget(null)
    aCacher.visible = true
  }

  // Réglages pilotés par la timeline (valeurs de 0 à 1)
  function appliquer({ pointage = 0, appui = 0, interface: visibiliteUI = 1 }) {
    const s = 1 - 0.16 * pointage
    coins.scale.set(s, s, 1)
    disque.scale.setScalar(1 - 0.22 * appui)
    for (const mat of [matUI, matUIsauge, pastille.material]) mat.opacity = visibiliteUI
    ui.visible = visibiliteUI > 0.001
  }

  function figer(oui) { figee = oui }

  function liberer() {
    cible.dispose()
    pastilleTex.dispose()
    ;[matUI, matUIsauge, pastille.material, ecran.material].forEach((m) => m.dispose())
    trait.dispose()
  }

  return { cameraPhoto, rendre, appliquer, figer, estFigee: () => figee, liberer, largeur: l, hauteur: h }
}

// Texte "Ce soir" dans une pastille, dessiné sur un petit canvas
function textePastille(texte) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 82
  const g = c.getContext('2d')
  g.fillStyle = COULEURS.saugeProfonde
  g.beginPath()
  g.roundRect(2, 2, 252, 78, 39)
  g.fill()
  g.fillStyle = COULEURS.creme
  g.font = '600 34px "Hanken Grotesk", system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(texte, 128, 43)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
