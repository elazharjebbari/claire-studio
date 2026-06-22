# Dossier — Sessions d'annotation vs Collaboration (Pactiva)

Dossier d'ingénierie **senior** pour la campagne `campagne-pactiva` (3 comptes :
`elazhar.jebbari` lead/admin, `jc.lamirel`, `zahra.boulaich` ; 50 ToS CLAUDETTE).

> **Thèse** : chacun annote **seul** sur **sa** session isolée ; l'admin **supervise** ;
> la **collaboration** (présence/comparaison/commentaires) **aide** sans jamais faire
> référence ; l'**IAA** et l'**export** s'appuient sur les sessions individuelles.

## Verdict express
Le **socle backend est solide** (la session = `Annotation` unique `(project,document,annotator)`,
écriture owner‑only, IAA pairwise, export par annotateur). La duplication observée en
prod (chaque document ×3 pour l'admin) venait **de la couche présentation** : les listes
de documents étaient dérivées des *assignations* (1 ligne par couple document×annotateur).

**Correctif structurel (ADR‑001)** : ressource **document‑centrée**
`GET /projects/{slug}/documents` (1 ligne **par document**, `mySession` + matrice
`sessions[]` pour l'admin), consommée par le sélecteur et la page campagne ; ouverture
de session **toujours via `createAnnotation`** (jamais celle d'un autre). Séparation UI
systématique « Ma session / Lecture seule / Collaboration ». + durcissements isolation,
exports (scope annotateur, manifeste, `md`, `iaa_matrix`, download, `build_snapshot`
enrichi), IAA N≥3 corrigé.

## Structure du dossier
| Dossier | Contenu | Formats |
|---|---|---|
| `00-audit/` | Audit approfondi (55 findings), synthèse, findings | `.md`, `.csv`, `.json` |
| `01-besoins/` | Glossaire (lève les ambiguïtés), user stories | `.md`, `.csv` |
| `02-architecture/` | Étude comparative, ADR‑001, modèle de séquence, contrat d'API | `.md`, `.puml`, `.yaml` |
| `03-conception-ui-ux/` | Principes UX, navigation, wireframes | `.md`, `.txt` |
| `04-data-model/` | Modèle de données, invariants, diagramme | `.md`, `.puml` |
| `05-securite/` | Permissions, isolation, politique d'indépendance | `.md` |
| `06-collaboration/` | Frontière collaboration vs session (point par point) | `.md` |
| `07-exports/` | Système d'export, formats, concordance, intégrité | `.md` |
| `08-plan-action/` | Plan d'action (lots, critères, risques, rollback), **runbook** | `.md` |
| `09-tests/` | Stratégie de tests (Vitest/MSW/Playwright/pytest), cas | `.md`, `.csv` |
| `10-design-system/` | Design system, tokens, accessibilité | `.md` |

> Les fichiers `00-audit.md`, `00-findings.csv`, `01-architecture.puml`,
> `02-comparative-study.md`, `03-plan-action.md`, `04-test-plan.md` à la **racine** du
> dossier sont la **v1** (audit éclair de la session précédente), conservés pour
> l'historique. La version **canonique** est la structure numérotée ci‑dessus.

## Statut d'implémentation (2026‑06‑22)
- ✅ Lots 1–3 **implémentés et testés** : backend **125/125** pytest, frontend **186/186**
  vitest, `tsc` vert. Voir `08-plan-action/plan-action.md`.
- 🔜 Lot 4 **planifié** (UX supervision, export async, tokens/a11y, formats restants).
- Déploiement : voir `08-plan-action/runbook.md`.
