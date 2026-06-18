# Plan d'action concret (démarrage jour par jour)

> Périmètre : les ~15 premiers jours ouvrés pour passer d'un repo vide à **annoter CLAUDETTE** (M0→M2
> du `development_plan.md`). Concret, actionnable, vérifiable. Stack CONTRACT : Django/DRF + JWT,
> Next.js/Tailwind, PostgreSQL. Tout renvoie au CONTRACT et à `vocabulary.yaml`.

## Semaine 1 — Socle (M0) + Corpus (M1 amorce)

### J1 — Bootstrap repo & qualité
- Init repo, `uv` (lockfile), `pyproject.toml` (Ruff 100 col), pre-commit (ruff, gitleaks), CI.
- Squelette Django (apps vides `corpora schemes projects annotations collaboration imports exports
  translations audit`) + DRF + settings par env.
- Squelette Next.js App Router + Tailwind, page `/login` placeholder.
- **Vérif** : `ruff` propre, CI verte, `manage.py check` OK.

### J2 — Auth JWT + shell
- JWT RS256 (`/auth/login`, `/auth/refresh`, `/me`), modèle `User(role)`.
- Refresh cookie HttpOnly/Secure ; permissions de base ; throttle login.
- Shell front : sidebar + top bar (sélecteur projet, ⌘K stub, cloche stub, thème).
- **Vérif** : login E2E minimal ; `pytest jwt_rotation` (base) ; en-têtes sécurité présents.

### J3 — Observabilité branchée tôt
- Logs JSON (`structlog`) + `request_id`/`trace_id` ; `/metrics` Prometheus ; OTel exporter.
- `PIIScrubber` de logs ; squelette de dashboards.
- **Vérif** : `pytest logging_pii` (base) ; `/metrics` expose RED ; un log porte `request_id`.

### J4 — Modèles corpus & schéma + seed vocab
- Entités `Corpus, Document, Sentence, ReferenceLabel, LabelScheme, Theme, LegalNature` (CONTRACT §2)
  + contraintes DB (unicité/contiguïté `Sentence.index`, thème ∈ scheme).
- Commande `seed_scheme` depuis `vocabulary.yaml` (thèmes, natures, certitude, injustice).
- **Vérif** : `pytest` invariants `Sentence.index` ; seed crée `claire-themes-v1` v1.0.0.

### J5 — Loader CLAUDETTE
- Implémenter `import_claudette` (`08_import_export/import_claudette.md`) : découverte fichiers,
  validation longueur, multi-label, niveau 0 → pas de label, détokenisation, idempotence checksum.
- **Vérif** : `pytest claudette_loader` (alignement, mismatch rejeté, multi-label, idempotence) ;
  `pytest detokenize` ; import d'au moins 2 documents (`Fitbit`, `Spotify`).

## Semaine 2 — Lecture document + annotation cœur (M2)

### J6 — API documents + overlay référence
- `GET /corpora`, `/corpora/{slug}/documents`, `/documents/{id}?include=reference_labels`,
  `/documents/{id}/sentences` (pagination, filtres).
- Front `/admin/corpora` (liste) + lecture document (centre-écran, ~70ch, line-height 1.7).
- **Vérif** : overlay injustice s'affiche (couleurs/intensité `vocabulary.yaml`) ; `e2e
  unfairness-overlay.spec` (base).

### J7 — Modèles Annotation/Clause + invariants
- `Annotation` (statut, certitudes), `Clause` (anchor, theme, span, rationale, certainty, order).
- Invariants : un clause start/phrase, thème ∈ scheme, unicité `(project,document,annotator)`.
- `POST /annotations`, `POST /annotations/{id}/clauses`, `PATCH /clauses/{id}`, `DELETE`.
- **Vérif** : un test par invariant ; verrouillage optimiste (409).

### J8 — Workspace : poser frontières & thèmes
- 3 panneaux (plan/TOC, document, inspecteur). Poser frontière (`B`/clic), thème (`T` + palette
  colorée recherche typée), réordonnancement dérivé des ancres (monotone).
- **Vérif** : `e2e annotate.spec` (poser/retirer clause, attribuer thème) ; clavier `j/k/B/T`.

### J9 — Certitude + statut + activité minimale
- Certitude clause `0–3` (boutons + raccourcis), agrégation globale **suggérée** (`certainty.md`).
- `PATCH /annotations/{id}` (statut/certitude), `POST /annotations/{id}/submit`.
- `ActivityEvent` sur transitions (`annotation.created/submitted`, `clause.*`) + cloche réelle.
- **Vérif** : `pytest certainty`, `certainty_aggregate`, `activity` ; cloche reflète une action.

### J10 — Snapshot initial (amorce M4) + revue de fin de semaine
- `AnnotationVersion` à la soumission (snapshot pivot immuable, numéro monotone).
- Page d'accueil « reprendre où on s'est arrêté » ; densité/thème dans `/settings`.
- **Vérif** : `pytest versioning` (base) ; démonstration bout-en-bout : importer → annoter →
  soumettre → snapshot → cloche.

## Jalons de contrôle (fin de période)

| Jour | Attendu vérifiable |
|---|---|
| J3 | login + observabilité + CI vertes |
| J5 | CLAUDETTE importé, invariants verts |
| J8 | on pose des clauses et des thèmes au clavier |
| J10 | flux importer→annoter→soumettre→snapshot→activité démontré |

## Règles de travail (CLAUDE.md)

- Petits diffs reviewables, commits conventionnels, jamais de modif massive en une passe.
- Expliquer le choix méthodologique **avant** le code (défendable scientifiquement).
- Tests pytest pour chaque brique critique ; pas de fuite train/test ; logger params/métriques.
- Le CONTRACT fait foi ; toute divergence se corrige vers le CONTRACT.

## Suite immédiate (J11+)

Enchaîner M3 (pré-annotations v9.2/v9.4) puis M4 (diff/restauration) — voir `development_plan.md`.
