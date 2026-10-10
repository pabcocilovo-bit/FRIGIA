// ─────────────────────────────────────────────────────────────
//  LE MODÈLE 3D
//  C'est LE SEUL fichier à modifier pour passer au vrai frigo.
//
//  Aujourd'hui : FICHIER_GLB = null → formes simples (boîtes, plans).
//  Demain     : FICHIER_GLB = '/models/frigia.glb' → le vrai modèle.
//
//  Dans les deux cas, chargerModele() renvoie les mêmes objets nommés :
//    fridge_body, fridge_door, shelf_01, shelf_02, shelf_03,
//    drawer_01, door_rack_01, door_rack_02, phone_body, phone_screen
//
//  Règles pour le futur GLB (à donner au modeleur) :
//  - mêmes noms d'objets que ci-dessus ;
//  - 1 unité = 1 mètre, le frigo posé au sol (y = 0), centré en x,
//    façade vers +z ;
//  - l'écran du téléphone (phone_screen) regarde vers +z, avec des UV
//    qui couvrent tout l'écran (0 → 1) ;
//  - compression Draco, textures KTX2 ou WebP, ombres cuites dans les textures.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { FRIGO, TELEPHONE } from '../config.js'
import { materiaux } from './materials.js'

const FICHIER_GLB = null

export const NOMS = [
  'fridge_body', 'fridge_door', 'shelf_01', 'shelf_02', 'shelf_03',
  'drawer_01', 'door_rack_01', 'door_rack_02', 'phone_body', 'phone_screen',
]

export async function chargerModele(renderer) {
  const racine = FICHIER_GLB ? await chargerGLB(FICHIER_GLB, renderer) : construireFormesSimples()
  const parties = {}
  for (const nom of NOMS) {
    parties[nom] = racine.getObjectByName(nom)
    if (!parties[nom]) console.warn(`[modèle] objet manquant : ${nom}`)
  }
  return { racine, parties }
}

// ── Le vrai modèle (chargé seulement si FICHIER_GLB est rempli) ──
async function chargerGLB(url, renderer) {
  // Imports dynamiques : ces chargeurs ne pèsent rien tant qu'on ne s'en sert pas
  const [{ GLTFLoader }, { DRACOLoader }, { KTX2Loader }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/DRACOLoader.js'),
    import('three/addons/loaders/KTX2Loader.js'),
  ])
  const draco = new DRACOLoader().setDecoderPath('./draco/')
  const ktx2 = new KTX2Loader().setTranscoderPath('./basis/').detectSupport(renderer)
  const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2)
  const gltf = await loader.loadAsync(url)
  draco.dispose()
  ktx2.dispose()
  return gltf.scene
}

// ── Les formes simples, en attendant le vrai modèle ──
function construireFormesSimples() {
  const m = materiaux()
  const { largeur: L, hauteur: H, profondeur: P, paroi: e } = FRIGO
  const racine = new THREE.Group()

  // Géométries partagées : une boîte, une sphère, un cylindre "unité",
  // mis à l'échelle pour chaque objet (une seule copie en mémoire).
  const boite = new THREE.BoxGeometry(1, 1, 1)
  const sphere = new THREE.SphereGeometry(1, 16, 12)
  const cylindre = new THREE.CylinderGeometry(1, 1, 1, 18)
  const cone = new THREE.ConeGeometry(1, 1, 14)
  const capsule = new THREE.CapsuleGeometry(1, 6, 4, 10)

  const bloc = (mat, [sx, sy, sz], [x, y, z], parent) => {
    const mesh = new THREE.Mesh(boite, mat)
    mesh.scale.set(sx, sy, sz)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }
  const forme = (geo, mat, [sx, sy, sz], [x, y, z], parent, rot) => {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.scale.set(sx, sy, sz)
    mesh.position.set(x, y, z)
    if (rot) mesh.rotation.set(...rot)
    parent.add(mesh)
    return mesh
  }

  // Caisse du frigo : 5 parois, ouverte à l'avant
  const corps = new THREE.Group()
  corps.name = 'fridge_body'
  bloc(m.laque, [L, H, e], [0, H / 2, -P / 2 + e / 2], corps) // fond
  bloc(m.laque, [e, H, P], [-L / 2 + e / 2, H / 2, 0], corps) // côté gauche
  bloc(m.laque, [e, H, P], [L / 2 - e / 2, H / 2, 0], corps) // côté droit
  bloc(m.laque, [L, e, P], [0, H - e / 2, 0], corps) // dessus
  bloc(m.laque, [L, e * 2, P], [0, e, 0], corps) // socle
  bloc(m.interieur, [L - 2 * e, H - 3 * e, 0.004], [0, H / 2, -P / 2 + e + 0.002], corps) // fond intérieur
  racine.add(corps)

  // Porte (avec sa poignée et sa doublure intérieure)
  const ep = FRIGO.porte.epaisseur
  const porte = new THREE.Group()
  porte.name = 'fridge_door'
  const panneau = new THREE.Mesh(new RoundedBoxGeometry(L, H, ep, 4, 0.018), m.laque)
  panneau.position.set(0, H / 2, P / 2 + ep / 2)
  porte.add(panneau)
  bloc(m.interieur, [L - 0.07, H - 0.1, 0.006], [0, H / 2, P / 2 - 0.003], porte) // doublure
  bloc(m.poignee, [0.022, 0.5, 0.022], [L / 2 - 0.07, H * 0.64, P / 2 + ep + 0.03], porte) // poignée
  bloc(m.poignee, [0.014, 0.014, 0.03], [L / 2 - 0.07, H * 0.64 + 0.22, P / 2 + ep + 0.015], porte)
  bloc(m.poignee, [0.014, 0.014, 0.03], [L / 2 - 0.07, H * 0.64 - 0.22, P / 2 + ep + 0.015], porte)
  racine.add(porte)

  // Clayettes en verre, avec ce qu'il y a dessus
  const clayette = (nom, y) => {
    const g = new THREE.Group()
    g.name = nom
    g.position.set(0, y, -0.07)
    bloc(m.verre, [L - 2 * e - 0.01, 0.008, 0.46], [0, 0, 0], g)
    bloc(m.laque, [L - 2 * e - 0.01, 0.02, 0.014], [0, 0, 0.23], g) // liseré avant
    racine.add(g)
    return g
  }
  const c1 = clayette('shelf_01', FRIGO.etages.shelf_01)
  forme(cylindre, m.lait, [0.042, 0.22, 0.042], [-0.18, 0.115, -0.06], c1) // bouteille de lait
  forme(cylindre, m.fromage, [0.05, 0.1, 0.05], [0.02, 0.055, 0.02], c1) // pot
  forme(cylindre, m.sauge, [0.052, 0.012, 0.052], [0.02, 0.11, 0.02], c1) // couvercle
  bloc(m.fromage, [0.12, 0.05, 0.08], [0.18, 0.03, 0.06], c1) // fromage

  const c2 = clayette('shelf_02', FRIGO.etages.shelf_02)
  forme(sphere, m.tomate, [0.038, 0.035, 0.038], [-0.17, 0.038, 0.05], c2)
  forme(sphere, m.tomate, [0.034, 0.032, 0.034], [-0.1, 0.035, 0.09], c2)
  forme(sphere, m.tomate, [0.036, 0.033, 0.036], [-0.13, 0.036, -0.02], c2)
  bloc(m.laque, [0.22, 0.05, 0.1], [0.12, 0.03, 0.02], c2) // boîte d'œufs
  for (let i = 0; i < 3; i++) forme(sphere, m.lait, [0.022, 0.028, 0.022], [0.05 + i * 0.07, 0.07, 0.02], c2)

  const c3 = clayette('shelf_03', FRIGO.etages.shelf_03)
  bloc(m.bac, [0.2, 0.07, 0.15], [-0.12, 0.04, 0.0], c3) // boîte de restes
  bloc(m.sauge, [0.21, 0.012, 0.16], [-0.12, 0.08, 0.0], c3) // couvercle
  forme(cylindre, m.lait, [0.035, 0.16, 0.035], [0.16, 0.085, -0.05], c3) // yaourt à boire

  // Bac à légumes : ouvert sur le dessus
  const bac = new THREE.Group()
  bac.name = 'drawer_01'
  bac.position.set(0, FRIGO.etages.drawer_01, 0.0)
  const lb = L - 2 * e - 0.02, pb = 0.5, hb = 0.3
  bloc(m.bac, [lb, 0.01, pb], [0, 0.005, 0], bac)
  bloc(m.bac, [lb, hb, 0.01], [0, hb / 2, pb / 2], bac)
  bloc(m.bac, [lb, hb, 0.01], [0, hb / 2, -pb / 2], bac)
  bloc(m.bac, [0.01, hb, pb], [-lb / 2, hb / 2, 0], bac)
  bloc(m.bac, [0.01, hb, pb], [lb / 2, hb / 2, 0], bac)
  bloc(m.verre, [L - 2 * e, 0.008, 0.56], [0, hb + 0.02, -0.02], bac) // couvercle en verre
  forme(capsule, m.courgette, [0.024, 0.024, 0.024], [-0.12, 0.05, 0.02], bac, [Math.PI / 2, 0, 0.3])
  forme(capsule, m.courgette, [0.022, 0.022, 0.022], [-0.05, 0.05, -0.04], bac, [Math.PI / 2, 0, -0.2])
  forme(cone, m.carotte, [0.02, 0.18, 0.02], [0.12, 0.04, 0.0], bac, [0, 0, Math.PI / 2])
  forme(cone, m.carotte, [0.018, 0.16, 0.018], [0.14, 0.04, 0.08], bac, [0, 0.3, Math.PI / 2])
  racine.add(bac)

  // Balconnets de porte (rattachés à la porte plus tard, pour suivre son ouverture)
  const balconnet = (nom, y) => {
    const g = new THREE.Group()
    g.name = nom
    g.position.set(0, y, P / 2 - 0.075)
    bloc(m.laque, [L - 0.14, 0.012, 0.11], [0, 0, 0], g)
    bloc(m.bac, [L - 0.14, 0.075, 0.01], [0, 0.035, -0.055], g) // rebord
    racine.add(g)
    return g
  }
  const b1 = balconnet('door_rack_01', FRIGO.etages.door_rack_01)
  forme(cylindre, m.lait, [0.034, 0.24, 0.034], [-0.15, 0.125, 0], b1)
  forme(cylindre, m.courgette, [0.03, 0.2, 0.03], [-0.07, 0.105, 0], b1) // bouteille verte
  forme(cylindre, m.tomate, [0.028, 0.15, 0.028], [0.05, 0.08, 0], b1) // ketchup
  const b2 = balconnet('door_rack_02', FRIGO.etages.door_rack_02)
  forme(cylindre, m.fromage, [0.04, 0.09, 0.04], [-0.12, 0.05, 0], b2) // moutarde
  forme(cylindre, m.lait, [0.04, 0.12, 0.04], [0.0, 0.065, 0], b2)
  forme(cylindre, m.sauge, [0.035, 0.1, 0.035], [0.12, 0.055, 0], b2)

  // Téléphone : coque + écran (l'écran regarde vers +z)
  const T = TELEPHONE
  const coque = new THREE.Mesh(new RoundedBoxGeometry(T.largeur, T.hauteur, T.epaisseur, 4, T.rayon * 0.6), m.coque)
  coque.name = 'phone_body'
  racine.add(coque)
  const ecran = new THREE.Mesh(
    rectangleArrondi(T.largeur - 2 * T.bordEcran, T.hauteur - 2 * T.bordEcran, T.rayon - T.bordEcran),
    new THREE.MeshBasicMaterial({ color: 0x111111 }),
  )
  ecran.name = 'phone_screen'
  ecran.position.z = T.epaisseur / 2 + 0.0003
  racine.add(ecran)

  return racine
}

// Rectangle aux coins arrondis, avec des UV de 0 à 1 (pour afficher l'image de l'écran)
function rectangleArrondi(l, h, r) {
  const s = new THREE.Shape()
  const x = -l / 2, y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + l - r, y)
  s.quadraticCurveTo(x + l, y, x + l, y + r)
  s.lineTo(x + l, y + h - r)
  s.quadraticCurveTo(x + l, y + h, x + l - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  const geo = new THREE.ShapeGeometry(s, 6)
  const pos = geo.attributes.position, uv = geo.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / l, (pos.getY(i) - y) / h)
  return geo
}
