# Plan — Campagne de traduction française (phrase par phrase)

## 1. Audit (constat)

Le jeu de traduction `claudette_fr` synchronisé en prod **n'est pas du français** : ce sont
les phrases **anglaises** sources, préfixées de `[FR] ` (stub de test).

- Analyse lexicale sur les 50 fichiers : **93 661 marqueurs anglais** vs **2 483 français**
  (≈ 97 % anglais).
- Exemple (`Dropbox.txt`, l. 3) :
  `[FR] these terms of service -lrb- `` terms '' -rrb- cover your use ...`
- Donc la « traduction FR » affichée en prod (50 docs, 9 414 lignes) est **factice** et
  trompeuse pour les annotateurs.

➡️ Il faut produire une **vraie** traduction française, **phrase par phrase**, alignée.

## 2. Volume & format

- **50 documents**, **9 414 phrases** (médiane 158 ; min Atlas 60 ; max Microsoft 548).
- Source = anglais **tokenisé Penn Treebank** + minuscules : `-lrb-`→`(`, `-rrb-`→`)`,
  ` `` `/`'' `→`"`, ponctuation espacée, pas de capitales. **Mauvais tel quel pour la MT**
  → étape de **détokenisation/nettoyage** obligatoire avant traduction.

## 3. Contrainte d'intégration (mécanisme existant)

La feature traduction est **file-based** (`claire.translations`) :
`data/translations/claudette_fr/<external_id>.txt`, **une ligne FR par phrase source**
(même nombre, même ordre), puis `manage.py sync_translations --lang fr`.

**Invariant critique** : `nb_lignes(FR) == nb_phrases(source)` pour chaque document
(sinon le mapping phrase↔traduction casse). Jamais fusionner/supprimer de ligne.

## 4. Approche retenue : MT + revue humaine (human-in-the-loop)

Une « vraie campagne » = **pré-traduction automatique de qualité** puis **revue/correction
humaine**, cohérent avec l'éthos « l'humain décide » de la plateforme.

### 4.1 Moteur de traduction (décision à prendre)
| Option | Qualité EN→FR juridique | Souveraineté | Coût | Prérequis |
|---|---|---|---|---|
| **LLM API (Claude/GPT) + glossaire** *(recommandé ici)* | Très bonne, terminologie pilotable | externe | ~faible | clé API |
| DeepL API | Excellente | externe | ~faible (au caractère) | clé API |
| Mistral / EuroLLM **local** (vision Pactiva) | Bonne | **totale (on-prem)** | infra | GPU/serveur |

> CLAUDETTE = **données publiques** (ToS scrappés) → l'égress externe n'est pas sensible
> *pour ce corpus*. Pour de **vrais contrats clients**, basculer sur le **modèle local
> souverain** (c'est précisément l'argument produit de Pactiva).

### 4.2 Glossaire juridique (cohérence terminologique)
Imposé au moteur : *Terms of Service* → « Conditions d'utilisation » ; *Privacy Policy* →
« Politique de confidentialité » ; *you agree* → « vous acceptez » ; *we may* → « nous
pouvons » ; *Service(s)* → « Service(s) » ; etc. (table versionnée, étoffée au fil de la revue).

## 5. Pipeline (script `translate_corpus`)

1. **Lire** les phrases d'un document depuis la base (ordre par `index`).
2. **Détokeniser** (Penn Treebank → anglais propre : parenthèses, guillemets, ponctuation,
   capitales en début de phrase / sigles).
3. **Traduire** chaque phrase EN→FR via le moteur choisi + glossaire (par lots, avec
   contexte du document pour la cohérence).
4. **Écrire** `data/translations/claudette_fr/<id>.txt` — **1 ligne FR / phrase**.
5. **QA automatique** : assert `nb_lignes == nb_phrases` ; détecter lignes vides, ratio de
   longueur aberrant, segments non traduits (restés EN) ; échantillon de **rétro-traduction**.
6. `sync_translations --lang fr` → chargement en base (provenance `mt:<moteur>`).
7. **Revue humaine in-platform** : les annotateurs valident/corrigent (provenance `human`).

## 6. Phasage

- **P0 — Nettoyage** : retirer le stub trompeur (supprimer le `TranslationSet claudette_fr`
  factice + ses 9 414 lignes) pour ne pas afficher d'anglais-déguisé-en-français.
- **P1 — Pilote** : 2 docs courts (Atlas 60, Moves-app 75) → valider qualité, glossaire,
  alignement, rendu dans l'atelier. ~135 phrases.
- **P2 — Masse** : traduire les 50 docs (9 414 phrases) avec le moteur validé.
- **P3 — Revue** : campagne de relecture humaine (assigner la revue, suivre le % validé).
- **P4 — Multilingue** (option) : étendre à l'allemand, etc. (même pipeline, dossier
  `claudette_de`, langue cible `de`).

## 7. Effort & coût (ordre de grandeur)
- MT : 9 414 phrases ≈ **~1,5 M caractères** → quelques € (DeepL) ou ~équivalent (LLM API).
- Détok + script + QA : ~½ j.
- Revue humaine : le vrai poste de charge (≈ 9 400 phrases à relire — répartir sur l'équipe).

## 8. Gouvernance qualité
- Invariant d'alignement vérifié par doc (bloquant).
- Glossaire versionné ; provenance par traduction (`mt:*` vs `human`).
- Traçabilité : le script journalise par doc (phrases, créées, anomalies).
- Réversible : tout passe par les fichiers + `sync` (rejouable).

## 9. Decision requise pour lancer
1. **Moteur** : LLM API (recommandé) / DeepL / modèle local souverain ?
2. **Accès** : clé API disponible, ou dois-je préparer le pipeline pour un moteur précis ?
3. **Nettoyage P0** : je supprime le stub FR factice maintenant ? (recommandé)

Dès cette décision, je livre le script `translate_corpus`, je lance le **pilote (P1)**,
puis la **masse (P2)** après validation.
