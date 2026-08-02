# Plan d'action — intégrer Fable comme 4ᵉ juge LLM

> Pré-requis de lecture : `00_AUDIT_INTEGRATION_LLM.md`.
> Principe directeur : **ne pas ajouter une 7ᵉ liste en dur**. On dérive la nomenclature des
> juges d'une source unique par côté (backend `Judge`, frontend `LLM_JUDGES`) et on scelle la
> parité par un test. Ajouter le 5ᵉ juge doit ensuite coûter 2 lignes + 1 dossier de données.

---

## Objectifs

- **O1** — Les 50 annotations Fable sont dans la base, à côté de celles de Claude/Codex/Mistral,
  sans les altérer, de façon rejouable.
- **O2** — Fable est visible et utilisable partout où un juge LLM l'est : réglette des
  frontières, fantômes, menu de phrase, comparaison N-way, pré-remplissage, triage,
  concordance, cockpit gold, labo d'analyse.
- **O3** — Fable est promouvable en compte annotateur (`gold/llm-annotators`) comme les autres.
- **O4** — La duplication de nomenclature qui a fait manquer Mistral dans `contract.ts` est
  supprimée, et un test empêche sa réapparition.
- **O5** — Une batterie de tests prouve l'intégration de bout en bout (pas seulement l'import).

**Hors périmètre** (explicitement) : recalcul du κ inter-juges à 4 juges (ça se fait côté
dépôt CLAIRE, `compute_iaa_v9_2_multi.py`, hors session d'annotation) ; toute modification du
moteur de résolution gold — les LLM restent une **référence**, jamais un votant.

---

## Lot A — Données (aucun code)

| # | Action | Vérification |
|---|---|---|
| A1 | Copier les 50 `<doc>_fable.json` vers `data/preannotations/fable/` | 50 fichiers, noms `<doc>_fable.json` |
| A2 | Contrôle d'intégrité (JSON valide, `judge=="fable"`, `doc`==nom, `segments` non vide) | script de contrôle : 0 anomalie |
| A3 | Corpus identique aux autres juges | `set(fable) == set(claude) == set(codex)` |

> Le nom des fichiers source respecte déjà la convention `<external_id>_<judge>.json` attendue
> par `import_preannotations` : **aucun renommage**.

## Lot B — Backend : nomenclature dérivée

| # | Fichier | Changement |
|---|---|---|
| B1 | `claire/imports/models.py` | `Judge.FABLE = "fable", "Fable"` + helper `Judge.import_judges()` (tous sauf `other`) |
| B2 | `claire/imports/migrations/0004_…` | `AlterField` sur `preannotation.judge` (choices) |
| B3 | `claire/projects/views.py` | remplacer le set en dur par `Judge.values` (P2) |
| B4 | `claire/gold/config.py` | `KNOWN_JUDGES = set(Judge.values)` (P3) |
| B5 | `claire/imports/…/import_preannotations.py` | défaut `--judges` = `Judge.import_judges()` (P4) |

Effet : **une** définition backend. Les trois duplications deviennent des dérivations.

## Lot C — Frontend : source unique + type honnête

| # | Fichier | Changement |
|---|---|---|
| C1 | `src/lib/llmJudges.ts` | entrée `fable` (initiale `F`, couleur d'identité `#FDBA74`, distincte des 3 autres et des couleurs de thème) |
| C2 | `src/types/contract.ts` | `Judge = "claude" \| "codex" \| "mistral" \| "fable" \| "other"` (corrige aussi l'oubli Mistral, P5) |

Aucun composant à toucher : toutes les surfaces bouclent déjà sur `LLM_JUDGES` (audit §5).

## Lot D — Import et vérification fonctionnelle

| # | Action |
|---|---|
| D1 | `manage.py migrate` puis `manage.py import_preannotations --project campagne-pactiva` (le défaut inclut désormais `fable`) |
| D2 | Contrôles SQL/ORM : 50 `PreAnnotation` juge `fable`, ~1 728 `PreClause`, aucune préannotation existante modifiée |
| D3 | `project_concordance` renvoie une ligne `fable` ; `GET gold/llm-annotators` liste `fable` |

## Lot E — Batterie de tests

**Backend** (`backend/tests/test_judge_fable.py`, nouveau) :

1. `import_preannotations` importe `fable` **par défaut** (sans `--judges`) ;
2. import **idempotent** : 2ᵉ passage → aucun doublon, aucune clause recréée ;
3. import de `fable` **n'altère pas** les préannotations `claude` déjà en base (non-régression) ;
4. le **vrai** fichier `Atlas_fable.json` (fixture réelle, tronquée si besoin) se normalise :
   60 phrases, segments → clauses pivot, `legal_nature` de l'ancre attachée ;
5. `Judge.FABLE` présent dans les choices du champ ; `KNOWN_JUDGES` contient `fable` ;
6. `POST gold/llm-annotators {judge: "fable", action: "add"}` → 200, annotations soumises
   dérivées ; `remove` → réversible ;
7. **concordance à 4 juges** : `per_judge` contient les 4, paires = C(4,2) = 6 ;
8. **triage à 4 juges** : une phrase avec 4 votes route sans erreur, majorité 3/4 respectée ;
9. **garde anti-hardcode** : aucun module de `claire/` ne contient un littéral
   `{"claude", "codex", "mistral"}` — la seule source est `Judge`.

**Frontend** (`frontend/tests/`) :

10. `llmJudges.test.ts` — 4 juges ordonnés, couleurs distinctes, helpers ;
11. `judgeFableIntegration.test.ts` (nouveau) — **parité** des identifiants de juges entre
    `LLM_JUDGES` et le `Judge` backend lu dans `imports/models.py` (source de vérité croisée) ;
12. comparaison **N-way à 4 juges** (`compareNway`) : unanimité / divergence correctes ;
13. réglette : 4 pistes rendues, celle sans données marquée.

**Non-régression** : suites complètes `pytest` (backend) et `vitest` (frontend) au vert.

## Lot F′ — Fable devient le modèle par défaut

Demande du porteur. « Par défaut » = **pré-sélectionné**, jamais **auto-exécuté** : la
pré-annotation automatique reste opt-in (consentement explicite), on ne change que le modèle
armé.

| # | Fichier | Changement |
|---|---|---|
| F′1 | `src/lib/llmJudges.ts` | `export const DEFAULT_LLM_JUDGE = "fable"` (source unique du défaut) |
| F′2 | `src/lib/prefs/schema.ts` | `prefill.judge` par défaut = `DEFAULT_LLM_JUDGE` (au lieu de `null`) |
| F′3 | `claire/accounts/ui_prefs.py` | `DEFAULT_PREFILL_JUDGE = "fable"` + `DEFAULTS["prefill"]["judge"]` |
| F′4 | `accounts/…/set_default_llm_judge.py` | commande d'alignement des **comptes existants** |

Pourquoi F′4 : le défaut de `DEFAULTS` ne vaut que pour un compte **neuf**. Les comptes déjà
créés (les 4 de la campagne) ont un blob `ui_preferences` persisté avec `judge: null` et
resteraient sur « Aucun ». La commande les aligne **sans écraser un choix exprimé** : elle ne
touche qu'un compte dont `prefill.judge` est nul **et** `prefill.asked` est faux (la modale de
consentement n'a jamais été montrée ⇒ aucun choix, même pas « Aucun »). Idempotente,
`--dry-run`, `--force` en dernier recours.

Non modifié à dessein : `overlays.llmSource` reste `"human"` — la source de rendu doit
continuer d'afficher le travail de l'annotateur, pas la segmentation d'un modèle.

## Lot F — Prod (sur décision explicite)

`deploy/push-preannotations.sh` envoie `data/preannotations/` par rsync puis lance l'import.
Il faut d'abord **déployer le code** (migration `imports/0004`) via `deploy/deploy-claire.sh`,
**puis** pousser les données. Ordre inverse = juge importé hors nomenclature.

---

## Séquencement et dépendances

```
A (données) ─┐
             ├─→ D (import local) ─→ E (tests) ─→ [F prod, sur validation]
B (backend) ─┤
C (frontend)─┘
```

B est indépendant de A ; C est indépendant de A et B. D exige A + B. E exige tout.

## Critères d'acceptation

- [ ] 50 `PreAnnotation` `fable` en base locale, 0 diff sur les autres juges
- [ ] `pytest` vert, incluant les 9 tests backend nouveaux
- [ ] `vitest` vert, incluant les 4 tests frontend nouveaux
- [ ] test de parité backend↔frontend en place (échoue si un juge est ajouté d'un seul côté)
- [ ] aucun littéral de liste de juges restant dans `backend/claire/**`
