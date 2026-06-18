# Import CLAUDETTE (loader corpus par défaut)

> Périmètre : feature **F12** (intégration & affichage CLAUDETTE par défaut). Cible :
> `Corpus`, `Document`, `Sentence`, `ReferenceLabel`. Endpoint admin : `/admin/corpora` ;
> module Django `corpora` (avec helpers `imports`). Données : archive XML/texte CLAUDETTE ToS.

## 1. Source de données

Le corpus CLAUDETTE ToS fournit, par document (= un service en ligne, ex. `Fitbit`) :

```
Sentences/<Doc>.txt        # 1 phrase tokenisée par ligne (texte « brut » tokenisé)
Labels_<CAT>/<Doc>.txt     # 1 ligne par phrase, niveau d'injustice 0..3 pour la catégorie <CAT>
                           # CAT ∈ {A, CH, CR, J, LAW, LTD, TER, USE}
```

- Alignement **strict ligne à ligne** entre `Sentences/<Doc>.txt` et chaque `Labels_<CAT>/<Doc>.txt` :
  la ligne `i` du fichier Sentences est la phrase d'index `i`, et la ligne `i` de chaque
  `Labels_<CAT>` est le niveau d'injustice de cette phrase pour `CAT`.
- Niveau `0` = catégorie non applicable à la phrase ⇒ **aucun** `ReferenceLabel` créé. Niveaux
  `1/2/3` ⇒ un `ReferenceLabel(category=CAT, level=L)` (vocab CONTRACT §5, `vocabulary.yaml`).
- Une phrase peut porter **plusieurs** `ReferenceLabel` (plusieurs catégories injustes simultanées).

## 2. Mapping vers le modèle

| Source | Cible | Règle |
|---|---|---|
| nom du jeu (`CLAUDETTE-ToS`) | `Corpus(slug, name, source_url, license, default_language='en')` | créé une fois |
| `<Doc>` (nom de fichier sans ext.) | `Document(external_id=<Doc>, title=<Doc>, language='en')` | un par fichier Sentences |
| chaque ligne de `Sentences/<Doc>.txt` | `Sentence(index=i, raw_text=<ligne tokenisée>, clean_text=<détokenisé>)` | `index` 0..N-1 contigu |
| ligne `i` de `Labels_<CAT>` avec niveau ∈ {1,2,3} | `ReferenceLabel(sentence, category=CAT, level)` | source=`claudette` |

- `raw_text` = ligne brute tokenisée (préserve la forme native, utile pour l'overlay et la
  reproductibilité). `clean_text` = version détokenisée lisible (règles de détokenisation
  déterministes : recoller la ponctuation, apostrophes, parenthèses), utilisée pour l'affichage
  centre-écran (workspace, navigation.md §3).
- `Document.n_sentences` = nombre de lignes ; `Document.checksum` = SHA-256 du fichier Sentences pour
  détecter les ré-imports divergents.
- `source_meta` conserve les chemins relatifs sources et la liste des catégories présentes pour
  audit/reproductibilité.

## 3. Algorithme du loader (idempotent)

1. **Découverte** : lister les `<Doc>` à partir de `Sentences/*.txt` ; pour chaque, repérer les
   `Labels_<CAT>/<Doc>.txt` disponibles.
2. **Validation pré-import** (échec = abandon document, jamais d'état partiel) :
   - tous les `Labels_<CAT>/<Doc>.txt` présents ont **exactement** le même nombre de lignes que
     `Sentences/<Doc>.txt` (sinon `LengthMismatchError`, document rejeté, raison journalisée) ;
   - niveaux ∈ {0,1,2,3} uniquement (sinon `InvalidLevelError`) ;
   - `CAT` ∈ vocabulaire fermé (sinon `UnknownCategoryError`).
3. **Écriture transactionnelle par document** : `Document` + `Sentence` (bulk) + `ReferenceLabel`
   (bulk) dans **une** transaction. Invariant CONTRACT §2 vérifié : `index` unique et contigu.
4. **Idempotence** : `(corpus, external_id)` unique. Ré-import du même `<Doc>` :
   - checksum identique ⇒ no-op (journalisé) ;
   - checksum différent ⇒ stratégie `Project.settings`/option CLI `--on-conflict={skip|replace|fail}`,
     défaut `fail` pour ne jamais écraser silencieusement un corpus déjà annoté.
5. **Garde-fou annotation** : si des `Annotation` référencent déjà ce document, `replace` est refusé
   (409) — on ne casse pas des frontières existantes. Migration de corpus = nouveau `Corpus`/version.
6. Émet `ActivityEvent verb=… ` (import corpus journalisé côté `/admin/audit`).

## 4. Détokenisation (clean_text)

Règles déterministes, testées, pour passer du tokenisé CLAUDETTE à un texte lisible :

- recoller la ponctuation collante (`,` `.` `;` `:` `?` `!` `)` `]`) au token précédent ;
- recoller `(` `[` au token suivant ;
- gérer les contractions anglaises (`do n't` → `don't`, `it 's` → `it's`) ;
- normaliser les espaces multiples.

`raw_text` reste la **vérité d'alignement** (les `char_start/char_end` éventuels et l'overlay
injustice s'appuient sur l'index de phrase, pas sur `clean_text`).

## 5. Affichage par défaut (F12)

Une fois importé, le corpus est immédiatement utilisable :

- `GET /api/v1/documents/{id}?include=reference_labels` renvoie phrases + labels d'injustice.
- Dans le workspace, l'overlay « injustice CLAUDETTE » (navigation.md §3, togglable) surligne les
  phrases portant un `ReferenceLabel`, couleur par catégorie et intensité par niveau
  (`vocabulary.yaml` `unfairness_levels.intensity`). Info-bulle = catégorie + niveau.
- L'overlay est **lecture seule** : il n'impose aucun thème, il aide à repérer les zones sensibles.

## 6. Tests (CONTRACT §6)

- `pytest claudette_loader` : alignement ligne à ligne ; multi-label par phrase ; niveau 0 → pas de
  label ; `LengthMismatchError` rejette le document ; idempotence checksum ; refus `replace` si
  annotations existantes.
- `pytest detokenize` : table de cas (contractions, ponctuation, parenthèses).
- `e2e unfairness-overlay.spec` : toggle overlay, couleurs/intensités, info-bulles correctes.
