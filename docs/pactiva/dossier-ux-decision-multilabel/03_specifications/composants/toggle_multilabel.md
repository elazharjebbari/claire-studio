# Spécification — Toggle multi-label `🏷`

> Canal 3. Active / désactive le multi-label sur une clause. **Le toggle EST l'annulation**
> (réversibilité native — cf. `principes_design.md` §2). Couleur dédiée `#64B5F6` (bleu clair),
> distincte du violet C3 et du vert de validation.

## 1. Rôle et invariant

Un seul interrupteur, deux états, **réversible** : re-cliquer rétablit l'état précédent sans
passer par un « undo » séparé. Le geste courant n'est jamais piégeant. L'undo/redo global reste
le filet de sécurité (transactionnel) pour les actions enchaînées.

L'interrupteur **ne crée pas** de thème secondaire à lui seul : il ouvre (ON) ou referme (OFF)
le **mode** multi-label. En ON, l'affordance « + thème secondaire » devient disponible ; en OFF,
les secondaires sont masqués (mais **non détruits** côté données tant que l'utilisateur ne les
retire pas explicitement — voir §5).

## 2. États visuels

| État | Libellé | Position du switch | Couleur | Glyphe |
|---|---|---|---|---|
| **ON (actif)** | **« Multi »** (`Multi-label` en version longue) | curseur à droite | fond `#64B5F6` à faible opacité + liseré `#64B5F6` | `🏷` plein, teinté `#64B5F6` |
| **OFF (inactif)** | **« Mono »** | curseur à gauche | neutre (`line` / `panel`) | `🏷` en contour discret, encre `ink_muted` |

Distinguabilité **sans couleur** (exigence socle) : l'état est lisible par **le libellé
(Mono / Multi)** ET **la position du curseur** — jamais par la teinte seule. La couleur n'est
qu'un renfort.

## 3. Emplacements (mêmes états partout)

| Emplacement | Forme retenue | Notes |
|---|---|---|
| **Inspecteur** (zone « Thèmes », en tête) | interrupteur complet : `🏷` + libellé Mono/Multi + switch | emplacement de référence ; cible ≥ 32 px |
| **SuggestionCard** | `🏷` + libellé court, accolé au bloc primaire/secondaire | active le set proposé (primaire + secondaire) en un geste ; cible ≥ 24 px |
| **Chip / document** | `🏷` compact (icône + état au tooltip) à côté de la rangée de chips | version dense, mais même sémantique et même réversibilité |

Le composant est **identique** dans les trois contextes (source unique), seules la densité et la
longueur du libellé varient.

## 4. Feedback (< 200 ms)

- **OFF → ON** : le switch glisse vers la droite (≤ 150 ms, easing sortant), le `🏷` se remplit et
  prend la teinte `#64B5F6`, le libellé passe « Mono » → « Multi », et la zone secondaire
  apparaît (fondu + léger glissement). Annonce lecteur d'écran : « Multi-label activé ».
- **ON → OFF** : transition inverse ; la zone secondaire se replie. Annonce : « Multi-label
  désactivé, retour mono-label ».
- Aucun rechargement ni clignotement ; le focus reste sur l'interrupteur après bascule.

## 5. Réversibilité et données (UX)

- **Bascule immédiate** : ON puis OFF dans la foulée ramène strictement à l'état de départ
  (mode + visibilité des secondaires) — c'est l'annulation décrite au socle.
- **Garde-fou** : si des thèmes secondaires ont été **réellement saisis** puis qu'on bascule
  OFF, ils sont **masqués, pas supprimés** ; un libellé discret indique « 2 secondaires masqués
  (Mono) ». Ré-activer ON les ré-affiche tels quels. La suppression d'un secondaire reste une
  action explicite distincte (sur le chip), elle, couverte par l'undo global.
- Cette dissociation « masquer (toggle) » vs « retirer (action chip) » protège contre la perte
  accidentelle de travail.

## 6. États techniques d'interaction

| État | Rendu |
|---|---|
| Survol | légère élévation du fond du switch, curseur `pointer`, tooltip décrivant l'action cible (« Activer le multi-label » / « Revenir en mono-label ») |
| Focus clavier | anneau de focus `selection_ring` (2 px) visible ; activable par **Espace** / **Entrée** |
| Active (pressé) | switch enfoncé, retour visuel instantané (< 100 ms) |
| Désactivé | si la clause ne peut pas être multi-label (ex. non annotée) : opacité 0.4, `aria-disabled`, tooltip explicatif |

## 7. Accessibilité (rappel ; détail dans `accessibilite.md`)

- Rôle `switch` avec `aria-checked` reflétant ON/OFF.
- `aria-label` : « Multi-label de la clause — actuellement {Mono|Multi} ».
- L'état doit rester perceptible en daltonisme et en niveaux de gris (libellé + position).
