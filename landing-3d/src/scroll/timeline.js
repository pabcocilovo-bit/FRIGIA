// La timeline GSAP unique, pilotée par le scroll.
// La scène est épinglée (pin) et l'animation suit le scroll (scrub).
// Chaque scène commence à un repère (label) : s1-phone, s2-dive, …
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SCENES, SCROLL } from '../config.js'

gsap.registerPlugin(ScrollTrigger)
// Sur mobile, la barre d'adresse qui apparaît/disparaît ne doit pas tout recalculer
ScrollTrigger.config({ ignoreMobileResize: true })

export function creerTimeline({ etat, dom, marquerSale }) {
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: marquerSale, // à chaque mouvement de la tête de lecture, on redessine
    scrollTrigger: {
      trigger: dom.scene,
      start: 'top top',
      // Longueur du scroll = durée de la timeline × hauteur d'écran × réglage
      end: () => '+=' + Math.round(tl.duration() * window.innerHeight * SCROLL.ecransParUnite),
      pin: true,
      scrub: SCROLL.scrub,
      invalidateOnRefresh: true,
      markers: SCROLL.marqueurs,
    },
  })

  scene1(tl, etat, dom)
  // Les scènes 2 à 5 viendront ici, une par une.

  ScrollTrigger.refresh()
  return tl
}

// ── SCÈNE 1 : le téléphone, le viseur, le flash ──
function scene1(tl, etat, dom) {
  const s = SCENES.s1
  tl.addLabel('s1-phone', 0)
  const a = (t) => `s1-phone+=${t}` // position dans la scène 1

  // Le téléphone entre dans le cadre, la caméra avance un peu
  tl.to(etat, { entree: 1, duration: s.entreeTelephone[1] - s.entreeTelephone[0], ease: 'power2.out' }, a(s.entreeTelephone[0]))
  tl.to(etat, { avance: 1, duration: s.duree, ease: 'power1.inOut' }, a(0))

  // Mise au point : les coins du viseur se resserrent
  tl.to(etat, { pointage: 1, duration: s.miseAuPoint[1] - s.miseAuPoint[0], ease: 'power2.inOut' }, a(s.miseAuPoint[0]))

  // Le flash : appui sur le bouton, lumière, la photo se fige
  tl.to(etat, { appui: 1, duration: s.flashMontee, ease: 'power1.in' }, a(s.flash - s.flashMontee))
  tl.to(etat, { appui: 0, duration: s.flashDescente, ease: 'power2.out' }, a(s.flash))
  tl.to(dom.flash, { autoAlpha: 0.95, duration: s.flashMontee, ease: 'power1.in' }, a(s.flash - s.flashMontee))
  tl.set(etat, { photoPrise: 1 }, a(s.flash))
  tl.to(dom.flash, { autoAlpha: 0, duration: s.flashDescente, ease: 'power2.out' }, a(s.flash))

  // Le titre s'efface doucement
  tl.to(dom.hero, {
    autoAlpha: 0, y: -24, duration: s.sortieTexte[1] - s.sortieTexte[0], ease: 'power1.in',
  }, a(s.sortieTexte[0]))

  // Durée totale de la scène (même si rien ne bouge à la fin)
  tl.set({}, {}, a(s.duree))
}
