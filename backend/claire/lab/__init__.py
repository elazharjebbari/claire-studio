"""Pactiva Lab — production des jeux de données et orchestration des expériences.

Principe d'architecture (cf. `docs/pactiva-lab/02_ARCHITECTURE.md`) : **le calcul
scientifique ne vit PAS ici**. Cette app produit des jeux de données figés et signés,
les confie à un package Python autonome (`research/pactiva_lab/`), puis ingère ses
résultats. Aucun import de `torch`, `transformers` ou `sklearn` n'est autorisé dans
`claire/` — le backend doit rester léger et déployable.
"""
