# ADR‑001 — Sessions d'annotation vs Collaboration (modélisation Pactiva)

- **Statut** : Accepté (2026‑06‑22)
- **Contexte** : campagne `campagne-pactiva` (3 comptes : `elazhar.jebbari` lead/admin,
  `jc.lamirel`, `zahra.boulaich` annotateurs ; 50 ToS CLAUDETTE). Duplication des
  documents (×3) sur la page campagne et dans le sélecteur d'annotation ; demande
  d'une séparation nette « vraie session » / « collaboration ».
- **Décideurs** : équipe Pactiva (back/front/UX). Voir `comparative-study.md`.

## Décision

1. **La session = l'`Annotation`** (1 par `(projet, document, annotateur)`, INV‑4).
   On **n'ajoute pas** de table `Session` (B1). On rend la notion explicite via
   l'API et l'UI.
2. **Nouvelle ressource document‑centrée** `GET /projects/{slug}/documents` (A4) :
   1 ligne **par document** (jamais dupliquée), enrichie de `mySession` et, pour
   l'admin/lead, de `sessions[]` (matrice document×annotateur) + `sessionsSummary`.
3. **Ouverture de session** toujours via `createAnnotation({project,document})`
   (C1) ; supervision admin via liens « œil » explicites en **lecture seule** (C3).
4. **Séparation UI systématique** (D) : « Ma session » (éditable, accent) /
   « Lecture seule » (warning) / « Collaboration » (aide, jamais une référence).
5. **IAA** : conserver Cohen κ pairwise, **corriger** le double‑comptage
   `per_theme`/`boundary` pour N≥3 (moyenne des κ par paire).
6. **Exports** : ajouter `scope.annotators`, tracer le format effectif + warnings
   dans le manifeste, ajouter un export *matrice de concordance* (CSV).
7. **Hygiène** : retirer les reliquats de démo (`admin/users` codé en dur « Bruno »,
   fixtures MSW « Bruno » hors tests), garde « mocks OFF en production ».

## Invariants préservés / ajoutés

- **INV‑4** (unicité (projet,document,annotateur)) — inchangé, fonde la session.
- **INV‑ISO** (isolation d'écriture) : seul le propriétaire écrit le contenu de sa
  session (`IsAnnotationOwner`) — inchangé, garanti côté API.
- **INV‑DOC‑UNIQUE** (nouveau, présentation) : toute liste de documents d'un projet
  expose **au plus une ligne par document**. Garanti par `GET .../documents` et par
  une dédup défensive côté hooks.
- **INV‑COLLAB** (nouveau, métier) : aucune donnée de collaboration (commentaire,
  comparaison, pré‑annotation, session d'autrui) ne compte comme référence pour MA
  soumission ni pour MON export.

## Conséquences

### Positives
- Duplication supprimée **par construction** (1 doc = 1 ligne), pas par rustine.
- Frontière session/collaboration **lisible** pour l'utilisateur ; ambiguïté levée.
- Supervision admin **propre** (matrice + avancement + accès lecture seule).
- 1 seule source de vérité du statut (pas de table session redondante).
- Surface de test claire (endpoint document‑centré, hooks, isolation).

### Négatives / coûts
- 1 endpoint + 1 sérialiseur + 1 hook à écrire et tester.
- Légère duplication de logique « rollup statut » (mutualisée dans un service).

### Risques & parades
| Risque | Parade |
|---|---|
| N+1 sur `sessions[]` (par document × annotateur) | `select_related`/`prefetch_related` + agrégat `Count` ; pagination |
| Régression de la duplication ailleurs | Dédup défensive dans `useProjectDocuments` + test vitest + e2e anti‑doublon |
| Fuite de sessions d'autrui à un annotateur | `sessions[]` **omis** si non admin/lead ; test pytest de permission |
| Rupture de contrat front | Type `ProjectDocument` ajouté au `contract.ts` ; MSW handler aligné |

## Alternatives écartées
- **Table `AnnotationSession`** (B2) : redondante 1‑1 avec `Annotation`, migration
  prod lourde, double statut — sur‑ingénierie.
- **Filtre client seul** (A1) : corrige le symptôme, pas la cause ; conservé en
  défense en profondeur uniquement.
