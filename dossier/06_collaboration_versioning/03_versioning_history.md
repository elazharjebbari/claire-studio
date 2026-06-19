# 03 — Versioning & historique (points 2 & 6)

## Soumission versionnée (point 2)

À la soumission, l'annotateur **nomme** et **décrit** la version. On crée une
`AnnotationVersion(kind="soumission")` portant un **snapshot immuable** + des stats
figées, et on passe l'annotation en `submitted`. Les versions **coexistent** :
on ne perd jamais une soumission antérieure.

Flux :
1. UI : bouton « Soumettre » → **dialogue** (champ *nom* requis, *description*
   optionnelle, aperçu des stats : #clauses, #par thème, certitude moyenne).
2. `POST /annotations/{id}/versions` `{ name, description, kind:"soumission" }` →
   le backend sérialise les clauses dans `snapshot`, calcule `stats`, incrémente
   `number`, écrit `ActivityEvent(version.submit)`.
3. `POST /annotations/{id}/submit` (ou champ `status` dans le même appel transactionnel).
4. Invalidations React Query : versions, annotation, analytics.

### Snapshot manuel
Le raccourci ⌘S crée une version `kind="snapshot_manuel"` **sans** nom obligatoire
(label auto horodaté) — capture rapide, non bloquante.

## Journal d'actions / historique (points 2 & 6)

Toute action humaine émet un `ActivityEvent` (cf. `event-types.csv`). L'historique se
décline à **trois granularités** :

- **Annotation/Document** : timeline complète des actions (qui, quoi, quand, pourquoi).
- **Phrase** : `GET /documents/{id}/sentence-history?index=N` → évolution de l'annotation
  de la phrase N à travers annotateurs et versions (point 6).
- **Version** : diff de deux snapshots (point 6, cf. `08_version_explorer.md`).

### Côté client (ce cycle)
Un **journal local** (Zustand `actionLog`) enregistre les actions de la session courante
pour un affichage immédiat (panneau « Historique ») et pour fonder l'undo/redo
(`04_undo_redo.md`). Chaque entrée : `{ id, ts, kind, label, anchorIndex?, sentenceIndex?,
before?, after? }`. Cliquer une entrée **recentre** le document sur la phrase/clause visée.

> Le journal local et l'`ActivityEvent` serveur partagent la même **taxonomie de verbes**
> (`event-types.csv`) : ce qui est rejoué localement (undo) est aussi traçable côté serveur.

## Modèle de diff

Diff de version = comparaison de deux `snapshot` :
- clauses **ajoutées** / **supprimées** (par `anchor_index`),
- clauses **modifiées** (thème, certitude, evidence, rationale) avec before/after,
- récapitulatif (`+n clauses`, `Δκ`, thèmes touchés).

Rendu : liste groupée par phrase, couleurs sémantiques (ajout vert, suppression rouge,
modification ambre), lien « voir sur le document ».

## Sécurité & intégrité
- Snapshots **immuables** ; une correction = une nouvelle version.
- `version.submit` écrit dans l'audit append-only ; impossible de « réécrire l'histoire ».
- Permissions : seul l'annotateur (ou un owner) crée des versions ; relecteur lit + review.
