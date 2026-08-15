/**
 * Glossaire des métriques — SOURCE UNIQUE des définitions courtes (info-bulles),
 * copiées telles quelles de `docs/pactiva-lab-resultats/05_CONTENUS_PEDAGOGIQUES.md` §3.
 * La version longue (exemples chiffrés) vit dans le centre d'aide.
 */

export const METRIC_GLOSSARY: Record<string, string> = {
  macroF1:
    "Moyenne du F1 calculé thème par thème : chaque thème compte autant, qu'il ait 19 ou 966 phrases. C'est la métrique exigeante : elle chute si les thèmes rares échouent.",
  microF1:
    "F1 calculé sur toutes les phrases confondues : les thèmes fréquents dominent. Toujours lire l'écart micro−macro : grand écart = le modèle vit sur les thèmes fréquents.",
  kappa:
    "Accord avec le gold, corrigé de la chance. Permet la seule comparaison directe modèle/humains/LLM (l'accord humain de référence est κ = 0,769).",
  ci: "L'intervalle dans lequel le score se déplacerait si l'on rejouait l'étude avec d'autres documents du même type. Calculé en rééchantillonnant les documents (jamais les phrases : les phrases d'un même document se ressemblent).",
  dispersion:
    "Écart-type du score entre les 5 plis de validation croisée. Sur un petit corpus, la dispersion compte autant que la moyenne : ± 0,03 signifie que le hasard du découpage déplace le score de 3 points.",
  ece: "Écart moyen entre la confiance annoncée et la justesse observée. 0 = parfaitement calibré. Un modèle sûr de lui et souvent dans l'erreur (ECE élevé) est dangereux en assistance à l'annotation.",
  humanCeiling:
    "Taux d'accord strict entre annotateurs, pris comme borne haute réaliste : un modèle ne peut pas être « plus d'accord avec les humains que les humains entre eux ». Approximé, car calculé sur le sous-ensemble multi-annoté ; c'est une bande de référence, pas un adversaire à battre.",
  lrap: "Qualité du CLASSEMENT des étiquettes proposées en multi-label : 1 = les bonnes étiquettes sont toujours en tête de liste. Complète le F1, qui ne voit pas l'ordre.",
  hammingLoss:
    "Fraction d'étiquettes erronées (oubliées ou ajoutées à tort) par phrase, en multi-label. Plus bas = mieux.",
  subsetAccuracy:
    "Part des phrases dont le jeu d'étiquettes est EXACTEMENT correct — la métrique la plus sévère du multi-label.",
  windowDiff:
    "Erreur de découpage en segments, mesurée par fenêtre glissante : pénalise les frontières manquées ou décalées. Plus bas = mieux.",
  pairedDelta:
    "La différence entre deux modèles évalués sur LES MÊMES documents, avec l'intervalle de confiance de cette différence et la probabilité d'observer un tel écart par hasard (obtenue en permutant les prédictions document par document). Si l'IC du Δ contient 0 : aucune différence démontrée à cet effectif.",
  agreementClasses:
    "Phrases où tous les annotateurs sont d'accord (strict) / où une majorité se dégage (majorité) / où ils divergent (divergence). Le taux d'erreur du modèle par classe dit s'il échoue là où les humains hésitent aussi.",
};

export function metricDefinition(key: string): string | undefined {
  return METRIC_GLOSSARY[key];
}
