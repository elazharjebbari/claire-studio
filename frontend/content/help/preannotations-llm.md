# Pré-annotations LLM

CLAIRE Studio peut **pré-remplir** une annotation à partir des propositions de
modèles de langage — les **juges LLM** (aujourd'hui **Claude, Codex, Mistral**) —
pour accélérer le travail tout en gardant l'humain décisionnaire.

## Pré-remplir

Dans la barre d'outils du workspace, le sélecteur **Pré-remplir** charge les ancres
et thèmes proposés par **un juge** comme **brouillon éditable** ; basculez d'un juge
à l'autre (Claude, Codex, Mistral…) sans perdre votre travail. La provenance est
tracée sur chaque clause, et « Aucun » retire le pré-remplissage.

Vous restez libre de modifier, supprimer ou compléter chaque clause adoptée.

## Fantômes de comparaison

Les frontières proposées par un juge mais **non encore retenues** par l'humain
restent affichées en **fantôme** (contour pointillé, étiquette `fantôme
<juge>:CODE`) dans le document. Elles servent uniquement de comparaison : elles
n'altèrent pas votre annotation tant que vous ne les adoptez pas.

Vous pouvez afficher ou masquer les fantômes **de chaque juge** via les bascules du
panneau Plan (« Fantôme LLM · claude », « … codex », « … mistral », etc.).

> La provenance (`claude` / `codex` / `mistral` / …) reste visible sur les clauses
> adoptées, ce qui permet d'auditer l'apport de chaque source.
