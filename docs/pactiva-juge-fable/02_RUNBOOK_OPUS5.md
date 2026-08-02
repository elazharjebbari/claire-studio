# Runbook — ajout du juge Fable (optimisé pour exécution par Opus 5)

> Exécutable tel quel, du haut vers le bas. Chaque étape porte sa **vérification** et sa
> **condition d'arrêt**. Toute étape est **rejouable** (idempotente) : en cas d'interruption,
> reprendre à l'étape en cours sans défaire les précédentes.
> Racine : `/Users/elazhar/PycharmProjects/claire-studio`. Env de test : conda `claire`.

## Conventions d'exécution

- Les étapes **B** et **C** sont **indépendantes** → les lancer en parallèle (édition de
  fichiers disjoints).
- Ne jamais écrire dans `/Users/elazhar/PycharmProjects/CLAIRE/` (dépôt source, lecture seule).
- Aucun `manage.py` sur la **prod** avant l'étape 9, validée explicitement par le porteur.

---

## Étape 0 — Garde-fou d'état initial

```bash
cd /Users/elazhar/PycharmProjects/claire-studio
git status --short           # attendu : aucune modif non commitée sur backend/ frontend/
ls data/preannotations       # attendu : _v94_archive claude codex mistral
```

**Arrêt si** : arbre de travail sale sur `backend/` ou `frontend/` (commiter ou remiser d'abord).

---

## Étape 1 — Données (Lot A)

```bash
mkdir -p data/preannotations/fable
cp /Users/elazhar/PycharmProjects/CLAIRE/annotations/v9_2_session4_fable/*_fable.json \
   data/preannotations/fable/
ls data/preannotations/fable | wc -l          # attendu : 50
```

Contrôle d'intégrité (à exécuter, sortie attendue « OK 50 ») :

```bash
python3 - <<'PY'
import json, glob, os
files = sorted(glob.glob('data/preannotations/fable/*_fable.json'))
bad = []
for f in files:
    d = json.load(open(f))
    base = os.path.basename(f)[:-len('_fable.json')]
    if d.get('judge') != 'fable': bad.append((base, 'judge'))
    if d.get('doc') != base: bad.append((base, 'doc'))
    if not d.get('document_plan', {}).get('segments'): bad.append((base, 'segments'))
    if not d.get('annotations'): bad.append((base, 'annotations'))
peers = {os.path.basename(p)[:-len('_claude.json')]
         for p in glob.glob('data/preannotations/claude/*_claude.json')}
mine = {os.path.basename(p)[:-len('_fable.json')] for p in files}
print('OK', len(files)) if (not bad and mine == peers) else print('KO', bad, mine ^ peers)
PY
```

**Arrêt si** : sortie ≠ `OK 50`.

---

## Étape 2 — Backend : nomenclature dérivée (Lot B)

`backend/claire/imports/models.py` — ajouter le juge **et** le helper qui supprime les
duplications :

```python
class Judge(models.TextChoices):
    CLAUDE = "claude", "Claude"
    CODEX = "codex", "Codex"
    MISTRAL = "mistral", "Mistral"
    FABLE = "fable", "Fable"
    OTHER = "other", "Other"

    @classmethod
    def import_judges(cls) -> list[str]:
        """Juges nommés (hors fourre-tout `other`) — ordre d'import stable."""
        return [j for j in cls.values if j != cls.OTHER]
```

Puis **dériver** les trois listes en dur :

| Fichier | Avant | Après |
|---|---|---|
| `claire/projects/views.py` (~826) | `if judge not in {"claude","codex","mistral"}` | `if judge not in set(Judge.import_judges())` (+ import) |
| `claire/gold/config.py` (21) | `KNOWN_JUDGES = {"claude","codex","mistral","other"}` | `KNOWN_JUDGES = set(Judge.values)` (import tardif si cycle) |
| `claire/imports/…/import_preannotations.py` (36) | `default="claude,codex,mistral"` | `default=",".join(Judge.import_judges())` |

Migration :

```bash
cd backend && DJANGO_SECRET_KEY=x .venv/bin/python manage.py makemigrations imports \
  --name alter_preannotation_judge_fable
```

**Vérification** : la migration ne contient qu'un `AlterField` sur `preannotation.judge`.
**Arrêt si** : elle touche un autre modèle.

---

## Étape 3 — Frontend : source unique (Lot C) — *parallélisable avec l'étape 2*

`frontend/src/lib/llmJudges.ts` :

```ts
{ id: "fable", label: "Fable", initial: "F", identityColor: "#FDBA74" },
```

`frontend/src/types/contract.ts` :

```ts
export type Judge = "claude" | "codex" | "mistral" | "fable" | "other";
```

**Vérification** : `#FDBA74` n'apparaît pas dans `design-tokens.json` (≠ couleur de thème) et
diffère des 3 autres `identityColor`.

---

## Étape 4 — Import local (Lot D)

```bash
cd backend
DJANGO_SECRET_KEY=x .venv/bin/python manage.py migrate
DJANGO_SECRET_KEY=x .venv/bin/python manage.py import_preannotations --project campagne-pactiva
```

Attendu : « Pré-annotations : N importées … juges ['claude','codex','mistral','fable'] ».

> **Note d'environnement** : la base locale de développement peut être vide (aucun projet
> `campagne-pactiva`). Dans ce cas l'étape 4 est **sans objet en local** et la preuve
> d'intégration est apportée par l'étape 6 (tests, qui montent leur propre base) puis
> l'étape 9 (prod). Ne pas fabriquer de projet factice pour « faire passer » l'étape.

**Vérification** (si un projet existe) :

```bash
DJANGO_SECRET_KEY=x .venv/bin/python manage.py shell -c "
from claire.imports.models import PreAnnotation, PreClause
from django.db.models import Count
print(list(PreAnnotation.objects.values('judge').annotate(n=Count('id')).order_by('judge')))
print('preclauses fable:', PreClause.objects.filter(preannotation__judge='fable').count())
"
```

---

## Étape 5 — Batterie de tests (Lot E)

Créer `backend/tests/test_judge_fable.py` — 9 cas (cf. plan §Lot E) dont :

- import par défaut, idempotence, non-régression sur `claude` ;
- normalisation d'un **vrai** payload Fable (fixture réelle) ;
- `gold/llm-annotators` add/remove pour `fable` ;
- concordance à 4 juges (6 paires), triage à 4 juges (majorité 3/4) ;
- **garde anti-hardcode** : `grep` du littéral de liste de juges dans `backend/claire/**`.

Créer `frontend/tests/judgeFable.test.ts` — parité `LLM_JUDGES` ↔ `Judge` backend (lecture de
`imports/models.py`), comparaison N-way à 4 juges, réglette à 4 pistes.
Mettre à jour `frontend/tests/llmJudges.test.ts` (4 juges attendus).

---

## Étape 6 — Exécution des suites

```bash
# Backend (env conda claire)
cd backend && conda run -n claire python -m pytest -q

# Frontend
cd frontend && npm run test -- --run
```

**Condition de sortie** : **0 échec** des deux côtés. Un échec = corriger et relancer ; ne
jamais neutraliser un test pour « passer ».

---

## Étape 7 — Revue de cohérence finale

```bash
grep -rn '"claude", "codex"' backend/claire --include="*.py" | grep -v migrations   # attendu : vide
grep -rn "'claude', 'codex'" backend/claire --include="*.py" | grep -v migrations   # attendu : vide
```

---

## Étape 8 — Commit

```bash
git add data/preannotations 2>/dev/null || true    # gitignoré : normal qu'il n'ajoute rien
git add backend frontend docs/pactiva-juge-fable
git commit -m "Add Fable as fourth LLM judge"
```

---

## Étape 9 — Prod

**Ordre impératif** — le code d'abord (migration), les données ensuite, l'alignement des
comptes en dernier :

```bash
DJANGO_SECRET_KEY=x ./deploy/deploy-claire.sh      # code + migration imports/0004
./deploy/push-preannotations.sh campagne-pactiva   # rsync data/preannotations + import

# Aligner les comptes EXISTANTS sur le modèle par défaut (dry-run d'abord)
ssh -i ~/.ssh/corolle_deploy root@46.202.128.168 \
  "cd /var/www/claire-studio/backend && DJANGO_SETTINGS_MODULE=config.settings.prod \
   .venv/bin/python manage.py set_default_llm_judge --dry-run"
# puis sans --dry-run
```

Vérifications post-déploiement, **sur le serveur** :

1. `GET /api/v1/projects/campagne-pactiva/gold/llm-annotators` liste `fable`, `documents: 50` ;
2. 50 `PreAnnotation` juge `fable` + 1 728 `PreClause`, les autres juges inchangés ;
3. les 4 juges apparaissent dans `_judge_vectors_for_document` d'un document réel ;
4. `prefill.judge == "fable"` sur les comptes de la campagne ;
5. suite `pytest` exécutée **sur le VPS** (mêmes tests, environnement de prod) ;
6. santé HTTP de `https://pactiva.legal` (200) après redémarrage des services.

---

## Journal d'exécution

| Étape | Statut | Note |
|---|---|---|
| 0 état initial | ✅ | arbre propre hors `docs/` |
| 1 données | ✅ | `OK 50` — 50 fichiers, corpus identique à Claude/Codex |
| 2 backend | ✅ | `Judge.FABLE` + `import_judges()` ; 3 duplications supprimées ; migration `imports/0004` (un seul `AlterField`) |
| 3 frontend | ✅ | `LLM_JUDGES` + `contract.ts` (corrige aussi l'oubli Mistral) |
| 4 import local | ✅ | 50 `PreAnnotation` / **1 728** `PreClause` ; claude+codex **inchangés** ; 2ᵉ passage = 172 `preannotation_unchanged` |
| 5 tests écrits | ✅ | 21 backend (`test_judge_fable.py`) + 12 frontend (`judgeFable.test.tsx`) |
| 6 suites vertes | ✅ | **pytest 470**, **vitest 539** (76 fichiers), `tsc --noEmit` = 0 |
| 7 cohérence | ✅ | aucune liste de juges en dur ; bug latent corrigé dans `import_annotations_archive` |
| 8 commit | ✅ | |
| 9 prod | ✅ | code + données + alignement des comptes, vérifié sur le VPS |

### Preuves de production (2026-08-02, HEAD `76459bc`)

| Vérification | Résultat |
|---|---|
| Pré-annotations par juge | claude **50**, codex **50**, mistral **50**, fable **50** |
| `PreClause` de Fable | **1 728** (= nombre de segments du corpus source) |
| Juges sur un document réel (`Atlas`) | `['claude', 'codex', 'fable', 'mistral']` |
| `gold/llm-annotators` | les 4 juges, `fable` à **50 documents** |
| Alignement des comptes | `fatima.ouali` → `fable` ; `elazhar.jebbari` et `zahra.boulaich` **conservent `claude`** (choix explicite, `asked=true`) |
| Défaut d'un compte neuf | `{enabled: false, asked: false, judge: "fable"}` |
| `pytest` sur le VPS | **450 passed, 20 skipped** (skips = données brutes CLAUDETTE absentes du VPS, préexistant) ; `test_judge_fable.py` **21/21, 0 skip** |
| Santé | api 200, front 200, 3 services `active` |

> ⚠ Deux comptes gardent `claude` **volontairement** : la commande ne touche pas un choix
> exprimé. Pour les basculer aussi : `set_default_llm_judge --force`.

### Effets de bord constatés (et voulus)

- `import_annotations_archive` énumérait `(claude|codex|gemini)` et mappait tout le reste sur
  `other` : une archive `v9_2_session4_fable` aurait été **silencieusement ignorée**. Corrigé
  par dérivation de `Judge` — c'est le garde-fou anti-hardcode qui l'a révélé.
- Sur `Atlas`, l'accord Fable↔Claude est de **98,3 %**, Fable↔Mistral 63,3 %, Codex↔Mistral
  26,7 % : Fable est proche de Claude et ne duplique pas Codex. Signal utile pour l'oracle de
  majorité à 4 juges (à confirmer sur les 50 documents avec `compute_iaa_v9_2_multi.py`).
