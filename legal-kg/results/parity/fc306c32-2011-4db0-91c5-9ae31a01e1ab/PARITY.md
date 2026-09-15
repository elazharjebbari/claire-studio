# Parité Python ↔ Cypher — run fc306c32-2011-4db0-91c5-9ae31a01e1ab

Règles v0.1 (sha256 8f2967dbbcc4…, gelées : True), statut `proposed`, export L3 `pilot100-inline-opus5-pass0`.

| | Python | Cypher | accord |
|---|---|---|---|
| appariements | 38 | 38 | 38 |

**Parité : OUI** — seulement Python : 0 ; seulement Cypher : 0 ; evidence divergente : 0.

| règle | Python | Cypher |
|---|---|---|
| Q-ab | 4 | 4 |
| Q-f-asymmetry | 4 | 4 |
| Q-g | 8 | 8 |
| Q-i | 1 | 1 |
| Q-j | 5 | 5 |
| Q-j-absence | 3 | 3 |
| Q-j-strict | 2 | 2 |
| Q-k | 5 | 5 |
| Q-p | 2 | 2 |
| Q-q | 4 | 4 |

## Graphe après chargement

```
{
 "nodes": {
  "Annotation": 65898,
  "Clause": 11983,
  "Sentence": 9414,
  "GoldDecision": 9414,
  "Norm": 196,
  "Theme": 55,
  "Document": 50,
  "Section": 26,
  "AnnexItem": 17,
  "Category": 8,
  "Party": 3,
  "Run": 2,
  "LegalSource": 1
 },
 "relationships": {
  "HAS_THEME": 78582,
  "ANNOTATED_BY": 65898,
  "CONTAINS": 59467,
  "DECIDED_BY": 9414,
  "NEXT": 9364,
  "LABELED": 1137,
  "EVIDENCED_BY": 274,
  "STATES": 196,
  "PRODUCED_BY": 196,
  "HAS_ACTOR": 196,
  "MATCHES_ITEM": 76,
  "PROJECTS_TO": 60,
  "PART_OF": 17,
  "MAPS_TO": 11,
  "SPLIT_OF": 3
 }
}
```

## Notes de chargement (15 sept. 2026, Memgraph 3.x via Colima sur macOS Intel)

- Export L1/L2/L4 `057c103a…` (dataset `7116e627…`) + export L3 `pilot100-inline-opus5-pass0` (196 normes `proposed`, 38 appariements de
  `run_rules.py`) copiés dans `graph/export/memgraph_import/` (un seul volume `/import`, sous-dossier `norms/`).
- Temps : `annotations.csv` 4,2 s, `sentence_themes.csv` 2,4 s, le reste < 1 s — **après ajout des index d'identifiants** dans
  `memgraph_schema.cypher` ; sans eux, `sentence_themes.csv` restait bloqué > 10 min (une contrainte d'unicité ne sert pas de plan d'accès).
- Les 38 `MATCHES_ITEM` de ce run coexistent avec les 38 importés du CSV (run `pilot100-inline-opus5-pass0`) : append-only par `run_id`, conforme à NAMING.md.
- Observation à auditer : 90 227 lignes `sentence_themes.csv` → 78 582 relations `HAS_THEME` (le `MERGE` sur `{source, role}` fusionne
  les lignes identiques phrase/thème/source/rôle, probablement des versions successives d'une même annotation) ; sans effet sur les règles.
- 3 clauses re-découpées du pilote créées avec `SPLIT_OF` vers leur clause parente ; 11 983 clauses au total (11 967 + 16 dérivées).
