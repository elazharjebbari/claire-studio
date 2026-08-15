/**
 * Introductions d'expérience — SOURCE UNIQUE des textes, copiés tels quels de
 * `docs/pactiva-lab-resultats/05_CONTENUS_PEDAGOGIQUES.md` §2 (ton de la charte §7 :
 * vouvoiement, phrases courtes, gras sur le mot-clé, jamais condescendant).
 *
 * Ne pas paraphraser ici : toute évolution éditoriale passe par le dossier d'abord.
 * Le lint éditorial (`labEditorial.test.ts`) vérifie la structure et les formulations.
 */

export interface ExperimentIntro {
  /** Ce que teste cette expérience (2-3 phrases, `**gras**` autorisé). */
  teste: string;
  /** Son rôle dans la publication (1-2 phrases). */
  role: string;
  /** Comment lire cette page (2-4 puces). */
  lire: string[];
}

export const EXPERIMENT_INTROS: Record<string, ExperimentIntro> = {
  "baseline-fast": {
    teste:
      "Un modèle volontairement simple (TF-IDF + classifieur linéaire) établit le **plancher** de performance : ce qu'obtient une méthode sans apprentissage profond, en quelques minutes de calcul. **Sans plancher, aucun gain n'est interprétable** — « 0,52 de macro-F1 » ne veut rien dire tant qu'on ignore ce qu'obtient la méthode la plus simple.",
    role:
      "Première ligne du tableau de résultats du papier long : tous les modèles s'y comparent, sur exactement les mêmes plis.",
    lire: [
      "Le chiffre clé est le **macro-F1 avec son intervalle de confiance** — pas un seuil à atteindre, une référence à dépasser.",
      "La bande grise est le **plafond humain approximé** : l'espace utile de progression va du plancher à cette bande.",
    ],
  },
  "position-only": {
    teste:
      "Un modèle qui ne voit **que la position** de la phrase dans le document — jamais son texte. Si la position seule prédit bien le thème, c'est que les CGU sont fortement structurées : les clauses de résiliation arrivent vers la fin, le préambule au début.",
    role:
      "Diagnostic amont de la question Q2 (« le thème est-il positionnel ? ») — si ce modèle est fort, l'ablation de contexte (F7) part d'une hypothèse déjà à moitié confirmée.",
    lire: [
      "Comparez ce score au plancher TF-IDF : s'il s'en approche, **la structure porte une grande part de l'information**.",
      "Un écart large entre ce modèle et les transformers mesure ce que le **lexique** ajoute à la structure.",
    ],
  },
  "llm-judges-baseline": {
    teste:
      "Les 4 juges LLM (préannotations figées, prompt documenté) évalués **sous le même protocole** que les modèles supervisés : mêmes documents, mêmes plis, même gold. C'est la seule façon de comparer honnêtement « ce que fait un LLM en zéro-shot » et « ce qu'apprend un modèle entraîné ».",
    role:
      "Figure F9 du papier long : humains, supervisé et LLM sur la même échelle de κ — elle « ferme la boucle » ouverte par le mur du κ. L'ordre attendu par le plan est **humains > supervisé > LLM**.",
    lire: [
      "La métrique est le **κ de Cohen contre le gold** — celle qui permet la comparaison directe avec l'accord humain (0,769).",
      "La matrice d'accord juge×juge indique si les LLM font les **mêmes** erreurs (accord élevé entre eux, faible avec le gold) ou des erreurs différentes.",
      "Cette baseline est **figée** : elle ne se relance pas, elle se cite.",
    ],
  },
  "screening-preprocess": {
    teste:
      "Un **criblage** : toutes les combinaisons de prétraitements (casse, détokenisation, longueur, fenêtre…) sur un modèle bon marché, pour repérer les axes qui ont un effet réel — et abandonner les autres AVANT de payer des heures de GPU.",
    role:
      "Section méthodologie du papier long : justifie les choix de prétraitement par une grille, pas par habitude.",
    lire: [
      "C'est une expérience **exploratoire** : pas de test de significativité par paire — un classement, des intervalles de confiance, et une règle de survie explicite : *une configuration est retenue si son intervalle touche celui de la meilleure*.",
      "L'**effet marginal par axe** est la vraie réponse : « la casse compte-t-elle ? » se lit dans le panneau par axe, pas dans le classement global.",
      "Les axes retenus seront **confirmés à l'étage suivant** par un test apparié — ce criblage éclaire, il ne prouve pas.",
    ],
  },
  "embeddings-frozen": {
    teste:
      "Des encodeurs **gelés** (aucun fine-tuning) avec une tête légère : le rapport qualité/coût maximal. La question n'est pas « est-ce le meilleur modèle ? » mais « **le fine-tuning vaut-il son coût ?** » — d'où les colonnes de coût à côté de la performance.",
    role:
      "Terme de comparaison de la question Q4 : si le fine-tuning ne gagne pas significativement, les embeddings gelés deviennent le choix défendable.",
    lire: [
      "Le verdict s'appuie sur un **test apparié par document** contre le run de fine-tuning comparable : Δ, intervalle de confiance du Δ, p-value de permutation.",
      "Un Δ dont l'intervalle contient 0 signifie : **aucune différence démontrée à cet effectif** — ce qui, à coût dix fois moindre, est un résultat en soi.",
    ],
  },
  "learning-curve": {
    teste:
      "La performance en fonction du **nombre de documents annotés** (5, 10, 20, 30, 39), chaque taille répétée 5 fois avec des tirages différents. Elle répond à la question la plus rentable du plan : **« quand peut-on arrêter d'annoter ? »**",
    role:
      "Figure F5 du papier long — et argument budgétaire pour la suite de la campagne d'annotation.",
    lire: [
      "Chaque point est un entraînement complet ; la bande autour de la moyenne vient de la variabilité des tirages.",
      "La courbe en pointillés est un **ajustement** (loi de puissance) : au-delà des données, c'est une **extrapolation** — la zone hachurée le rappelle, et elle s'arrête à ~100 documents : extrapoler plus loin serait de la fiction.",
      "Attention aux deux derniers points : avec 39 documents au total, les tailles 30 et 39 puisent presque tout le corpus — leur variance est artificiellement faible.",
    ],
  },
  "legal-bert-finetune": {
    teste:
      "Le **résultat principal** de la tâche T1 : un Legal-BERT affiné, évalué en validation croisée imbriquée, avec calibration et analyse d'erreurs. C'est la réponse à Q1 : « peut-on prédire le thème d'une clause à un niveau utile ? »",
    role:
      "Le chiffre-titre du papier long, exprimé en **pourcentage du plafond humain approximé** — jamais en absolu isolé.",
    lire: [
      "**macro-F1 [IC]** est le chiffre-titre ; **κ** permet la comparaison directe avec l'accord humain (0,769) et les juges LLM.",
      "La **calibration** (ECE) dit si les confiances du modèle sont honnêtes — une suggestion à 95 % qui n'a raison que 60 % du temps détruirait la confiance des annotateurs dans l'atelier.",
      "Le panneau **par classe d'accord** est la lecture la plus instructive : le modèle échoue-t-il surtout là où les humains divergent aussi ? Un modèle qui n'échoue que sur les cas de divergence humaine a, en pratique, atteint le plafond.",
    ],
  },
  "ablation-context": {
    teste:
      "La même architecture, en faisant varier UNE chose : le **contexte** donné au modèle (0, 1 ou 2 phrases voisines ; avec ou sans position dans le document). Toute différence s'interprète causalement, puisque tout le reste est constant.",
    role:
      "Figure F7 — présentée comme contribution originale : « le thème d'une phrase juridique est-il largement positionnel ? »",
    lire: [
      "Les 6 barres partagent les mêmes plis : les différences se testent **par paires appariées** (Δ, IC, p).",
      "Si la fenêtre n'apporte rien mais que la position apporte beaucoup, la réponse à Q2 est oui — et cela a une conséquence pratique : un modèle plus simple suffit.",
    ],
  },
  "multilabel-finetune": {
    teste:
      "Le passage au **multi-étiquettes** (T2) : une clause peut porter plusieurs thèmes. C'est le classifieur du papier phare — celui dont les scores alimentent l'hypergraphe de détection de clauses abusives.",
    role:
      "Résultat central [F1] du papier long ; le plafond de référence n'est plus κ mais **α-MASI 0,635** (l'accord multi-étiquettes est plus dur).",
    lire: [
      "**micro-F1** (chaque étiquette compte autant) sera nettement au-dessus de **macro-F1** (chaque thème compte autant) : c'est attendu — les thèmes rares sont fragiles. **L'écart micro−macro est le point de rigueur** : le papier l'assume et le documente au lieu de le cacher.",
      "**LRAP** mesure la qualité du classement des étiquettes proposées, ce que F1 ne voit pas.",
      "Le nuage F1 par étiquette vs fréquence (la « longue traîne ») montre thème par thème où le modèle est utilisable et où il ne l'est pas encore.",
    ],
  },
  "sequence-boundary": {
    teste:
      "Le **découpage** : où commence et finit chaque clause. C'est le point dur du projet — les humains eux-mêmes ne s'accordent que modérément sur les frontières (Jaccard 0,39–0,63 selon les paires).",
    role:
      "Tableau T3 du papier long, en regard de la fourchette d'accord humain — troisième contribution du papier court (la frontière est le vrai point dur, pas le thème).",
    lire: [
      "**WindowDiff** et **Pk** pénalisent les frontières décalées ; **plus bas = mieux** (contrairement au F1).",
      "La bande de référence est une **fourchette** (l'accord humain varie fortement selon les paires d'annotateurs) — un modèle « dans la fourchette » fait aussi bien que des humains entre eux.",
    ],
  },
  "knn-explainable": {
    teste:
      "Un classifieur par plus proches voisins : chaque prédiction s'explique par **les exemples annotés qui lui ressemblent**. Moins précis qu'un transformer, mais chaque décision est montrable à un juriste.",
    role:
      "Argument d'explicabilité (valeur AI & Law) et moteur possible de suggestions dans l'atelier — pas un résultat central.",
    lire: [
      "Le F1 se lit comme d'habitude ; la valeur ajoutée est dans les exemples voisins restitués par prédiction.",
    ],
  },
  "encoders-comparison": {
    teste:
      "À architecture constante, des encodeurs **juridiques** (Legal-BERT…) contre des **généralistes** : le pré-entraînement sur du droit paie-t-il sur nos CGU ?",
    role: "Tableau des encodeurs du papier long.",
    lire: [
      "Comparaisons appariées (mêmes plis) : Δ par paire d'encodeurs, IC, p — un encodeur juridique qui ne gagne pas significativement est un résultat publiable.",
    ],
  },
  "ablation-gold-quality": {
    teste:
      "Le même modèle entraîné sur le **gold arbitré** versus le **consensus automatique** : l'arbitrage humain des conflits améliore-t-il réellement le modèle aval ?",
    role:
      "Décision stratégique de campagne (E5 en écho) : poursuivre l'arbitrage ou s'en passer.",
    lire: [
      "Test apparié : si le Δ est nul, l'arbitrage garde sa valeur pour la MESURE de fiabilité, mais pas pour l'entraînement — deux usages à ne pas confondre.",
    ],
  },
  "ablation-label-noise": {
    teste:
      "La **robustesse au bruit** : on corrompt volontairement 5, 10, 20 % des étiquettes d'entraînement et on mesure la dégradation.",
    role:
      "Ablation G5 du papier phare : le classifieur qui alimente l'hypergraphe résiste-t-il à des annotations imparfaites ?",
    lire: [
      "La pente de dégradation importe plus que chaque point : une chute douce = un modèle utilisable même si la campagne d'annotation contient des erreurs résiduelles.",
    ],
  },
};

/** Introduction générique pour une expérience libre (mode expert, sans preset). */
export const GENERIC_INTRO: ExperimentIntro = {
  teste:
    "Une expérience **libre** : sa configuration ne suit aucun preset du plan scientifique. Les métriques standard s'appliquent, mais l'interprétation dépend de ce que vous avez fait varier.",
  role:
    "Hors du parcours des figures de l'article — utile pour explorer, à confirmer via un preset avant de citer.",
  lire: [
    "Lisez chaque score avec son **intervalle de confiance** et sa **dispersion inter-plis** — sur un petit corpus, la moyenne seule ment.",
    "Le **plafond humain approximé** reste la référence : un score s'exprime en pourcentage de ce plafond, jamais dans l'absolu.",
  ],
};

export function introFor(preset: string | null | undefined): ExperimentIntro {
  return EXPERIMENT_INTROS[(preset ?? "").trim()] ?? GENERIC_INTRO;
}
