# Système d'export

> Statut : **implémenté** (feature 5). Réf. code : `backend/claire/exports/`,
> `backend/claire/annotations/services.py` (`build_snapshot`),
> `backend/claire/projects/iaa.py` (concordance), `backend/config/api_urls.py:53`.
> Tests : `backend/tests/test_export.py`.

L'export transforme la **Référence (gold)** d'une **Campagne** — c.-à-d. l'état
autoritatif des **Sessions d'annotation** stockées en base — en un artefact de
fichier accompagné d'un **manifeste** explicatif. Le vocabulaire suit le
[glossaire](../01-besoins/glossaire.md) : on exporte des `Annotation` (sessions),
chacune attribuée à **un** annotateur, jamais une fusion ni un agrégat anonyme.

L'export est une **lecture** : il ne touche aucune session, ne fait aucune
référence à la **Collaboration** (commentaires, présence, comparaison N‑way) et
n'invente aucune donnée. Toute dégradation (format non implémenté) est **tracée**
dans le manifeste, jamais silencieuse.

---

## 1. Pipeline `ExportJob → run_export`

### 1.1 Modèle `ExportJob`

`backend/claire/exports/models.py:26`

| Champ | Type | Rôle |
|---|---|---|
| `project` | FK `Project` (CASCADE) | Campagne exportée |
| `format` | `CharField(choices=ExportFormat)` | Format **demandé** (`format_requested`) |
| `scope` | `JSONField` (defaut `{}`) | Filtres : `statuses` / `documents` / `annotators` |
| `status` | `CharField(choices=ExportStatus)` | `pending` → `running` → `done`/`failed` |
| `artifact_path` | `CharField(600)` | Chemin filesystem de l'artefact (confiné `EXPORTS_DIR`) |
| `manifest` | `JSONField` | Métadonnées de traçabilité (cf. §6) |
| `requested_by` | FK `AUTH_USER_MODEL` (PROTECT) | Demandeur (admin) |
| `created_at` | `DateTimeField(auto_now_add)` | Horodatage de la demande |

`ExportStatus` (`models.py:19`) : `pending`, `running`, `done`, `failed`.
`ExportFormat` (`models.py:9`) : `jsonl`, `csv`, `conll`, `xml`, `md`,
`huggingface`, `iaa_matrix`.

### 1.2 Déclenchement (création + exécution)

Endpoint d'écriture (admin uniquement) :
`POST /projects/{slug}/exports` →
`ProjectViewSet.exports` (`backend/claire/projects/views.py:610`),
protégé par `permission_classes=[IsAdminRole]`.

```text
POST /api/v1/projects/{slug}/exports
{ "format": "jsonl", "scope": { "annotators": ["alice"], "statuses": ["approved"] } }
```

Le corps crée un `ExportJob` (`format` défaut `jsonl`, `scope` défaut `{}`)
puis appelle **synchroniquement** `run_export(job)` et renvoie le job sérialisé
en `201` (`views.py:617-625`).

### 1.3 `run_export(job)`

`backend/claire/exports/services.py:131`

Étapes (le tout sous `@transaction.atomic`) :

1. `status = running` puis save (`services.py:133`).
2. Sélection des sessions via `_selected_annotations(job)` (cf. §3).
3. Sérialisation : `records = [build_snapshot(a) for a in …]` (`services.py:137`) —
   pivot CONTRACT §4 enrichi (cf. §5).
4. Création du dossier `settings.EXPORTS_DIR` (`mkdir parents/exist_ok`).
5. Calcul du **format effectif** + `warnings` (cf. §2).
6. Nom de fichier déterministe :
   `export_{slug}_{job.id}_{YYYYMMDDThhmmss}.{ext}` (`services.py:158`).
7. Écriture de l'artefact (`_write_*` selon le format effectif).
8. Construction du **manifeste** (`services.py:170`).
9. `artifact_path`, `manifest`, `status = done` ; save partiel.
10. En cas d'exception : `status = failed`, `manifest = {"error": …}`, log
    `export_failed`, puis `raise` (`services.py:196-201`).

### 1.4 Lecture du résultat

`ExportJobViewSet` (`backend/claire/exports/views.py:14`,
`ReadOnlyModelViewSet`, `IsAdminRole`), monté sur `exports`
(`api_urls.py:53`) :

- `GET /exports/{id}` — statut + manifeste (serializer `ExportJobSerializer`).
- `GET /exports/{id}/download` — artefact (cf. §7).

---

## 2. Formats et politique de repli **tracé**

Quatre formats sont **réellement implémentés** ; ils figurent dans
`_IMPLEMENTED_FORMATS` (`services.py:123`) :

| Format | Implémenté | Écriture | Extension | Contenu |
|---|---|---|---|---|
| `jsonl` | ✅ | `_write_jsonl` (`services.py:56`) | `.jsonl` | 1 session pivot/ligne (CONTRACT §4) — **format de référence réimportable** |
| `csv` | ✅ | `_write_csv` (`services.py:62`) | `.csv` | 1 **clause** par ligne (tableur) |
| `md` | ✅ | `_write_md` (`services.py:83`) | `.md` | Rapport lisible : 1 bloc par session + table des clauses |
| `iaa_matrix` | ✅ | `_write_iaa_matrix` (`services.py:107`) | `.csv` | Concordance κ pairwise (cf. §6) |
| `conll` | ❌ | repli → `jsonl` | `.jsonl` | **Warning** dans le manifeste |
| `xml` | ❌ | repli → `jsonl` | `.jsonl` | **Warning** dans le manifeste |
| `huggingface` | ❌ | repli → `jsonl` | `.jsonl` | **Warning** dans le manifeste |

**Repli explicite, jamais silencieux** (`services.py:147-153`, finding
`silent-format-fallback` corrigé) : si le `format` demandé n'est pas implémenté,
le **format effectif** retombe sur `jsonl` (le pivot CONTRACT §4) et une chaîne
est ajoutée à `warnings` :

```
format 'conll' non implémenté → repli sur jsonl (pivot CONTRACT §4)
```

Le manifeste distingue alors `format_requested` (demandé) ≠ `format_effective`
(produit), et l'**extension du fichier reflète le format effectif** (`.jsonl`),
pas le format trompeur demandé (`ext` calculé sur `effective`, `services.py:155`).

> Limite assumée : `conll`/`xml`/`huggingface` sont encore exposés dans l'UI
> (`frontend/src/app/(app)/admin/exports/page.tsx`) ; ils produisent un JSONL
> avec warning plutôt qu'une erreur 400. Pistes : implémenter ces sérialiseurs
> ou retirer/désactiver ces options côté front.

---

## 3. Scope : `statuses` / `documents` / `annotators`

`_selected_annotations(job)` (`services.py:26`) construit le queryset des
sessions à exporter, avec `select_related(document, annotator, project, scheme)`.

| Clé de `scope` | Filtre appliqué | Défaut |
|---|---|---|
| `statuses` | `status__in=statuses` (`services.py:33`) | `["submitted","in_review","approved"]` — **gold‑grade only** (`services.py:37`) ; exclut `draft`/`archived`/`rejected` |
| `documents` | `document__external_id__in=documents` (`services.py:40`) | tous les documents |
| `annotators` | `annotator.username` **ou** `annotator.pk` (`services.py:44-52`) | tous les annotateurs |

Le **scope par annotateur** (ADR‑001 §F) accepte indifféremment des `username`
ou des `pk` numériques (`a.isdigit()`), comme le reste du contrat. Il sert à
exporter la **Session** d'un annotateur précis, ou un sous‑ensemble pour
comparaison/audit.

Ordre stable : `order_by("document__external_id", "annotator__username")`
(`services.py:53`) — reproductibilité de l'artefact.

> Limite connue (finding `manifest-and-scope-traceability`, info) : les valeurs
> de `scope.statuses` ne sont pas encore whitelistées (un appel pourrait demander
> `archived`). À durcir : refuser les statuts hors gold‑grade.

---

## 4. Attribution par annotateur / session

Chaque enregistrement exporté porte le champ **`annotator`**
(`build_snapshot`, `annotations/services.py:57` → `annotation.annotator.username`).
Conformément à INV‑4, le triplet `(project, document, annotator)` est unique :
**une ligne d'export = une session = un annotateur**, jamais une fusion.

Le manifeste agrège la liste distincte des annotateurs présents
(`"annotators": sorted({r["annotator"] for r in records})`, `services.py:178`).
Combiné au scope `annotators`, cela permet :

- l'**export d'une seule session** (un annotateur, un document) ;
- l'export multi‑annotateurs où chaque session reste **distincte et attribuée**
  (CSV : la colonne `annotator` ; JSONL : le champ `annotator`).

---

## 5. Enrichissement `build_snapshot` — zéro perte d'information

`build_snapshot(annotation)` (`backend/claire/annotations/services.py:47`)
sérialise une session vers le pivot CONTRACT §4. Il a été **enrichi** (finding
`snapshot-drops-validated-source` corrigé) pour que l'export distingue le **gold
humain validé** d'un **seed LLM** non retravaillé :

| Niveau | Champ ajouté | Source | Pourquoi |
|---|---|---|---|
| session | `source` | `annotation.source` | Distingue annotation **humaine** d'un **seed LLM** |
| session | `updated_at` | `annotation.updated_at.isoformat()` | Horodate la session (audit, fraîcheur) |
| clause | `validated` | `c.validated` | **Seule une clause validée fait Référence** (point d / glossaire) |
| clause | `order` | `c.order` | Ordre de saisie, pour distinguer gold retravaillé d'un seed |

> Note d'impact : `build_snapshot` sert **aussi** aux `AnnotationVersion`
> immuables (`create_version`, `annotations/services.py:85`). L'enrichissement
> profite donc également au versioning et au diff (feature 3), sans schéma
> divergent.

---

## 6. Export de concordance `iaa_matrix`

`_write_iaa_matrix(path, project)` (`services.py:107`) matérialise la
**Concordance (IAA)** — jusque‑là simple endpoint de lecture — en artefact
versionné (finding `no-iaa-export-artifact` corrigé). Il appelle
`project_iaa(project)` (`projects/iaa.py:83`) qui calcule le **κ de Cohen
pairwise** par document, puis écrit un CSV :

| Colonne | Source (`iaa.py`) |
|---|---|
| `document` | `external_id` du document |
| `annotator_a` / `annotator_b` | usernames des deux sessions comparées |
| `kappa` | `cohen_kappa(v1, v2)` arrondi 4 décimales |
| `n_sentences` | nombre de phrases du document |

La concordance ne porte que sur les sessions **soumises** (`submitted`,
`in_review`, `approved` — `pairwise_kappa_for_document`, `iaa.py:60`) et de
≥ 2 annotateurs. Le double‑comptage `per_theme`/`boundary` pour N ≥ 3 est corrigé
en moyennant les κ **par paire** (ADR‑001 §E, `iaa.py:116-119`).

---

## 7. Téléchargement `/exports/{id}/download` (anti path‑traversal)

`ExportJobViewSet.download` (`backend/claire/exports/views.py:21`) renvoie un
`FileResponse(as_attachment=True)`. Le chemin de l'artefact est **confiné à
`EXPORTS_DIR`** (finding `no-download-endpoint` corrigé) :

```python
exports_dir = os.path.realpath(str(settings.EXPORTS_DIR))   # views.py:28
real = os.path.realpath(job.artifact_path)                  # views.py:29
if os.path.commonpath([exports_dir, real]) != exports_dir or not os.path.isfile(real):
    raise Http404("Artefact introuvable.")                  # views.py:30-31
```

- `realpath` résout les `..` et les symlinks **avant** la comparaison.
- `commonpath` garantit que l'artefact est **dans** `EXPORTS_DIR` ; tout chemin
  hors du dossier (path‑traversal) → `404`.
- `EXPORTS_DIR` est configurable :
  `env("CLAIRE_EXPORTS_DIR", default=BASE_DIR/"var"/"exports")`
  (`backend/config/settings/base.py:65`).
- Accès réservé `IsAdminRole` (lecture admin).

---

## 8. Limites connues restantes

| # | Limite | Réf. finding | Piste |
|---|---|---|---|
| 1 | **Export 100 % synchrone** dans la requête HTTP malgré le modèle Job (pas de robustesse gros volumes) | `export-synchronous-in-request` (major) | Déporter `run_export` vers une tâche async (Celery/RQ), répondre `pending` immédiatement, front poll `GET /exports/{id}` ; prefetch des clauses ; streamer l'écriture JSONL au lieu de matérialiser `records` |
| 2 | `@transaction.atomic` enveloppe l'**I/O disque** : le `raise` rollback le save `failed` et peut laisser un **artefact orphelin** | `atomic-wraps-disk-io` (minor) | Sortir l'I/O du `atomic`, save `failed` hors transaction, `unlink(missing_ok=True)` du fichier partiel, écriture atomique (temp + rename) |
| 3 | `scope.statuses` **non validé** (un `archived` passerait) ; manifeste sans ventilation par statut | `manifest-and-scope-traceability` (info) | Whitelister les statuts gold‑grade ; enrichir le manifeste (ventilation par statut/annotateur) |
| 4 | Formats `conll`/`xml`/`huggingface` exposés à l'UI mais en repli JSONL | `silent-format-fallback` (résolu côté traçabilité) | Implémenter les sérialiseurs ou masquer les options |
| 5 | `IsAdminRole` laisse passer `SAFE_METHODS` : un authentifié pourrait **lire** les jobs d'export d'autres projets | `admin-only-reads-actually-open` (minor) | Filtrer `get_queryset` par appartenance projet, ou permission stricte |

---

## Annexe — Mini « format spec » du pivot (CONTRACT §4)

Format pivot interne **et** d'export (JSONL = une instance par ligne). Réf.
`dossier/00_overview/CONTRACT.md §4`, enrichi par `build_snapshot`.

```json
{
  "doc": "Fitbit",
  "project": "campagne-pactiva",
  "annotator": "alice",
  "schema": "claire-themes-v1",
  "status": "submitted",
  "source": "human",
  "updated_at": "2026-06-22T10:15:00+00:00",
  "global_certainty": 2,
  "clauses": [
    {
      "anchor_index": 0,
      "theme": "META",
      "legal_nature": null,
      "evidence_span": "we recently revised these terms",
      "rationale": "notice d'ouverture",
      "certainty": 3,
      "validated": true,
      "order": 0
    }
  ]
}
```

### Champs exportés

| Champ | Niveau | Type | Source code | Sémantique |
|---|---|---|---|---|
| `doc` | session | string | `document.external_id` | Identifiant du **Document** |
| `project` | session | string (slug) | `project.slug` | **Campagne** |
| `annotator` | session | string (username) | `annotator.username` | Propriétaire de la **Session** (attribution) |
| `schema` | session | string (slug) | `project.scheme.slug` | Schéma de labels |
| `status` | session | enum | `annotation.status` | `draft`/`submitted`/`in_review`/`approved`/`rejected`/`archived` |
| `source` | session | string | `annotation.source` | `human` vs seed LLM (**enrichi**) |
| `updated_at` | session | ISO‑8601 / null | `annotation.updated_at` | Horodatage de la session (**enrichi**) |
| `global_certainty` | session | int (0–3) | `annotation.global_certainty` | Certitude globale déclarée |
| `clauses[]` | session | array | relation `clauses` | Triées `order, anchor_sentence.index` |
| `clauses[].anchor_index` | clause | int (0‑based) | `c.anchor_sentence.index` | Phrase de départ de la clause |
| `clauses[].theme` | clause | string (code) | `c.theme.code` | Thème (vocabulaire fermé du schéma) |
| `clauses[].legal_nature` | clause | string / null | `c.legal_nature.code` | Nature juridique (optionnelle) |
| `clauses[].evidence_span` | clause | string | `c.evidence_span` | Empan textuel justificatif |
| `clauses[].rationale` | clause | string | `c.rationale` | Justification libre |
| `clauses[].certainty` | clause | int / null | `c.certainty` | `0=incertain,1=plutôt,2=confiant,3=certain` |
| `clauses[].validated` | clause | bool | `c.validated` | **Fait Référence (gold)** uniquement si `true` (**enrichi**) |
| `clauses[].order` | clause | int | `c.order` | Ordre de saisie (**enrichi**) |

**CSV** (`_write_csv`, `services.py:62`) : aplatissement 1 ligne/clause ; en‑têtes
`doc, project, annotator, schema, status, source, global_certainty, anchor_index,
theme, legal_nature, evidence_span, rationale, certainty, validated, order`.
`extrasaction="ignore"` rend l'écriture robuste si `build_snapshot` gagne de
nouveaux champs.
