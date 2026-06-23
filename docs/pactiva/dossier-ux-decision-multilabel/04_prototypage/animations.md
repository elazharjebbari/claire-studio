# Spécification des animations — feedback de décision & multi-label

> Section 04_prototypage du dossier UX multi-label (Pactiva). Conception UI/UX,
> pas de code. Toute durée perceptible ≤ 200 ms (principe « feedback immédiat »
> de `principes_design.md`). Aucune animation ne déplace la mise en page de façon
> à faire « sauter » le contenu (pas de reflow brutal). Toutes respectent la
> préférence système de réduction du mouvement.

## 0. Principes transverses

- **Budget temps** : aucune animation de feedback ne dépasse **200 ms** ; au-delà,
  l'utilisateur perçoit un délai. Les transitions d'ambiance (glissement de carte)
  visent 160–220 ms et restent interruptibles.
- **Ce qu'on anime** : couleur, opacité, échelle légère, remplissage de glyphe,
  liseré. **Ce qu'on n'anime pas** : la position des chips de thème (le primaire
  ne se déplace pas quand un secondaire apparaît → stabilité de lecture).
- **Courbe** : `ease-out` pour les apparitions/confirmations (départ rapide,
  fin douce) ; `ease-in-out` pour les bascules réversibles (toggle).
- **Renfort non-couleur** : chaque animation qui change une couleur change AUSSI
  une forme, un glyphe ou un libellé (WCAG AA, jamais la couleur seule). Si les
  animations sont réduites, l'**état final** reste pleinement lisible.
- **Idempotence visuelle** : rejouer l'animation ne crée pas de scintillement ;
  un état déjà atteint ne « re-pulse » pas.

## 1. Feedback de validation (★ / ⚡ / ✎ : ambre → vert)

Déclencheur : clic sur « Valider », « Accepter », « Valider + suivant ».

| Phase | Durée | Effet |
|---|---|---|
| Impact | 0–90 ms | la forme de provenance (★/⚡/✎) **grossit** de 1.0 → 1.15 (échelle), `ease-out` |
| Couleur | 0–150 ms | la couleur passe **ambre `#FBBF24` → vert `#34D399`** ; le glyphe ◷ (à valider) est remplacé par la forme de provenance |
| Détente | 150–200 ms | retour 1.15 → 1.0 |

- Halo optionnel : anneau vert à 3:1 de contraste, opacité 0.4 → 0, sur 200 ms.
- **Sans mouvement** : pas de scale ni de halo ; bascule directe ambre→vert + swap
  de glyphe (instantané). L'information passe entièrement par forme + couleur finale.
- Le badge de NIVEAU (Cx, couleur) **ne s'anime pas** : la validation ne change
  pas le niveau, seulement l'état de provenance.

## 2. Transition mono → multi (toggle 🏷 et pose d'un secondaire)

Déclencheur : activation du toggle `🏷 Multi-label`, clic « ＋ thème secondaire »,
ou validation d'une suggestion C3 portant un secondaire.

| Phase | Durée | Effet |
|---|---|---|
| Toggle | 0–160 ms | le switch glisse OFF→ON (`ease-in-out`) ; libellé « Mono » → « Multi-label » (swap de texte, pas de fondu lent) |
| Apparition 2ⁿᵈ | 0–180 ms | le chip secondaire entre par **opacité 0 → 0.9** + **échelle 0.96 → 1.0**, ancré à sa position finale (le primaire ne bouge pas) |
| Préfixe | à la pose | `◻` (proposé) → `+` (posé) : remplissage du glyphe, pas de déplacement |

- **Réversible (toggle OFF)** : animation **exactement inverse** (chip 0.9 → 0
  opacité, switch ON→OFF) sur 160 ms ; le secondaire est masqué, **non détruit**.
- La pastille `＋N` du ClauseChip du plan s'incrémente avec un micro-pulse
  (échelle 1.0 → 1.12 → 1.0, 180 ms) pour signaler le changement à distance.
- **Sans mouvement** : le chip secondaire apparaît/disparaît sans fondu ni scale ;
  le libellé du toggle bascule instantanément (Mono/Multi reste l'indice fiable).

## 3. Pulse « décision manuelle » (✎)

Déclencheur : validation manuelle explicite (bouton ✎), pour marquer qu'un humain
a tranché sans assistance — feedback un cran plus appuyé que C1/C2.

| Phase | Durée | Effet |
|---|---|---|
| Pulse | 0–200 ms | la plume ✎ pulse une fois (opacité 0.6 → 1.0, échelle 1.0 → 1.1 → 1.0, `ease-out`) ; couleur **vert `#22C55E`** (action humaine) |

- **Un seul** pulse (pas de boucle) : c'est une confirmation, pas une alerte.
- **Sans mouvement** : la plume s'affiche directement en vert, pleine opacité.

## 4. Clignotement de conflit (C4 / C5)

Déclencheur : entrée sur une clause **C4/C5** non résolue, ou tentative d'action
en lot incluant une clause d'arbitrage. Signale qu'une décision humaine est due ;
**jamais** d'auto-validation.

| Phase | Durée | Effet |
|---|---|---|
| Attention | 2 cycles, ~180 ms/cycle | le marqueur `❗` + liseré (ambre C4 `#F59E0B` / rose C5 `#F43F5E`) pulse en opacité 0.5 ↔ 1.0, **puis s'arrête** sur l'état plein |

- **Limité à 2 cycles** : un clignotement perpétuel fatigue et nuit à l'accessibilité
  (risque vestibulaire / TDAH). Après 2 cycles, état stable saillant (`❗` + couleur).
- Ne **jamais** clignoter en rouge plein sur toute la carte (agressif) : seul le
  marqueur + le liseré pulsent.
- **Sans mouvement** : aucun clignotement ; `❗` + liseré affichés pleins
  immédiatement. La saillance vient de la forme et du libellé « Arbitrage requis ».

## 5. Glissement de la file (carte suivante)

Déclencheur : « Valider + suivant » dans la file de triage.

| Phase | Durée | Effet |
|---|---|---|
| Sortie | 0–120 ms | la carte traitée glisse / fond vers le haut (opacité 1 → 0) |
| Entrée | 80–220 ms | la carte suivante glisse depuis le bas (translation 8 px, opacité 0 → 1), chevauchement léger pour la fluidité |

- Les **compteurs Cx** se décrémentent avec un micro-pulse (cf. §2).
- **Sans mouvement** : remplacement direct du contenu, pas de glissement ; le
  compteur change sa valeur sans pulse.

## 6. Option « Réduire les animations »

- **Source** : respecte d'abord la préférence système (équivalent
  `prefers-reduced-motion`) ; un réglage **dans les préférences de Pactiva**
  permet de forcer l'état « réduit » indépendamment du système.
- **Comportement en mode réduit** : suppression des translations, scale, halos,
  pulses et clignotements. On conserve uniquement les **changements d'état
  instantanés** (couleur finale, swap de glyphe, libellé du toggle), qui suffisent
  à comprendre le résultat.
- **Garantie** : aucune information n'est perdue en mode réduit, car chaque
  animation n'était qu'un **renfort** d'un changement déjà porté par forme + texte.
- Le budget « feedback < 200 ms » reste respecté trivialement (transitions à 0 ms).

## 7. Récapitulatif des durées

| Animation | Durée totale | Boucle ? | Mode réduit |
|---|---|---|---|
| Validation ambre→vert (§1) | ≤ 200 ms | non | instantané |
| Mono → multi / toggle (§2) | ≤ 180 ms | non (réversible) | instantané |
| Pulse manuel ✎ (§3) | ≤ 200 ms | non (1×) | instantané |
| Conflit C4/C5 (§4) | 2 cycles (~360 ms) | non (s'arrête) | aucun clignotement |
| Glissement file (§5) | ≤ 220 ms | non | remplacement direct |
