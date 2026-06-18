# Traductions (file-based, feature F8)

`TRANSLATIONS_ROOT` = ce dossier (`claire-studio/data/translations`).

Chaque **jeu de traduction** est un sous-dossier (ex. `claudette_fr/`) déclaré comme
`TranslationSet` (langue cible + stratégie de mapping). La synchronisation lit les fichiers
`<external_id>.txt` et les aligne sur le document du corpus.

Stratégies :
- `by_external_id` (défaut) : `<external_id>.txt`, **une ligne par phrase** (même index que
  `claudette_tos/Sentences/<external_id>.txt`). Crée des traductions au niveau phrase.
- `document` : `<external_id>.txt` = traduction du document entier (un seul bloc).

`external_id` = nom du fichier Sentences (ex. `Fitbit`, `Spotify`).

Pour ajouter une langue : créer un dossier (`claudette_de/`), y déposer les fichiers
`<external_id>.txt`, puis déclarer le set dans l'app (Admin → Traductions) et lancer la sync.

> L'échantillon `claudette_fr/` contient des placeholders `[FR] …` pour 4 documents,
> à des fins de démonstration de la chaîne de mapping. Remplacer par de vraies traductions.
