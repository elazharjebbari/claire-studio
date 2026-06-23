# Spécification — Indicateur de provenance `★` / `⚡` / `✎`

> Canal 2 (provenance) + Canal 2bis (état). **FORME = qui a validé** (stable) ;
> **COULEUR = état** (vert validé / ambre à valider). Unifie l'affichage de la provenance à
> trois endroits aujourd'hui disjoints : la **piste de validation**, le **`ClauseChip`** du
> plan et l'**en-tête de clause**. Source unique (cf. `icones_validation.yaml`,
> `palette_couleurs.yaml`).

## 1. Le trio (forme = provenance)

| Forme | Provenance | Sens | Accent (rappel d'origine) |
|---|---|---|---|
| **`★`** | Pré-annotation | validé en adoptant une proposition LLM (seed confirmé) | ambre `#F59E0B` |
| **`⚡`** | Moteur de triage | validé via la file / le rail (niveau Cx) | bleu `#3B82F6` |
| **`✎`** | Manuel | saisi / décidé par l'annotateur, sans assistance | vert `#22C55E` |

La forme est **invariante** : une pré-annotation reste `★` qu'elle soit proposée ou validée ;
seule **sa couleur** change selon l'état. Cela supprime l'ambiguïté de l'UI actuelle où la
provenance n'était lisible que dans l'en-tête.

## 2. La couleur (= état, orthogonale à la forme)

| État | Couleur (dark / light) | Application |
|---|---|---|
| **Validé** | `#34D399` / `#2E7D32` (vert) | la forme de provenance prend le vert |
| **À valider** | `#FBBF24` / `#B45309` (ambre) | la forme passe en ambre **ou** est remplacée par `◷` générique (voir §4) |
| **Non couvert** | `#64748B` / `#9E9E9E` (gris) | glyphe `·` (phrase non annotée) |

Exemples canoniques : `★` ambre = pré-annotation **proposée** ; `★` vert = pré-annotation
**validée**. `⚡` vert + `C2` = validé via le moteur, règle C2. `✎` vert = validé manuellement.

## 3. Complément spécifique au moteur `⚡`

Et **seulement** pour `⚡` : un **badge Cx** (`●` C1 émeraude, `◐` C2 lime, `⧉` C3 violet,
`◑` C4 ambre, `⚖` C5 rose) est affiché **juste après l'éclair**, teinté de la couleur de son
niveau. Pour `★` et `✎`, **aucun** code Cx (ce serait du bruit). Règle socle reprise :
« le niveau Cx n'apparaît QUE pour la provenance moteur, à côté de `⚡` ».

## 4. État « à valider » et bascule vers la forme de provenance

- Tant que la clause est **proposée / non confirmée**, on affiche le glyphe générique **`◷`**
  (ambre), conservé de l'UI actuelle.
- À la **validation**, `◷` est **remplacé** par la forme de provenance correspondante (`★`/`⚡`/`✎`),
  en vert. La transition est animée (≤ 200 ms, morphing du glyphe).
- Variante équivalente acceptée : conserver la forme de provenance dès l'état proposé mais en
  **ambre** (utile quand la provenance est déjà connue avant validation, ex. seed). Choisir UNE
  convention par surface et s'y tenir (cohérence). Recommandation : `◷` ambre générique sur la
  piste/chip ; forme + ambre dans l'en-tête où la provenance est déjà nommée.

## 5. Mapping vers le backend (existant)

| Affichage | Condition de données |
|---|---|
| `★` | `DraftClause.seededFrom` renseigné **+** `validated` (ambre si non encore `validated`) |
| `⚡` + Cx | `DraftClause.triageLevel` renseigné **+** `validated` ; le Cx vient de `triageLevel` |
| `✎` | `validated` **sans** `seededFrom` **ni** `triageLevel` (= l'actuel « ✎ moi ») |
| `◷` | non `validated`, toute provenance (état proposé) |
| `·` | phrase sans clause (non couverte) |

Règle d'unicité (socle) : **une seule forme de provenance par clause** — la **dernière action de
validation fait foi**. Si une clause seedée (`★`) est re-validée manuellement après édition, elle
devient `✎`.

## 6. Déclinaison par emplacement (même trio, rendu adapté)

| Emplacement | Rendu | Notes |
|---|---|---|
| **Piste de validation** (barre `w-1` à gauche du document) | marque `★/⚡/✎` (ou `◷`) posée sur la barre, ≥ 12 px | remplace l'actuel `✓`/`◷` indifférencié par la **vraie** provenance |
| **`ClauseChip`** (plan / ToC) | glyphe de provenance en lieu et place de l'actuel `✓`/`◷` | la teinte de thème du chip et le badge `+N` restent inchangés ; la provenance occupe l'emplacement du glyphe d'état |
| **En-tête de clause** | marque + libellé court (« ✎ moi », « ⚡ C2 », « ★ pré-annotation ») | unifie l'actuel `resolvedFrom`/`seededFrom`/humain sous le trio ★/⚡/✎ |

Les trois surfaces affichent **le même signe pour le même sens** (principe de cohérence). La
provenance devient ainsi lisible **partout**, plus seulement dans l'en-tête.

## 7. Accessibilité

- Chaque marque porte un `title` / `aria-label` textuel explicite : « Validé via le triage —
  règle C2 », « Pré-annotation LLM confirmée », « Validé manuellement », « À valider ».
- Taille glyphe ≥ 12 px, contraste ≥ 3:1 sur le fond du chip / de la piste.
- Jamais la couleur seule : la **forme** distingue déjà les trois provenances ; la couleur ne
  fait qu'ajouter l'état. Un utilisateur daltonien lit la provenance par la forme et l'état par
  le glyphe `◷` (à valider) vs forme pleine (validé) + le texte du tooltip.
