# Feature B — Décision argumentée

> Décision **actée** : modèle **hybride « phrase atomique + bloc dérivé »**, **sans
> migration de schéma**, sans `end_index`. Ce document justifie le choix, liste les
> risques et leurs parades, les alternatives écartées, et **pourquoi pas de migration**.
> Comparaison chiffrée : `B-comparatif.csv` (hybride = 148, par-phrase = 139, hiérarchique
> = 77, spans-bornés = 74).

## 1. Décision

**On retient le modèle (c) hybride dérivé.**

- **Stockage** : inchangé. Une `Clause` reste ancrée **par phrase**
  (`anchor_sentence`), conformément à INV-2 (`uniq_clause_annotation_anchor` dans
  `annotations/models.py`) et au correctif **C4** (annotation humaine par phrase).
- **Bloc** : **vue dérivée** côté frontend, calculée par une fonction **pure**
  `deriveBlocks(runs)` au-dessus de `computeRuns(drafts, n, {perSentence:true})`
  (`lib/runs.ts`). Le bloc n'est **jamais persisté** ; son identité est la paire
  `(start, theme)` au rendu.
- **Gestes** : produisent des clauses par phrase via l'API store existante
  (`setBoundary`, `removeBoundary`, `updateDraft`, `toggleBoundary`), regroupés en
  **lots atomiques** par une nouvelle primitive `applyBlockOp` (un seul snapshot undo).
- **Backend** : **aucun changement** (modèle, serializers, contrat camelCase, IAA).

## 2. Pourquoi l'hybride **sans `end_index`**

1. **Préserver C4 et l'IAA exacte.** L'IAA repose sur `_theme_vector` qui produit un
   vecteur **par phrase** (`[starts.get(i) for i in range(n_sentences)]`) consommé par
   `cohen_kappa` (`projects/iaa.py`). Introduire `end_index` (modèle (b)) obligerait à
   **forward-filler** les spans pour reconstruire ce vecteur — c'est **exactement** le
   débordement que C4 a éliminé. On régresserait un correctif déjà livré et la justesse
   de κ deviendrait sensible à chaque borne. **Inacceptable.**

2. **La vérité métier EST la phrase.** Le schéma (catégories CLAUDETTE) et la mesure
   d'accord sont **par phrase**. Un span `[a..e]` est une **commodité de saisie**, pas une
   entité métier. Modéliser une commodité comme une donnée crée une dette permanente.

3. **L'override (B3) est trivial en dérivé, coûteux en span.** Surcharger une phrase
   interne :
   - **dérivé** : on change **une** clause → le bloc se scinde **par recalcul** (zéro
     écriture voisine) ;
   - **span** : supprimer 1 span + créer 3 (réconciliation), avec invariants de
     non-chevauchement à tenir. Le geste **le plus fréquent** (ajuster une phrase) est le
     **plus simple** en dérivé.

4. **Merge/split sans état à synchroniser.** En dérivé, fusion et division **émergent**
   de `deriveBlocks` : il n'existe aucun champ `end_index`/`block_id` à maintenir, donc
   **aucune** possibilité de désynchronisation bloc ↔ clauses. Avec `end_index`, toute
   incohérence de borne devient un bug de données.

5. **Réutilisation maximale de l'existant.** `computeRuns(perSentence)`,
   `clauseRangeBetween`, `selectedSentences`/`selectedClauseIds`, undo/redo par snapshot,
   autosave **par ancre** (`lib/autosave.ts::planClauseSync`, clé = `anchorIndex`),
   `SelectionToolbar` (P4/P8) et `SentenceMenu` (toggle par phrase) **fonctionnent déjà**
   au bon grain. `end_index` invaliderait notamment le diff par ancre de l'autosave.

6. **Coût et risque faibles.** Surface d'implémentation : **1** fonction pure +
   **1** primitive store + câblage UI. **Backend : rien.** À comparer aux migrations
   DB + backfill + DRF + IAA refaits des modèles (b)/(d).

## 3. Pourquoi **PAS de migration**

- **Inutile** : tout B se construit au-dessus du modèle par phrase existant. Aucun besoin
  fonctionnel (B1–B9) n'exige un attribut au niveau bloc.
- **Risquée en prod** : la prod tourne sur un VPS OpenLiteSpeed mutualisé (cf. mémoire
  déploiement) ; une migration DB + backfill de données réelles (corpus CLAUDETTE déjà
  annoté/prérempli, ~100 pré-annotations) ajoute un risque opérationnel sans contrepartie.
- **Réversibilité** : un changement **purement frontend** (dérivation) est activable /
  désactivable et **rollback-able** sans toucher aux données ; une migration de schéma ne
  l'est pas trivialement.
- **Compatibilité contrat** : le contrat API (`anchor_index`, `theme`, …) et les
  serializers (`annotations/serializers.py`) restent **identiques** → MSW, tests et
  imports LLM (`replacePrefill` qui déplie déjà par phrase) ne bougent pas.

> Conclusion : **migration = coût + risque, bénéfice nul** pour B. On s'en abstient
> délibérément (cf. besoin transverse « pas de migration si évitable »).

## 4. Risques du modèle retenu et parades

| # | Risque | Sévérité | Parade (cf. spec) |
|---|--------|:---:|---|
| R-B1 | Pose de plage = N écritures → N entrées d'undo (UX) | Moyen | Primitive `applyBlockOp` : **un** snapshot undo + **un** `set()` par lot (spec §5, §8 B-PERF-2) |
| R-B2 | Perf de re-dérivation à chaque frappe (≤ 300 phrases) | Faible | `deriveBlocks` **O(R)**, **mémoïsée** sur `[draftClauses, nSentences]` (B-PERF-1) ; bench < 5 ms |
| R-B3 | Rafale de POST autosave pour une plage | Faible | Debounce 1200 ms + idempotence `clientOpId` + convergence post-synchro (déjà dans `useAutosave`) ; hors chemin UI |
| R-B4 | Collision d'extension (poignée vers un autre thème) | Faible | Politique explicite « écraser sur extension explicite », bornée au document (spec §3.3) ; undo restaure |
| R-B5 | Identité de bloc éphémère (pas d'attribut persistant) | Faible | Acceptable : les attributs vivent sur la `Clause`/phrase ; aucun besoin d'attribut au niveau bloc |
| R-B6 | Confusion visuelle bloc vs phrase | Faible | Distinction forme + couleur + poignées (a11y daltonisme), tooltips « Bloc <thème> i–j » (spec §6) |
| R-B7 | `readOnly` (R1) doit neutraliser aussi les gestes-bloc | Moyen | `applyBlockOp` garde `if (s.readOnly) return {}` comme les mutateurs existants |

## 5. Alternatives écartées (et conditions de réexamen)

- **(b) Spans bornés `end_index`** — *écartée*. Régresse l'IAA par phrase (forward-fill),
  migration lourde, override coûteux, invariants de chevauchement. **Réexamen seulement si**
  la donnée métier devenait intrinsèquement multi-phrases ET l'IAA redéfinie au span (non
  prévu).
- **(d) Hiérarchique sections/clauses** — *écartée*. Sur-ingénierie pour B ; migration
  majeure ; sémantique IAA ambiguë (section vs phrase). **Réexamen seulement si** un besoin
  de **structuration documentaire** (articles/sections navigables) émerge — c'est un autre
  projet que B.
- **(a) Pur par phrase seul** — *insuffisant*. Bon socle mais ne couvre pas l'ergonomie de
  plage (B2/B4/B5). L'hybride **est** (a) + la couche dérivée : on garde tous ses
  avantages.
- **Variante d'extension « buter sur collision »** — *écartée* au profit de « écraser sur
  extension explicite », pour rester cohérent avec la sélection-plage (B2) qui écrase déjà.
- **`block_id` côté frontend pour identifier les blocs** — *écartée* : inutile (l'identité
  `(start, theme)` au rendu suffit) et source de désynchronisation.

## 6. Ce que la décision engage (périmètre d'implémentation)
- **Ajout frontend** : `lib/blocks.ts` (`deriveBlocks`, `blockAt`, pur, testé comme
  `lib/runs.ts`) ; primitive store `applyBlockOp` (lot atomique, undo unique, `readOnly`-safe) ;
  câblage UI (poignées de bord, double-clic = sélection bloc, actions « bloc » de
  `SelectionToolbar`, override via `SentenceMenu` inchangé).
- **Aucun ajout backend** ; **aucune** migration ; **aucun** changement de contrat.
- Détail des impacts par fichier : `B-migration.md`. Gestes complets : `B-interactions.md`.
  Modèle de données et vue dérivée : `B-modele-donnees.puml`.
