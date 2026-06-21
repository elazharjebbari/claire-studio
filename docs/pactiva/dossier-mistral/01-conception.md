# 01 — Conception : besoins, personas, user stories

> Cadre le **pourquoi** et le **pour qui** de l'intégration de Mistral, avant
> l'architecture (`02`) et le plan (`03`). Les user stories tabulées sont dans
> `01-user-stories.csv`.

## 1. Contexte produit

L'atelier Pactiva permet d'**annoter** des documents juridiques (TOS) phrase par
phrase, en s'appuyant sur des **pré-annotations LLM** servant de juges/assistants :
- aujourd'hui **Claude** et **Codex** ;
- on ajoute **Mistral** (modèle souverain européen) comme **3ᵉ juge**.

Les pré-annotations Mistral existent déjà (session `v9_2_session3_mistral`,
**22 documents**, format v9.2). Le corpus de la campagne comprend **50 documents** ;
Mistral n'en couvre donc qu'**une partie** : la conception doit traiter le cas
« **pas de Mistral pour ce document** » comme un état **normal** (piste grisée).

## 2. Objectifs & non-objectifs

### Objectifs (lot initial)
- **O1** — L'annotateur **voit** les frontières/thèmes de Mistral dans la **réglette**
  (3ᵉ piste), au même titre que Claude et Codex.
- **O2** — L'annotateur peut **pré-remplir** son annotation depuis Mistral (option
  « Mistral » dans le prefill) et afficher son **fantôme**.
- **O3** — Le menu **par phrase** montre l'avis de Mistral (bloc juge + adopter).
- **O4** — L'**import** des pré-annotations Mistral est **idempotent** (prod & local),
  sans changement de schéma.
- **O5** — Le code devient **data-driven** : ajouter un 4ᵉ juge demain = éditer
  **un seul fichier** (`lib/llmJudges.ts`) + déposer les données.

### Non-objectifs (reportés, cf. `03` §Suite)
- **N1** — Comparaison **N-way** / matrice d'accord (le mode `compare` **reste
  pairwise** claude-vs-codex).
- **N2** — Calcul d'**IAA backend** incluant Mistral comme 3ᵉ rater (l'IAA par phrase
  existe ; l'étendre à N juges est un chantier séparé).
- **N3** — Sélecteur « quels 2 juges comparer » dans `ComparePanel`.

## 3. Besoins fonctionnels (priorisés MoSCoW)

| Réf | Besoin | Priorité |
|-----|--------|----------|
| BF-1 | Importer les 22 JSON Mistral (v9.2) de façon idempotente | **Must** |
| BF-2 | `GET /preannotations` renvoie Mistral comme tout autre juge | **Must** (déjà le cas) |
| BF-3 | Réglette : 3ᵉ piste Mistral, grisée si absente pour le doc | **Must** |
| BF-4 | Prefill : option « Mistral » + fantôme Mistral | **Must** |
| BF-5 | Menu par phrase : bloc juge Mistral + bouton adopter | **Must** |
| BF-6 | Couleur d'**identité** Mistral distincte (daltonisme-safe) | **Must** |
| BF-7 | SoT `lib/llmJudges.ts` + surfaces data-driven | **Must** |
| BF-8 | Compat : `claudePre/codexPre/byIndex` conservés pendant migration | **Must** |
| BF-9 | Switch source : « Mistral » sélectionnable (vue document = Mistral) | **Should** |
| BF-10 | Seeders locaux (`feed_db`) incluent Mistral | **Should** |
| BF-11 | Import archive multi-versions reconnaît `mistral` | **Could** |
| BF-12 | Compare N-way / matrice | **Won't (ce lot)** |

## 4. Besoins non-fonctionnels

| Réf | Besoin | Cible |
|-----|--------|-------|
| BNF-1 | **Aucune** migration de schéma au-delà de l'enum | enum déjà migrée (`0002`) |
| BNF-2 | **Idempotence** import (re-run sans doublon) | clé `(proj,doc,judge,version)` |
| BNF-3 | **Pas de régression** sur claude/codex (front + E2E) | suite verte avant/après |
| BNF-4 | **A11y** : info juge = forme/lettre + libellé, jamais couleur seule | WCAG AA |
| BNF-5 | **Wire camelCase** ; `themeCode` normalisé en sortie | déjà en place |
| BNF-6 | **Perf** : pas de recalcul superflu (mémos réglette inchangés) | mémos réutilisés |
| BNF-7 | **Réversibilité** : rollback deploy automatique (health ≠ 200) | `deploy-claire.sh` |

## 5. Personas & JTBD (Jobs To Be Done)

### Persona A — Zahra, **annotatrice juridique**
- **Profil** : juriste, annote 5–10 docs/semaine, exigeante sur l'ergonomie, daltonienne
  (deutéranomalie légère) — d'où l'exigence couleur-safe.
- **JTBD** :
  - « Quand je lis une clause ambiguë, je veux **comparer d'un coup d'œil** où Claude,
    Codex **et Mistral** posent leurs frontières, pour **trancher plus vite**. »
  - « Quand un document n'a pas d'avis Mistral, je veux le **savoir clairement** sans
    croire à un bug. »
  - « Quand je démarre un document, je veux **pré-remplir** depuis le modèle que je
    juge le plus fiable (parfois Mistral), puis corriger. »
- **Frustrations actuelles** : bascule manuelle source-par-source ; pas de vue
  simultanée ; aucun signal « modèle absent ».

### Persona B — Jean-Christophe (jc.lamirel), **lead annotation / référent qualité**
- **Profil** : pilote la campagne, suit l'accord inter-modèles et inter-annotateurs,
  prépare les imports prod.
- **JTBD** :
  - « Quand j'ajoute un nouveau juge, je veux une **procédure d'import idempotente**
    et **reproductible** (local → prod), sans toucher au schéma. »
  - « Quand je livre, je veux **vérifier** que la réglette montre bien 3 pistes et que
    rien n'a régressé sur Claude/Codex. »
  - « Je veux que l'ajout d'un futur juge soit **un fichier de config**, pas un chantier. »
- **Frustrations actuelles** : juges codés en dur ⇒ tout ajout = refactor transverse
  risqué.

### Persona C — Ahmed (elazhar), **lead tech / ops** (secondaire)
- **JTBD** : « Quand je déploie, je veux que la **migration s'applique seule**, que les
  **données** partent par rsync, et un **smoke** prod rapide (3 pistes, prefill Mistral,
  pas de tempête réseau ni de 400). »

## 6. Parcours cible (happy path annotateur)

```
1. Ouvre un document de la campagne.
2. Active la réglette « Frontières » → 3 pistes : C (Claude), Cx (Codex), M (Mistral).
   - Si Mistral absent pour ce doc → piste M grisée + en-tête barré (état normal).
3. Survole une cellule M de début de segment → tooltip « Mistral | Résiliation (TER) |
   phrases 15–17 ».
4. (Option) Active le fantôme Mistral → propositions Mistral en filigrane.
5. (Option) Prefill « Mistral » → ses clauses seedent le brouillon, puis l'annotateur
   corrige phrase par phrase.
6. Sur une phrase litigieuse, clic-droit → menu : blocs Claude / Codex / Mistral,
   chacun avec « adopter ».
```

## 7. Critères d'acceptation transverses (Definition of Ready → Done)

- **DoR** : données Mistral présentes (`data/preannotations/mistral/`), SoT spécifiée,
  testids planifiés en `…-${judge.id}`.
- **DoD global** :
  1. Backend : `Judge.MISTRAL` testé ; import `mistral` idempotent prouvé (pytest).
  2. Front : `lib/llmJudges.ts` est l'**unique** source ; aucune nouvelle occurrence
     littérale `"claude"/"codex"` ajoutée hors SoT/tests.
  3. Réglette : 3 pistes ; piste absente **grisée** (pas masquée).
  4. Prefill + fantôme + menu par phrase : Mistral présent et fonctionnel.
  5. **Aucune** régression claude/codex (vitest + Playwright verts).
  6. Compare **inchangé** (toujours pairwise) — non régressé.
  7. Smoke prod OK (health 200, 3 pistes, prefill Mistral, pas de 400/tempête).

## 8. Risques produit & parades

| Risque | Impact | Parade |
|--------|--------|--------|
| Annotateur croit à un bug quand Mistral manque (22/50 docs) | Confiance | État « grisé + en-tête barré » + libellé tooltip « aucune donnée Mistral » |
| Couleur Mistral confondue avec une catégorie/thème | Lisibilité | Identité = teinte neutre **distincte** des thèmes + **lettre** « M » |
| Refactor casse Claude/Codex | Régression | Migration **additive** du hook ; suite E2E claude/codex en garde-fou |
| Surcoût cognitif (3 pistes) | Ergonomie | Toggle par modèle (déjà présent) ; densité « compacte » possible |
| Périmètre qui dérape vers le N-way | Délai | Non-objectif explicite N1–N3 ; compare gelé |
