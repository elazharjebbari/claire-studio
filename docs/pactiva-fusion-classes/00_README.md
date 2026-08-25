# Fusion de classes & modèle graphe — dossier de décision

> **Question décisionnelle** : faut-il réduire les 20 thèmes de la taxonomie v1 en
> classes plus massives — **en amont du traitement, jamais dans les annotations** —
> pour (a) fiabiliser la ressource du papier court, (b) améliorer l'apprenabilité des
> classifieurs, (c) servir la détection de clauses abusives par graphe ?
>
> **Réponse courte : oui — schéma T11 recommandé** (11 classes), sous réserve de la
> validation expérimentale pré-enregistrée du fascicule 03.

## Le résultat en une figure

Sur l'export prod du 24 août 2026 (50 documents soumis, 15 984 votes,
33 documents multi-annotés — empreinte `f68c4e9e…`), **sans entraîner aucun
modèle**, par simple remapping des votes existants :

| Schéma | Classes | α-MASI [IC 95 %] | Δ apparié vs T20 | Désaccords primaires | AP abusivité (combo, LODO) | Support min |
|---|---|---|---|---|---|---|
| **T20 — statu quo** | 20 | 0,613 [0,567 ; 0,670] | — | 29,7 % | 0,331 | 33 |
| T14 — fiabilité | 14 | 0,653 [0,606 ; 0,715] | +0,040 [0,029 ; 0,054] | 24,9 % | 0,316 | 133 |
| **T11 — fonctionnel stratifié** | 11 | **0,685 [0,638 ; 0,741]** | **+0,072 [0,059 ; 0,086]** | 21,4 % | **0,315** | 218 |
| T10 — fonctionnel | 10 | 0,699 [0,645 ; 0,757] | +0,086 [0,070 ; 0,104] | 20,5 % | 0,290 | 218 |

Lecture : **T11 fait franchir à l'annotation multi-label le seuil d'acceptabilité de
Passonneau (α-MASI ≥ 0,667)** — signe stable sur 100 % des 1 000 tirages bootstrap
appariés par document — en ne sacrifiant que 4,9 % (relatif) du signal d'abusivité,
là où T10 en détruit 12,6 % en fusionnant limitation de responsabilité et exclusion
de garantie (deux classes aux profils CLAUDETTE opposés : P(abusif) 0,385 vs 0,039).

Le principe qui départage les schémas : **fusionner le long des grappes de confusion,
jamais à travers les strates d'abusivité.**

## Les fascicules

| # | Fichier | Contenu | À lire si |
|---|---|---|---|
| 01 | [01_STATS_DONNEES.md](01_STATS_DONNEES.md) | Statistiques factuelles du corpus : supports, déséquilibre, multi-label, confusions inter-annotateurs, fiabilité par thème, lien thème→abusivité CLAUDETTE | vous voulez les faits bruts |
| 02 | [02_ANALYSE_FUSION.md](02_ANALYSE_FUSION.md) | Analyse : critères de fusion, grappes de confusion, définition des schémas T14/T11/T10, effets simulés, tensions et menaces de validité | vous voulez comprendre le raisonnement |
| 03 | [03_PROTOCOLE_VALIDATION.md](03_PROTOCOLE_VALIDATION.md) | Protocole expérimental pré-enregistré : hypothèses H1–H4, implémentation `theme_map` dans le Lab, matrice de runs (local + Grid'5000), règles de décision | vous voulez exécuter la validation |
| 04 | [04_ETAT_DE_L_ART_GRAPHE.md](04_ETAT_DE_L_ART_GRAPHE.md) | État de l'art : détection de clauses abusives, segmentation thématique, graphes de connaissances juridiques, formalisation déontique et requêtes de conformité | vous préparez le papier long |
| 05 | [05_MODELE_GRAPHE.md](05_MODELE_GRAPHE.md) | Notre modèle : texte → segmentation thématique → graphe contractuel typé par T11 + connaissance métier par schéma de clause → requêtes interprétables d'abusivité | vous voulez la proposition scientifique |

Annexe : [`scripts/`](scripts/) — les trois scripts d'analyse (exploration,
simulation, Δ appariés) et leurs résultats JSON, rejouables sur tout export du Lab.

## Ce que la fusion N'est PAS

- **Pas une ré-annotation** : les 20 thèmes restent la vérité stockée en base et dans
  l'atelier. La fusion est un **remapping au chargement du dataset** (axe de
  configuration du runner, comme `label_noise`) — réversible, versionnée, empreinte.
- **Pas un choix esthétique** : chaque fusion est justifiée par trois signaux
  convergents mesurés (confusion inter-annotateurs, fiabilité α par thème, sémantique
  juridique) et contrainte par un garde-fou (compatibilité des profils d'abusivité).
- **Pas encore une décision définitive** : les chiffres ci-dessus sont des effets
  simulés sur les votes (aperçu du 24 août 2026). L'adoption pour les papiers passe
  par le protocole du fascicule 03 (classifieurs entraînés, mêmes plis, tests appariés).

## Liens avec les autres dossiers

- `docs/pactiva-experiences-papiers/` — les 19 expérimentations existantes ; le
  protocole 03 en réutilise 7 (l'axe `theme_map` s'y ajoute).
- `docs/pactiva-anomalies-graphe/` — le dossier définitif du papier long ; les
  fascicules 04–05 en prolongent la partie graphe (hypergraphe, co-occurrence).
- `docs/pactiva-papier-ressource/` — le papier court de mesure ; le fascicule 01
  fournit ses tableaux descriptifs à jour, le 02 son résultat « granularité vs
  fiabilité ».
