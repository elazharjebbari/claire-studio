# Les types d'annotation et leur sens

Quatre informations composent une annotation de clause. Les deux premières sont
**obligatoires** (frontière + thème), les autres **enrichissent** et aident à
l'arbitrage et à la qualité.

## 1. La frontière de clause (segmentation)

Une **frontière** ouvre un **bloc-clause** sur une phrase d'ancrage ; le bloc court
jusqu'à la frontière suivante. Poser une frontière = décider « ici commence une
nouvelle clause ».

| Geste | Effet |
|---|---|
| Clic sur une phrase | Focus (sélection), **sans** créer de clause |
| Choisir un thème (inspecteur ou menu) | **Crée** la clause à cette phrase |
| Touche `B` | Ouvre la palette de thème sur la phrase focalisée |

> Règle d'or : une frontière marque un **changement de sujet/fonction** dans le
> contrat (nouveau titre, nouvelle obligation, nouveau régime). En cas de doute, on
> préfère **regrouper** plutôt que sur-découper.

## 2. Le thème (vocabulaire fermé)

Chaque bloc-clause reçoit **un** thème parmi un **vocabulaire fermé** (20 thèmes, cf.
*Nos thèmes de segmentation*). « Fermé » signifie : pas de thème libre — on choisit
toujours dans la liste, ce qui garantit la comparabilité entre annotateurs.

## 3. La nature juridique (optionnel)

Qualifie la **fonction** de la clause (obligation, permission, déclaration,
définition, exclusion…). Utile pour l'analyse fine ; non bloquant.

## 4. La certitude (0–3)

Votre **confiance** dans l'annotation de ce bloc :

| Valeur | Sens |
|---|---|
| 0 | Incertain |
| 1 | Plutôt |
| 2 | Confiant |
| 3 | Certain |

La certitude alimente les statistiques de qualité (écran Insights) et signale les
clauses à relire en priorité.

## 5. Evidence span & rationale

- **Evidence span** : la **citation textuelle** qui justifie le thème (le passage
  décisif). Courte et littérale.
- **Rationale** : **pourquoi** ce thème, en une phrase. Précieux pour la relecture et
  pour trancher les désaccords.

Dans l'inspecteur, sous ces deux champs, un sélecteur **Vous / Claude / Codex** permet
de **comparer** votre evidence/rationale à ceux des juges LLM et de **reprendre** leur
proposition en un clic.

## Surcouches de référence (overlays)

Affichables/masquables, sans modifier votre annotation :

- **Injustice CLAUDETTE** : surligne les phrases marquées injustes (catégorie +
  niveau) — cf. *Les catégories CLAUDETTE*.
- **Fantôme LLM (Claude / Codex)** : montre en pointillés les **frontières proposées**
  par un juge, même là où vous avez déjà annoté → comparaison d'un coup d'œil.
- **Traduction (FR)** : affiche la traduction sous chaque phrase.

## Arbitrage & comparaison LLM

En mode **Comparer**, l'atelier superpose les segmentations de Claude et Codex et
met en évidence les **divergences**. Vous naviguez de désaccord en désaccord (`n`/`p`,
barre sticky, panneau comparatif) et **adoptez** la proposition d'un juge (`1` = Claude,
`2` = Codex) — un **voyant** marque alors la clause comme arbitrée.

➡️ Suite : *Les catégories CLAUDETTE* puis *Nos thèmes de segmentation*.
