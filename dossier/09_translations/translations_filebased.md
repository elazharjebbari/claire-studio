# Traductions file-based

> Périmètre : feature **F8** (traductions file-based). Entités : `TranslationSet`, `Translation`.
> Endpoints : `GET /api/v1/projects/{slug}/translations`, `POST /api/v1/translations/sets`,
> `POST /api/v1/translations/sets/{id}/sync`. Surface : `/admin/translations` + overlay langue dans
> le workspace. Module Django `translations`.

## 1. Principe : pointer un dossier, ne pas dupliquer le texte source

CLAIRE est DB-centrique avec **exports/sources fichiers**. Pour les traductions, la vérité reste **un
dossier sur disque** (typiquement la sortie d'un pipeline de traduction, cohérent avec l'`auto_pull`
des pré-annotations). Un `TranslationSet` est un **pointeur** vers ce dossier ; le `sync` lit les
fichiers et matérialise des `Translation` alignées aux phrases du corpus.

```
TranslationSet(PK id, *FK corpus, *name, *target_language, *folder_path, mapping_strategy, status)
Translation(PK id, *FK translation_set, *FK document, FK sentence?, *text, provenance)
```

- Un `TranslationSet` est attaché à un **`Corpus`** (pas à un projet) : la traduction d'un corpus est
  réutilisable par tous les projets qui l'emploient (réutilisabilité, feature 11).
- `target_language` : code BCP-47 (`fr`, `es`, `de`, `it` — les 4 langues CLAUDETTE potentielles).
- Plusieurs `TranslationSet` par corpus = **plusieurs langues** et/ou plusieurs provenances
  (ex. `fr-human`, `fr-deepl`).
- `Translation.sentence` est **optionnel** : si renseigné, la traduction est alignée à la phrase
  (granularité phrase, idéal pour l'overlay) ; sinon elle est au niveau document (granularité
  document, fallback). Les stratégies d'alignement sont détaillées dans `mapping_strategies.md`.

## 2. Déclaration & exemple de config

`POST /api/v1/translations/sets` déclare le pointeur ; la config type est dans
`translations_config.example.yaml`. Champs clés :

- `corpus` (slug), `name`, `target_language`, `folder_path`, `mapping_strategy`
  (`by_filename | by_line_index | by_sentence_id`, voir `mapping_strategies.md`),
- options de robustesse : `encoding` (défaut `utf-8`), `strict_length` (rejeter si le nombre de lignes
  diffère du nombre de phrases), `on_conflict` (`skip | replace | fail`).

`folder_path` est **validé** : doit être sous une racine autorisée
(`settings.TRANSLATIONS_ROOT`), pas de `..`, pas de lien symbolique sortant (anti path-traversal,
cf. `12_security/security.md`). Le chemin est stocké **relatif** à la racine.

## 3. Sync : du dossier aux Translation

`POST /api/v1/translations/sets/{id}/sync` lance un sync (asynchrone, idempotent) :

1. **Résolution des fichiers** selon `mapping_strategy` → liste `(Document, [lignes/segments])`.
2. **Validation** par document :
   - `strict_length=true` ⇒ nombre de lignes == `Document.n_sentences` (sinon `LengthMismatchError`,
     document marqué `mismatch`, sync continue sur les autres — pas d'état partiel par document) ;
   - encodage décodable ; lignes non vides (ligne vide tolérée mais signalée).
3. **Écriture transactionnelle par document** : upsert des `Translation` (clé `(translation_set,
   document, sentence)`), `provenance` renseignée (chemin fichier, ligne, stratégie, checksum source).
4. **Idempotence** : checksum par fichier ; fichier inchangé ⇒ skip. Re-sync après édition du dossier
   ⇒ mise à jour selon `on_conflict`.
5. **Statut** du set : `synced | partial (mismatch sur certains docs) | error`. Émet
   `ActivityEvent verb=translation.synced payload={set, language, docs_synced, docs_mismatch}`.

Le sync **ne modifie jamais** le corpus source (`Sentence.raw_text`) : les traductions sont une
**couche d'affichage**, pas une réécriture du document annoté.

## 4. Multi-langues & overlay

- L'utilisateur choisit une langue d'**overlay** dans le workspace (navigation.md §3, overlay langue).
  Le centre-écran reste le texte source annoté (les `anchor_index` portent sur les phrases sources,
  invariant d'alignement) ; la traduction s'affiche en **regard** (ligne par ligne) ou en survol.
- L'annotation se fait **toujours** sur le document source : les frontières de clause, thèmes et spans
  référencent les `Sentence` sources, jamais les traductions. La traduction aide la compréhension,
  elle ne déplace pas l'unité d'annotation. Cela garantit qu'un même gold reste comparable quelle que
  soit la langue d'aide affichée (cohérence IAA, exports).
- `GET /projects/{slug}/translations` liste les sets disponibles pour le corpus du projet (langues +
  statut), pour peupler le sélecteur d'overlay.

## 5. Conflits & cas limites

| Cas | Comportement |
|---|---|
| Fichier traduction plus court/long que le doc | `strict_length` → `mismatch` (doc ignoré, signalé) ; sinon alignement partiel jusqu'au min, reste signalé |
| Document source absent du dossier | aucune `Translation` ; signalé `missing_source` (info, non bloquant) |
| Fichier traduction sans document correspondant | ignoré ; signalé `orphan_file` |
| Ré-import du corpus source (n_sentences change) | `TranslationSet` marqué `stale` ; re-sync requis (l'alignement par index devient invalide) |
| Encodage illisible | document `error`, sync continue |

## 6. Tests (CONTRACT §6)

- `pytest translation_sync` : upsert idempotent ; `mismatch` isole le document fautif ; `orphan_file`
  et `missing_source` signalés ; `stale` après ré-import source.
- `pytest translation_pathsafety` : `folder_path` hors racine / `..` / symlink rejetés.
- `e2e translations.spec` : déclaration d'un set, sync, sélecteur d'overlay, affichage en regard,
  annotation toujours ancrée sur le source.
