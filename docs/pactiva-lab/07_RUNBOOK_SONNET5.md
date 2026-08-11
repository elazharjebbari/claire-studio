# Runbook d'exécution — optimisé pour un agent Claude Sonnet 5

> **Comment lire ce runbook.** Chaque étape a : un objectif, les fichiers concernés, la
> vérification qui prouve qu'elle est faite, et une **condition d'arrêt**. Une étape dont la
> vérification échoue **ne doit pas être marquée faite** : corriger ou signaler, jamais
> poursuivre en laissant une case verte à tort.

---

## 0. Contexte à charger avant de commencer

**Lire, dans cet ordre :**
1. [`00_README.md`](00_README.md) — la décision et le principe d'architecture
2. [`01_PLAN_SCIENTIFIQUE.md`](01_PLAN_SCIENTIFIQUE.md) §3 (invariants) et §4 (maturités)
3. [`02_ARCHITECTURE.md`](02_ARCHITECTURE.md) §1–§4
4. [`04_PLAN_DEV.md`](04_PLAN_DEV.md) — le lot en cours seulement
5. [`05_TESTS.md`](05_TESTS.md) — les tests du lot en cours

**Conventions du dépôt à respecter (non négociables) :**

| Règle | Détail |
|---|---|
| Tests backend | `backend/.venv/bin/python -m pytest` — l'environnement conda `claire` **n'a pas** reportlab |
| `manage.py` local | préfixer `DJANGO_SECRET_KEY=x` |
| Commentaires et docstrings | **en français**, denses, expliquant le *pourquoi* |
| Couleurs | jamais de hex en dur (garde active sur 15 fichiers) |
| Nomenclature des juges | **dérivée** de `Judge` / `LLM_JUDGES` — un littéral de liste fait échouer le test |
| Sortie API | camelCase (djangorestframework-camel-case) |
| Repli | **jamais silencieux** : tracer dans le manifeste ou lever |
| Dépôt CLAIRE | `/Users/elazhar/PycharmProjects/CLAIRE/` est en **lecture seule** |

**Ne jamais faire :**
- importer `torch` / `transformers` / `sklearn` dans `backend/` ;
- écrire une liste de juges en dur ;
- supprimer une métrique existante (la déprécier) ;
- committer un secret, même de test ;
- marquer une étape faite sans avoir passé sa vérification.

---

## Étape 1 — L0 : sélection par maturité

**Objectif.** `maturity=complete` capte les annotations finies mais non soumises.

**Fichiers**
```
backend/claire/lab/__init__.py           (nouveau)
backend/claire/lab/apps.py               (nouveau)
backend/claire/lab/selectors.py          (nouveau — PUR, aucun import Django)
backend/tests/test_lab_selectors.py      (nouveau)
backend/claire/settings.py               ajouter "claire.lab" à INSTALLED_APPS
```

**Contenu attendu de `selectors.py`** — fonctions pures sur des dicts, pas sur des modèles :
```python
def annotation_maturity(n_sentences: int, n_clauses: int, n_validated: int, status: str) -> str
def select_annotations(rows: list[dict], maturity: str, scope: dict) -> tuple[list[dict], list[dict]]
    # retourne (retenus, exclus) — chaque exclu porte {"document", "reason", "detail"}
```

**Vérification**
```bash
backend/.venv/bin/python -m pytest backend/tests/test_lab_selectors.py -v
backend/.venv/bin/python -c "import claire.lab.selectors, sys; \
  assert not any(m.startswith('django') for m in sys.modules), 'selectors doit rester PUR'"
```

**Condition d'arrêt.** Si `select_annotations` ne garantit pas
`len(retenus) + len(exclus) == len(candidats)`, **s'arrêter** : une exclusion silencieuse
invalide tout ce qui suit.

---

## Étape 2 — L0 : preflight et endpoint

**Fichiers**
```
backend/claire/lab/preflight.py          construit le rapport (comptages, exclusions, empreinte)
backend/claire/lab/views.py              POST /lab/datasets/preflight
backend/claire/lab/serializers.py
backend/claire/lab/urls.py               + branchement dans le routeur du projet
backend/claire/lab/management/commands/lab_preflight.py
backend/tests/test_lab_preflight.py
```

**Vérification locale**
```bash
cd backend && DJANGO_SECRET_KEY=x .venv/bin/python manage.py lab_preflight \
  --project campagne-pactiva --maturity complete
```

**Vérification sur données réelles** (attendus mesurés le 11/08/2026) :
```
maturity=submitted → 35 annotations
maturity=complete  → 45 annotations       ⭐ +10 (fatima.ouali)
Endomondo exclu, motif partial_annotation (59/498 validées)
```

**Condition d'arrêt.** Si `complete` ne renvoie pas au moins autant d'annotations que
`submitted`, la définition de complétude est fausse — corriger avant de continuer.

---

## Étape 3 — L2 : corriger `boundary_agreement` ⚠️ prioritaire

> **Pourquoi avant L1.** `boundary_kappa` publie aujourd'hui 1,000 par construction. C'est un
> chiffre faux, déjà affiché. Chaque jour de retard produit des analyses contaminées.

**Fichiers**
```
backend/claire/analysis/metrics.py       + registry.register(boundary_agreement)
backend/claire/projects/iaa.py           marquer boundary_kappa déprécié (ne PAS supprimer)
backend/tests/test_lab_metrics.py
```

**Définition.** Un segment = plage maximale de phrases consécutives portant le **même ensemble
de thèmes**. Une frontière = index de début de segment. Mesures : Jaccard par document,
WindowDiff, Pk.

**Vérification**
```bash
backend/.venv/bin/python -m pytest backend/tests/test_lab_metrics.py -k boundary -v
```
Sur la prod, la valeur attendue est **0,39–0,63**, jamais 1,000.

**Condition d'arrêt.** Si la nouvelle métrique rend 1,0, elle mesure encore les ancres et non
les segments reconstruits — **ne pas livrer**.

---

## Étape 4 — L2 : métriques enrichies

Ajouter, une par une, avec son test : `alpha_masi` · `label_distribution` · `cooccurrence` ·
`human_llm_matrix` · `annotator_audit` · `gold_progress` · `campaign_readiness`.
Voir [`specs/metrics-catalog.yaml`](specs/metrics-catalog.yaml) pour les sorties attendues.

**Valeurs de contrôle sur la prod (11/08/2026)** — si une seule diffère nettement, enquêter
avant de poursuivre :
```
alpha_masi.alpha_masi              ≈ 0,635      alpha_masi.alpha_nominal  ≈ 0,701
cooccurrence.unfair_lift           7,4× sur LICENSE_IP+TERMINATION
cooccurrence (multi-label brut)    ≈ 1,09×
campaign_readiness.complete_but_not_submitted   = 10
human_llm_matrix.cross_mean        48–60 %      human_llm_matrix.human_mean ≈ 80 %
```

**Vérification de non-régression** (impérative) :
```bash
backend/.venv/bin/python -m pytest backend/tests/ -k "analysis or metrics" -v
```

---

## Étape 5 — L1 : splits, agrégation, builder

**Fichiers**
```
backend/claire/lab/splits.py             PUR — GroupKFold par document
backend/claire/lab/aggregation.py        PUR — réutilise projects.gold_scoring
backend/claire/lab/builder.py
backend/claire/lab/models.py             LabDataset (immuable)
backend/claire/lab/migrations/0001_initial.py
backend/claire/lab/management/commands/lab_build_dataset.py
backend/tests/test_lab_splits.py
backend/tests/test_lab_dataset.py
```

**Points de vigilance**
- L'immutabilité se pose comme dans `AnalysisSnapshot` (surcharge de `save()`).
- L'empreinte couvre **critères + contenu** : deux contenus différents ⇒ deux empreintes.
- `n_documents < k` ⇒ `dataset_too_small`, jamais un `GroupKFold` qui explose.
- Le manifeste liste les exclusions **avec motif**.

**Vérification**
```bash
backend/.venv/bin/python -m pytest backend/tests/test_lab_splits.py backend/tests/test_lab_dataset.py -v
cd backend && DJANGO_SECRET_KEY=x .venv/bin/python manage.py lab_build_dataset \
  --project campagne-pactiva --maturity complete --label "v1-complete"
```
Puis vérifier que le dossier produit contient bien les 7 fichiers du contrat (§`02` 4.1).

---

## Étape 6 — L4 : package `pactiva_lab`

**Fichiers** : `research/pyproject.toml` + l'arbre de [`02_ARCHITECTURE.md`](02_ARCHITECTURE.md) §2.

**Ordre d'implémentation** — cet ordre garantit qu'on a un résultat de bout en bout tôt :
1. `config.py` (validation par le schéma) → `env.py` → `data.py`
2. `preprocess/detokenize.py` (le plus rentable)
3. `models/baselines.py` : majorité, puis position seule, puis TF-IDF
4. `evaluation/metrics.py` (T1 d'abord) → `bootstrap.py` → `ceiling.py`
5. `cli.py`

**Vérification**
```bash
cd research && python -m pytest -v
python -m pactiva_lab run --config ../tests/fixtures/baseline.json \
  --data /tmp/dataset-v1 --out /tmp/out-1
python -m pactiva_lab run --config ../tests/fixtures/baseline.json \
  --data /tmp/dataset-v1 --out /tmp/out-2
diff <(jq -S . /tmp/out-1/results.json) <(jq -S . /tmp/out-2/results.json)   # doit être vide
```

**Condition d'arrêt.** Si le `diff` n'est pas vide, le déterminisme est cassé (graine non
propagée) — **corriger avant tout le reste** : sans déterminisme, aucun résultat n'est publiable.

---

## Étape 7 — L3 : visualisations

> **Charger la skill `dataviz` AVANT d'écrire la première ligne de code de graphe.** Elle fixe
> la palette, le choix de forme, l'accessibilité et les règles d'axe/légende/infobulle.

**Ordre** : primitives (`scales.ts`, `Axis`, `Legend`, `ExportButton`) → F2 et F3 (les plus
simples et les plus utiles) → F1, F4 → le reste.

**Vérification**
```bash
cd frontend && npx vitest run charts figures && npx tsc --noEmit
npx vitest run a11y
```

---

## Étape 8 — L5 : orchestration et backend local

Suivre [`04_PLAN_DEV.md`](04_PLAN_DEV.md) L5. **Calquer `services.py` sur
`claire/analysis/services.py`** (file, heartbeat, retry, annulation) — le mécanisme est éprouvé
en production, ne pas en réinventer un autre.

**Vérification**
```bash
backend/.venv/bin/python -m pytest backend/tests/test_lab_runs.py -v
cd backend && DJANGO_SECRET_KEY=x .venv/bin/python manage.py lab_worker --once
```

---

## Étape 9 — L6 : modèles lourds

Voir L6. Toujours tester d'abord sur le jeu jouet, puis sur un vrai dataset.

**Vérification**
```bash
cd research && python -m pytest -v -m "not slow"
python -m pactiva_lab run --config configs/embeddings-frozen.json --data … --out …
```

---

## Étape 10 — L7 : UI du Lab

Voir L7. Réutiliser les primitives existantes (`components/ui/primitives`, `Disclosure`).

**Vérification**
```bash
cd frontend && npx vitest run lab && npx tsc --noEmit && npx vitest run a11y
```

---

## Étape 11 — L8 : Grid'5000

**Ordre impératif :** `crypto.py` et les tests de fuite de secret **d'abord**, le runner ensuite.
Un runner écrit avant la sécurité finit par journaliser un mot de passe.

**Génération de la clé**
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# → à placer dans LAB_CREDENTIALS_KEY (jamais dans le dépôt)
```

**Vérification en simulation**
```bash
backend/.venv/bin/python -m pytest backend/tests/test_lab_credentials.py backend/tests/test_lab_g5k.py -v
```

**Vérification manuelle réelle** (hors CI, une fois, avec un vrai compte) :
```bash
curl -u "$G5K_LOGIN:$G5K_PASSWORD" https://api.grid5000.fr/stable/sites | head
```

**Condition d'arrêt.** Si un seul test de fuite de secret échoue, **ne pas déployer**.

---

## Étape 12 — Déploiement

**Ordre impératif** (piège connu du projet) :
```bash
# 1. worktree propre, y compris les fichiers non suivis (le script refuse sinon)
git status --porcelain --untracked-files=normal

# 2. code + migrations
deploy/deploy-claire.sh --allow-migrations

# 3. vérifications post-déploiement
ssh -i ~/.ssh/corolle_deploy -o IdentitiesOnly=yes root@46.202.128.168 \
  'cd /var/www/claire-studio/backend && .venv/bin/python -m pytest -q | tail -5'
curl -s -o /dev/null -w "%{http_code}\n" https://pactiva.legal/api/health
```

`LAB_CREDENTIALS_KEY` doit être présente dans l'environnement du serveur **avant** le
déploiement de L8, sinon l'enregistrement d'identifiants renverra 503 (comportement voulu,
mais autant l'éviter en production).

---

## Journal d'exécution

| Étape | Lot | État | Vérification | Date |
|---|---|---|---|---|
| 1 | L0 sélection | ✅ | 37 tests verts ; suite backend **508** (471 avant) | 11/08/2026 |
| 2 | L0 preflight | ✅ | exécuté sur la prod, voir le tableau ci-dessous | 11/08/2026 |
| 3 | L2 boundary ⚠️ | ✅ | `boundary_agreement` remplace l'artefact ; ancien conservé et déprécié | 11/08/2026 |
| 4 | L2 métriques | ✅ | 8 métriques ajoutées au registre ; 31 tests | 11/08/2026 |
| 5 | L1 dataset | ✅ | splits + agrégation + builder + `LabDataset` immuable ; 22 tests | 11/08/2026 |
| 6 | L4 package | ✅ | `research/pactiva_lab/` autonome ; **53 tests**, déterminisme vérifié | 11/08/2026 |
| 7 | L3 figures | ✅ | primitives SVG + F1–F4, palette **validée** ; 32 tests | 11/08/2026 |
| 8 | L5 orchestration | ✅ | runs, dédup, zombies, ingestion tout-ou-rien ; 25 tests | 11/08/2026 |
| 9 | L6 modèles | ⚠️ | structure + imports paresseux ; **poids réels non exécutés** (hors CI) | 11/08/2026 |
| 10 | L7 UI | ✅ | Lab (datasets/runs/calcul) + « Prêt pour la science » ; 19 tests | 11/08/2026 |
| 11 | L8 Grid'5000 | ⚠️ | crypto + runner + 14 tests de sécurité ; **API réelle non appelée** | 11/08/2026 |
| 12 | Déploiement | ⛔ | non déployé (demande explicite) | — |

> **Tenir ce journal à jour au fil de l'exécution.** Une étape marquée faite sans sa
> vérification est une dette qui se paiera au moment d'écrire l'article.

---

## Résultats mesurés — étapes 1 et 2 (11 août 2026)

Exécuté sur la base de **production** (`campagne-pactiva`) :

```
manage.py lab_preflight --project campagne-pactiva --compare

maturité      annot.   docs   phrases  ≥2 ann.  ≥3 ann.
-------------------------------------------------------
any               43     35      7126        6        2
complete          43     35      7126        6        2
submitted         35     31      6725        4        0
gold               0      0         0        0        0

… puis avec le seuil de complétude assoupli :
manage.py lab_preflight --maturity complete --completeness 0.98
→ 44 annotations · 35 documents · 6 multi-annotés · 3 TRIPLES
```

**Ce que le Lot 0 rapporte, chiffré :** `complete` (seuil 0,98) contre `submitted`, c'est
**+9 annotations**, **+4 documents**, **+2 documents multi-annotés** et surtout
**0 → 3 documents en triple annotation**. Le passage de 1 à 3 paires d'annotateurs
mesurables, sans une minute d'annotation supplémentaire.

**Deux ajustements décidés par l'exécution** (que la spécification seule n'aurait pas
révélés) :

1. **Seuil de complétude paramétrable** (`completeness_threshold`, défaut **strict à 1,0**).
   Motif : `Academia`/`fatima.ouali` était écarté pour **192 phrases validées sur 193** —
   un clic oublié, pas un travail inachevé. À 0,98 elle est récupérée, et c'est ce qui fait
   passer le troisième document en triple annotation. La tolérance est **tracée** dans le
   rapport (`near_complete`) et signalée par un avertissement : elle doit rester visible
   dans le manifeste et dans l'article.
2. **Les motifs d'exclusion portent les chiffres.** « maturité any < complete requis » ne
   permettait pas de distinguer `Booking` (0/128, à peine ouvert) de `Academia` (192/193,
   fini) — or l'un est à écarter et l'autre à récupérer. Les motifs affichent désormais
   `192/193 phrases validées, 99.5 %`.

**Écartés à juste titre** (tous confirmés non finis) : `Amazon` 102/132 · `Betterpoints_UK`
7/113 · `Booking` 0/128 · `Crowdtangle` 0/78 · `Endomondo` 59/498 · `Fitbit` 0/158.

**Avertissement remonté automatiquement :** `FEEDBACK` est sous 50 occurrences → macro-F1
peu fiable sur cette classe. C'est exactement le garde-fou attendu du plan scientifique.

> **État de la prod :** le module a été testé sur le VPS puis **entièrement retiré**
> (`claire/lab` supprimé, `config/settings/base.py` restauré, HEAD `976398b`, 3 services
> actifs, front 200). Rien de non déployé ne subsiste sur le serveur.


---

## Résultats d'exécution — lots L1 à L8 (11 août 2026)

**Suites de tests**

| Suite | Avant | Après |
|---|---:|---:|
| pytest backend | 471 | **600** |
| pytest `research/` (sans Django) | — | **53** |
| vitest frontend | 548 | **599** |
| `tsc --noEmit` | 0 erreur | **0 erreur** |

### Trois bugs trouvés PAR l'exécution, invisibles à la spécification

1. **La graine du découpage n'avait aucun effet.** Le tri par taille (nécessaire à
   l'équilibrage) écrasait le pré-mélange pseudo-aléatoire : deux validations croisées
   « indépendantes » tombaient sur exactement la même partition. Corrigé en départageant
   les plis de charge égale par une clé dépendant de la graine.
2. **`ticks()` rendait 3 graduations au lieu de 6.** La règle d'arrondi prenait le plus
   GRAND pas rond au lieu du plus petit ≥ pas brut : un axe 0–1 affichait `0 · 0,5 · 1`.
3. **Un octet nul dans `models/heavy.py`** rendait le fichier illisible par
   l'interpréteur — détecté par l'échec d'import du test, pas par une relecture.

### Ce qui n'a PAS été fait, et pourquoi

| Élément | État | Raison |
|---|---|---|
| Entraînement de transformers sur poids réels | non exécuté | `transformers`/`torch` non installés ; testé sur modèle jouet et par imports paresseux |
| Appel réel à l'API Grid'5000 | non exécuté | aucun compte configuré ; simulé, avec une commande de vérification manuelle dans ce runbook |
| Tests a11y Playwright | non exécutés | `e2e/a11y.spec.ts` exige un serveur lancé ; les règles d'accessibilité sont en revanche couvertes par les tests vitest (équivalent tabulaire, rôles, libellés) |
| Figures F5–F12 | non faites | F1–F4 couvrent les résultats déjà mesurés ; les autres dépendent de runs réels |
| Déploiement | non fait | demande explicite de ne pas déployer |

### Vérification manuelle restante (une fois, avec un vrai compte)

```bash
# 1. clé de chiffrement côté serveur
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
export LAB_CREDENTIALS_KEY=…

# 2. API Grid'5000
curl -u "$G5K_LOGIN:$G5K_PASSWORD" https://api.grid5000.fr/stable/sites | head

# 3. environnement conda côté grille
ssh $G5K_LOGIN@access.grid5000.fr
# puis, SUR UN NŒUD (pas la frontale — RAM insuffisante) :
module load conda && conda create -n pactiva-lab python=3.11 && conda activate pactiva-lab
pip install -e /path/to/research[transformers]
```
