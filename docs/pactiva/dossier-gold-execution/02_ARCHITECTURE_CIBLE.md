# 02 — Architecture cible, flux et invariants

> Principe directeur : **conservateur**. Le socle (moteur pur, recompute idempotent,
> verrou à bail, gold figé, traçabilité, export deux couches) est conservé **sans
> refactoring**. Toutes les évolutions sont **additives** et réversibles.

## 1. Le seul changement de fond : rendre la complétude déclarative

### 1.1 Problème à résoudre

La règle « on ne résout qu'une fois que tous les annotateurs attendus ont soumis » est
juste, mais l'ensemble « attendu » est aujourd'hui **déduit** des assignations, sans
possibilité de le corriger quand la campagne dévie (annotateur assigné qui abandonne,
lead qui annote à sa place). Résultat : blocage définitif et muet.

### 1.2 Solution retenue — un participant déclaré en config

On ajoute à la config de résolution (`Project.settings['resolution']`) une clé
`expected_annotators` : **liste blanche nominative d'usernames**, exactement sur le
modèle de la clé `arbiters` existante (même validation « doit être membre du projet »,
même studio, même composant d'autocomplétion `ArbiterPicker`).

```
expected_annotators = []          → comportement ACTUEL inchangé (déduction par assignation)
expected_annotators = [u1, u2…]   → ces usernames FONT FOI, quel que soit leur rôle
```

Propriétés recherchées :

| Exigence | Comment elle est tenue |
|---|---|
| Ne pas affaiblir le garde-fou | La complétude reste exigée ; seule la **liste** devient explicite |
| Traçabilité | `save_resolution_config` journalise déjà chaque changement (`config_changes`) |
| Réversibilité | Vider la liste restaure le comportement actuel |
| Zéro migration | La config vit dans un `JSONField` déjà présent |
| Compatibilité | Aucune donnée existante modifiée ; défaut = comportement actuel |
| Rôle indifférent | Un **lead qui annote** peut être déclaré participant (cas réel) |

### 1.3 Source unique

`services.document_annotators()` devient la **seule** implémentation ; le cockpit
(`projects/views.py`) cesse de recalculer la complétude en SQL parallèle et réutilise
un helper de lot (`readiness_by_document(project, documents)`) construit sur la même
règle — comme `compute_status()` l'a déjà fait pour le statut.

## 2. Rendre le blocage visible

Le payload `readiness` passe de quatre compteurs à un diagnostic nommé :

```
readiness: {
  expected: 3, submitted: 2, missing: 1, ready: false,
  expectedUsernames: ["zahra.boulaich", "fatima.ouali", "jc.lamirel"],   ← NOUVEAU
  missingUsernames:  ["jc.lamirel"],                                     ← NOUVEAU
  source: "config" | "assignment" | "annotation"                         ← NOUVEAU
}
```

`source` dit **d'où vient** la liste des attendus : c'est ce qui permet à l'arbitre de
comprendre en un coup d'œil s'il regarde une déduction ou une déclaration.

Côté UI, le bandeau « Résolution indisponible » nomme les manquants et, pour un
lead/admin, propose un lien direct vers le studio de configuration.

## 3. Machine à états — inchangée, complétée

### 3.1 Résolution (document)

```
                 annotations incomplètes
    ┌──────────────────── awaiting ◄──────────────────┐
    │                        │                        │
    │        complétude OK   ▼                        │ perte de complétude
    │                      ready ──── 1ʳᵉ décision ──► in_progress
    │                        │                             │
    │                        │       toutes décidées + finalize()
    │                        ▼                             ▼
    └──────────────────────────────────────────────► resolved (GOLD FIGÉ)
                                   reopen() (lead/admin)  │
                                   ◄───────────────────────┘
```

- `compute_status()` (pur, partagé cockpit ↔ atelier) reste la source unique ;
  « finalisé » est **prioritaire** : un gold figé qui perd sa complétude reste `resolved`.
- `resolved` est **immuable** : `decide`, `auto-resolve` et le recompute sont refusés
  (409) tant que `reopen` n'a pas été appelé.

### 3.2 Phrase (GoldSentence)

```
   non décidée ──auto-résolution──► décidée (auto_resolved=true)  ──décision humaine──┐
        │                                                                             ▼
        └────────────────────── décision humaine ───────────────────────────► décidée (humaine)
                                                                                      │
                                                 annulation (NOUVEAU) ────────────────┘
```

**Invariant conservé** : une décision humaine n'est jamais écrasée par un recompute
(`services.py:262`). **Ajout** : l'annulation (`undo`) est une opération **explicite,
tracée** (`ArbitrationEvent` verbe `UNDO`) qui remet la phrase dans l'état proposé par
le moteur — jamais une suppression silencieuse.

## 4. Invariants (à tester, pas à supposer)

| # | Invariant | Garanti par |
|---|---|---|
| I1 | Les LLM n'entrent **jamais** dans la décision, la classe d'accord, le risque ou l'auto-résolution | `gold_scoring.score_sentence` (pur) |
| I2 | Une décision humaine survit à tout recompute | `services.recompute_document` |
| I3 | Une résolution finalisée est immuable sans `reopen` | `assert_not_finalized` sous verrou |
| I4 | Une écriture n'est possible que par le détenteur du verrou actif | `_assert_holder` sous `select_for_update` |
| I5 | Le thème décidé appartient au schéma du projet ; un refuge n'est jamais secondaire | `decide_sentence` |
| I6 | `finalize` exige **toutes** les phrases `index < n` décidées | `finalize_resolution` |
| I7 | Tout changement d'état est tracé (append-only) | `ArbitrationEvent` |
| **I8** | **La complétude est calculée par une seule implémentation** (cockpit = atelier) | *à établir* (lot 1) |
| **I9** | **Une décision humaine porte le multi-label voulu par l'arbitre** (primaire + secondaires explicites) | *à établir* (lot 4) |
| **I10** | **`undo` restaure l'état moteur sans détruire l'historique** | *à établir* (lot 5) |

## 5. Modèle de données — aucune migration structurelle

| Besoin | Solution | Migration ? |
|---|---|---|
| Participants déclarés | clé JSON `expected_annotators` dans `Project.settings` | non |
| Commentaire d'arbitrage | champ `GoldSentence.comment` **déjà présent** | non |
| Annulation tracée | nouveau verbe dans `ArbitrationVerb` | **oui** — migration `AlterField` sur `choices` (sans effet sur le schéma, cf. précédent `0002`) |

Aucun champ n'est supprimé, aucune table n'est modifiée structurellement, aucune
donnée n'est réécrite. Le risque de perte est nul par construction.

## 6. Architecture frontend/backend — les points d'extension utilisés

| Couche | Fichier | Nature de l'évolution |
|---|---|---|
| Config | `backend/claire/gold/config.py` | + `config_expected_annotators()`, + validation dans `validate_resolution_config` (calquée sur `arbiters`) |
| Services | `backend/claire/gold/services.py` | `document_annotators()` lit la config ; `resolution_readiness()` expose les noms ; + `undo_decision()` |
| API | `backend/claire/projects/views.py` | cockpit réutilise le helper de lot ; + route `…/decide/undo` ; + compteur `manual` |
| Types | `frontend/src/lib/gold/types.ts` | + champs de diagnostic, + `manual` dans `GoldCounts` |
| Navigation pure | `frontend/src/lib/gold/blocks.ts` | + `nextManual()`/`prevManual()`, + `manual` dans `outlineStats` |
| Store | `frontend/src/store/goldStore.ts` | + filtre `"manual"`, + pile d'annulation |
| Atelier | `GoldWorkspace.tsx` | + gestionnaire clavier (raccourcis de la spec), + compteur de cas manuels |
| Inspecteur | `GoldInspectorPanel.tsx` | + choix libre du thème, + édition des secondaires, + commentaire, + numéros de raccourcis |
| Studio | `GoldConfigStudio.tsx` | + section « Participants attendus » (réutilise `ArbiterPicker`) |

Tout le reste — moteur, verrou, export, stats, cascade — **n'est pas touché**.
