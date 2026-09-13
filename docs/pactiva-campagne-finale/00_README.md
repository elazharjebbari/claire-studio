# Campagne expérimentale finale — dossier technique

> **14 expériences, 4 questions de recherche, une enveloppe standardisée, des portes de
> contrôle automatiques.** Exécutée le 13 septembre 2026 sur le dataset `7116e627…`
> (50 documents, 9 414 phrases, 150 annotations, GOLD complet à 9 414 décisions).
>
> Résultat de la campagne : **10 expériences validées, 4 préliminaires** — et les quatre
> sont bloquées par **une seule et même porte** : le GOLD n'est pas figé.

## Le fait qui conditionne tout

Les 462 arbitrages manuels **ont été faits** : le gold est complet (9 414 phrases décidées,
dont 462 décisions humaines, 0 en attente). Mais **aucune des 50 résolutions n'est
finalisée**, donc le gold reste modifiable — et un chiffre qui en dépend peut encore
changer. Les portes le détectent et refusent le statut « validé » aux quatre expériences
concernées (E1.4, E2.1, E2.3, E3.3).

**Finaliser les 50 résolutions les fait basculer en « validé » sans rien recalculer d'autre.**

## Les fascicules

| # | Fichier | Contenu |
|---|---|---|
| 01 | [01_ARCHITECTURE.md](01_ARCHITECTURE.md) | Diagnostic AS-IS, architecture expérimentale, modèle de données des résultats, versionnement, portes de contrôle, stratégie de reproductibilité |
| 02 | [02_RESULTATS.md](02_RESULTATS.md) | Les résultats par question de recherche, avec leur statut et ce qu'ils établissent |
| 03 | [03_RUNBOOK.md](03_RUNBOOK.md) | Runbook exécutable, liste des expériences et dépendances, critères d'acceptation, rollback |

Artefacts : [`frontend/src/features/paper/campaign.json`](../../frontend/src/features/paper/campaign.json)
(les 14 enveloppes, source unique de la vue) et la vue
**Résultats de l'article** (`/projects/<slug>/paper`).

## Ce qui a été livré

- **Une enveloppe standardisée** par expérience : résumé, question, hypothèse, protocole,
  données, configuration, métriques avec IC, résultats, incertitude, interprétation,
  limites, artefacts, contrôles, statut et **provenance complète**.
- **Des portes de contrôle automatiques** qui DÉDUISENT le statut : gold figé, gold
  complet, dataset figé, corpus non partiel, découpe au niveau document, absence de fuite,
  mappings de taxonomie figés, graine enregistrée, version du code enregistrée, population
  constante pour les comparaisons.
- **Une vue « Résultats pour l'article »** : navigation par question de recherche, filtres
  (taxonomie, mode citable), tableaux avec IC 95 %, badges de statut, ce-qui-bloque nommé,
  drill-down (détail par classe, matrice d'accord, erreurs représentatives), provenance
  dépliable, et export **CSV / JSON / LaTeX** (tableaux, tableau de synthèse par question,
  et macros `\newcommand` pour les valeurs citées en ligne).
- **Trois nouvelles mesures** qui manquaient : la référence humaine en leave-one-annotator-out,
  le benchmark des quatre juges contre le GOLD, et l'analyse d'erreurs par classe d'accord.

## Les quatre résultats qui portent l'article

1. **Le plafond humain est mesuré** : 0,871 d'exactitude, κ 0,859 (leave-one-annotator-out).
   Tout le reste se lit par rapport à cette borne.
2. **T20 n'atteint pas le seuil d'acceptabilité, T11 si** — et le gain se reproduit sur les
   17 documents de validation (+0,069 contre +0,066 en conception).
3. **Les modèles de langue sont loin** : meilleur juge à 0,601 d'exactitude contre le GOLD,
   quand un humain atteint 0,871. Les LLM s'accordent plus entre eux (jusqu'à 0,800) qu'avec
   les humains (au mieux 0,594) : c'est un écart de convention, pas seulement de performance.
4. **Les erreurs des modèles ne sont pas arbitraires** : 26,8 % d'erreur là où les
   annotateurs sont unanimes contre 66,9 % là où ils divergent. Une partie de ces « erreurs »
   sont des désaccords légitimes.

## Ce qui n'est PAS dans cette campagne

Les modèles GPU (Legal-BERT fine-tuné, encodeurs comparés, frontières en étiquetage de
séquence) ne sont pas inclus : RQ4 ne contient que des planchers CPU. Le chemin est prêt
(le runner accepte `data.taxonomy`), mais ces runs demandent Grid'5000 et n'ont pas été
lancés ici. Ils sont déclarés comme tels dans le fascicule 03.
