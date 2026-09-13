# Taxonomies T20 / T14 / T11 / T10 — dossier technique et résultats

> **Principe fondateur : T20 est la source canonique.** C'est la taxonomie annotée par les
> trois annotateurs, stockée en base et transmise sur le fil. T14, T11 et T10 ne sont
> **jamais des données** : ce sont des projections déterministes, appliquées à l'affichage
> dans l'interface et au chargement dans les expérimentations. Aucune annotation, aucune
> décision gold n'est réécrite, dupliquée ou altérée.

## Le résultat principal

**T11 fait franchir à la ressource le seuil d'acceptabilité de Passonneau (α-MASI ≥ 0,667),
et ce gain se reproduit sur les 17 documents qui n'ont pas servi à concevoir les fusions.**

| Population | T20 | **T11** | Δ apparié [IC 95 %] | Signe stable |
|---|---|---|---|---|
| Corpus complet (50 doc.) | 0,658 ✗ | **0,725 ✓** | +0,0669 [0,0585 ; 0,0772] | 100 % |
| Conception (33 doc.) | 0,654 ✗ | **0,719 ✓** | +0,0657 [0,0548 ; 0,0785] | 100 % |
| **Validation (17 doc.)** | 0,663 ✗ | **0,732 ✓** | **+0,0687 [0,0542 ; 0,0846]** | 100 % |

Le gain mesuré hors des données de conception (+0,0687) est **au moins aussi élevé** que
sur les données de conception (+0,0657) : aucun surajustement décelable. T20 n'atteint le
seuil sur aucune des trois populations.

## Les fascicules

| # | Fichier | Contenu |
|---|---|---|
| 01 | [01_ARCHITECTURE.md](01_ARCHITECTURE.md) | Diagnostic AS-IS, architecture cible, modèle de données et versionnement, stratégie de mapping, conventions de nommage, modifications backend/frontend/Lab |
| 02 | [02_RESULTATS.md](02_RESULTATS.md) | Les tableaux publiables : les 12 cellules (4 taxonomies × 3 populations) sur annotations brutes, consensus et gold |
| 03 | [03_RUNBOOK.md](03_RUNBOOK.md) | Runbook exécutable par lots, tests, critères d'acceptation, rollback |

Artefacts : [`resultats/taxonomy_matrix.json`](resultats/taxonomy_matrix.json) (sortie
complète, traçable), et la spécification figée
[`frontend/src/lib/taxonomy/taxonomies.json`](../../frontend/src/lib/taxonomy/taxonomies.json).

## Ce qui a été livré

- **Une spécification unique et versionnée** des quatre taxonomies, lue à l'identique par
  TypeScript et par Python — sur le modèle des cas d'or du moteur gold, le précédent du
  projet pour un fichier partagé entre les deux langages. Parité testée des deux côtés.
- **Des noms juridiquement explicites** : chaque classe fusionnée porte un libellé, une
  description de ce qu'elle couvre, la liste de ses thèmes T20, et la justification
  **mesurée** de la fusion.
- **Un sélecteur de taxonomie dans l'atelier** : les libellés, couleurs, glyphes,
  pastilles, légendes et compteurs suivent la taxonomie choisie ; la décision, elle, reste
  écrite en T20 (un bandeau le dit explicitement).
- **Un axe expérimental** `data.taxonomy` et `data.population` dans le Lab : la projection
  se fait au chargement, les plis ne bougent pas, donc toute comparaison inter-taxonomies
  est **appariée par construction**.
- **Une partition figée** conception (33) / validation (17), avec une note d'honnêteté sur
  ce à quoi le hold-out est aveugle — et la vérification que les critères contaminés
  auraient donné la même décision.

## Les trois pièges traités explicitement

1. **Un secondaire absorbé par son primaire.** Après fusion, `USER_CONTENT` et
   `LICENSE_IP` tombent dans la même classe : si le secondaire survivait, la cardinalité et
   α-MASI seraient artificiellement gonflés. Il disparaît (testé des deux côtés).
2. **Les frontières recalculées.** Le drapeau de frontière du dataset a été calculé sur les
   jeux T20 ; après fusion, deux phrases voisines peuvent porter le même jeu. Conserver le
   drapeau mesurerait une segmentation qui n'existe plus dans cette taxonomie.
3. **Le chemin d'écriture jamais projeté.** Un code de macro-catégorie ne doit jamais
   redescendre en base. L'annotation et l'arbitrage s'écrivent toujours en T20.
