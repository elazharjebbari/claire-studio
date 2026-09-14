# ADR-003 — Représentation des règles juridiques : YAML déclaratif compilé en Cypher, pré-enregistré

**Statut** : accepté (14 septembre 2026) · **Révision** : si l'on passe à des règles défaisables ou à des listes nationales.

## Context
Les items de l'annexe 93/13 doivent devenir des règles exécutables, lisibles par des juristes,
versionnées et gelées avant évaluation, avec leurs exceptions (annexe §2) et leur correspondance aux
catégories CLAUDETTE. Le graphe n'affirme pas la violation : il établit une correspondance à un item
indicatif.

## Options considered
1. Cypher écrit à la main par règle ; 2. LegalRuleML/OWL + moteur de règles externe (défaisable) ;
3. **YAML déclaratif** (conditions sur champs fermés, exceptions, seuils, mapping) compilé en Cypher par
un moteur pur ; 4. règles apprises (classifieur) sur features du graphe.

## Decision
Option **3** pour R1–R3 (avec compilation vers Cypher et vers une fonction Python pure pour les tests) ;
option 1 réservée à R4 (exploratoire) ; option 4 comme approche comparée (A7), jamais comme règle ;
option 2 conservée comme **export** (LegalRuleML) pour l'interopérabilité si une publication le justifie.

## Rationale
Le YAML est relu par des juristes, hashé et gelé (`graph/rules/FROZEN.txt`), et ne peut pas lire la
référence (le compilateur refuse `LABELED`/`Category`) ; la compilation garantit une sémantique unique
(`not_stated ≠ none`, agrégation vers les phrases d'evidence) ; les règles défaisables et la
déontique complète (LegalRuleML) sont hors de portée des données actuelles (pas de nature déontique
annotée) et seraient de la sur-formalisation.

## Consequences
Un mini-DSL à documenter (`graph/rules/README.md` — champs, opérateurs, `unless`, seuils, familles) ; un
compilateur testé (cas dorés) ; toute modification = nouvelle version + nouvelle empreinte + nouveau run ;
pas de correction de règle pendant une évaluation.

## Risks
Expressivité insuffisante pour certains items (c, n, o : déjà classés non exprimables) ; sémantique de
composition R3 plus délicate (parade : R3 limité à des motifs nommés, évalués qualitativement d'abord).
