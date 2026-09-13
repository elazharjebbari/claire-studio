"""pactiva_lab — entraînement et évaluation des modèles de thèmes de clauses.

Package **autonome** : il ne connaît ni Django, ni Pactiva, ni base de données. Il lit un
dossier de dataset (produit par `claire.lab.builder`), entraîne, évalue, et écrit un
dossier de résultats. Ce découplage est ce qui permet d'exécuter exactement le même code
sur un portable, sur le VPS et sur un nœud GPU Grid'5000 — et de publier le paquet tel
quel en annexe de l'article.

Trois invariants scientifiques sont imposés par le code, pas par la discipline :

1. **Découpage groupé par document.** Un découpage par phrase ferait fuir des phrases du
   même contrat entre entraînement et test ; les scores seraient gonflés et le résultat
   non publiable. Les plis viennent du dataset, figés, et ne sont jamais recalculés ici.
2. **Plafond humain sur chaque tâche.** Avec un α-MASI de 0,635 entre annotateurs, aucun
   modèle entraîné sur ce gold ne peut raisonnablement le dépasser : un score rapporté
   sans son plafond est ininterprétable.
3. **Intervalles de confiance par rééchantillonnage de DOCUMENTS.** Les phrases d'un même
   contrat ne sont pas indépendantes ; un bootstrap par phrase donnerait des intervalles
   faussement étroits.
"""

__version__ = "0.1.0"

# Capacités déclarées par CETTE version du package. Le runner refuse une configuration
# qui exige une capacité absente : sur un déploiement distant (Grid'5000) synchronisé à la
# main, un package périmé IGNORERAIT silencieusement `data.taxonomy` et produirait des
# résultats étiquetés T11 mais calculés en T20 — une fausse figure indétectable.
CAPABILITIES = frozenset({"taxonomy_projection", "population_filter"})
