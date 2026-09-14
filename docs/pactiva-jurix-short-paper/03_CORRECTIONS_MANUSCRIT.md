# Corrections du manuscrit — protocole d'annotation et contrainte légale

> **Pourquoi ce document.** Deux éléments du manuscrit ne décrivent pas ce qui a
> réellement été fait. L'un est une **erreur factuelle** sur le protocole d'annotation,
> l'autre une **sur-revendication** sur l'origine de la contrainte légale. Ce document
> établit les faits depuis le code, propose le texte de remplacement en anglais, et donne
> le plan d'insertion compatible avec la limite de 5 pages.

---

## 1. Ce que le manuscrit dit aujourd'hui, et pourquoi c'est inexact

### 1.1 Le protocole d'annotation — erreur factuelle

**Section 3 (Construction), texte actuel :**

> *« Annotators post-edited model pre-annotations rather than labelling from a blank slate;
> this speeds the task and anchors it, and we treat the resulting anchoring as a limitation
> to be bounded rather than a problem to be assumed away. »*

**Section 5 (Limitations), texte actuel :**

> *« Pre-annotations were post-edited rather than produced from scratch, and annotator
> divergence from the suggested label (38.5–48.6% of sentences) bounds the anchoring risk
> without eliminating it. »*

**Ces deux passages décrivent un protocole qui n'est pas le nôtre.** Il n'y a jamais eu de
pré-annotation unique que les annotateurs auraient corrigée.

### 1.2 Le protocole réel, établi depuis le code

| Élément | Ce que dit le code | Fichier |
|---|---|---|
| Les quatre juges annotent **indépendamment** chaque phrase | les niveaux « dérivent de l'ACCORD INTER-JUGES (jamais d'une confiance auto-déclarée) » | `lib/triage/levels.ts` |
| Un moteur **déterministe** route chaque phrase en cinq niveaux C1–C5 selon l'accord des juges | C1 unanime → C5 éclaté | `lib/triage/engine.ts` |
| **Aucun juge n'est privilégié** | tri « STABLE et indépendant de l'ordre des juges : support décroissant, puis index de priorité » — la priorité porte sur les **thèmes**, jamais sur les juges | `lib/triage/engine.ts` |
| L'annotateur **n'est pas contraint au menu** des propositions | l'inspecteur affiche « tous les thèmes visibles (grille) », vocabulaire fermé à 20 thèmes | `components/workspace/InspectorPanel.tsx` |

C'est donc une **aide à la décision fondée sur l'accord entre quatre modèles**, pas une
post-édition. La différence est substantielle pour la relecture : l'ancrage sur la sortie
d'un modèle unique, qui est le reproche classique, **ne s'applique pas ici**.

### 1.3 Le biais qui subsiste réellement

Il ne disparaît pas pour autant, mais il change de nature :

> **Les quatre juges évalués sont exactement les quatre qui ont assisté l'annotation.**
> Aucun modèle extérieur au processus ne figure au banc d'essai.

La circularité est donc **collective et symétrique** et non individuelle. Conséquences :

- le **classement relatif** des quatre juges reste interprétable — le moteur ne privilégie
  aucun d'eux, et l'annotateur peut sortir de leurs propositions ;
- une **erreur partagée par les quatre** peut survivre, puisque l'accord unanime des juges
  (niveau C1) est le cas où l'annotateur relit le moins ;
- l'écart mesuré entre le plafond humain et les juges pourrait être **optimiste pour les
  quatre à la fois**, face à un cinquième modèle jamais impliqué.

Un élément chiffré vérifié pour cet audit va dans ce sens sans le prouver : l'avantage du
meilleur juge sur le deuxième vaut $+0.029$ là où les trois annotateurs sont unanimes,
contre $+0.093$ là où ils se divisent — et ce juge est le seul des quatre à **s'améliorer**
quand les humains se divisent, alors que les trois autres perdent de 2,4 à 6,2 points. La
lecture prudente est que sur les cas difficiles, le choix humain se porte plus souvent sur
la proposition de ce modèle ; savoir si c'est parce qu'il a raison ou parce qu'il est
proposé demanderait un cinquième juge extérieur.

### 1.4 La contrainte légale — sur-revendication

**Section 4, texte actuel :**

> *« The merge responsible is one that crosses unfairness strata, placing clauses that the
> Directive treats differently \cite{eu1993directive,micklitz2017empire} into a single
> category. »*

La phrase laisse entendre que les strates sont **dérivées du texte** de la directive. Elles
sont en fait opérationnalisées par une mesure : $P(\text{abusif} \mid \text{thème})$ observé
sur les étiquettes \corpus{}, avec un seuil de lift ($\geq 3$ contre $\leq 1$). La chaîne
vers le droit tient — ces étiquettes encodent la directive — mais elle compte un maillon de
plus que ce que la phrase affirme.

**Ce qui manque par ailleurs** : le manuscrit ne dit nulle part que les fusions ont été
**revues par les juristes de l'équipe**, ni que le garde-fou est un critère de conception.
C'est pourtant l'argument le plus fort de la section, et JURIX y est particulièrement
sensible.

---

## 2. Les corrections proposées

Quatre remplacements, en anglais, prêts à insérer.

### C-1 · Section 3 « Construction » — décrire le protocole réel

**Remplacer** la phrase sur la post-édition **par :**

> *Annotators did not post-edit a single model's output. The four judges labelled every
> sentence independently, and a deterministic engine ranked each sentence into one of five
> tiers from inter-judge agreement alone, from unanimous to fully split; annotators saw that
> tier and the competing candidates, but chose from the full 20-theme vocabulary rather than
> from the proposals.*

*(46 mots contre 42 — coût net : +4)*

### C-2 · Section 3 « Construction » — la conception des fusions et sa revue juridique

**Ajouter**, juste avant le bloc « Measurement » :

> *\Tn{14} and \Tn{11} were designed under four criteria --- confusability, deficient
> reliability, contractual function and support --- subject to one constraint fixed in
> advance: no merge may join two themes whose observed unfairness rates fall in opposite
> strata. The merges were reviewed by the legal scholars among the authors. \Tn{10} adds the
> single merge that this constraint forbids, and is reported as a counterfactual rather than
> as a candidate.*

*(coût : +58 mots)*

> ⚠ La deuxième phrase n'est à garder **que si elle est exacte**. Vous avez confirmé que les
> juristes ont revu les fusions ; si leur revue a porté sur une partie seulement, il faut
> l'écrire ainsi.

### C-3 · Section 4 — formuler exactement la contrainte

**Remplacer** la phrase sur la Directive **par :**

> *The merge responsible joins two themes whose observed unfairness rates fall in opposite
> strata --- 0.385 against 0.039 --- a distinction consumer protection law draws
> \cite{eu1993directive,micklitz2017empire} and that the agreement signal does not express.*

*(32 mots contre 22 — coût net : +10)*

### C-4 · Section 5 « Limitations » — déclarer le biais réel

**Remplacer** la phrase sur la post-édition **par :**

> *The four judges evaluated here are the four that assisted annotation, so the benchmark is
> not free of circularity; the engine privileged none of them and annotators could label
> outside their proposals, but an error shared by all four could survive. Excluding the
> strongest judge leaves $\kappa = 0.515$, which widens the gap to the human ceiling rather
> than narrowing it.*

*(56 mots contre 28 — coût net : +28)*

**Coût total des quatre corrections : +100 mots**, pour une marge disponible d'environ
45 mots en bas de page 5. Il faut donc dégager **~55 mots**.

---

## 3. Les coupes compensatoires

Choisies pour retirer de la redondance, jamais un résultat. Par ordre de préférence :

| # | Où | Quoi | Gain |
|---|---|---|---|
| **K-1** | §4, paragraphe « Reported » | La justification (« the encoder is a single model with early stopping…; the judges are scored on stored pre-annotations ») **répète** les limites de la §5. Garder « We report these figures rather than demonstrate them » et supprimer la justification | ~28 mots |
| **K-2** | §5, implications | « in line with findings on other legal annotation tasks » — l'information est portée par les citations qui suivent | ~9 mots |
| **K-3** | §6, conclusion | « and, being multi-label and triply annotated, to measure how reliably that question can be answered » — déjà dit en §3 et dans le résumé | ~16 mots |
| **K-4** | §3, bloc « The layer » | « Individual votes are retained rather than collapsed into a consensus, so that disagreement remains available for analysis » → « Individual votes are retained rather than collapsed into a consensus » (les citations portent le reste) | ~8 mots |

**Total disponible : ~61 mots**, pour un besoin de ~55. La marge tient.

---

## 4. Plan d'action

L'ordre compte : couper d'abord, insérer ensuite, vérifier à chaque étape.

| Étape | Action | Vérification |
|---|---|---|
| 1 | Appliquer **K-1 à K-4** | `bash tools/check_pages.sh` → le corps doit descendre sous 5 pages |
| 2 | Appliquer **C-1** (protocole réel, §3) | recompiler |
| 3 | Appliquer **C-4** (biais réel, §5) | recompiler |
| 4 | Appliquer **C-3** (contrainte exacte, §4) | recompiler |
| 5 | Appliquer **C-2** (conception + revue juridique, §3) | `check_pages.sh` → **doit rester à 5 pages** |
| 6 | Contrôles de format | légendes au-dessus des tableaux, 0 citation non résolue, 0 `overfull`, aucune commande de mise en page |
| 7 | Régénérer les fichiers EasyChair | `easychair-*.txt` réextraits depuis `main.tex` |

**Si l'étape 5 fait déborder** : la variable d'ajustement est C-2, dont la troisième phrase
(« \Tn{10} adds the single merge… ») peut être réduite à « \Tn{10} violates it by
construction » (−18 mots) sans perdre l'argument.

---

## 5. Effets attendus sur la relecture

| Critère JURIX | Avant | Après |
|---|---|---|
| `technical quality` | un protocole décrit de façon inexacte | le protocole réel, et un biais nommé plutôt que subi |
| `originality` | la contrainte légale paraît constatée après coup | contrainte de conception, revue par des juristes, avec son contrefactuel |
| `reviewer's confidence` | le relecteur doit deviner qui a annoté quoi | chaque rôle est explicite |
| `significance` | l'écart aux juges peut sembler fragile | l'analyse de sensibilité montre qu'il **s'élargit** quand on retire le juge suspect |

La correction la plus importante n'est pas défensive : **décrire le vrai protocole est un
gain**. Une aide à la décision fondée sur l'accord de quatre modèles, avec choix libre dans
le vocabulaire complet, est un dispositif plus rigoureux que la post-édition d'un modèle
unique — et le manuscrit se décrivait, à tort, comme faisant le second.
