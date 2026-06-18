# Revue & notation

> Périmètre : feature **F10** (notation + décisions). Entité : `Review`. Endpoints :
> `POST /api/v1/annotations/{id}/reviews`, `GET /api/v1/annotations/{id}/reviews`. Surface :
> mode revue `/review/[annotationId]` (lecture + notation + commentaires).

## 1. Modèle

```
Review(PK id, *FK annotation, *FK reviewer(User), *score[1..5], decision[approve|request_changes|reject],
       rubric:json, body:md, created_at)
```

- Un `Review` est l'évaluation d'**une** annotation par **un** reviewer à un instant donné. Plusieurs
  reviews successives possibles (historique de qualité) ; la **dernière** fait foi pour le statut.
- `score` = note globale **1–5** ; `decision` = verdict actionnable ; `rubric` = détail par critère ;
  `body` = commentaire de synthèse (Markdown assaini, cf. `comments.md` §3).
- Réservé aux rôles `reviewer`, `lead`, `admin`/`owner` (navigation.md §4). Un annotateur ne note pas.

## 2. Rubrique de notation (1–5)

La note globale est étayée par une **rubrique fermée** (cohérente, défendable), stockée dans
`rubric:json`. Critères et échelle :

| Critère | Question | Échelle |
|---|---|---|
| `boundaries` | Les frontières de clause sont-elles correctes/justifiées ? | 1–5 |
| `theme_accuracy` | Les thèmes sont-ils corrects (vocab fermé respecté) ? | 1–5 |
| `evidence` | Les `evidence_span` étayent-ils bien chaque clause ? | 1–5 |
| `rationale` | Les justifications sont-elles claires et suffisantes ? | 1–5 |
| `consistency` | Cohérence interne et avec les consignes du projet ? | 1–5 |

Barème de chaque critère (ancré pour limiter la subjectivité) :

```
5 = irréprochable      4 = mineur à corriger     3 = correct avec réserves
2 = problèmes notables 1 = à refaire
```

`rubric` exemple :
```json
{"boundaries": 5, "theme_accuracy": 4, "evidence": 4, "rationale": 3, "consistency": 4,
 "weights": {"boundaries": 0.25, "theme_accuracy": 0.30, "evidence": 0.15,
             "rationale": 0.10, "consistency": 0.20}}
```

Le `score` global peut être saisi directement **ou** suggéré comme moyenne pondérée des critères
(arrondie) — comme pour la certitude, la suggestion ne s'écrit jamais sans validation du reviewer.

## 3. Décisions & transitions de statut

`decision` pilote la transition de statut de l'`Annotation` (CONTRACT §2 :
`draft|submitted|in_review|approved|rejected|archived`) :

| `decision` | Transition d'`Annotation` | Effet |
|---|---|---|
| `approve` | `submitted/in_review → approved` | annotation validée, éligible export gold |
| `request_changes` | `submitted/in_review → in_review` (renvoi) | l'annotateur reprend ; commentaires ancrés non résolus attendus |
| `reject` | `submitted/in_review → rejected` | annotation écartée (motivée) |

Règles :

- Une review ne peut viser qu'une annotation `submitted` ou `in_review` (pas un `draft`). Sinon 409.
- Toute décision émet `ActivityEvent verb=review.posted` + `annotation.<approved|changes_requested
  |rejected>` et **crée une `AnnotationVersion`** (snapshot du moment de la décision, traçabilité —
  `07_collaboration_versioning/versioning.md` §2).
- `request_changes` boucle avec les commentaires (`comments.md` §4) : le reviewer ancre des
  commentaires non résolus ; l'annotateur corrige, re-soumet, une nouvelle review tranche.

## 4. Articulation avec certitude & IAA

- Le reviewer dispose en mode revue de la **heatmap de certitude** (`certainty.md` §4) pour cibler les
  clauses `0/1`. La rubrique `consistency`/`evidence` y prête attention.
- Quand un document est multi-codé, le `lead` lit l'IAA
  (`07_collaboration_versioning/inter_annotator_agreement.md`) **avant** d'arbitrer : la review n'est
  pas un jugement de personne mais une décision de qualité documentée.
- Les reviews alimentent des métriques qualité (`11_tracking_observability/metrics_catalog.csv` :
  taux d'approbation, délai de revue, distribution des scores) — pseudonymisables.

## 5. Garanties

- `score ∈ [1,5]`, `decision` ∈ ensemble fermé, critères de `rubric` ∈ ensemble fermé.
- Les transitions de statut sont **les seules** voies d'`approved/rejected` (pas de PATCH direct
  contournant la review pour ces états sensibles — cohérence audit).
- Historique complet : toutes les reviews conservées, la dernière détermine le statut courant.

## 6. Tests (CONTRACT §6)

- `pytest reviews` : `score`/`decision`/`rubric` validés ; transitions de statut correctes ; refus de
  review sur `draft` ; création de version à la décision.
- `pytest review_score_suggest` : moyenne pondérée correcte, jamais écrite sans validation.
- `e2e review.spec` : notation rubrique, `request_changes` → boucle commentaires → re-soumission →
  `approve`.
