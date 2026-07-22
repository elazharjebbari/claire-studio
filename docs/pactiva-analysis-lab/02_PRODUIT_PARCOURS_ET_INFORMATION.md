# Produit, parcours et architecture de l’information

## 1. Promesse

« Comprendre la qualité d’une campagne, expliquer les écarts et agir sur les cas qui comptent. »
L’interface ne parle pas d’abord de métriques, mais de questions : _La couverture est-elle
suffisante ? Où les humains divergent-ils ? Sur quels thèmes le modèle est-il instable ? Pourquoi
ce document n’est-il pas prêt pour le Gold ?_

## 2. Personas et droits attendus

| Persona       | Besoin                                    | Vue par défaut       | Limite                              |
| ------------- | ----------------------------------------- | -------------------- | ----------------------------------- |
| Annotateur    | comprendre son travail et revoir ses cas  | individuel personnel | pas de classement des pairs         |
| Reviewer/Lead | détecter ambiguïtés et organiser la revue | fiabilité/désaccords | identités pseudonymisées par défaut |
| Chercheur     | reproduire une analyse et exporter        | mode expert/rapports | accès textuel selon habilitation    |
| Admin/Owner   | configurer, figer, recalculer             | overview/qualité     | actions sensibles auditables        |

## 3. Navigation cible

Dans le groupe « Corpus & projets », ajouter pour le projet courant :

```text
Documents
Analyse & qualité
Résolution GOLD
Mes projets
```

La route `/projects/[slug]/analysis` héberge une sous-navigation : Vue d’ensemble, Qualité, Atlas,
Individuel, Fiabilité, Désaccords, Taxonomie, Humains–IA, Gold, Rapports. Les sections sont des
routes partageables (`/analysis/reliability`, par exemple), pas des onglets conservés uniquement en
mémoire.

## 4. Barre de contexte

Toujours visible sous les breadcrumbs : run/freeze, mode, unité, acteurs, statuts, documents,
période, schéma, référence Gold. Les filtres principaux vivent dans l’URL. Les contrôles non
pertinents au mode sont absents du DOM. Un résumé textuel du périmètre reste visible :

> 18 documents · 2 annotateurs · 4 820 phrases · annotations soumises · schéma v3

## 5. Flux principal

1. Choisir la question ou le module.
2. Configurer le mode et les acteurs.
3. Résoudre le périmètre et afficher son support prévisionnel.
4. Réutiliser un run valide ou lancer un calcul.
5. Lire les KPI, l’interprétation puis la visualisation.
6. Descendre vers la table et les cas explicatifs.
7. Ouvrir le contexte contractuel sans perdre les filtres.
8. Ajouter à la revue, ouvrir le Gold, proposer une clarification ou composer un rapport.

## 6. Structure d’une page

```text
Question + état du run + actions
Barre de contexte globale
Guide repliable « Comprendre cette analyse »
KPI (maximum 4, support toujours visible)
Visualisation principale + interprétation
Table accessible et paginée
Drill-down / cas sources
Méthodologie et avertissements
```

## 7. États fonctionnels obligatoires

- **vide** : aucun objet dans le périmètre, avec action de correction ;
- **insuffisant** : données présentes mais support sous le seuil ;
- **partiel** : certaines sources ou versions manquent ;
- **stale** : les sources ont changé depuis le fingerprint ;
- **queued/running** : progression et possibilité d’annulation ;
- **failed** : code stable, explication, identifiant de diagnostic et relance ;
- **permission denied** : ne révèle pas l’existence de données interdites ;
- **ready** : date, version des métriques et manifeste consultables.

## 8. Actions et traçabilité

Un clic sur un graphique ne modifie pas la vérité métier. Il applique un filtre ou ouvre un cas.
Toute mutation subséquente utilise le domaine concerné (review, gold, scheme) et crée son propre
événement d’audit. L’Analysis Lab stocke le lien entre le cas analytique et l’action, jamais une
copie concurrente de la décision.
