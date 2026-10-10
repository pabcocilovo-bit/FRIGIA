// Assemble la scène : plateau + modèle + écran du téléphone + timeline.
// Ce fichier est chargé en arrière-plan, après le premier affichage de la page.
import * as THREE from 'three'
import { CAMERA, TELEPHONE } from '../config.js'
import { creerPlateau } from './stage.js'
import { chargerModele } from './model.js'
import { creerEcranPhoto } from './phone-screen.js'
import { creerTimeline } from '../scroll/timeline.js'

// L'état de l'animation : la timeline GSAP fait varier ces valeurs (0 → 1),
// et la scène 3D se met à jour à partir d'elles à chaque image.
export const etat = {
  entree: 0, // entrée du téléphone dans le cadre
  avance: 0, // légère avancée de la caméra pendant la scène 1
  pointage: 0, // les coins du viseur se resserrent
  appui: 0, // appui sur le déclencheur
  photoPrise: 0, // 1 = la photo est prise, l'écran est figé
}

export async function demarrer({ canvas, dom }) {
  // La pastille "Ce soir" utilise la police de la page : on l'attend
  await document.fonts.load('600 34px "Hanken Grotesk"').catch(() => {})

  const plateau = creerPlateau(canvas)
  const { scene, camera } = plateau
  const { racine, parties } = await chargerModele(plateau.renderer)
  scene.add(racine)

  // ── Le téléphone : on regroupe coque + écran dans un pivot qu'on anime ──
  const pivotTel = new THREE.Group()
  pivotTel.rotation.order = 'YXZ' // d'abord tourner vers le frigo, puis pencher
  scene.add(pivotTel)
  pivotTel.add(parties.phone_body, parties.phone_screen)
  const ecran = creerEcranPhoto(plateau, parties.phone_screen, pivotTel)

  // ── La porte : les balconnets la suivent quand elle s'ouvre ──
  parties.fridge_door.attach(parties.door_rack_01)
  parties.fridge_door.attach(parties.door_rack_02)

  // ── Mise à jour de la scène à partir de l'état ──
  const pos = new THREE.Vector3(...TELEPHONE.position)
  const depart = pos.clone().add(new THREE.Vector3(...TELEPHONE.departDecalage))
  const rotFin = new THREE.Euler(...TELEPHONE.rotation, 'YXZ')
  const rotDepart = new THREE.Euler(...TELEPHONE.departRotation, 'YXZ')
  const camA = { p: new THREE.Vector3(...CAMERA.epaule.position), c: new THREE.Vector3(...CAMERA.epaule.cible) }
  const camB = { p: new THREE.Vector3(...CAMERA.epauleFin.position), c: new THREE.Vector3(...CAMERA.epauleFin.cible) }
  const cible = new THREE.Vector3()
  const { amplitude, vitesse } = TELEPHONE.balancement
  const mouvementReduit = matchMedia('(prefers-reduced-motion: reduce)').matches

  plateau.surChaqueImage((tempsMs) => {
    const t = tempsMs / 1000
    // Balancement "tenu à la main", qui s'arrête une fois la photo prise
    const bal = mouvementReduit ? 0 : amplitude * (1 - etat.photoPrise) * etat.entree

    // Téléphone : du bas de l'écran vers sa pose finale
    const e = etat.entree
    pivotTel.position.lerpVectors(depart, pos, e)
    pivotTel.position.x += Math.sin(t * vitesse * 1.3) * bal
    pivotTel.position.y += Math.sin(t * vitesse) * bal
    pivotTel.rotation.set(
      THREE.MathUtils.lerp(rotDepart.x, rotFin.x, e) + Math.sin(t * vitesse * 0.8) * bal * 4,
      THREE.MathUtils.lerp(rotDepart.y, rotFin.y, e),
      THREE.MathUtils.lerp(rotDepart.z, rotFin.z, e),
    )

    // Caméra : par-dessus l'épaule, légère avancée
    camera.position.lerpVectors(camA.p, camB.p, etat.avance)
    cible.lerpVectors(camA.c, camB.c, etat.avance)
    camera.lookAt(cible)

    // Écran : interface, photo figée ou image en direct
    ecran.appliquer({ pointage: etat.pointage, appui: etat.appui })
    ecran.figer(etat.photoPrise > 0.5)
    ecran.rendre()

    return bal > 0 // tant que le téléphone bouge tout seul, on continue de dessiner
  })

  creerTimeline({ etat, dom, marquerSale: plateau.marquerSale })
  plateau.observer(dom.scene.parentElement)

  // Outil de réglage, seulement en développement
  if (import.meta.env.DEV) window.__frigia = { etat, plateau, parties, pivotTel, THREE }

  // Première image dessinée : on fait apparaître la scène en fondu
  requestAnimationFrame(() => canvas.classList.add('pret'))
  return plateau
}
