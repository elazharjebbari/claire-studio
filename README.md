# CLAIRE Studio — Plateforme d'annotation juridique collaborative

> Nom de travail : **CLAIRE Studio** (renommable). Plateforme d'annotation de documents
> juridiques (segmentation en clauses + thèmes + nature juridique), conçue d'abord pour le
> corpus **CLAUDETTE / UNFAIR-ToS** mais **agnostique au corpus** (réutilisable sur d'autres
> bases : CUAD, LEDGAR, ContractNLI, contrats FR…).

Ce dépôt contient **deux choses** :

1. **`dossier/`** — le **dossier technique** complet (architecture, data, backend, frontend,
   UI/UX, design system, collaboration & versioning, import/export, traductions, qualité &
   certitude, commentaires, tracking, sécurité, plans, runbook). Source de vérité de la
   conception.
2. **`backend/` + `frontend/`** — le **MVP fonctionnel** (Django/DRF + Next.js/Tailwind),
   avec tests (pytest, Vitest, MSW, Playwright), seeders et runbook exécutable.

## Pourquoi ce produit

L'audit du projet CLAIRE (`docs/2026-06-18_audit_approfondi_docs.md`) a montré que le verrou
n'est ni le prompt ni l'outillage, mais **l'absence d'un gold humain de référence**. Trois
protocoles d'annotation LLM (V8/V9.2/V9.4) ont chacun réussi en pilote puis échoué à l'échelle
(κ ≈ 0,32–0,45 sur 50 documents). CLAIRE Studio fournit l'instrument manquant : **un atelier où
des annotateurs humains produisent ce gold**, assistés par les pré-annotations LLM (Claude /
Codex), avec traçabilité, certitude, commentaires, versioning, accord inter-annotateurs (κ) et
export multi-format.

## Lecture rapide du dossier

| Sous-dossier | Contenu |
|---|---|
| `dossier/00_overview/` | **CONTRACT** (à lire en premier), vocabulaire, modèle de données, contrat API, navigation |
| `dossier/01_product_ux/` | Personas, user journeys, wireframes, ergonomie anti-fatigue |
| `dossier/02_architecture/` | Vue C4, composants, séquences (PlantUML), ADR |
| `dossier/03_data_model/` | Schéma relationnel, migrations, invariants |
| `dossier/04_backend/` | Django/DRF, API, auth, import/export, services |
| `dossier/05_frontend/` | Next.js, state, composants, accessibilité |
| `dossier/06_design_system/` | Tokens, couleurs, typographie, thème sombre |
| `dossier/07_collaboration_versioning/` | Multi-annotateur, versions, historique, IAA |
| `dossier/08_import_export/` | Loaders CLAUDETTE & LLM, formats d'export |
| `dossier/09_translations/` | Système file-based de traductions |
| `dossier/10_quality_certainty_comments/` | Certitude, notation, commentaires, archivage |
| `dossier/11_tracking_observability/` | Audit trail, métriques, logs, monitoring |
| `dossier/12_security/` | AuthN/Z, RGPD, menaces, durcissement |
| `dossier/13_testing_strategy/` | Pyramide de tests MSW/Vitest/Playwright/pytest |
| `dossier/14_plans/` | Plan de conception, de développement, d'action |
| `dossier/15_runbook/` | Runbook d'exécution end-to-end |

## Démarrage (MVP)

Voir `dossier/15_runbook/RUNBOOK.md`. En résumé :

```bash
# Backend
cd backend && make setup && make seed && make run    # http://localhost:8000
# Frontend
cd frontend && npm ci && npm run dev                   # http://localhost:3001
# Tests
cd backend && make test           # pytest
cd frontend && npm test           # Vitest + MSW
cd frontend && npm run e2e        # Playwright
```
