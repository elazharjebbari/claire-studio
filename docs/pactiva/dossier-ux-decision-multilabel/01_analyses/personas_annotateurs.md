# Personas — annotateurs juridiques Pactiva

> Trois profils qui se partagent l'atelier d'annotation. Ils ont des besoins distincts, mais
> manipulent les **mêmes trois canaux** (niveau C1–C5, provenance, multi-label). Le design doit
> servir les trois sans cloisonner l'outil : un même écran, des lectures différentes.

## Persona A — Léa, annotatrice débutante (guidage)

**Profil.** Juriste junior / stagiaire, formée au schéma d'annotation depuis quelques jours.
Connaît les thèmes mais hésite sur les frontières et sur le sens des niveaux. Travaille
lentement, vérifie beaucoup.

**Objectifs.**
- Ne pas se tromper ; comprendre *pourquoi* une suggestion est faite.
- Savoir, à chaque clause, **ce qu'on attend d'elle** (valider ? arbitrer ? ajouter un thème ?).
- Distinguer ce qui vient d'un modèle de ce qu'elle décide elle-même.

**Frustrations sur l'UI actuelle.**
- « Je vois bien `✓` ou `◷`, mais je ne sais pas si c'est *moi*, *le modèle* ou *le triage* qui
  l'a posé. » (provenance cantonnée à l'en-tête, 3 conventions).
- « C3, ça veut dire que c'est mal noté ? » — confusion niveau ≠ certitude.
- « J'ai validé, mais rien ne me confirme que le secondaire a bien été pris. » (pas de feedback
  C3).
- « La carte me propose Accepter, Confirmer, Valider… je clique lequel ? » (surcharge d'actions).

**Besoins de design.**
- **Règle nommée au geste** (« Validé via le triage — règle C2 · Haute ») pour apprendre en
  faisant.
- **Action primaire évidente** par niveau (un seul bouton qui ressort).
- **Provenance lisible partout** (forme ★/⚡/✎) pour comprendre l'origine sans creuser.
- **Feedback < 200 ms** rassurant après chaque geste.

**Citations types.**
> « Dis-moi quoi faire sur cette clause, et confirme-moi que c'est bien fait. »
> « Je ne veux pas casser ce que le modèle a proposé sans m'en rendre compte. »

## Persona B — Karim, annotateur expert (vitesse / raccourcis)

**Profil.** Juriste expérimenté, connaît le schéma par cœur, traite de gros volumes. Veut le
moins de friction possible. Travaille au clavier, n'ouvre l'inspecteur que pour les cas durs.

**Objectifs.**
- **Débit** : enchaîner les clauses faciles (C1/C2) sans quitter le clavier.
- N'investir de l'attention que là où c'est nécessaire (C3 multi-label, C4/C5 arbitrage).
- Pouvoir **revenir en arrière instantanément** s'il se trompe en allant vite.

**Frustrations sur l'UI actuelle.**
- « Pour un C1 évident, je veux *valider + suivant* en une touche, pas naviguer un popover. »
- « Quand je pose un multi-label en C3, j'aimerais un toggle réversible, pas chercher l'undo. »
- « L'overlay de niveau est opt-in : du coup je ne vois pas la priorité par défaut, je dois
  l'activer. »
- « Le multi-label n'apparaît pas dans le plan : je ne peux pas scanner les clauses riches. »

**Besoins de design.**
- **1-clic / 1-touche** sur C1/C2 (modèle « accept + next »).
- **Toggle 🏷 réversible** sur le multi-label (le toggle EST l'annulation, pas d'undo séparé
  pour le geste courant).
- **Niveau visible sans action** au moins pour C4/C5 (priorité d'attention).
- **Pastille `＋N` au plan** pour repérer les clauses multi-label d'un coup d'œil.
- Cibles ≥ 24 px en gouttière dense (ne pas rater le clic en allant vite).

**Citations types.**
> « Le facile doit être instantané ; je veux dépenser mon attention sur les C5. »
> « Si je me trompe à la volée, je re-clique et c'est annulé — point. »

## Persona C — Inès, reviewer / curatrice (visibilité qualité)

**Profil.** Responsable qualité / arbitre. N'annote pas en volume : elle **contrôle**, arbitre
les désaccords, vérifie la cohérence du corpus. Lit beaucoup, agit ponctuellement mais avec
des enjeux forts.

**Objectifs.**
- **Repérer** vite les zones à risque : C5 arbitrage, C4 majorité, clauses seedées non
  revues, multi-label douteux.
- **Tracer l'origine** de chaque décision (modèle / triage / humain) pour juger la fiabilité.
- Comparer les positions des annotateurs/juges sur les cas conflictuels.

**Frustrations sur l'UI actuelle.**
- « Je ne peux pas distinguer dans le plan une clause *adoptée d'un LLM* d'une clause *décidée à
  la main* — la coche est la même. » (P1/P4 de l'audit).
- « Le multi-label est invisible hors du popover : je ne sais pas où sont les sets riches sans
  ouvrir chaque clause. »
- « C4/C5 ne ressortent pas assez : je dois chasser les arbitrages. »
- « La provenance est dans l'en-tête, l'état dans la piste : je jongle entre deux endroits. »

**Besoins de design.**
- **Provenance lisible au plan et partout** (forme ★/⚡/✎ + état couleur) pour cibler les
  clauses seedées non revues.
- **Saillance forte de C5 puis C4** (couleur vive + `❗`, jamais auto-validé) pour aller droit
  aux arbitrages.
- **Multi-label visible à l'échelle du document** (`＋N`) pour auditer la couverture des
  secondaires.
- **Comparateur par juge** enrichi de la provenance dans l'inspecteur.
- Aucune action destructrice sans état réversible (filet pour ses arbitrages).

**Citations types.**
> « Montre-moi les arbitrages et les clauses encore tièdes du modèle ; je m'occupe du reste. »
> « Je veux savoir *d'où vient* une annotation avant de la valider comme référence. »

## Synthèse — tensions et arbitrages de design

| Tension | Léa (débutante) | Karim (expert) | Inès (reviewer) | Résolution design |
|---|---|---|---|---|
| Guidage vs vitesse | veut du guidage | veut zéro friction | veut du contrôle | **Adaptativité par niveau** : 1-clic en C1/C2 (Karim), carte explicative en C3 (Léa), alerte+décision en C4/C5 (Inès). |
| Visibilité de la provenance | « qui a validé ? » | secondaire | **critique** | Forme ★/⚡/✎ **partout** : invisible pour qui n'en a pas besoin, immédiate pour qui en a besoin. |
| Multi-label | besoin de confirmation | besoin de réversibilité | besoin de visibilité | Toggle 🏷 réversible + feedback (Léa/Karim) + pastille `＋N` au plan (Inès). |
| Densité | risque de surcharge | tolère la densité | lit beaucoup | 3 canaux **orthogonaux** à emplacements distincts : richesse sans collision. |

> Principe transverse : **un seul atelier, trois lectures**. Le design ne crée pas trois modes ;
> il rend chaque canal lisible *isolément*, de sorte que chaque persona « voit » ce qui le
> concerne sans être encombré par le reste.
