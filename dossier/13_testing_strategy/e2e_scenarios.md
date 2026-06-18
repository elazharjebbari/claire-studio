# Scénarios E2E — Playwright (gherkin-like)

> Une spec par feature F1→F12 (cf. `test_matrix.csv`). Tournent contre la **pile réelle** :
> Postgres seedé (`make seed`), backend :8000, frontend :3000 — orchestrés par
> `scripts/e2e.sh` / `make e2e`. Utilisateurs seedés : `alice` (annotator), `bob` (annotator),
> `carol` (reviewer), `admin` (owner). Auth via JWT (login programmatique en `globalSetup`,
> storageState par rôle).

## Conventions

- **Given** = état seedé/préconditions, **When** = actions, **Then** = assertions observables.
- Sélecteurs stables `data-testid` (contrat d'orchestration : le frontend expose des
  `data-testid` listés ci-dessous). Pas de sélecteur fragile sur le texte traduit.
- Chaque spec est indépendante (DB réinitialisée ou namespacée par worker).

---

## F1 — `annotate.spec.ts` (Q-FON-03 : tout au clavier)

```
Scenario: Annoter un document entièrement au clavier
  Given alice est connectée et a une assignation sur le document "Fitbit"
  When elle ouvre /annotate/{annotationId}
   And elle navigue j/k jusqu'à la phrase [6]
   And elle appuie B pour poser une frontière de clause (ancre = [6])
   And elle appuie T puis tape "TERMINATION" et valide le thème
   And elle appuie 2 pour fixer la certitude de la clause
   And elle appuie ⌘S pour créer un snapshot
   And elle appuie sur "Soumettre"
  Then la clause [6] apparaît dans le plan (gauche) avec la couleur du thème TERMINATION
   And l'inspecteur (droite) affiche thème=TERMINATION, certitude=2
   And l'annotation passe au statut "submitted"
   And aucune souris n'a été utilisée (test piloté 100% clavier)
```

## F2 — `prefill.spec.ts`

```
Scenario: Pré-remplir depuis Claude puis comparer à Codex
  Given le projet a des pré-annotations claude@v9.4 et codex@v9.2 pour "Fitbit"
  When alice clique "Pré-remplir depuis Claude"
  Then les ancres+thèmes Claude apparaissent comme brouillon éditable
   And la provenance affiche "seeded_from: preannotation:claude@v9.4"
  When elle active l'overlay "LLM codex"
  Then les frontières Codex non retenues s'affichent en fantôme (non destructif)
  When elle supprime une clause issue de Claude et soumet
  Then provenance.edited = true est enregistré
```

## F3 — `history.spec.ts` (Q-FIA-01)

```
Scenario: Restaurer une version reproduit l'état à l'identique
  Given une annotation avec 3 versions (v1, v2, v3)
  When alice ouvre /history/{annotationId}
  Then la timeline liste v1..v3 ordonnées
  When elle compare v2 et v3
  Then le diff montre exactement les clauses ajoutées/modifiées
  When elle restaure v2
  Then l'état courant est égal à v2 (diff courant↔v2 = vide)
```

## F4 — `collaboration.spec.ts` (Q-FIA-02)

```
Scenario: Voir qui a annoté quoi et l'IAA
  Given alice et bob ont chacun annoté "Fitbit" dans le projet
  When carol (reviewer) ouvre /projects/claudette-gold-v1
  Then le tableau de bord montre la progression par annotateur
   And la cloche d'activité liste les événements récents (verbes submit/clause/comment)
   And l'IAA (Cohen κ alice↔bob) est affiché et > 0
  When carol filtre l'activité par actor=alice
  Then seuls les événements d'alice s'affichent
```

## F5 — `export.spec.ts`

```
Scenario: Exporter un projet en JSONL
  Given admin est sur /admin/exports pour le projet claudette-gold-v1
  When il lance un export format=jsonl scope=approved
  Then un ExportJob est créé avec statut "pending" puis "done"
   And l'artefact est téléchargeable
   And le manifest indique la version de schéma claire-themes-v1
  When il lance un export format=csv pour une comparaison inter-annotateurs
  Then anonymize=true par défaut (identités pseudonymisées)
```

## F6 — `ergonomics.spec.ts` (Q-A11Y-01)

```
Scenario: Confort de lecture et thème sombre
  Given alice est dans le workspace
  When elle bascule en thème sombre via la top bar
  Then les couleurs respectent le contraste AA (audit axe = 0 violation critique)
   And le réglage persiste au rechargement
  When elle redimensionne le panneau inspecteur
  Then la nouvelle largeur est conservée
```

## F7 — `palette.spec.ts` (Q-FON-02 : ≤ 3 clics)

```
Scenario: Command palette et profondeur de navigation
  Given alice est connectée
  When elle ouvre la palette avec ⌘K
   And elle tape "Fitbit" et valide
  Then elle arrive sur le workspace du document "Fitbit"
  When elle ouvre ⌘K et lance "Exporter le projet"
  Then l'action d'export se déclenche
  Then toute surface de navigation.md est atteignable en ≤ 3 clics depuis l'accueil
```

## F8 — `translations.spec.ts`

```
Scenario: Déclarer un dossier de traduction et l'afficher
  Given admin a un dossier de traductions FR seedé pour le corpus
  When il déclare le TranslationSet (folder_path) sur /admin/translations
   And il lance le sync
  Then le mapping document/phrase est créé (statut "synced")
  When alice ouvre le document et active l'overlay langue=FR
  Then la traduction s'affiche en regard des phrases
```

## F9 — `comments.spec.ts`

```
Scenario: Commenter pour justifier un choix
  Given alice a une clause sélectionnée dans le workspace
  When elle appuie C et écrit "ancrage sur la clause d'arbitrage"
  Then un fil de commentaire apparaît dans l'inspecteur, ancré sur la clause
  When carol (reviewer) répond puis marque le fil résolu
  Then le fil est affiché comme "resolved"
```

## F10 — `review.spec.ts`

```
Scenario: Mode revue, notation et archivage
  Given une annotation d'alice est en statut "submitted"
  When carol ouvre /review/{annotationId}
   And elle attribue un score 4/5 avec décision "request_changes"
  Then la review est enregistrée et l'annotation passe "in_review"
  When admin archive l'annotation
  Then le statut devient "archived" et un ActivityEvent est émis
```

## F11 — `new-corpus.spec.ts` (Q-EVO-01 : 0 ligne de code)

```
Scenario: Ajouter un nouveau corpus et schéma sans déploiement
  Given admin est sur /admin/corpora
  When il crée un corpus "DemoCorpus" et importe 2 documents
   And il crée sur /admin/schemes un LabelScheme "demo-themes-v1" (vocab fermé)
   And il crée un projet utilisant ce corpus + ce schéma
  Then un annotateur peut annoter un document de DemoCorpus
   And aucun redéploiement n'a été nécessaire (tout via l'admin)
```

## F12 — `unfairness-overlay.spec.ts`

```
Scenario: Overlay d'injustice CLAUDETTE par défaut
  Given le document "Fitbit" a des ReferenceLabel d'injustice (catégorie+niveau)
  When alice ouvre le workspace
  Then l'overlay injustice est actif par défaut
   And les phrases injustes sont surlignées
  When elle survole une phrase surlignée
  Then une info-bulle affiche la catégorie (ex. LTD) et le niveau (1/2/3)
  When elle désactive l'overlay
  Then les surlignages disparaissent sans modifier l'annotation
```

---

## data-testid attendus (contrat d'orchestration UI)

`sentence-{index}`, `clause-anchor-{index}`, `theme-palette`, `inspector`, `certainty-control`,
`comment-thread`, `unfairness-toggle`, `unfairness-mark-{index}`, `ghost-overlay-{judge}`,
`version-timeline`, `diff-view`, `activity-bell`, `iaa-value`, `export-job-status`,
`theme-toggle`, `command-palette`, `lang-overlay-toggle`. Le frontend les expose ; les specs
s'y accrochent.
