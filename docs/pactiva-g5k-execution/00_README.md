# Exécution des expérimentations sur Grid'5000

Dossier d'exécution — 13–14 septembre 2026.

| Document | Contenu |
|---|---|
| [`01_AUDIT_ACCES.md`](01_AUDIT_ACCES.md) | Ce qui a été vérifié depuis la production, et les **trois défauts bloquants** trouvés |
| [`02_PLAN_ACTION.md`](02_PLAN_ACTION.md) | Le plan en cinq étapes, et ce qu'il ne fait délibérément pas |
| [`03_RUNBOOK.md`](03_RUNBOOK.md) | Séquence opératoire avec critères d'arrêt et table de diagnostic |
| [`04_RESULTATS.md`](04_RESULTATS.md) | Les chiffres obtenus, leurs réserves, et ce qui reste ouvert |

## En une page

**L'accès fonctionnait**, mais trois défauts se seraient tous manifestés *après* la
réservation d'un nœud : le package distant datait du 14 août et aurait produit des chiffres
T20 étiquetés T11 **sans aucune erreur** ; le cache de modèles était jeté à chaque job alors
que les nœuds n'ont pas Internet ; les GPU de lyon exigent le type de job `exotic`.

**Quatre runs Grid'5000** ont été exécutés, dont trois fine-tunings sur V100. La chaîne a
été validée par un job CPU de 15 minutes avant tout engagement de GPU.

**Deux résultats pour l'article.** La fusion T20→T11 tient sur un modèle capacitif (κ
0,695 → 0,720 ; l'écart au plafond humain passe de 0,289 à 0,140). Et une hypothèse
**réfutée** : l'agrégation en consensus a effacé le multi-étiquetage (1,04 étiquette par
phrase), si bien que le score multi-label ne mesure pas la tâche annoncée.

**Un acquis de méthode** : les baselines rejouées reproduisent les chiffres publiés à six
décimales, y compris entre exécution locale et exécution sur un nœud Grid'5000.
