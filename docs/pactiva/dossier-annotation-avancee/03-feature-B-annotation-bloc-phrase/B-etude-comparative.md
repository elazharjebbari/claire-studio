# Feature B — Étude comparative des modèles d'annotation

> Objectif : comparer les modèles candidats pour « annoter à la fois par phrase ET par
> bloc » et **justifier** le modèle retenu. Quatre modèles sont étudiés en profondeur.
> Critères chiffrés : `B-comparatif.csv`. Décision : `B-choix.md`.
>
> Référentiel d'ancrage (code réel) : `store/workspace.ts`, `lib/runs.ts`,
> `lib/autosave.ts`, `components/workspace/SelectionToolbar.tsx`, `SentenceMenu.tsx`,
> `backend/claire/annotations/models.py`, `backend/claire/projects/iaa.py`.

## Grille d'évaluation
Pour chaque modèle : **principe**, **forces**, **faiblesses**, **ergonomie spans**,
**granularité phrase**, **justesse IAA**, **coût d'implémentation**, **migration**,
**robustesse**, **évolutivité**, **risque**.

---

## (a) Pur par phrase — *base actuelle (C4)*

**Principe.** Une `Clause` = une phrase (`anchor_sentence`). Rendu via
`computeRuns(drafts, n, {perSentence:true})` ; IAA via `_theme_vector` par phrase. Aucun
regroupement : annoter un bloc = répéter le geste phrase par phrase
(`SelectionToolbar::annotate` itère déjà `setBoundary` par phrase).

- **Forces** : déjà en place, **zéro** migration, IAA **exacte** par phrase (κ Cohen juste),
  modèle de données minimal, autosave par ancre déjà fiable et idempotent.
- **Faiblesses** : **fastidieux** pour une longue suite homogène (constat audit §3) ;
  pas de notion de bloc → pas de poignées d'extension, pas de feedback « bloc » ; l'override
  d'une phrase n'a pas de « bloc » duquel se détacher (manque conceptuel pour l'UX).
- **Ergonomie spans** : faible (3/5 au mieux via la sélection-plage, mais sans bloc persistant
  ni poignées).
- **Granularité phrase** : maximale (5/5).
- **Justesse IAA** : maximale (5/5) — c'est la référence.
- **Coût implémentation** : nul (1/5 d'effort = déjà fait).
- **Migration** : aucune (5/5).
- **Robustesse** : très haute (5/5) — une seule représentation, pas d'état dérivé à
  synchroniser.
- **Évolutivité** : moyenne — tout ajout d'ergonomie « bloc » devra de toute façon dériver
  les groupes ; on n'a juste pas encore fait ce travail.
- **Risque** : très faible.
- **Verdict** : socle sain mais **insuffisant** seul pour B2/B4/B5 (ergonomie de plage).

---

## (b) Spans bornés avec `end_index` — *migration de schéma*

**Principe.** Une `Clause` devient un **span** `[anchor_index, end_index]` couvrant
plusieurs phrases. Le bloc est un **objet persistant**. Implique d'ajouter `end_index`
au modèle `Clause`, de migrer les données et **toute** la chaîne (serializers, contrat
camelCase, `runs.ts`, store, autosave, **IAA**).

- **Forces** : le « bloc » est first-class (une ligne = un span) ; pose de plage = 1 écriture ;
  extension = patch d'un seul champ.
- **Faiblesses** : **migration lourde et risquée** ; casse l'invariant simple INV-2 (« une
  clause-start par phrase ») au profit d'intervalles → il faut gérer les **chevauchements**,
  les **trous**, la **réconciliation** override (scinder un span en trois lignes), et un
  nouvel ensemble d'invariants (non-chevauchement, bornes valides).
- **Ergonomie spans** : très bonne (5/5) en apparence — mais l'override (B3) **recrée** la
  complexité : surcharger une phrase interne = supprimer 1 span + créer 3 → plus coûteux que
  le modèle dérivé.
- **Granularité phrase** : dégradée (2/5) au stockage : une phrase n'a plus forcément sa
  propre ligne ; la cibler exige de **découper** le span.
- **Justesse IAA** : **menacée** (2/5). `_theme_vector` devrait **forward-filler** les spans
  pour redevenir par phrase → on réintroduit exactement le débordement que **C4 a supprimé**.
  Toute erreur de borne fausse κ. Régression directe d'un correctif livré.
- **Coût implémentation** : très élevé (1/5) : migration DB + data backfill + DRF + contrat +
  `runs.ts` + store + `autosave.ts` (le diff par `anchorIndex` ne suffit plus : il faut diffuser
  par identité de span) + tests IAA refaits.
- **Migration** : **nécessaire et bloquante** (1/5) — déploiement plus risqué (cf. mémoire
  prod OLS).
- **Robustesse** : moyenne-faible (2/5) : invariants de spans (chevauchement/trous) à tenir
  côté serveur ET client.
- **Évolutivité** : bonne si l'on voulait des annotations **intrinsèquement** multi-phrases ;
  inutile ici car la vérité métier **est** la phrase (schéma CLAUDETTE, IAA par phrase).
- **Risque** : élevé (régression IAA, migration, double invariant).
- **Verdict** : apporte un confort de stockage **au prix** d'une régression IAA et d'une
  migration — **disproportionné** pour un besoin d'ergonomie.

---

## (c) Hybride « phrase atomique + bloc dérivé » — *RETENU*

**Principe.** Le stockage reste **pur par phrase** (modèle (a), intact). Le **bloc** est une
**vue dérivée** côté frontend : `deriveBlocks(computeRuns(drafts,n,{perSentence:true}))`
agrège les clauses contiguës de même thème. Les gestes de plage / poignées / double-clic
**produisent** des clauses par phrase via l'API store existante (`setBoundary`,
`removeBoundary`, `updateDraft`) + une primitive de **lot atomique** `applyBlockOp` pour
n'avoir **qu'un** undo par geste de plage.

- **Forces** :
  - **Zéro migration**, contrat API et IAA **inchangés** (préserve C4) ;
  - ergonomie de plage **complète** (B2/B4/B5) sans donnée nouvelle ;
  - **merge/split automatiques** : émergent de la re-dérivation → impossibles à
    désynchroniser (pas d'`end_index` à maintenir) ;
  - réutilise massivement l'existant : `computeRuns` (C4), `clauseRangeBetween`,
    `selectedSentences`/`selectedClauseIds`, undo/redo par snapshot, autosave par ancre,
    `SelectionToolbar` (P4/P8) et `SentenceMenu` (toggle par phrase) ;
  - override (B3) **trivial** : on change **une** clause, le split est dérivé (aucune
    réconciliation de span).
- **Faiblesses** :
  - un geste de plage = **N écritures** clause (mitigé : 1 transaction store + autosave
    debouncé/idempotent ; perf maîtrisée jusqu'à 300 phrases, cf. spec §8) ;
  - l'« identité » d'un bloc est éphémère (paire `(start, theme)`), donc pas d'attribut
    persistant attaché au bloc (acceptable : aucun besoin métier d'attribut au niveau bloc —
    les attributs vivent sur la `Clause`/phrase).
- **Ergonomie spans** : excellente (5/5) — plage, poignées, double-clic, merge auto.
- **Granularité phrase** : maximale (5/5) — la phrase reste l'unité réelle.
- **Justesse IAA** : maximale (5/5) — vecteur par phrase **inchangé** (B-IAA-1).
- **Coût implémentation** : faible-modéré (4/5) : 1 fonction pure `deriveBlocks`, 1 primitive
  store `applyBlockOp`, du câblage UI (poignées, double-clic, actions bloc de la toolbar).
  Backend : **rien**.
- **Migration** : **aucune** (5/5).
- **Robustesse** : très haute (5/5) — une seule source de vérité (clauses/phrase) ; le bloc
  est recalculé, jamais stocké → pas d'état divergent.
- **Évolutivité** : haute — la couche dérivée peut accueillir d'autres agrégations (par
  `legal_nature`, par certitude…) sans toucher au schéma.
- **Risque** : faible (concentré sur l'atomicité d'undo des lots et la perf, tous deux
  cadrés).
- **Verdict** : **meilleur compromis** ergonomie × IAA × coût × risque. Retenu.

---

## (d) Modèle hiérarchique sections / clauses

**Principe.** Introduire un niveau **section** (groupe de clauses) persistant, possiblement
imbriqué (document → sections → clauses → phrases). Le bloc devient une **section** stockée,
avec ses propres champs.

- **Forces** : modélisation riche, proche de la structure d'un contrat (titres, articles) ;
  utile pour une navigation documentaire avancée.
- **Faiblesses** : **sur-ingénierie** pour B ; nouvelle table + relations + invariants
  (couverture, imbrication, ordre) ; migration **majeure** ; complexité d'édition (déplacer
  une phrase entre sections, resync sections ↔ clauses) ; **IAA** : il faut décider si κ se
  calcule au niveau section ou phrase → si section, on **change la sémantique** de l'accord
  (rupture avec C4) ; si phrase, la hiérarchie n'apporte rien à l'IAA.
- **Ergonomie spans** : bonne (4/5) potentiellement, mais au prix d'une UX d'arbre lourde.
- **Granularité phrase** : conservable (3/5) mais la phrase n'est plus l'unité de premier
  plan.
- **Justesse IAA** : ambiguë (2/5) — dépend du niveau d'accord choisi ; risque de
  redéfinir/dégrader κ.
- **Coût implémentation** : très élevé (1/5) : modèle + migration + UI d'arbre + sync +
  contrat + IAA.
- **Migration** : **nécessaire et lourde** (1/5).
- **Robustesse** : moyenne (2/5) : plus d'entités = plus d'invariants à tenir.
- **Évolutivité** : la plus haute en théorie (structure documentaire), mais **hors besoin**
  exprimé (B1–B9 ne demandent pas de sections).
- **Risque** : élevé (périmètre, migration, sémantique IAA).
- **Verdict** : puissant mais **disproportionné** ; à reconsidérer **seulement** si un besoin
  futur de structuration documentaire (articles/sections) émerge — pas pour B.

---

## Synthèse comparative (lecture rapide)

| Modèle | Ergonomie spans | Granularité phrase | Justesse IAA | Coût | Migration | Robustesse | Risque |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| (a) Pur par phrase | 3 | 5 | 5 | nul | aucune | 5 | très faible |
| (b) Spans `end_index` | 5 | 2 | 2 | très élevé | requise | 2 | élevé |
| **(c) Hybride dérivé** | **5** | **5** | **5** | **faible** | **aucune** | **5** | **faible** |
| (d) Hiérarchique | 4 | 3 | 2 | très élevé | lourde | 2 | élevé |

Notes chiffrées pondérées dans `B-comparatif.csv`.

## Conclusion
Le modèle **(c) hybride dérivé** **domine** : il atteint l'ergonomie de plage de (b)/(d)
**tout en conservant** la granularité phrase et l'IAA exacte de (a), **sans migration** et
avec un coût/risque faibles. Il transforme le « bloc » d'une **donnée à maintenir** (sources
d'incohérence) en une **propriété calculée** (toujours cohérente avec les clauses). Décision
détaillée et alternatives écartées : `B-choix.md`.
