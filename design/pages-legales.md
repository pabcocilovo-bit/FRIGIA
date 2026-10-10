# Pages légales de Frigia

Version de travail du 9 octobre 2026. Textes de l'app actuelle (`src/App.tsx` et `src/Landing.tsx`) mis à jour avec les décisions de la refonte. Ils sont aussi dans le prototype V3 (Réglages, rubrique Légal).

> Point de départ, pas un avis juridique : à faire relire par un juriste avant la mise en ligne.

## Ce qui change par rapport à l'existant

- Les deux versions de l'existant (page d'accueil et application) se contredisaient. Il n'en reste qu'une, en 4 pages : Conditions, Confidentialité, Mentions, Cookies. La page RGPD est fondue dans Confidentialité.
- Fini l'essai de 4 jours avec carte à 4,99 €/mois : 15 scans offerts sans carte, puis Plus à 6,99 €/mois, 39,99 €/an, ou 29,99 €/an en prix fondateur.
- Ajouts liés à nos écrans : codes ami et créateur, paiement refusé, pause d'un mois, résiliation en 3 clics avec « Je change d'avis », suppression du compte, mode sans réseau, notifications.
- Nouvelles données : famille et enfants, allergies (données de santé, avec accord explicite), planning, liste, économies, photo gardée dans « Tes scans ».
- Corrections : l'IA citée est Anthropic (plus « Google »), la carte n'est jamais vue par Frigia, la commission des créateurs est annoncée.
- Rétractation : l'existant disait qu'elle ne s'appliquait pas. Pour un abonnement, elle s'applique, sauf case cochée au paiement.
- Ton : on tutoie, comme dans l'app, avec un encadré « L'essentiel » en tête de chaque page.

## À compléter ou décider avant la mise en ligne

1. Éditeur : statut (micro-entreprise au minimum), SIRET, adresse. « Particulier » ne suffit pas pour vendre un abonnement.
2. Médiateur de la consommation : à désigner, c'est obligatoire.
3. Case « accès immédiat » sur la page de paiement, pour la rétractation.
4. Email un mois avant le renouvellement annuel (obligatoire).
5. Région de Supabase (UE ou non) et outil d'envoi des emails automatiques.
6. Pause : une fois par an, ou sans limite ?
7. Photo du frigo : la garder entière ou en miniature dans « Tes scans ».
8. Faire relire par un juriste avant la mise en ligne : ces textes sont un point de départ.

---

## Conditions d'utilisation et de vente

_Mise à jour le 9 octobre 2026_

**L'essentiel**

- 15 scans offerts, sans carte bancaire.
- Frigia Plus : 6,99 €/mois sans engagement, ou à l'année.
- Tu résilies en 3 clics, Plus reste actif jusqu'à la fin de la période payée.
- Les recettes viennent d'une IA : vérifie toujours les allergènes.

### 1. Ce qu'est Frigia

Frigia est une application web (installable sur ton téléphone) qui te propose des recettes à partir d'une photo de ton frigo. Une intelligence artificielle lit la photo, repère les ingrédients et propose trois recettes.

Frigia est édité par **[À compléter : l'éditeur indiqué dans les mentions légales]**. En créant un compte, tu acceptes ces conditions.

### 2. Ton compte

Tu crées ton compte avec ton email et un mot de passe, ou avec Google. Avec un email, tu le confirmes par un code à 6 chiffres.

Il faut avoir au moins 15 ans. Les enfants peuvent figurer dans le profil Famille d'un adulte, mais n'ont pas de compte à eux.

Ton compte est personnel. Garde ton mot de passe pour toi.

### 3. La formule Gratuit

- 15 scans offerts au total, sans carte bancaire et sans limite de temps.
- Les favoris et les scans de plus de 7 jours restent enregistrés, mais s'affichent floutés.
- La famille, le planning de la semaine et la liste de courses complète sont réservés à Plus.

### 4. Frigia Plus

- Mensuel : 6,99 € par mois, sans engagement.
- Annuel : 39,99 € par an.
- Prix fondateur : 29,99 € par an pour les 500 premiers abonnés. Ce prix est garanti tant que tu ne résilies pas.

Les prix sont en euros, toutes taxes comprises. Le paiement se fait sur la page sécurisée de Stripe : Frigia ne voit jamais ton numéro de carte.

L'abonnement se renouvelle tout seul. Pour l'annuel, on t'envoie un email un mois avant le renouvellement, avec la date et le prix.

### 5. Codes ami et créateur

Tu peux entrer un code en créant ton compte ou en passant à Plus.

- Code créateur : ton premier mois de Plus est offert.
- Code ami (parrainage) : un mois de Plus offert pour toi et pour l'ami qui t'a invité, quand tu t'abonnes.
- Un seul code par compte. Les codes ne se cumulent pas, n'ont pas de valeur en argent et peuvent expirer : la date est alors indiquée.
- En cas d'abus (faux comptes, codes revendus), on peut annuler l'avantage.

Quand tu utilises le code d'un créateur, il touche une commission. On lui donne le nombre d'abonnés venus par son code, jamais ton nom ni ton email.

### 6. Si le paiement échoue

Si ta banque refuse le paiement, rien n'est débité et Plus ne s'active pas. Tu peux réessayer ou changer de carte.

Au renouvellement, Stripe réessaie pendant quelques jours et on te prévient par email. Sans nouveau moyen de paiement, ton compte repasse en Gratuit. Tes favoris, tes scans et ta liste ne sont pas supprimés.

### 7. Pause et résiliation

Pause : tu peux mettre Plus en pause un mois, **[À compléter : une fois par an]**. En mensuel, le paiement suivant est sauté. En annuel, ton année est prolongée d'un mois.

Résiliation : dans Réglages, puis Abonnement, touche « Oui, résilier » puis « Confirmer la résiliation ». Trois clics, sans justification. Tu reçois un email de confirmation.

Plus reste actif jusqu'à la fin de la période déjà payée, puis ton compte passe en Gratuit. La période entamée n'est pas remboursée. Tu peux changer d'avis jusqu'à cette date.

### 8. Droit de rétractation

Tu as 14 jours après ton abonnement pour te rétracter, en écrivant à frigia.contact@gmail.com.

Si tu demandes à profiter de Plus tout de suite en cochant la case prévue au paiement, tu reconnais que le service commence avant la fin de ce délai. En cas de rétractation, on te rembourse alors au prorata des jours restants.

### 9. Les recettes et l'IA

Les recettes sont créées par une intelligence artificielle (Claude, d'Anthropic). Elles peuvent contenir des erreurs : quantités, temps de cuisson, ingrédients mal reconnus.

Frigia tient compte des allergies et des goûts indiqués, mais ne remplace pas un avis médical. Vérifie toujours les étiquettes et les allergènes, surtout pour les enfants.

Les photos des plats servent d'illustration (banque d'images Pexels) et ne montrent pas exactement ta recette.

Les économies affichées (« 22,60 € sauvés ce mois-ci ») sont des estimations à partir de prix moyens.

### 10. Bon usage

Tu t'engages à ne pas contourner les limites de scans, ne pas créer de faux comptes, ne pas copier ou revendre le contenu de Frigia et ne pas tenter d'accéder aux comptes des autres.

### 11. Disponibilité

On fait de notre mieux pour que Frigia marche tout le temps, sans pouvoir le garantir. Sans réseau, ta liste de courses, ta semaine et tes favoris restent ouverts, car ils sont gardés sur ton téléphone. Le scan attend le retour du réseau.

### 12. Supprimer ton compte

Dans Réglages, « Supprimer mon compte ». Tu confirmes par email. Ton abonnement est résilié en même temps et tes données sont effacées sous 30 jours.

### 13. Changements

Si ces conditions ou les prix changent, on te prévient par email au moins 30 jours avant. Tu peux résilier avant que le changement s'applique.

### 14. Litiges

Ces conditions relèvent du droit français. En cas de souci, écris-nous d'abord : on répond sous 48 heures. Si on ne trouve pas d'accord, tu peux saisir gratuitement le médiateur de la consommation : **[À compléter : nom et site du médiateur à désigner]**.

### Contact

frigia.contact@gmail.com

---

## Politique de confidentialité

_Mise à jour le 9 octobre 2026_

**L'essentiel**

- On ne vend jamais tes données.
- La photo du frigo sert à lire tes ingrédients.
- Les allergies ne sont enregistrées qu'avec ton accord.
- Tu peux tout télécharger ou tout supprimer.

### Qui s'occupe de tes données

**[À compléter : L'éditeur indiqué dans les mentions légales]** est responsable du traitement. Contact : frigia.contact@gmail.com.

### Ce qu'on enregistre

- Ton compte : prénom, email, mot de passe chiffré, ou ton identité Google si tu te connectes avec Google.
- Tes réponses à l'inscription : objectif, régime, allergies, temps pour cuisiner, ustensiles.
- Ta famille (Plus) : prénom, âge, allergies et ce que chacun n'aime pas, y compris pour les enfants.
- Tes scans : la photo du frigo, les ingrédients trouvés, les recettes proposées et ce que tu as cuisiné.
- Tes favoris, ta semaine, ta liste de courses et tes économies estimées.
- Ton abonnement : formule, dates et code utilisé. Le paiement est géré par Stripe : on ne voit jamais ton numéro de carte.
- Tes choix de notifications, et des données techniques : connexions, type d'appareil, langue.

### Les allergies, un cas à part

Une allergie est une donnée de santé. On ne l'enregistre que si tu l'ajoutes toi-même, pour toi ou ta famille, et seulement pour adapter les recettes. Tu peux la retirer à tout moment.

### La photo du frigo

Elle est envoyée à l'IA pour lire les ingrédients, puis gardée dans « Tes scans » pour que tu retrouves tes recettes. Elle part quand tu supprimes le scan ou ton compte. **[À compléter : Garder la photo entière ou une miniature : à décider côté code.]**

### Pourquoi, et sur quelle base

- Faire marcher Frigia (scan, recettes, famille, planning, liste) : l'exécution de nos conditions.
- Tenir compte des allergies : ton accord, que tu peux retirer.
- Emails de nouveautés et notifications : ton accord, réglable dans Réglages.
- Sécurité, lutte contre la triche et amélioration du service : notre intérêt légitime.
- Factures : nos obligations légales.

### Qui y a accès

- Supabase : comptes et base de données (**[À compléter : région à vérifier : UE]**).
- Vercel : hébergement de l'application (États-Unis).
- Anthropic : lecture de la photo et création des recettes (États-Unis). Ne reçoit que la photo, les ingrédients et les contraintes (allergies, âges, goûts), jamais ton nom ni ton email. Selon ses conditions, il n'entraîne pas ses modèles avec ces données.
- Stripe : paiement.
- Google : connexion avec Google, si tu la choisis.
- Cloudflare (Turnstile) : protection contre les robots à l'inscription.
- **[À compléter : Outil d'envoi des emails automatiques, à préciser]**.
- Pexels ne reçoit que le nom de la recette pour trouver une photo.

Les créateurs ne voient que le nombre d'abonnés venus par leur code. On ne vend ni ne loue jamais tes données.

### Hors de l'Union européenne

Certains de ces services sont aux États-Unis. Les transferts sont encadrés par le cadre de protection des données UE–États-Unis ou par les clauses types de la Commission européenne.

### Combien de temps

- Tant que ton compte est actif.
- Après 3 ans sans connexion, on te prévient puis on supprime le compte.
- Après suppression du compte : effacement sous 30 jours.
- Les factures sont gardées 10 ans, comme la loi l'impose.
- Les données techniques de connexion : 12 mois.

### Sur ton téléphone

Pour marcher sans réseau, Frigia garde une copie de ta liste, de ta semaine et de tes favoris sur ton téléphone. Elle s'efface quand tu te déconnectes.

### Les moins de 15 ans

Il faut 15 ans pour créer un compte. Les informations des enfants sont saisies par leur parent dans le profil Famille, qui peut les modifier ou les supprimer à tout moment.

### Tes droits

Tu peux accéder à tes données, les corriger, les supprimer, les récupérer dans un fichier, t'opposer à un traitement ou retirer ton accord. Écris à frigia.contact@gmail.com : réponse sous 30 jours.

Si tu penses que tes droits ne sont pas respectés, tu peux saisir la CNIL (cnil.fr).

### Sécurité

Mots de passe chiffrés, connexions sécurisées, accès limité aux personnes qui en ont besoin.

---

## Mentions légales

_Mise à jour le 9 octobre 2026_

**L'essentiel**

- Qui édite Frigia, et comment nous joindre.
- Où l'application est hébergée.

### Éditeur

Frigia est édité par **[À compléter : Pablo Cocilovo, statut à préciser (micro-entreprise au minimum), SIRET, adresse]**.

Directeur de la publication : **[À compléter : Pablo Cocilovo]**.

Contact : frigia.contact@gmail.com.

### Hébergement

Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com).

Données : Supabase (**[À compléter : région à vérifier]**).

### Propriété intellectuelle

Le nom Frigia, le logo, les textes, les illustrations et le code appartiennent à l'éditeur. Toute reproduction sans accord écrit est interdite.

Les photos des plats viennent de Pexels et appartiennent à leurs auteurs.

### Responsabilité

Les recettes sont créées par une IA et données à titre indicatif. Vérifie les allergènes. En cas de doute sur ta santé, demande l'avis d'un professionnel.

---

## Cookies et stockage

_Mise à jour le 9 octobre 2026_

**L'essentiel**

- Aucun cookie de pub ni de suivi.
- Seulement ce qu'il faut pour rester connecté et marcher sans réseau.

### Ce que Frigia garde sur ton appareil

- Ta session de connexion (Supabase) : nécessaire.
- Tes préférences, comme la langue : pratique.
- Ta liste, ta semaine et tes favoris, pour marcher sans réseau : pratique.
- Le contrôle anti-robot de Cloudflare à l'inscription : nécessaire.

### Pendant le paiement

La page de paiement Stripe utilise ses propres cookies, nécessaires pour sécuriser le paiement.

### Pas de pub, pas de suivi

Frigia n'utilise aucun cookie publicitaire ni de suivi. Ces éléments sont tous nécessaires ou pratiques : aucun bandeau d'accord n'est donc demandé. **[À compléter : Si un outil de mesure d'audience est ajouté, il faudra le configurer sans cookie ou demander ton accord.]**

### Les effacer

Tu peux tout effacer depuis les réglages de ton navigateur. Tu seras alors déconnecté, et ce qui était gardé pour le mode sans réseau disparaîtra du téléphone (pas de ton compte).
