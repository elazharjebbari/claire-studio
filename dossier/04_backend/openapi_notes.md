# OpenAPI Notes

## Génération
Le schéma est produit par **drf-spectacular**.

- En ligne : `GET /api/schema` (YAML) et UI Swagger sur `GET /api/docs`.
- En fichier : `make openapi` → `openapi.yaml` (`python manage.py spectacular --file openapi.yaml`).

Réglages (`SPECTACULAR_SETTINGS` dans `config/settings/base.py`) :
- `TITLE = "CLAIRE Studio API"`, `VERSION = "1.0.0"`.
- `SCHEMA_PATH_PREFIX = "/api/v1"` pour que les chemins exposés soient les chemins métier.
- `SERVE_INCLUDE_SCHEMA = False` (la vue Swagger pointe vers `schema` par `url_name`).

## Conventions reflétées dans le schéma
- **Pas de slash final** : le router DRF est instancié avec `trailing_slash=False` afin de
  coller exactement aux chemins de CONTRACT §3 (`/api/v1/annotations/{id}/clauses`, etc.).
- **JWT Bearer** : sécurité globale via `rest_framework_simplejwt.authentication.JWTAuthentication`.
- **Pagination** : `DefaultPagination` (PageNumber, `page_size` paramétrable, max 500).

## Couverture (≈ 40 opérations)
Tous les endpoints de CONTRACT §3 apparaissent dans le schéma, y compris les actions
imbriquées exposées via `@action` :
`/auth/login`, `/auth/refresh`, `/me`, `/corpora(+/{slug}/documents)`, `/documents(+/{id}/sentences)`,
`/schemes`, `/projects(+/{slug}/{assignments,progress,translations,exports,preannotations/import})`,
`/annotations(+/{id}/{clauses,submit,versions,versions/{n}/diff,comments,reviews})`,
`/clauses/{id}`, `/comments/{id}/resolve`, `/preannotations`, `/translations/sets(+/{id}/sync)`,
`/exports/{id}`, `/activity`.

## Limites connues (warnings non bloquants)
- `MeView` est une `APIView` : sérialiseur de réponse explicité via `@extend_schema(responses=UserSerializer)`.
- Quelques actions custom utilisent des corps de requête libres (`raw` JSON des pré-annotations,
  `scope` d'export) typés en objet générique. Acceptable pour le MVP ; on pourra ajouter des
  sérialiseurs d'entrée dédiés pour un typage strict ultérieur.
- 0 erreur de génération ; les warnings restants concernent l'inférence d'enums sur des champs
  partagés (statuts, rôles) et sont sans impact fonctionnel.
