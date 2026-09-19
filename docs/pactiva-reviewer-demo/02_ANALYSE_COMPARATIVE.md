# 02 — Analyse comparative : trois approches par bloc, proposition finale

> Méthode : pour la page dans son ensemble puis pour chaque bloc, trois approches (A/B/C), leurs forces et faiblesses au regard de trois critères — **valeur perçue par le reviewer**, **robustesse** (ce qui peut casser un soir de relecture), **coût de réalisation dans le calendrier** — et un choix ✔. La matrice tabulée est dans `02a_options-comparatif.csv`.

## 0. La page dans son ensemble

| | A — Vitrine et téléchargements | B — Page « vérifier le papier » | C — Laboratoire ouvert |
|---|---|---|---|
| Idée | Une page statique : résumé, cartes de téléchargement, liens vers la plateforme | Chaque promesse du papier a sa section ; le classifieur s'essaie en direct ; les chiffres clés sont générés depuis les artefacts | Exposer publiquement le Lab (expériences, runs, comparaisons) et l'atelier en lecture |
| Valeur perçue | correcte : tout est là, rien ne s'exerce | élevée : le reviewer *fait* quelque chose et retrouve les chiffres du papier | élevée mais diffuse ; le reviewer se perd dans un outil interne |
| Robustesse | maximale (statique) | bonne : une seule fonction dynamique (classification), le reste est statique ou lu depuis des fichiers figés | fragile : surfaces internes, états, permissions, données non pseudonymisées |
| Coût | faible | moyen | élevé (audit de chaque surface) |
| Verdict | insuffisant pour la promesse « running instance » | ✔ **retenu** | écarté |

**Retenu : B**, avec un emprunt à A (les téléchargements restent des fichiers statiques, générés par script) et un emprunt à C (deux liens sortants vers les surfaces existantes : projets publics, atelier après connexion).

## 1. Données brutes, gold et juges

| | A — Zip unique | B — Fichiers séparés + lecture en ligne | C — API de requête |
|---|---|---|---|
| Idée | un `thematic-layer-<empreinte>.zip` | zip **et** chaque fichier téléchargeable, avec un aperçu (10 lignes) et le schéma des champs | endpoints filtrables (par document, annotateur, juge) |
| Forces | simple, une empreinte | le reviewer voit le format sans rien télécharger ; pédagogique | puissant |
| Faiblesses | opaque avant téléchargement | quelques ko de plus | coût, surface d'attaque, doublon avec le visualiseur |
| Verdict | | ✔ | écarté |

Les fichiers sont ceux de `data/thematic-layer/` après pseudonymisation, servis depuis `frontend/public/downloads/` (générés par `scripts/build_thematic_layer_release.py`, empreinte et tailles écrites dans un `RELEASE.json` lu par la page).

## 2. Le modèle servi

| | A — Réentraîner sur les 50 contrats | B — Réentraîner sur 33 (conception), servir sur 17 (hold-out) | C — Modèle plus léger (distillé) pour le confort CPU |
|---|---|---|---|
| Idée | un modèle « produit » | la découpe de validation des taxonomies (`taxonomies.json` : designSet / holdout), recette E4.4 inchangée | DistilBERT ou MiniLM |
| Forces | meilleure exactitude attendue | les 17 contrats proposés en essai sont **hors échantillon** ; le reviewer voit un vrai test ; chiffres du hold-out affichés à côté | latence divisée par deux |
| Faiblesses | tout contrat CLAUDETTE proposé serait vu à l'entraînement | légèrement moins de données d'entraînement | s'éloigne du modèle du papier |
| Verdict | écarté | ✔ | écarté |

Où entraîner : en local (CPU i9, 2–4 h) plutôt que sur Grid'5000 (réservation à confirmer par le porteur) ou sur le VPS (partagé avec la production). Les poids (~440 Mo) montent ensuite sur le VPS par rsync.

## 3. Où tourne l'inférence

| | A — Synchrone dans Django | B — Job + sondage, sous-processus `research/.venv` | C — Service résident (modèle chargé une fois) |
|---|---|---|---|
| Forces | trivial | reprend le motif éprouvé du Lab (`LocalBackend`) et de l'export asynchrone ; isole torch du processus web ; respecte les 60 s du proxy | latence minimale |
| Faiblesses | torch dans le processus web, coupure à 60 s | chargement du modèle à chaque job (~5 s) | un service systemd de plus, mémoire résidente permanente sur un VPS partagé |
| Verdict | écarté | ✔ (avec un verrou : un job à la fois) | v2 si l'usage le justifie |

## 4. Entrée du texte

| | A — Coller seulement | B — Coller, `.txt`, ou choisir un contrat hold-out | C — Tout format (PDF, DOCX, URL) |
|---|---|---|---|
| Verdict | trop pauvre | ✔ (décision du porteur ; PDF exclu) | écarté (extraction de texte hasardeuse, licence) |

Garde-fous : 60 000 caractères, 400 phrases, anglais (part de mots-outils anglais ≥ 5 % sur les 2 000 premiers caractères), refus poli et immédiat au-delà.

## 5. Segmentation en phrases

| | A — Règles maison (ponctuation) | B — `pysbd` + paragraphes durs | C — Modèle (spaCy) |
|---|---|---|---|
| Forces | zéro dépendance | déterministe, règles éprouvées (abréviations, numérotations « 4.1 »), 60 ko | robuste |
| Faiblesses | listes et titres mal découpés | dépendance pure Python | 50 Mo de modèle, temps de chargement, écart avec CLAUDETTE |
| Verdict | repli | ✔ | écarté |

CLAUDETTE présente une phrase par ligne : les sauts de ligne sont traités comme des frontières dures, `pysbd` ne coupe qu'à l'intérieur d'une ligne.

## 6. Le visualiseur

| | A — Réutiliser `AnnotationWorkspace` en lecture | B — Composants dédiés, purs, réutilisant la présentation des thèmes | C — Tableau simple |
|---|---|---|---|
| Forces | fidélité maximale à l'atelier | même langage visuel (rail de couleur, chips, frontières, TOC), aucune dépendance aux stores ni à l'authentification, anglais natif | trivial |
| Faiblesses | couplage aux stores, préférences par compte, raccourcis, 40 composants | à écrire (≈ 6 composants) | pauvre, ne montre pas la structure de clause |
| Verdict | écarté | ✔ | écarté |

Éléments repris : `presentTheme`, `presentationTooltip`, `CategoryChip`, `TaxonomyLegend`, `TaxonomySwitch`, `getThemeIcon`, `getThemeToken`, `Panel`, `Button`, `Disclosure`, `Logo`.

## 7. Comparaison avec la référence (contrats CLAUDETTE)

| | A — Modèle seul | B — Modèle vs gold, votes A1–A3, quatre juges, par phrase | C — Tableaux de métriques seulement |
|---|---|---|---|
| Verdict | | ✔ : c'est là que la couche thématique prend sa valeur (désaccords visibles, cascade lisible) | complément (une ligne de résumé : exactitude et κ sur le document) |

## 8. Sécurité et bon usage

| | A — Ouvert sans limite | B — Quotas par adresse + tailles + langue + pas de stockage | C — Code d'accès reviewer |
|---|---|---|---|
| Forces | | proportionné à un usage de relecture ; aucun compte à gérer | contrôle fort |
| Faiblesses | coût CPU non borné | | le papier est déjà déposé avec l'URL nue ; un code ajouterait une friction |
| Verdict | écarté | ✔ | option réversible (paramètre `DEMO_ACCESS_CODE`, vide par défaut) |

## 9. Chiffres clés sur la page

| | A — Retapés dans le composant | B — Générés depuis les artefacts figés | C — Capture du tableau du papier |
|---|---|---|---|
| Verdict | écarté (dérive) | ✔ (`scripts/build_demo_manifest.py` lit `manifest.json`, `results.json`, `taxonomy_matrix.json` → `frontend/public/downloads/RELEASE.json`) | écarté |

## Proposition finale

Une page anglaise en quatre temps, du plus actif au plus documentaire :

1. **Try the classifier** — coller / déposer / choisir un contrat hold-out ; résultat dans un visualiseur à la manière de l'atelier ; pour un contrat CLAUDETTE, colonnes gold, A1–A3, juges, résumé d'exactitude et κ.
2. **What we release** — huit cartes (votes, gold, juges, prompts, taxonomies, codebook, protocole, plateforme), zip et fichiers, empreinte visible, aperçus.
3. **Key figures** — le tableau du papier généré depuis les artefacts, avec « how computed » et lien vers le fichier source.
4. **The platform** — liens vers les projets publics et l'atelier (connexion), source GitHub, citation.

Ce qui augmente la valeur perçue : le reviewer **exécute** le modèle du papier sur un document que le modèle n'a jamais vu et **voit** le désaccord entre humains, juges et modèle sur chaque phrase. Ce qui la protège : tout le reste est figé, généré, vérifié par les tests, et la seule fonction dynamique est bornée.
