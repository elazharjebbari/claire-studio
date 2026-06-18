# Tracking produit & analytics annotateur

> Périmètre : feature **F4** + tracking. S'appuie sur `ActivityEvent`
> (`07_collaboration_versioning/activity_feed.md`). Distinction nette avec l'observabilité technique
> (`observability.md`). Respect strict de la vie privée (`12_security/rgpd_dpia.md`).

## 1. Deux journaux, deux finalités

| | Audit trail produit | Observabilité technique |
|---|---|---|
| Source | `ActivityEvent` (DB) | logs/metrics/traces (`observability.md`) |
| Public | utilisateurs (cloche, dashboard, audit) | exploitants/devs |
| Contenu | verbes métier, payload borné | requêtes, latences, erreurs |
| Rétention | `retention.activity_events_days` | rétention infra |
| Mutabilité | append-only | rotatif |

Le **tracking produit** = exploitation analytique de l'audit trail (jamais un second journal qui
dupliquerait `ActivityEvent`). Toute métrique de tracking dérive d'`ActivityEvent` (+ `Annotation`,
`Review`) — voir `metrics_catalog.csv`.

## 2. Métriques de productivité (dérivées d'ActivityEvent)

Calculées par agrégation, pseudonymisables, **jamais** utilisées pour classer/sanctionner des
personnes (cf. RGPD & éthique IAA) :

- **Vélocité d'annotation** : annotations `submitted` par période et par annotateur (pseudonyme).
- **Temps de cycle** : délai `annotation.created → annotation.submitted` (médiane, pas moyenne, pour
  résister aux outliers / pauses).
- **Profondeur d'édition** : nombre de `clause.added/updated/deleted` par annotation (signal
  d'effort, pas de qualité).
- **Délai de revue** : `annotation.submitted → review.posted` (santé du pipeline qualité).
- **Taux de seeding** : part d'annotations `source=preannotation_seed` puis éditées (`provenance.edited`)
  — mesure l'utilité réelle des pré-annotations LLM (F2).
- **Distribution de certitude** : par projet/annotateur (signal de difficulté du corpus, `certainty.md`).

Ces séries alimentent : carte projet (`/projects`), tableau de bord (`/projects/[slug]`), console
admin (`/admin/audit`). Toujours agrégées sur un **N minimal** (k-anonymat configurable, défaut k≥3)
pour éviter la ré-identification d'un annotateur isolé.

## 3. Analytics annotateur respectueux de la vie privée

Principes (alignés `12_security/rgpd_dpia.md`) :

- **Pas de tracking comportemental fin** : on ne journalise pas les frappes, le temps passé par
  phrase, les mouvements de souris, ni le focus fenêtre. Le grain est l'**événement métier**
  (`clause.added`, `annotation.submitted`), pas le télémétrique intrusif.
- **Pseudonymisation par défaut** dans toute restitution comparative (pseudonyme stable par projet,
  `collaboration.md` §4). La dé-anonymisation est un acte tracé (`reveal_identity`).
- **Finalité explicite** : les métriques servent le **pilotage qualité du corpus** (clarté des
  consignes, difficulté, santé du pipeline), pas l'évaluation RH. Cette finalité est documentée et
  affichée.
- **Minimisation** : payloads bornés, pas de contenu intégral ni de PII superflue (`activity_feed.md`
  §1/§3). `excerpt` tronqué.
- **Droits** : un annotateur peut consulter ses propres métriques ; l'export/effacement de ses
  données suit la procédure RGPD.

## 4. Audit global (`/admin/audit`)

Vue admin sur l'ensemble des `ActivityEvent` (filtres `project/actor/verb/target_type/since`,
endpoint `GET /api/v1/activity`). Sert :

- la **traçabilité** (qui a fait quoi, quand) — y compris actes sensibles (`reveal_identity`,
  `member.added`, purge) ;
- la **reconstruction** d'un incident ou d'une décision qualité ;
- l'**export d'audit** (pour conformité / reproductibilité scientifique), pseudonymisable.

## 5. Garanties

- **Source unique** : aucune métrique produit n'invente de journal ; tout remonte à `ActivityEvent`.
- **k-anonymat** sur les agrégats exposés.
- **Pas de finalité cachée** : le catalogue (`metrics_catalog.csv`) déclare nom, type, description,
  source de chaque métrique — pas de mesure non documentée.

## 6. Tests (CONTRACT §6)

- `pytest tracking_metrics` : vélocité/temps de cycle/délai de revue calculés correctement depuis des
  `ActivityEvent` simulés ; médianes robustes aux outliers.
- `pytest tracking_privacy` : k-anonymat respecté ; pseudonymisation par défaut ; pas de métrique non
  cataloguée exposée.
- `e2e collaboration.spec` : dashboard reflète vélocité et délai de revue.
