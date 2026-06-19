# Les catégories d'injustice CLAUDETTE

CLAUDETTE marque des phrases **potentiellement injustes** dans **8 catégories**, avec
un **niveau de sévérité**. C'est une donnée de **référence** (overlay), distincte de
votre segmentation thématique : une même phrase peut être, par ex., de thème
*Limitation de responsabilité* **et** marquée injuste *LTD niveau 2*.

## Les 8 catégories

| Code | Catégorie | Sens (clause qui…) |
|---|---|---|
| **A** | Arbitration | impose l'**arbitrage** (renonce au tribunal), surtout s'il est hors pays/payant |
| **CH** | Unilateral change | autorise le fournisseur à **modifier unilatéralement** les conditions |
| **CR** | Content removal | permet de **supprimer/bloquer** le contenu de l'utilisateur, parfois sans préavis |
| **J** | Jurisdiction | fixe le **tribunal compétent** (souvent au domicile du fournisseur) |
| **LAW** | Choice of law | impose la **loi applicable** (souvent celle du fournisseur) |
| **LTD** | Limitation of liability | **limite/exclut la responsabilité** du fournisseur |
| **TER** | Unilateral termination | permet une **résiliation unilatérale**, parfois sans motif ni préavis |
| **USE** | Contract by using | répute le contrat **accepté par le simple usage** du service |

## Les niveaux de sévérité

| Niveau | Libellé | Lecture |
|---|---|---|
| 1 | clairement juste / faible | mention présente mais équilibrée |
| 2 | potentiellement injuste | déséquilibre possible, à surveiller |
| 3 | clairement injuste | déséquilibre net en défaveur de l'utilisateur |

L'intensité du surlignage dans l'atelier suit ce niveau.

## Comment l'utiliser pendant l'annotation

- L'overlay **n'impose rien** : il **attire l'attention** sur des zones sensibles, qui
  correspondent souvent à des frontières de clause importantes (résiliation,
  responsabilité, arbitrage…).
- Une concentration de marques *LTD/TER/A* est un bon indice qu'un **bloc-clause
  distinct** s'y trouve.
- Ne confondez pas : la **catégorie CLAUDETTE** = nature *d'injustice* ; votre
  **thème** = nature *thématique* du bloc. Les deux coexistent.

## Correspondances utiles (indicatives)

| Catégorie CLAUDETTE | Thème de segmentation souvent associé |
|---|---|
| A — Arbitration | `ARBITRATION_DISPUTES` |
| J / LAW | `GOVERNING_LAW` |
| LTD | `LIMITATION_LIABILITY`, `WARRANTY_DISCLAIMER` |
| TER | `TERMINATION` |
| CH | `MODIFICATION_OF_TERMS` |
| CR | `USER_CONTENT`, `ACCEPTABLE_USE` |
| USE | `PREAMBLE_SCOPE` |

➡️ Suite : *Nos thèmes de segmentation* (le vocabulaire fermé que vous appliquez).
