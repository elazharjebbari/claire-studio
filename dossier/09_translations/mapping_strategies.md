# Stratégies de mapping fichier ↔ document ↔ phrase

> Périmètre : feature **F8**. Détaille les valeurs de `TranslationSet.mapping_strategy` employées par
> le sync (`translations_filebased.md` §3). Trois stratégies, de la plus simple à la plus précise.
> Toutes préservent l'invariant : l'unité d'annotation reste la **phrase source** (`Sentence.index`).

## Vue d'ensemble

| Stratégie | Apparie document via | Aligne phrase via | Granularité | Robustesse |
|---|---|---|---|---|
| `by_filename` | nom de fichier | (aucune / 1 doc = 1 texte) | document | haute |
| `by_line_index` | nom de fichier | n° de ligne == `Sentence.index` | phrase | moyenne (fragile au décalage) |
| `by_sentence_id` | nom de fichier ou clé | id de phrase explicite dans le fichier | phrase | très haute |

## 1. `by_filename` — appariement document, traduction au niveau document

Le dossier contient **un fichier par document**, dont le nom (sans extension) correspond à
`Document.external_id`.

```
<folder_path>/fr/Fitbit.txt        → Document.external_id == "Fitbit"
<folder_path>/fr/Spotify.txt       → Document.external_id == "Spotify"
```

- Règle d'appariement : `stem(filename) == Document.external_id` (insensible à la casse configurable
  `case_insensitive`, normalisation Unicode NFC). Collision (deux fichiers même stem) ⇒ `error`.
- Le **contenu entier** du fichier devient **une** `Translation` au niveau document
  (`sentence = null`). Affichage en regard global, pas ligne à ligne.
- Usage : traductions « bloc » (résumé traduit, ou source non tokenisée côté traduction).
- Avantage : aucune dépendance à l'alignement ligne à ligne ⇒ insensible aux décalages de phrases.

## 2. `by_line_index` — alignement positionnel ligne ↔ phrase

Un fichier par document (appariement comme §1), **une ligne par phrase**, dans le **même ordre** que
`Sentences/<Doc>.txt`. La ligne `i` du fichier de traduction est la traduction de la phrase d'index
`i`.

```
ligne 0  →  Sentence.index == 0
ligne 1  →  Sentence.index == 1
...
ligne N-1 → Sentence.index == N-1
```

- Crée une `Translation(sentence=Sentence[i], text=ligne[i], sentence=… )` par ligne.
- **Pré-requis strict** : `nombre de lignes == Document.n_sentences`. Sinon, selon `strict_length` :
  rejet du document (`mismatch`) ou alignement partiel jusqu'au min, reste signalé. Cette stratégie
  est la plus fragile : tout ajout/suppression de ligne décale tout l'alignement → on recommande
  `strict_length=true`.
- Lignes vides : tolérées (traduction manquante pour cette phrase), `provenance.note="empty_line"`.
- Usage : sortie de pipeline qui garantit la correspondance 1 ligne ↔ 1 phrase (cas le plus courant
  pour CLAUDETTE, où le source est déjà 1 phrase/ligne).

## 3. `by_sentence_id` — alignement par identifiant explicite (le plus sûr)

Le fichier porte un **identifiant de phrase explicite** par segment ; l'ordre et le nombre de lignes
n'importent plus. Deux conteneurs supportés :

### JSONL (recommandé)
```json
{"sentence_index": 0, "text": "nous avons recemment revise ces conditions"}
{"sentence_index": 6, "text": "fitbit concoit des produits"}
```
### TSV
```
sentence_index	text
0	nous avons recemment revise ces conditions
6	fitbit concoit des produits
```

- Appariement document : par nom de fichier (§1) **ou** par champ `document_external_id` en tête du
  fichier (mode `embedded_doc`).
- Alignement phrase : `sentence_index` ∈ `[0, n_sentences)`. Hors borne ⇒ segment ignoré, signalé
  `out_of_range`. Index dupliqué ⇒ premier conservé, doublon signalé.
- Tolère un sous-ensemble (traduction partielle) sans casser l'alignement : c'est la stratégie à
  privilégier dès que la traduction n'est pas garantie ligne à ligne, ou multi-langue partielle.
- Usage : pipelines modernes, traductions partielles, corrections ponctuelles.

## 4. Choix de la stratégie

Arbre de décision (mis dans `Project`/admin au moment de déclarer le set) :

1. La traduction est-elle alignée phrase à phrase ? **Non** → `by_filename`.
2. **Oui**, et le fichier porte-t-il des identifiants de phrase explicites ? **Oui** →
   `by_sentence_id` (préféré, robuste). **Non**, mais 1 ligne ↔ 1 phrase garanti → `by_line_index`.

Défaut recommandé pour CLAUDETTE : `by_line_index` avec `strict_length=true` (le source est déjà
1 phrase/ligne), avec migration vers `by_sentence_id` si le pipeline ajoute des ids.

## 5. Invariants communs

- L'`anchor_index` d'une clause et tous les spans référencent **toujours** la phrase source ; la
  stratégie de mapping n'affecte que la **couche d'affichage** traduction.
- Normalisation des noms : NFC + trim + (option) casse. Pas de path-traversal (validation du dossier
  en amont, `12_security/security.md`).
- `provenance` de chaque `Translation` consigne : `strategy`, `source_file` (relatif), `line`/`id`,
  `checksum` — pour audit et re-sync.

## 6. Tests (CONTRACT §6)

- `pytest mapping_by_filename` : appariement stem, collision → error, traduction document.
- `pytest mapping_by_line_index` : alignement positionnel, `strict_length`, lignes vides.
- `pytest mapping_by_sentence_id` : JSONL & TSV, `out_of_range`, doublons, sous-ensemble partiel.
