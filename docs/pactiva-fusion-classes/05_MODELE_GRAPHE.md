# 05 — Notre modèle : le graphe contractuel typé et ses requêtes d'abusivité

> La chaîne cible, telle que fixée : **texte du contrat → segmentation thématique →
> graphe du document contractuel construit avec la connaissance métier de ce que
> chaque clause doit a priori contenir → alimentation en graphe de connaissances →
> requêtes interprétables détectant les clauses abusives.**
>
> Ce fascicule propose le modèle (définition, connaissance métier, requêtes,
> évaluation). Les phases « alimentation KG » et « exécution des requêtes » sont
> les chantiers suivants — le périmètre s'arrête ici à la proposition, adossée à
> l'état de l'art du fascicule 04.

## 1. Vue d'ensemble — un pipeline neuro-symbolique en 4 étages

```
        ToS brut (texte)
            │  ① segmentation en phrases + segmentation thématique
            ▼     (classifieur multi-label du papier long, taxonomie T11,
                   frontières = changement de jeu de thèmes)
        Segments typés (clauses candidates)
            │  ② construction du graphe documentaire
            ▼     (nœuds typés T11 + schémas de clause ; hyperarêtes de co-occurrence)
        Graphe contractuel G(d)
            │  ③ alimentation KG : extraction des slots par schéma de clause
            ▼     (valeurs, parties, portées, modalités déontiques ; provenance = spans)
        Graphe de connaissances instancié
            │  ④ requêtes d'abusivité (4 familles de motifs)
            ▼
        Clauses signalées + SOUS-GRAPHE TÉMOIN (l'explication est le résultat)
```

Répartition des rôles : le **neural** (étages ①–③) transforme du texte en
structure — c'est là que vivent l'incertitude et les scores de confiance ; le
**symbolique** (étage ④) juge la structure — c'est là que vit l'interprétabilité.
Un signalement n'est jamais « le modèle pense que » : c'est un motif nommé, apparié
sur des nœuds précis, avec les phrases sources en provenance.

## 2. Définition du graphe contractuel

Pour un document d : G(d) = (V, E, H) avec

**Nœuds V** :

| Type | Contenu | Origine |
|---|---|---|
| `Document` | métadonnées (service, date, langue) | corpus |
| `Clause` | segment thématique ; attributs : type T11 (+ types secondaires), span de phrases, score de confiance du classifieur | étage ① |
| `Party` | les parties (« provider », « user », tiers) | schéma (fermé pour les ToS) |
| `Norm` | énoncé déontique : modalité ∈ {obligation, interdiction, permission} × porteur × action | étage ③ (nature juridique v9.2 / proxy D1, puis extraction) |
| `Slot` | valeur extraite d'un schéma de clause (délai de préavis, plafond, forum…) | étage ③ |

**Arêtes E** : `PART_OF` (clause→document, avec position), `NEXT` (ordre du
document), `TYPED_AS` (clause→type, avec rôle primaire/secondaire), `STATES`
(clause→norme), `BEARS_ON` (norme→partie), `HAS_SLOT` (clause→slot), `REFERS_TO`
(renvois internes « as described in section… »).

**Hyperarêtes H** : une hyperarête par **combinaison de types co-présents** dans
une clause (le multi-étiquetage résiduel ~19 % sous T11) et par combinaison de
clauses liées par renvoi — c'est le support formel du signal de co-occurrence
validé par G2 (l'identité de combinaison porte un signal d'abusivité supervisé :
AUC-PR 0,589 vs taux de base 0,186 sur votes).

**Pourquoi T11 et pas T20** : les types de nœuds sont le vocabulaire de TOUTES les
requêtes. Un type que deux annotateurs ne s'accordent pas à attribuer (FEEDBACK
α = 0,099 sous T20) rend indécidable toute requête qui le mentionne. T11 garantit
α ≥ 0,58 par classe et 0,685 globalement (fascicule 02) : **la fiabilité de la
taxonomie est la condition de validité des requêtes** — c'est le lien organique
entre les deux moitiés de ce dossier, et entre les deux papiers.

## 3. La connaissance métier : les schémas de clause

Pour chaque type T11, un **schéma de clause** déclare ce qu'une clause de ce type
doit a priori contenir (slots attendus), et les configurations à risque (motifs),
alignées sur les catégories CLAUDETTE et l'annexe de la directive 93/13/CEE.
Extrait (le schéma complet est un livrable YAML du chantier suivant) :

| Type T11 | Slots attendus | Motifs à risque (→ catégorie CLAUDETTE) |
|---|---|---|
| MODIFICATION_OF_TERMS | mécanisme de notification, délai, droit de sortie | modification unilatérale sans notification (→ CH) ; « simple publication vaut acceptation » (→ CH, USE) |
| TERMINATION | causes, préavis, effets (données, crédits) | résiliation unilatérale sans cause ni préavis (→ TER) ; perte des contenus sans recours (→ TER, CR) |
| LIMITATION_LIABILITY | plafond, exclusions, exceptions (faute lourde, dol) | exclusion totale y compris faute lourde (→ LTD) ; plafond dérisoire (→ LTD) |
| DISPUTES_LAW | forum, mécanisme (arbitrage/judiciaire), droit applicable, class action | arbitrage obligatoire (→ A) ; forum imposé hors résidence du consommateur (→ J) ; droit étranger (→ LAW) ; renonciation aux actions collectives (→ A) |
| FRAMEWORK | objet, définitions, canal de notification | acceptation par simple usage (→ USE) |
| CONTENT_IP | licence (portée, durée, exclusivité), retraits | licence perpétuelle/irrévocable sur le contenu utilisateur ; retrait discrétionnaire (→ CR) |
| ACCOUNT_USE | conditions d'accès, suspensions | suspension discrétionnaire sans préavis (→ TER) |
| FEES_PAYMENT | prix, renouvellement, remboursement | renouvellement tacite sans rappel ; modification unilatérale du prix (→ CH) |
| WARRANTY_DISCLAIMER | étendue du « as is », exceptions légales | — (strate basse ; à risque seulement en composition, §4-F3) |
| THIRD_PARTY_SERVICES | responsabilité sur les tiers | report intégral de responsabilité (→ LTD) |
| PRIVACY_DATA | renvoi politique de confidentialité, finalités | consentement par usage (→ USE) |

Double emploi du schéma : **guide d'extraction** à l'étage ③ (quels slots chercher
dans une clause de ce type) et **base de requêtes** à l'étage ④ (quels motifs
évaluer). C'est l'implémentation opérationnelle de « ce que chaque clause doit a
priori contenir ».

## 4. Les requêtes — quatre familles de motifs

Chaque famille est un gabarit de requête de graphe (pseudo-Cypher ci-dessous) ;
un signalement retourne le **sous-graphe témoin** (clause, slots, normes, phrases).

**F1 — Présence d'une configuration interdite** (l'abusivité « classique ») :

```cypher
MATCH (c:Clause {type:'DISPUTES_LAW'})-[:HAS_SLOT]->(s:Slot {name:'mecanisme'})
WHERE s.value = 'arbitrage' AND s.obligatoire = true
RETURN c, s                                        // → catégorie A, niveau 3
```

**F2 — Absence d'un élément attendu** (le schéma comme norme de complétude —
introuvable dans les approches par classification, qui ne voient pas l'absence) :

```cypher
MATCH (c:Clause {type:'MODIFICATION_OF_TERMS'})
WHERE NOT (c)-[:HAS_SLOT]->(:Slot {name:'notification'})
RETURN c                                           // modification sans notification → CH
```

**F3 — Composition trans-clauses** (le signal G2, rendu symbolique) : le cumul de
transferts de risque, anodin clause par clause, léonin en système :

```cypher
MATCH (d:Document)<-[:PART_OF]-(c1:Clause {type:'LIMITATION_LIABILITY'}),
      (d)<-[:PART_OF]-(c2:Clause {type:'WARRANTY_DISCLAIMER'}),
      (d)<-[:PART_OF]-(c3:Clause)-[:STATES]->(n:Norm {modalite:'obligation'})
      -[:BEARS_ON]->(:Party {role:'user'})
WHERE n.action = 'indemniser'
RETURN c1, c2, c3                                  // triangle d'exculpation → LTD composé
```

C'est ici que la décision T11 (garder WARRANTY_DISCLAIMER séparée de
LIMITATION_LIABILITY) prend tout son sens : la composition F3 a BESOIN des deux
types distincts — une fusion T10 l'aurait rendue inexprimable.

**F4 — Incohérence interne** (contradictions et renvois brisés) :

```cypher
MATCH (c1:Clause)-[:STATES]->(n1:Norm {modalite:'permission', action:a}),
      (c2:Clause)-[:STATES]->(n2:Norm {modalite:'interdiction', action:a})
RETURN c1, c2                                      // permission et interdiction du même acte
```

Gradation assumée : F1/F2 sont des règles dures (haute précision, interprétables
une à une) ; F3 s'amorce avec les combinaisons apprises de G2 (les hyperarêtes les
plus prédictives deviennent des gabarits symboliques après relecture juridique) ;
F4 est exploratoire. Le système reste utile à chaque étage intermédiaire.

## 5. Évaluation prévue

| Question | Protocole | Référence |
|---|---|---|
| Les requêtes détectent-elles l'abusivité ? | précision/rappel/AUC-PR par catégorie CLAUDETTE, par famille F1–F4, contre les labels phrase | corpus 50 ToS (puis gold arbitré) |
| Que vaut la structure vs la phrase isolée ? | baselines : classifieur de phrases (papier long) et LLM zéro-shot, mêmes plis par document | `legal-bert-finetune`, juges |
| D'où vient le signal ? | ablations : sans typage T11 (types LLM bruts) ; sans slots (F1/F2 off) ; sans hyperarêtes (F3 off) ; sans déontique (D1) | matrice G2 existante |
| Robustesse au pipeline amont | bruit d'étiquettes injecté à l'étage ① (G5 : 86 % du signal conservé à 35 % de bruit — borne déjà mesurée) | `cooccurrence-bruit` |
| Interprétabilité | étude qualitative : pour n signalements, le sous-graphe témoin suffit-il à un juriste pour trancher ? | annotateurs du projet |

## 6. Feuille de route (chantiers suivants, dans l'ordre)

1. **Valider T11** (protocole du fascicule 03) — préalable à tout le reste ;
2. **Schémas de clause v1** (YAML, 11 types, slots + motifs sourcés 93/13/CEE +
   annexe CLAUDETTE) — travail métier, relecture juridique ;
3. **Constructeur de graphe** sur les sorties du classifieur (étages ①–②),
   artefact `hypergraph.json` du Lab comme point de départ ;
4. **Extraction de slots** (étage ③) — LLM contraint par schéma, avec provenance
   et validation d'échantillon par les annotateurs ;
5. **Moteur de requêtes** F1–F2 puis F3 (étage ④), évaluation contre CLAUDETTE ;
6. Rédaction papier long : figure pipeline + tableau d'ablations + étude
   d'interprétabilité.
