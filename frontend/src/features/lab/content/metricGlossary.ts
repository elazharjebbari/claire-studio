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
  ci: "L'intervalle dans lequel le score se déplacerait si l'on rejouait l'étude avec d'autres documents du même type. Calculé en rééchantillonnant les documents (jamais les phrases : les phrases d'un même document se ressemblent). Un résultat sans IC ne va pas dans l'article.",
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
  alphaMasi:
    "α de Krippendorff avec distance MASI : l'accord sur des ENSEMBLES de thèmes (multi-label). Deux jeux partiellement recouvrants comptent comme accord partiel, pas comme désaccord total. Seuils : ≥ 0,667 acceptable, ≥ 0,8 fiable.",
  alphaNominal:
    "α de Krippendorff nominal sur le thème PRIMAIRE seul (projection mono-label) — le terme de comparaison d'E1 : ce que vaudrait l'accord si la tâche était mono-label.",
  alphaDiff:
    "α nominal − α-MASI, sur le même matériau : le prix de fiabilité du multi-label. L'IC (bootstrap par document, différence APPARIÉE) dit si ce coût est stable au rééchantillonnage.",
  gwetAc1:
    "Accord corrigé de la chance, robuste aux prévalences extrêmes — là où κ s'effondre mécaniquement (thème rare presque toujours absent). À lire EN COMPLÉMENT de l'α par thème, jamais à sa place.",
  boundaryJaccard:
    "Recouvrement des positions de début de segment entre deux annotateurs, sur les frontières RECONSTRUITES (plages de thèmes identiques). Le κ « d'ancres » vaut 1,0 par construction et ne mesure rien.",
  seedDivergence:
    "Part des phrases où le jeu de thèmes de l'annotateur diffère du juge LLM le plus proche. Borne INFÉRIEURE du travail d'édition réel : le juge de pré-remplissage n'est pas persisté (limite déclarée).",
  aucPr:
    "Aire sous la courbe précision-rappel : la qualité du classement des clauses par score d'anomalie, comparée au taux de base (~10 % d'abusives). Plus adaptée que l'AUC-ROC quand la classe positive est rare.",
  precisionAt:
    "Sur les k clauses les plus anormales selon le score, la part réellement abusive. C'est la métrique « utilisateur » : que trouve un juriste qui lit le haut de la pile ?",
  lift:
    "Precision@k divisée par le taux de base : 3× = le haut de la pile contient trois fois plus d'abusives que le hasard.",
  npmi:
    "Information mutuelle normalisée d'une paire de thèmes : −1 = jamais ensemble, 0 = indépendants, +1 = toujours ensemble. Le score npmi_min repère la paire la PLUS atypique d'une clause.",
  comboIdentity:
    "P(abusif | combinaison de thèmes) estimé sur l'entraînement — référence SUPERVISÉE : la borne haute de ce que l'identité de combinaison peut donner. Ce n'est PAS un détecteur non supervisé.",
};

export function metricDefinition(key: string): string | undefined {
  return METRIC_GLOSSARY[key];
}
