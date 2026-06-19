# Le jeu de données : UNFAIR-ToS / CLAUDETTE

> À lire en premier. Cette page explique **ce que vous annotez**, **pourquoi**, et
> **comment le corpus est structuré**. Les pages suivantes détaillent chaque type
> d'annotation et chaque catégorie.

## En une phrase

Vous annotez des **conditions générales d'utilisation** (Terms of Service / CGU) de
services en ligne, afin de construire un **gold humain** de référence : un découpage
fiable du contrat en **clauses thématiques**, qui servira à détecter et expliquer des
**anomalies** (clauses atypiques, incohérences, clauses potentiellement injustes).

## D'où viennent les documents ?

- **UNFAIR-ToS** (projet **CLAUDETTE**, Lippi et al. 2019 ; extension multilingue
  Drawzeski et al. 2021) : un corpus public de ToS de grands services en ligne
  (réseaux sociaux, plateformes, e-commerce…), annoté à l'origine en **clauses
  potentiellement injustes**.
- Les documents sont fournis **phrase par phrase**, chaque phrase portant un **index**
  stable. C'est l'unité d'interaction dans l'atelier (vous cliquez une phrase, posez
  des frontières entre phrases).

## Quels types de contrats ?

Des **contrats d'adhésion** grand public : conditions d'utilisation de services
numériques. On y retrouve, de façon récurrente, des familles de clauses : éligibilité
et compte, vie privée et données, propriété intellectuelle, usage acceptable,
résiliation, garanties et responsabilité, arbitrage et litiges, loi applicable, frais,
services tiers, etc. (cf. *Nos thèmes de segmentation*).

## Deux niveaux de lecture du contrat

```
Document (ToS)
 └── Blocs-clauses          ← segmentation PHYSIQUE/LOGIQUE (notre découpage)
      ├── phrase 0
      ├── phrase 1          chaque bloc = suite contiguë de phrases
      └── …                 portant UN thème (vocab fermé)
 └── Phrases injustes        ← annotation CLAUDETTE (catégorie + niveau)
```

1. **Notre segmentation** (le cœur de votre travail) : découper le document en
   **blocs-clauses** contigus et leur attribuer **un thème** parmi un vocabulaire
   fermé. C'est ce qui structure le corpus.
2. **L'injustice CLAUDETTE** (overlay de référence) : certaines phrases sont marquées
   « potentiellement injustes » dans une des **8 catégories**, avec un **niveau** de
   sévérité. C'est une donnée d'aide, affichable en surcouche.

## Pourquoi « bloc-clause » et non « 1 phrase = 1 clause » ?

La convention CLAUDETTE d'origine assimile une phrase à une clause. Nos travaux ont
montré que c'est trop fin : une clause juridique réelle est souvent une **suite de
phrases** (un titre + son corps). On annote donc des **blocs-clauses** : une frontière
ouvre un bloc, qui court jusqu'à la frontière suivante. C'est plus fidèle au document
et plus stable entre annotateurs.

## Langues & traductions

Le corpus principal est en **anglais**. Un **voyant FR** signale les documents pour
lesquels une **traduction française** phrase-à-phrase est disponible (sélecteur de
documents, écran Insights). Vous pouvez basculer l'affichage VO / Bilingue / FR ;
l'annotation reste toujours indexée sur la phrase, quelle que soit la langue affichée.

## Ce que vous produisez

Pour chaque document : un ensemble de **clauses** = `(phrase d'ancrage → thème)`, avec
options de **nature juridique**, **certitude (0–3)**, **evidence span** (citation
justificative) et **rationale** (pourquoi ce thème). Le tout est **versionné** et
**traçable** (qui a fait quoi, quand, pourquoi).

➡️ Suite : *Les types d'annotation et leur sens*.
