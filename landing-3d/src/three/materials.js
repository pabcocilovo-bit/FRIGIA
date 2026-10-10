// Matériaux partagés : créés une seule fois, réutilisés par tous les objets.
import * as THREE from 'three'
import { COULEURS } from '../config.js'

let cache = null

export function materiaux() {
  if (cache) return cache
  const c = (hex) => new THREE.Color(hex)
  cache = {
    // Laque du frigo : légers reflets, pas de métal
    laque: new THREE.MeshStandardMaterial({ color: c(COULEURS.papier), roughness: 0.3, metalness: 0 }),
    interieur: new THREE.MeshStandardMaterial({ color: c(COULEURS.interieur), roughness: 0.55, metalness: 0 }),
    poignee: new THREE.MeshStandardMaterial({ color: c(COULEURS.sauge), roughness: 0.35, metalness: 0.1 }),
    // Verre : simple transparence (la vraie réfraction coûte trop cher)
    verre: new THREE.MeshStandardMaterial({
      color: c(COULEURS.verre), roughness: 0.15, metalness: 0,
      transparent: true, opacity: 0.45, depthWrite: false,
    }),
    bac: new THREE.MeshStandardMaterial({
      color: c(COULEURS.verre), roughness: 0.25, metalness: 0,
      transparent: true, opacity: 0.7,
    }),
    coque: new THREE.MeshStandardMaterial({ color: c(COULEURS.saugeProfonde), roughness: 0.38, metalness: 0.15 }),
    // Aliments
    tomate: new THREE.MeshStandardMaterial({ color: c(COULEURS.tomate), roughness: 0.35 }),
    carotte: new THREE.MeshStandardMaterial({ color: c(COULEURS.carotte), roughness: 0.6 }),
    fromage: new THREE.MeshStandardMaterial({ color: c(COULEURS.fromage), roughness: 0.6 }),
    courgette: new THREE.MeshStandardMaterial({ color: c(COULEURS.courgette), roughness: 0.5 }),
    lait: new THREE.MeshStandardMaterial({ color: c(COULEURS.lait), roughness: 0.3 }),
    sauge: new THREE.MeshStandardMaterial({ color: c(COULEURS.sauge), roughness: 0.5 }),
  }
  return cache
}

// Libère la mémoire GPU des matériaux partagés
export function libererMateriaux() {
  if (!cache) return
  Object.values(cache).forEach((m) => m.dispose())
  cache = null
}
