# Enquête — « Valider + suivant » bloqué (curseur interdit)

> Signalement : sur certains comptes (constaté sur **fatima.ouali**, prod), le bouton vert
> « Valider (modèle courant) + phrase suivante » du rail d'actions rapides **ne fonctionne pas
> toujours** ; le curseur affiche souvent l'icône « interdit ».

## 1. Ce que disait le DOM fourni

```html
<div class="… opacity-0 pointer-events-none group-hover:opacity-100 …">
  <button data-quickaction-validate="50" … class="… disabled:cursor-not-allowed disabled:opacity-30">
```

Le bouton de la phrase 50 est **actif** (pas d'attribut `disabled`). Le curseur « interdit »
vient donc d'un **autre** bouton : `cursor-not-allowed` n'apparaît que via `disabled:`.

## 2. Cause racine

Deux faits, dans `DocumentPanel.tsx` :

```ts
const quickCanValidate = Boolean(anchor);           // anchor = clause EXISTANTE à cette phrase
…
if (index + 1 !== focused) focusSentence(index + 1); // on avance d'UNE phrase
requestAnimationFrame(() => { /* place le bouton index+1 sous le curseur */ });
```

Le bouton n'est actif que sur une phrase **portant une clause** — choix de conception assumé
(ne jamais fabriquer une clause là où il n'y en a pas : pas de fragmentation de segment, pas
d'adoption d'un juge arbitraire). Mais une clause **couvre plusieurs phrases** : seules les
phrases d'**ancre** en portent une.

Mesure sur le compte signalé (prod) :

| | |
|---|---|
| Document | `Google`, annotation `draft` de fatima.ouali |
| Phrases | **93** |
| Clauses | **20** (segmentation normale — les modèles en produisent 18–24 sur ce document) |
| Phrases validables | 20 / 93 = **21 %** |

Le « curseur collant » place le bouton de la phrase `index + 1` exactement sous la souris.
Comme `index + 1` n'est presque jamais une ancre, **il dépose systématiquement le curseur sur
un bouton désactivé** → `cursor-not-allowed`, clic sans effet, enchaînement cassé. Ce n'était
donc pas un bug de permission ni de verrou : la fonctionnalité visait la mauvaise cible.

## 3. Correctif

1. **Avancer vers la prochaine phrase VALIDABLE**, pas vers `index + 1` — logique pure
   extraite dans `frontend/src/lib/quickValidate.ts` (`validatableIndicesOf`,
   `nextValidatableIndex`), consommée par `DocumentPanel`. Le curseur collant vise désormais
   le bouton de la clause suivante : on enchaîne **clause après clause**, sans bouger la souris.
2. **Le bouton désactivé dit pourquoi** : infobulle « Rien à valider ici : cette phrase ne
   porte pas de clause » (au lieu du titre trompeur « Valider… »), + `aria-label` cohérent.
   Un bouton grisé au libellé actif se lit comme une panne.

Ce qui n'a **pas** changé : on ne crée toujours aucune clause fantôme, et le bouton reste rendu
sur chaque phrase (l'ancrage `data-quickaction-validate` sert au repositionnement).

## 4. Tests ajoutés

`frontend/tests/quickValidate.test.ts` (7 cas) : tri des ancres, saut par-dessus les phrases
sans clause (cas réel 50 → 57), clauses contiguës, dernière clause → `null`, jamais de
re-ciblage sur soi-même (anti-boucle), document sans clause.
`quickActionRail.test.tsx` : l'infobulle du bouton désactivé explique l'absence de clause.

## 5. Vérification connexe — le moteur d'arbitrage prend-il Fable ?

**Oui.** Payload de l'atelier gold en prod (`campagne-pactiva` / `Google`) :

```
phrase 0 llms: [fable, claude, codex, mistral]   ← les 4 juges, sur tout le document
```

Fable y figure en **référence** (`llm_details`), conformément à l'invariant : les LLM ne sont
**jamais** parties au conflit, la résolution reste strictement inter-annotateurs. Deux
ajustements faits au passage :

- l'inspecteur affichait l'identifiant brut (`fable`) → il affiche le libellé (`Fable`) ;
- l'ordre des modèles suivait l'insertion en base (alphabétique) → il suit désormais l'**ordre
  d'affichage** unique.

## 6. Ordre d'affichage des modèles (demande jointe)

Ordre retenu, **par taille de modèle décroissante** : **Fable → Claude → Codex → Mistral**.

- Source backend : `JUDGE_DISPLAY_ORDER` + `judge_display_rank()` (`imports/models.py`),
  appliqués à `Judge.import_judges()`, `build_document_data` (votes LLM de l'atelier gold) et
  `llm_annotator_status` (studio de résolution).
- Source frontend : ordre de `LLM_JUDGES` — gouverne réglette, comparaison N-way, menus,
  pré-remplissage, fantômes.
- **Parité testée des deux côtés** ; un juge non classé passe en fin de liste au lieu de
  disparaître.

L'ordre de **déclaration** de `Judge` reste l'historique d'ajout (il n'a aucune portée
d'affichage) : le test de parité compare les *ensembles* pour la nomenclature et les *listes
ordonnées* pour l'affichage.
