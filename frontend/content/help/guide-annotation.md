# Bien annoter : méthode & bonnes pratiques

Un déroulé recommandé, des règles de découpage, et les réflexes qui rendent
l'annotation **rapide, cohérente et défendable**.

## Le déroulé en 6 étapes

```
1. Survol      → lire le document en entier (mode VO ou Bilingue) une 1re fois
2. Frontières  → poser les blocs-clauses (changements de sujet/fonction)
3. Thèmes      → attribuer UN thème par bloc (vocab fermé)
4. Enrichir    → certitude (0–3), evidence span, rationale, nature juridique
5. Comparer    → mode Comparer : arbitrer les divergences entre juges LLM
6. Soumettre   → version nommée + description ; commentaires si besoin
```

## Où poser une frontière ?

Posez une frontière quand **la fonction du texte change** :

- un **titre** ou numéro de section apparaît ;
- on passe d'une **obligation** à une **permission**, d'un **régime** à un autre
  (ex. de la résiliation à la responsabilité) ;
- un **nouveau sujet** commence (données → paiement → litiges).

Ne posez **pas** de frontière pour une simple énumération interne au même sujet.
**En cas de doute : regrouper.** Un bloc trop large se re-découpe ; une myriade de
micro-blocs est coûteuse et instable entre annotateurs.

## Choisir le thème

- Le thème qualifie la **fonction dominante** du bloc (lire tout le bloc).
- `MISC_BOILERPLATE` est un **dernier recours** (divisibilité, intégralité, cession…).
- Une clause = **un** thème ; deux sujets ⇒ probablement **deux** blocs.
- Voir *Nos thèmes de segmentation* pour les définitions et les pièges fréquents.

## Utiliser les aides sans s'y soumettre

- **Injustice CLAUDETTE** (overlay) : repère les zones sensibles (souvent des
  frontières importantes), n'impose pas le thème.
- **Fantômes LLM** : visualisez les frontières proposées par les juges LLM (Claude, Codex, Mistral…) pour
  comparer — votre annotation reste la vôtre.
- **Mode Comparer + arbitrage** : naviguez les divergences (`n`/`p`), lisez l'evidence
  de chaque juge (touche `e` ou icône à la frontière), puis **adoptez** (`1` Claude /
  `2` Codex) si pertinent. Un voyant marque la clause arbitrée.
- **Sélecteur de source dans l'inspecteur** : comparez evidence/rationale Vous /
  un juge LLM et **reprenez** une formulation en un clic.

## Bien régler la certitude

Soyez honnête : `3` (Certain) seulement quand la clause est nette ; `0–1` quand vous
hésitez. La certitude **priorise la relecture** et nourrit les statistiques de qualité
(écran Insights). Mieux vaut un `1` assumé qu'un faux `3`.

## Justifier (evidence + rationale + commentaires)

- **Evidence span** : la citation courte et littérale qui **prouve** le thème.
- **Rationale** : une phrase de *pourquoi*.
- **Commentaires** : pour dialoguer (général / phrase / sélection / clause), signaler
  un doute, demander un avis. Indispensable en annotation collaborative.

## Raccourcis essentiels

| Touche | Action |
|---|---|
| `j` / `k` | phrase suivante / précédente |
| `B` / `T` | poser/ouvrir la palette de thème |
| `0`–`3` | certitude de la clause sélectionnée |
| `n` / `p` | divergence suivante / précédente *(mode Comparer)* |
| `1` / `2` | adopter Claude / Codex sur la divergence *(mode Comparer)* |
| `e` | aperçu evidence/rationale à la frontière |
| `g` | panneau comparatif |
| `⌘Z` / `⌘⇧Z` | annuler / rétablir |
| `⌘S` | snapshot |

## Avant de soumettre

- [ ] Tout le document est couvert par des blocs (pas de longue zone sans thème).
- [ ] Pas de `MISC_BOILERPLATE` abusif.
- [ ] Les clauses sensibles (résiliation, responsabilité, arbitrage) sont isolées.
- [ ] Certitude renseignée ; evidence span sur les clauses clés.
- [ ] Divergences LLM majeures examinées.
- [ ] Version **nommée + décrite** à la soumission.

> La qualité d'un gold humain tient autant à la **cohérence** (mêmes règles d'un
> document à l'autre) qu'à l'exactitude ponctuelle. En cas d'hésitation récurrente,
> notez-le en commentaire : cela fait évoluer le guide.
