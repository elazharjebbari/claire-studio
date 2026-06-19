# 16 — Correctif : 404 en mode réel + icônes pro + pages estimées

## Audit du bug

En **mode réel** (frontend → API Django, `NEXT_PUBLIC_ENABLE_MOCKS=false`), plusieurs
surfaces appelaient des endpoints **implémentés uniquement côté MSW** (mocks front),
absents du backend → **404** : `/config/flags`, `/annotations/{id}/attribution`,
`/annotations/{id}/presence`, `/documents/{id}/contributors`,
`/documents/{id}/sentence-history`, `/projects/{slug}/insights[/{doc}]`,
`/projects/{slug}/share-links`. Les overlays (attribution, insights) plantaient donc
en réel alors qu'ils marchaient en démo MSW.

## Solutions comparées

**S1 — Désactiver/masquer ces surfaces en réel (front-only).** Forces : zéro backend.
Faiblesses : on perd les fonctionnalités en production. *Rejeté.*

**S2 — Implémenter les endpoints avec NOUVEAUX modèles + migrations** (ShareLink,
Presence, AttributionLog…). Forces : complet, persistant. Faiblesses : migrations
lourdes, surface d'erreur, données à alimenter. *Reporté (pas nécessaire maintenant).*

**S3 — Endpoints DÉRIVÉS des modèles existants, SANS migration (retenu).**
- `flags` : lus depuis `settings.FEATURE_FLAGS` (admin-surchargeable).
- `attribution` / `contributors` : dérivés des `Annotation`/`Clause` + couleur
  d'identité **déterministe** (`common/identity.user_color`).
- `presence` : utilisateur courant (présence minimale ; le temps réel viendra via
  Channels, cf. 06).
- `sentence-history` : **projection des snapshots de versions** immuables à l'ancre.
- `insights` corpus/document : **agrégats** ORM (couvertures, distribution de thèmes,
  κ via `project_iaa`, certitude moyenne, #commentaires) + **pages estimées**.
- `share-links` : jeton **HMAC signé** (`django.core.signing`) — pas de table.
- commentaires : `scope` **calculé** (clause > phrase > document) dans le serializer,
  champs `scope/range_*` tolérés en écriture (ignorés) → pas de migration.

**Décision : S3.** Le mode réel cesse de 404 sans aucune migration ni donnée
supplémentaire, et reste cohérent avec les formes camelCase consommées par le front.

## Icônes pro

Remplacement des icônes **textuelles/emoji** par **lucide-react** (dépendance ajoutée)
sur les surfaces visibles : barre d'outils (Historique/Commentaires/Versions/Insights),
en-tête (Attribution/Comparer/aperçu de frontière), navigation de divergences, panneau
d'historique (annuler/rétablir + verbes), présence/invitation, insights.

## Pages estimées par document

Heuristique `approx_pages = round(n_sentences / 25)` (densité contrat), exposée par les
insights et affichée dans la table corpus (« ≈ N p. ») et en KPI document (avec le
nombre de phrases). Source unique : `common/identity.approx_pages`.

## Plan d'action (exécuté)

1. `common/identity.py` : couleurs déterministes + `approx_pages` + `display_name`.
2. `config/api_urls.py` : `GET /config/flags` ; `settings.FEATURE_FLAGS`.
3. `annotations/views.py` : actions `attribution`, `presence`.
4. `corpora/views.py` : actions `contributors`, `sentence-history`.
5. `projects/views.py` : actions `insights`, `insights/<doc>`, `share-links`.
6. `collaboration/serializers.py` : `scope` calculé + tolérance write.
7. Front : `lucide-react`, `approxPages` (types/fixtures/affichage), passe d'icônes.
8. Tests : `backend/tests/test_insights_collab.py` (pytest) ; vitest 91 verts ; tsc 0.

## Vérification (local)

```
make stop-all && make dev-all
```
Backend doit répondre 200 sur :
```
curl -s localhost:8000/api/v1/config/flags
curl -s -H "Authorization: Bearer <token>" localhost:8000/api/v1/projects/claudette-gold-v1/insights
```
Puis dans l'app : Attribution et Insights ne produisent plus de 404 ; les documents
affichent « ≈ N pages ». Tests backend : `cd backend && .venv/bin/pytest -q tests/test_insights_collab.py`.
