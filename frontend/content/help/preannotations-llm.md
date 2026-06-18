# Pré-annotations LLM

CLAIRE Studio peut **pré-remplir** une annotation à partir des propositions de
modèles de langage (Claude, Codex), pour accélérer le travail tout en gardant
l'humain décisionnaire.

## Pré-remplir

Dans la barre d'outils du workspace :

- **Pré-remplir depuis Claude** charge les ancres et thèmes proposés par Claude
  comme **brouillon éditable**. La provenance est tracée sur chaque clause.
- **Codex** fait de même à partir des propositions de Codex.

Vous restez libre de modifier, supprimer ou compléter chaque clause adoptée.

## Fantômes de comparaison

Les frontières proposées par les LLM mais **non encore retenues** par l'humain
restent affichées en **fantôme** (contour pointillé, étiquette `fantôme
claude:CODE`) dans le document. Elles servent uniquement de comparaison : elles
n'altèrent pas votre annotation tant que vous ne les adoptez pas.

Vous pouvez afficher ou masquer les fantômes de chaque juge via les bascules du
panneau Plan (« Fantôme LLM · claude » / « Fantôme LLM · codex »).

> La provenance (`claude` / `codex`) reste visible sur les clauses adoptées, ce
> qui permet d'auditer l'apport de chaque source.
