# API Reference — `/api/v1/` (DRF, JWT)

> Conforme à CONTRACT §3. Pagination `?page=&page_size=`, filtres et tri `?ordering=`.
> Codes : 200/201/204 succès, 400 validation, 401 non auth, 403 interdit, 404, 409 conflit.
> Auth : `Authorization: Bearer <access>`. Schéma OpenAPI : `GET /api/schema`, Swagger `GET /api/docs`.

## Auth & identité
| Méthode | Chemin | Notes |
|---|---|---|
| POST | `/api/v1/auth/login` | `{username, password}` → `{access, refresh}` |
| POST | `/api/v1/auth/refresh` | `{refresh}` → `{access}` |
| GET | `/api/v1/me` | utilisateur courant |

## Corpora & documents (F11, F12)
| Méthode | Chemin | Notes |
|---|---|---|
| GET | `/api/v1/corpora` | liste corpus |
| POST | `/api/v1/corpora` | admin |
| GET | `/api/v1/corpora/{slug}/documents` | documents du corpus (paginé) |
| GET | `/api/v1/documents/{id}` | doc + phrases + `reference_labels` |
| GET | `/api/v1/documents/{id}/sentences` | phrases (paginé) |

## Schémas d'annotation (F11)
| Méthode | Chemin | Notes |
|---|---|---|
| GET | `/api/v1/schemes` | liste |
| GET | `/api/v1/schemes/{slug}` | themes + legal_natures |
| POST | `/api/v1/schemes` | admin : créer/cloner |

## Projets (F4)
| Méthode | Chemin | Notes |
|---|---|---|
| GET | `/api/v1/projects` | projets visibles (membres ; admin voit tout) |
| POST | `/api/v1/projects` | admin (`corpus_slug`, `scheme_slug`) |
| GET | `/api/v1/projects/{slug}` | détail |
| GET | `/api/v1/projects/{slug}/assignments` | plan de travail (filtré par utilisateur) |
| GET | `/api/v1/projects/{slug}/progress` | comptes par statut + totals + IAA (κ) |

## Annotations & clauses (F1, F10)
| Méthode | Chemin | Notes |
|---|---|---|
| GET | `/api/v1/annotations?project=&document=&annotator=&status=` | liste filtrable |
| POST | `/api/v1/annotations` | `{project, document}` ; option `seed=preannotation:claude` ; idempotent sur le triplet (INV-4) |
| GET | `/api/v1/annotations/{id}` | détail + clauses |
| PATCH | `/api/v1/annotations/{id}` | statut (via state machine) et/ou `global_certainty` |
| POST | `/api/v1/annotations/{id}/submit` | transition → submitted |
| POST | `/api/v1/annotations/{id}/clauses` | `{anchor_index, theme_code, legal_nature_code?, evidence_span?, rationale?, certainty?}` ; 409 si ancre déjà prise (INV-2) |
| PATCH | `/api/v1/clauses/{id}` | éditer (mêmes invariants) |
| DELETE | `/api/v1/clauses/{id}` | supprimer |

## Versioning (F3)
| Méthode | Chemin | Notes |
|---|---|---|
| GET | `/api/v1/annotations/{id}/versions` | historique |
| POST | `/api/v1/annotations/{id}/versions` | snapshot manuel (`label?`) |
| GET | `/api/v1/annotations/{id}/versions/{n}/diff` | diff vs version précédente |

## Collaboration (F9, F10)
| Méthode | Chemin | Notes |
|---|---|---|
| GET/POST | `/api/v1/annotations/{id}/comments` | fil de commentaires |
| POST | `/api/v1/comments/{id}/resolve` | marquer résolu |
| GET/POST | `/api/v1/annotations/{id}/reviews` | reviewer/admin ; la décision pilote la state machine (approve→approved, reject→rejected) |

## Pré-annotations (F2)
| Méthode | Chemin | Notes |
|---|---|---|
| POST | `/api/v1/projects/{slug}/preannotations/import` | admin ; `{document, judge, raw}` ou `{items:[...]}` (v9.2 ou v9.4 auto-détectés) |
| GET | `/api/v1/preannotations?project=&document=&judge=` | liste + preclauses normalisées |

## Traductions (F8)
| Méthode | Chemin | Notes |
|---|---|---|
| GET | `/api/v1/projects/{slug}/translations` | translation sets du corpus |
| POST | `/api/v1/translations/sets` | déclarer un dossier (`corpus_slug, folder_path, target_language, mapping_strategy`) |
| POST | `/api/v1/translations/sets/{id}/sync` | mapping file-based |

## Exports (F5)
| Méthode | Chemin | Notes |
|---|---|---|
| POST | `/api/v1/projects/{slug}/exports` | admin ; `{format: jsonl\|csv\|…, scope:{statuses?,documents?}}` ; exécute et renvoie le job |
| GET | `/api/v1/exports/{id}` | statut + `artifact_path` + `manifest` |

## Activité (F4)
| Méthode | Chemin | Notes |
|---|---|---|
| GET | `/api/v1/activity?project=&actor=&verb=` | audit trail (append-only) |
