# Plan de développement (phases, jalons, lotissement, estimation)

> Périmètre : exécution de la conception (`conception_plan.md`) pour livrer les 12 features
> (`00_overview/feature_traceability.csv`). Cohérent CONTRACT (entités/API/pivot) et stack
> Django/DRF + Next.js/Tailwind. Estimations en **jours-personne (j)**, indicatives.

## 1. Lotissement par phases

### Phase 0 — Socle (≈ 8 j) — Jalon **M0 : squelette qui tourne**
- Repo, `uv`, pre-commit, Ruff (100 col), CI (tests + `security-review`).
- Django + DRF + JWT RS256 ; Next.js App Router + Tailwind + shell (sidebar/top bar).
- PostgreSQL, migrations de base, OTel/Prometheus/logs JSON branchés.
- Modèles `User`, auth `/login`, `/me`. *Sortie* : login fonctionnel, `/metrics`, CI verte.

### Phase 1 — Corpus & schémas (≈ 10 j) — Jalon **M1 : CLAUDETTE chargé** (F11, F12)
- Apps `corpora`, `schemes` ; entités Corpus/Document/Sentence/ReferenceLabel/LabelScheme/Theme/
  LegalNature ; seed `vocabulary.yaml`.
- **Loader CLAUDETTE** (`08_import_export/import_claudette.md`) : alignement ligne à ligne, multi-label,
  détokenisation, idempotence.
- `/admin/corpora`, `/admin/schemes` ; `GET /documents/{id}?include=reference_labels`.
- Tests : `claudette_loader`, `detokenize`, `scheme_isolation`.

### Phase 2 — Annotation cœur (≈ 16 j) — Jalon **M2 : on annote** (F1, F6)
- App `annotations` : Annotation, Clause + invariants (un start/phrase, vocab fermé, unicité triplet).
- Workspace 3 panneaux, navigation clavier (`B/T/C/0-3/j/k/g d`), thème sombre (design system 06).
- Certitude clause + agrégation globale suggérée (`10_quality_certainty_comments/certainty.md`).
- Tests : invariants §2, `certainty`, `e2e annotate.spec`, a11y axe.

### Phase 3 — Pré-annotations LLM (≈ 10 j) — Jalon **M3 : pré-remplissage** (F2)
- App `imports` : PreAnnotation/PreClause ; normalisation **v9.2 & v9.4 → pivot** ; alias thèmes.
- Upload + auto-pull file-based ; seeding brouillon éditable + fantôme.
- Tests : `import_v92`, `import_v94`, `preann_validation`, `preann_autopull`, `e2e prefill.spec`.

### Phase 4 — Versioning & historique (≈ 9 j) — Jalon **M4 : historique/diff** (F3)
- AnnotationVersion (snapshot immuable, numérotation monotone), diff par `anchor_index`, restauration.
- `/history/[id]`, `/compare`.
- Tests : `versioning`, `diff`, `e2e history.spec`.

### Phase 5 — Collaboration, audit & IAA (≈ 12 j) — Jalon **M5 : collaboratif** (F4, F7)
- App `audit` : ActivityEvent (verbes fermés, payloads validés), cloche, dashboard `progress`.
- Anonymisation (pseudonyme par projet), `peer_visibility`.
- **IAA** : Cohen/Fleiss, WindowDiff, par thème/frontière (`inter_annotator_agreement.md`).
- Tests : `activity`, `activity_visibility`, `anonymize`, `iaa_*`, `e2e collaboration.spec`.

### Phase 6 — Qualité : commentaires, revue, archivage (≈ 11 j) — Jalon **M6 : boucle qualité** (F9, F10)
- App `collaboration` : Comment (ancré, fils, mentions, résolution), Review (rubrique 1–5, décisions).
- Mode `/review/[id]` ; archivage + rétention.
- Tests : `comments`, `comment_mentions`, `reviews`, `archival`, `e2e comments.spec`/`review.spec`.

### Phase 7 — Traductions file-based (≈ 8 j) — Jalon **M7 : multi-langue** (F8)
- App `translations` : TranslationSet/Translation ; 3 stratégies de mapping ; sync idempotent ;
  overlay langue.
- Tests : `translation_sync`, `mapping_*`, `translation_pathsafety`, `e2e translations.spec`.

### Phase 8 — Exports (≈ 10 j) — Jalon **M8 : exports + manifeste** (F5)
- App `exports` : ExportJob asynchrone, 6 formats (jsonl/csv/conll/xml/md/huggingface),
  **manifeste explicatif**, scope, anonymisation par défaut.
- `/admin/exports`.
- Tests : `export_formats`, `export_scope`, `export_manifest*`, `e2e export.spec`.

### Phase 9 — Durcissement & finition (≈ 10 j) — Jalon **M9 : prêt à publier**
- Sécurité (OWASP, rate limiting, path-safety), RGPD/DPIA, observabilité complète (dashboards,
  alerting), performance (N+1, pagination), accessibilité, documentation.
- Tests : `authz_isolation`, `jwt_rotation`, `ratelimit_login`, `pathsafety`, `logging_pii`,
  `metrics_cardinality`, charge.

## 2. Récapitulatif jalons

| Jalon | Contenu | Features | Estimation cumul |
|---|---|---|---|
| M0 | Socle | — | ~8 j |
| M1 | Corpus/CLAUDETTE | F11, F12 | ~18 j |
| M2 | Annotation cœur | F1, F6 | ~34 j |
| M3 | Pré-annotations | F2 | ~44 j |
| M4 | Versioning | F3 | ~53 j |
| M5 | Collab/IAA | F4, F7 | ~65 j |
| M6 | Qualité | F9, F10 | ~76 j |
| M7 | Traductions | F8 | ~84 j |
| M8 | Exports | F5 | ~94 j |
| M9 | Durcissement | transverse | ~104 j |

Total indicatif **≈ 104 j** (≈ 5 mois 1 dev, ou ~10–12 semaines à 2 devs). Marge risques : +15 %.

## 3. Dépendances entre lots

```
M0 → M1 → M2 ─┬→ M3 (seed dépend de l'annotation)
              ├→ M4 (version dépend de l'annotation)
              ├→ M5 (audit/IAA dépendent d'annotations multiples)
              └→ M6 (revue dépend de soumission)
M1 → M7 (traductions dépendent du corpus)
M2,M4 → M8 (export dépend du pivot + versions)
tout → M9
```

## 4. Définition de « terminé » (DoD) par feature

- Invariants CONTRACT §2 concernés **testés** ; endpoints CONTRACT §3 implémentés et documentés.
- E2E de la feature vert (`feature_traceability.csv`), a11y axe sur les surfaces UI.
- Pas de PII en logs ; métriques au catalogue ; `security-review` propre si zone sensible.
- Documentation du dossier à jour (le module renvoie au CONTRACT et au vocabulaire).

## 5. Approche d'exécution

- **Petits diffs reviewables** (CLAUDE.md), conventions de commit `feat/fix/refactor/docs`.
- Vertical slices : chaque feature traverse DB→API→UI→tests avant la suivante.
- Pas de fuite train/test silencieuse dans les exports (splits explicites + manifeste).
