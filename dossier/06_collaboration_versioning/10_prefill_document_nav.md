# 10 — Pré-remplissage commutable, navigation documents & en-tête sticky (points 0 & 1)

## Point 0a — Bug « Pré-remplir Claude/Codex » : on ne peut pas commuter

### Diagnostic
`seedFromPreAnnotation` est **additif** et **saute les ancres déjà présentes**. Après
un 1er pré-remplissage (Claude), cliquer Codex ne fait quasi rien : ses ancres
chevauchent celles déjà posées → ignorées. Impossible de « basculer » d'un juge à l'autre.

### Solutions
- **S1 — Vider puis re-seeder** : supprime *tout* puis seed le nouveau juge. *Faiblesse* :
  détruit le travail humain. ❌
- **S2 — Remplacer uniquement les clauses seedées (RETENU)** : on supprime les clauses
  dont `seededFrom` commence par `preannotation:` (issues d'un pré-remplissage, non
  humaines) puis on seed le nouveau juge sur les ancres libres. Les clauses **créées ou
  éditées par l'humain** (`seededFrom` nul) sont **préservées**. Voyant de juge actif.
- **S3 — Superposer en fantômes** : ne rien remplacer, basculer l'overlay fantôme.
  *Faiblesse* : ne répond pas à « pré-remplir » (édition), seulement à comparer. ❌

**Décision : S2.** Nouvelle action store `replacePrefill(clauses, judge)` + état
`prefilledJudge`. La barre d'outils devient un **contrôle segmenté** « Pré-remplir :
Aucun · Claude · Codex » montrant le juge actif ; commuter remplace proprement. Si des
clauses humaines existent, un garde-fou (confirmation) évite les pertes accidentelles
des clauses *éditées issues d'un seed* (trade-off documenté).

## Point 0b — Barre de navigation des documents

### Besoins
Changer de document ; **voyant** « brouillon non enregistré » ; **recherche
autocomplétée**.

### Solutions
- **S1 — Menu déroulant simple** : liste tous les documents. *Faiblesse* : ne passe pas
  à l'échelle (corpus larges), pas de recherche. ❌
- **S2 — Combobox autocomplétée (RETENU)** : champ de recherche filtrant la liste des
  documents du corpus (titre, id), navigation au clavier, **badge draft** sur le
  document courant si `dirty`, et badge de statut (draft/submitted) par entrée. Saut vers
  l'annotation du document sélectionné.
- **S3 — Palette de commandes globale (⌘K)** : déjà existante pour la recherche globale ;
  on la complète mais on garde une **barre dédiée** visible (découvrabilité). ➕ complément.

**Décision : S2** (barre dédiée `DocumentSwitcher`) + lien vers ⌘K pour la recherche
avancée. Le voyant draft réutilise `dirty` du store ; la navigation résout l'annotation
du document (liste des annotations filtrée par document).

## Point 1 — En-tête d'annotation **sticky**

### Solutions
- **S1 — `position: sticky; top:0` sur la barre de contrôles (RETENU)** : la barre reste
  visible au scroll dans le conteneur défilant, avec fond opaque + `backdrop-blur` et un
  léger séparateur. Simple, performant, accessible. ✅
- **S2 — Barre flottante détachée** : superposition `fixed`. *Faiblesse* : gère mal le
  multi-panneaux redimensionnables, risque de chevauchement. ❌
- **S3 — Toolbar repliable au scroll** : masque/affiche selon le sens du scroll.
  *Faiblesse* : surprises d'apparition, complexité ; non nécessaire ici. ❌

**Décision : S1.** On isole la rangée de contrôles (Version, Frontières, source,
Comparer, langue) dans un conteneur `sticky top-0 z-20` avec fond `bg-reading/90
backdrop-blur` ; le contenu du document défile dessous.

## Impact code (ce cycle)
- `store/workspace.ts` : `prefilledJudge`, `replacePrefill`, `actionLog` (+ logging).
- `WorkspaceToolbar.tsx` : contrôle segmenté de pré-remplissage.
- `DocumentSwitcher.tsx` (nouveau) : combobox autocomplétée + voyant draft.
- `DocumentPanel.tsx` : en-tête de contrôles rendu **sticky**.
- `SubmitDialog.tsx` (nouveau) + `HistoryPanel.tsx` (nouveau) : point 2.
