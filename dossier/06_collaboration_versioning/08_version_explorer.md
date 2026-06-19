# 08 — Explorateur de versions : document & phrase (point 6)

## Objectif

Voir **toutes les versions enregistrées** d'une annotation, au niveau du **document**
comme de la **phrase**, et comprendre les modifications de chacun à travers le temps.

## Vue Document (`/annotate/{id}/versions`)

- **Frise des versions** : cartes ordonnées (number, name, description, kind, auteur,
  date, stats). Sélection de **deux** versions → **diff**.
- **Diff de versions** : comparaison des snapshots (cf. `03_versioning_history.md`) —
  clauses ajoutées/supprimées/modifiées, groupées par phrase, couleurs sémantiques,
  lien « voir sur le document ».
- **Restaurer** : crée une **nouvelle** version à partir d'un snapshot ancien (jamais
  d'écrasement) ; trace `version.restore`.

## Vue Phrase (timeline) — cœur du point 6

`GET /documents/{id}/sentence-history?index=N` projette les `ActivityEvent` de la phrase
N (tous annotateurs, toutes versions) en une **timeline** :

```
Phrase 12 — « ... terminate or suspend your account ... »
● v1  Alice   clause.create  → TERMINATION            (certitude 2)   "clause de résiliation"
● v1  Bruno   clause.retheme → TERMINATION≈LTD ?      commentaire ajouté
● v2  Alice   set_certainty  2 → 3
● v3  Codex   divergence.adopt (Codex) → TERMINATION
```

Chaque ligne : pastille **couleur d'auteur**, verbe, before→after, version, horodatage,
« pourquoi » (rationale/commentaire). Clic → recentre le document sur la phrase à l'état
de cette version (lecture).

## Pourquoi c'est robuste

- La timeline phrase est une **projection de l'audit append-only** : fidèle, immuable,
  sans logique de reconstruction fragile.
- Les versions document s'appuient sur des **snapshots immuables** → diffs déterministes.

## UX
- Sélecteur de deux versions par drag ou cases ; diff côte à côte ou inline.
- Filtre par auteur / par verbe ; recherche d'une phrase (autocomplete) pour ouvrir sa
  timeline.
- Accessibilité : timeline = liste ARIA navigable ; diff = régions étiquetées.

## API (cf. `12_api_contract.md`)
- `GET /annotations/{id}/versions` (étendu : name, description, kind, stats).
- `GET /annotations/{id}/versions/{n}/diff?against=m` (diff de snapshots).
- `GET /documents/{id}/sentence-history?index=N`.
- `POST /annotations/{id}/versions/{n}/restore`.
