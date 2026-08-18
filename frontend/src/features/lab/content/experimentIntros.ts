/**
 * Introductions d'expérience — SOURCE UNIQUE des textes pédagogiques du Lab.
 *
 * Structure et règles éditoriales : `docs/pactiva-lab-resultats/05_CONTENUS_PEDAGOGIQUES.md`
 * (§1 pour le schéma, §4 pour les formulations verrouillées ; ton de la charte §7 :
 * vouvoiement, phrases courtes, gras sur le mot-clé, jamais condescendant). Depuis
 * l'enrichissement du 16 août 2026 (§2-bis du dossier), CE fichier est le porteur
 * canonique des textes complets — versionné et lint-testé (`labEditorial.test.ts`) ;
 * le dossier garde les règles, pas les copies.
 *
 * Cinq volets par expérience :
 *   pourquoi   — le PROBLÈME auquel l'expérience répond (le piège évité, l'enjeu) ;
 *   teste      — ce que l'expérience fait concrètement ;
 *   role       — sa place dans les publications (figure, tableau, décision) ;
 *   lire       — comment lire la page de résultats (2-4 puces) ;
 *   metriques  — chaque notion et chaque métrique de CETTE page : son sens, et
 *                comment la lire ICI (seuils, ordres de grandeur, pièges).
 *
 * Les exemples chiffrés datés (« aperçu du 16 août 2026 ») viennent de
 * `docs/pactiva-experiences-papiers/04_RESULTATS_APERCU.md` — ils ancrent la lecture
 * mais bougeront avec la campagne ; les références publiées (κ 0,769 · α-MASI 0,635 ·
 * Jaccard 0,39–0,63) restent les repères verrouillés.
 */

export interface MetricNote {
  /** Nom affiché de la métrique ou de la notion (ex. « α-MASI », « lift »). */
  nom: string;
  /** Ce que cette métrique/notion SIGNIFIE — une à deux phrases concrètes. */
  sens: string;
  /** Comment la lire SUR CETTE PAGE : seuil, ordre de grandeur attendu, piège. */
  lecture: string;
}

export interface ExperimentIntro {
  /** Pourquoi cette expérience existe : le problème, le piège évité (2-3 phrases). */
  pourquoi: string;
  /** Ce que teste cette expérience (2-3 phrases, `**gras**` autorisé). */
  teste: string;
  /** Son rôle dans la publication (1-2 phrases). */
  role: string;
  /** Comment lire cette page (2-4 puces). */
  lire: string[];
  /** Notions & métriques de cette page — sens + lecture concrète. */
  metriques: MetricNote[];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Notes RÉUTILISABLES — les notions transverses dont le sens ne change pas d'une
 * page à l'autre. Une seule définition, réutilisée telle quelle : deux formulations
 * divergentes de « IC 95 % » seraient un bug éditorial.
 * ──────────────────────────────────────────────────────────────────────────── */

const NOTE_IC: MetricNote = {
  nom: "IC 95 % (bootstrap par document)",
  sens:
    "L'intervalle dans lequel le score se déplacerait si l'on rejouait l'étude avec d'autres documents du même type. Calculé en rééchantillonnant les DOCUMENTS, jamais les phrases : les ~195 phrases d'un même contrat se ressemblent, les rééchantillonner donnerait des intervalles faussement étroits.",
  lecture:
    "Un résultat sans IC ne va pas dans l'article. Avec ~39 documents, un IC de ±0,03 à ±0,05 est normal — un IC très étroit doit éveiller le soupçon (fuite, calcul par phrase).",
};

const NOTE_DISPERSION: MetricNote = {
  nom: "Dispersion inter-plis (±)",
  sens:
    "L'écart-type du score entre les 5 plis de validation croisée — ce que le hasard du découpage change au résultat.",
  lecture:
    "Sur un petit corpus, elle compte autant que la moyenne : ± 0,03 signifie que changer de découpage déplace le score de 3 points. Deux modèles séparés de moins que leur dispersion ne sont pas départagés.",
};

const NOTE_PLAFOND: MetricNote = {
  nom: "Plafond humain approximé",
  sens:
    "Le taux d'accord strict entre annotateurs, pris comme borne haute réaliste : un modèle ne peut pas être « plus d'accord avec les humains que les humains entre eux ».",
  lecture:
    "Une bande de référence avec sa propre incertitude, jamais un adversaire. On écrit « X % du plafond humain approximé ». Les plafonds diffèrent par tâche : κ 0,769 (thème), α-MASI 0,635 (multi-étiquettes), Jaccard 0,39–0,63 (frontières).",
};

const NOTE_DELTA: MetricNote = {
  nom: "Δ apparié [IC], p (permutation)",
  sens:
    "La différence entre deux modèles évalués sur LES MÊMES documents et les mêmes plis, avec l'IC de cette différence et la probabilité d'observer un tel écart par hasard (échange des prédictions document par document).",
  lecture:
    "Si l'IC du Δ contient 0 : « aucune différence démontrée à cet effectif » — jamais « les modèles sont équivalents ». La plateforme refuse de comparer des runs à plis différents.",
};

const NOTE_KAPPA_GOLD: MetricNote = {
  nom: "κ (kappa de Cohen) contre le gold",
  sens:
    "L'accord avec la référence, corrigé de l'accord dû au hasard — la seule unité qui permette la comparaison directe modèle / humains / juges LLM.",
  lecture:
    "Le repère est l'accord humain κ = 0,769 (0,66–0,73 selon les paires, aperçu du 16 août 2026). Un κ se lit toujours à côté de la prévalence : sur un thème quasi absent, il s'effondre mécaniquement.",
};

const NOTE_ECE: MetricNote = {
  nom: "ECE (erreur de calibration)",
  sens:
    "L'écart moyen entre la confiance annoncée par le modèle et sa justesse observée. 0 = parfaitement calibré.",
  lecture:
    "Décisif pour l'atelier : une suggestion affichée « 95 % » qui n'a raison que 60 % du temps détruit la confiance des annotateurs. La courbe de fiabilité montre OÙ le modèle est mal calibré, ce que l'ECE agrégé cache.",
};

/* ──────────────────────────────────────────────────────────────────────────── */

export const EXPERIMENT_INTROS: Record<string, ExperimentIntro> = {
  "baseline-fast": {
    pourquoi:
      "L'erreur la plus commune en classification appliquée : annoncer un score sans référence basse. « 0,52 de macro-F1 » impressionne — jusqu'à découvrir qu'un TF-IDF l'approche en trois minutes de CPU. Le plancher a une seconde fonction, défensive : un modèle simple **anormalement haut** sur un nouveau dataset signale une fuite (des phrases du même contrat des deux côtés du découpage) avant que des heures de GPU ne soient engagées.",
    teste:
      "Un modèle volontairement simple (TF-IDF + classifieur linéaire) établit le **plancher** de performance : ce qu'obtient une méthode sans apprentissage profond, en quelques minutes de calcul. **Sans plancher, aucun gain n'est interprétable** — « 0,52 de macro-F1 » ne veut rien dire tant qu'on ignore ce qu'obtient la méthode la plus simple.",
    role:
      "Première ligne du tableau de résultats du papier long : tous les modèles s'y comparent, sur exactement les mêmes plis. À relancer en premier sur tout nouveau dataset.",
    lire: [
      "Le chiffre clé est le **macro-F1 avec son intervalle de confiance** — pas un seuil à atteindre, une référence à dépasser.",
      "La bande grise est le **plafond humain approximé** : l'espace utile de progression va du plancher à cette bande.",
      "Le **F1 par thème** montre déjà la longue traîne : les thèmes rares (FEEDBACK 0,34 % du corpus) échouent dès ce plancher — tous les modèles suivants hériteront de cette difficulté.",
    ],
    metriques: [
      {
        nom: "macro-F1",
        sens:
          "Moyenne du F1 calculé thème par thème : chaque thème compte autant, qu'il ait 19 ou 966 phrases. La métrique exigeante — elle chute si les thèmes rares échouent.",
        lecture:
          "C'est le chiffre-titre de toutes les comparaisons. Un modèle parfait sur les 10 thèmes fréquents mais nul sur les 10 rares plafonne à ~0,50.",
      },
      {
        nom: "micro-F1",
        sens:
          "F1 sur toutes les phrases confondues : les thèmes fréquents dominent le calcul.",
        lecture:
          "Toujours lire l'écart micro−macro : un grand écart = le modèle vit sur les thèmes fréquents. C'est attendu ici, et c'est ce que les modèles suivants devront réduire.",
      },
      { ...NOTE_KAPPA_GOLD },
      { ...NOTE_ECE },
      { ...NOTE_IC },
      { ...NOTE_DISPERSION },
      { ...NOTE_PLAFOND },
    ],
  },

  "position-only": {
    pourquoi:
      "Les CGU sont un genre TRÈS structuré : préambule en tête, licence au milieu, résiliation et droit applicable vers la fin. Si la seule position prédit une bonne part du thème, alors tous les gains des modèles lexicaux doivent se lire **net de la structure** — le piège serait d'attribuer aux transformers ce que la mise en page donne gratuitement.",
    teste:
      "Un modèle qui ne voit **que la position** de la phrase dans le document — jamais son texte. Si la position seule prédit bien le thème, c'est que les CGU sont fortement structurées : les clauses de résiliation arrivent vers la fin, le préambule au début.",
    role:
      "Diagnostic amont de la question Q2 (« le thème est-il positionnel ? ») — si ce modèle est fort, l'ablation de contexte (F7) part d'une hypothèse déjà à moitié confirmée.",
    lire: [
      "Comparez ce score au plancher TF-IDF : s'il s'en approche, **la structure porte une grande part de l'information**.",
      "Un écart large entre ce modèle et les transformers mesure ce que le **lexique** ajoute à la structure.",
    ],
    metriques: [
      {
        nom: "Position relative (doc_position)",
        sens:
          "La seule entrée du modèle : l'index de la phrase divisé par la longueur du document, entre 0 (première phrase) et 1 (dernière).",
        lecture:
          "Le modèle apprend des zones (« 0,8–0,9 → LIMITATION_LIABILITY »). Il ne peut par construction rien distinguer À L'INTÉRIEUR d'une zone — ses erreurs dessinent la carte des thèmes qui ne sont PAS positionnels.",
      },
      {
        nom: "macro-F1 (contre le plancher TF-IDF)",
        sens:
          "Le même macro-F1 que partout — mais sa lecture est comparative : la question n'est pas « est-il bon ? », c'est « à quelle distance du plancher lexical est-il ? ».",
        lecture:
          "S'il atteint 60–80 % du plancher TF-IDF, la structure documentaire est un signal majeur : les gains lexicaux de tous les modèles suivants se liront net de cette part.",
      },
      { ...NOTE_IC },
      { ...NOTE_PLAFOND },
    ],
  },

  "llm-judges-baseline": {
    pourquoi:
      "Le « mur du κ » (κ 0,32–0,45 pour le LLM seul) a été mesuré pendant la campagne d'annotation, dans les conditions de l'atelier. Pour écrire dans l'article « le supervisé fait mieux que le zéro-shot », il faut réévaluer les juges **sous le protocole d'évaluation** — mêmes documents, mêmes plis, même gold — sinon la comparaison mélange deux protocoles et un relecteur la rejette. Cette baseline est gratuite : les préannotations sont déjà en base.",
    teste:
      "Les 4 juges LLM (préannotations figées, prompt documenté) évalués **sous le même protocole** que les modèles supervisés : mêmes documents, mêmes plis, même gold. C'est la seule façon de comparer honnêtement « ce que fait un LLM en zéro-shot » et « ce qu'apprend un modèle entraîné ».",
    role:
      "Figure F9 du papier long : humains, supervisé et LLM sur la même échelle de κ — elle « ferme la boucle » ouverte par le mur du κ. L'ordre attendu par le plan est **humains > supervisé > LLM**.",
    lire: [
      "La métrique est le **κ de Cohen contre le gold** — celle qui permet la comparaison directe avec l'accord humain (0,769).",
      "La matrice d'accord juge×juge indique si les LLM font les **mêmes** erreurs (accord élevé entre eux, faible avec le gold) ou des erreurs différentes.",
      "Cette baseline est **figée** : elle ne se relance pas, elle se cite.",
    ],
    metriques: [
      { ...NOTE_KAPPA_GOLD },
      {
        nom: "Matrice d'accord juge × juge",
        sens:
          "Le taux d'accord brut de chaque paire de juges sur les mêmes phrases — indépendamment du gold.",
        lecture:
          "Deux juges très d'accord entre eux mais peu avec le gold font les MÊMES erreurs (les cumuler n'apporte rien). Aperçu du 16 août 2026 : claude↔fable 0,80 (quasi redondants), codex↔mistral 0,34 — la famille de modèles pèse plus que le prompt.",
      },
      {
        nom: "Baseline figée",
        sens:
          "Les prédictions viennent des préannotations déjà en base (jamais relancées) : le comparateur est stable dans le temps et coûte zéro appel.",
        lecture:
          "Si le schéma d'annotation évolue, cette baseline reste celle du schéma v9.2 — un changement de version exigerait une nouvelle campagne de préannotation, pas un re-calcul.",
      },
      { ...NOTE_IC },
      { ...NOTE_PLAFOND },
    ],
  },

  "screening-preprocess": {
    pourquoi:
      "Chaque axe de prétraitement double la grille : 5 axes = 48 combinaisons, inabordables en fine-tuning GPU. Le criblage teste la grille complète sur un modèle bon marché et élimine les axes sans effet AVANT le coût. Le piège évité est statistique : tester 48 paires produirait mécaniquement 2–3 « p < 0,05 » par pur hasard — d'où un classement et une règle de survie, PAS une forêt de p-values.",
    teste:
      "Un **criblage** : toutes les combinaisons de prétraitements (casse, détokenisation, longueur, fenêtre…) sur un modèle bon marché, pour repérer les axes qui ont un effet réel — et abandonner les autres AVANT de payer des heures de GPU.",
    role:
      "Section méthodologie du papier long : justifie les choix de prétraitement par une grille, pas par habitude.",
    lire: [
      "C'est une expérience **exploratoire** : pas de test de significativité par paire — un classement, des intervalles de confiance, et une règle de survie explicite : *une configuration est retenue si son intervalle touche celui de la meilleure*.",
      "L'**effet marginal par axe** est la vraie réponse : « la casse compte-t-elle ? » se lit dans le panneau par axe, pas dans le classement global.",
      "Les axes retenus seront **confirmés à l'étage suivant** par un test apparié — ce criblage éclaire, il ne prouve pas.",
    ],
    metriques: [
      {
        nom: "Classement des configurations",
        sens:
          "Les 48 combinaisons ordonnées par macro-F1, chacune avec son IC — une carte, pas un verdict.",
        lecture:
          "Ne retenez jamais « la première » seule : tout ce dont l'IC touche celui de la meilleure est statistiquement indiscernable d'elle.",
      },
      {
        nom: "Effet marginal par axe",
        sens:
          "Pour un axe (ex. la casse), l'écart entre la moyenne de toutes les configurations « keep » et de toutes les « lower » — l'effet de l'axe, moyenné sur tout le reste.",
        lecture:
          "Sous 0,005 de macro-F1 (seuil exploratoire, dit tel quel), l'axe est déclaré négligeable au criblage et abandonné. Au-dessus, il passe à l'étage confirmatoire.",
      },
      {
        nom: "Règle de survie",
        sens:
          "Le critère explicite de sélection : une configuration survit si son IC touche celui de la meilleure.",
        lecture:
          "C'est l'anti-p-hacking : la règle est posée AVANT de regarder les résultats, et le papier la cite telle quelle.",
      },
      { ...NOTE_IC },
    ],
  },

  "embeddings-frozen": {
    pourquoi:
      "Le fine-tuning coûte des GPU-heures, une infrastructure et de la maintenance ; des embeddings gelés s'encodent une fois puis se réutilisent pour toutes les têtes. La question Q4 est donc une question de **coût/bénéfice**, pas de record. Résultat mesuré (Palier 6, 15-16 août 2026) : le fine-tuning ne gagne que +0,02 de macro-F1, non significatif — la preuve qu'« aucune différence démontrée » est une conclusion utile, pas un échec.",
    teste:
      "Des encodeurs **gelés** (aucun fine-tuning) avec une tête légère : le rapport qualité/coût maximal. La question n'est pas « est-ce le meilleur modèle ? » mais « **le fine-tuning vaut-il son coût ?** » — d'où les colonnes de coût à côté de la performance.",
    role:
      "Terme de comparaison de la question Q4 : si le fine-tuning ne gagne pas significativement, les embeddings gelés deviennent le choix défendable.",
    lire: [
      "Le verdict s'appuie sur un **test apparié par document** contre le run de fine-tuning comparable : Δ, intervalle de confiance du Δ, p-value de permutation.",
      "Un Δ dont l'intervalle contient 0 signifie : **aucune différence démontrée à cet effectif** — ce qui, à coût dix fois moindre, est un résultat en soi.",
    ],
    metriques: [
      {
        nom: "Encodeur gelé + tête légère",
        sens:
          "L'encodeur transforme chaque phrase en vecteur UNE fois (poids figés) ; seule une petite tête (régression logistique, SVM, kNN, MLP) apprend sur ces vecteurs.",
        lecture:
          "Le sweep encodeur × tête compare 16 combinaisons pour le prix d'un seul encodage par encodeur — c'est le cache d'embeddings qui rend le criblage de têtes quasi gratuit.",
      },
      {
        nom: "macro-F1 par variante",
        sens: "Le même chiffre-titre que partout, décliné par (encodeur, tête).",
        lecture:
          "Lisez d'abord les écarts ENTRE ENCODEURS (souvent grands), ensuite entre têtes (souvent petits) — investir dans l'encodeur paie plus que raffiner la tête.",
      },
      { ...NOTE_DELTA },
      { ...NOTE_IC },
      { ...NOTE_PLAFOND },
    ],
  },

  "knn-explainable": {
    pourquoi:
      "En AI & Law, une prédiction inexplicable est difficilement opposable : un juriste ne peut pas auditer un vecteur de probabilités. Le k-NN prédit « comme les k phrases annotées les plus proches » — chaque décision se VÉRIFIE en lisant ces k phrases. On accepte de perdre quelques points de F1 contre cette propriété ; encore faut-il mesurer combien.",
    teste:
      "Un classifieur par plus proches voisins : chaque prédiction s'explique par **les exemples annotés qui lui ressemblent**. Moins précis qu'un transformer, mais chaque décision est montrable à un juriste.",
    role:
      "Argument d'explicabilité (valeur AI & Law) du papier long et moteur possible de suggestions dans l'atelier — pas un résultat central. Le chiffre utile est le COÛT de l'explicabilité : l'écart au fine-tuning.",
    lire: [
      "Le F1 se lit comme d'habitude ; la valeur ajoutée est dans les **exemples voisins** restitués par prédiction.",
      "Comparez au fine-tuning : l'écart de macro-F1 est le **prix de l'explicabilité** — s'il est faible, le k-NN devient le candidat naturel pour les suggestions de l'atelier.",
    ],
    metriques: [
      {
        nom: "k (nombre de voisins)",
        sens:
          "La prédiction est le vote des k phrases d'entraînement les plus proches dans l'espace d'embeddings (k = 5 ici).",
        lecture:
          "Petit k = sensible au bruit d'annotation ; grand k = lissé mais aveugle aux thèmes rares (moins de k exemples existants). k = 5 est le compromis du plan.",
      },
      {
        nom: "Voisins restitués",
        sens:
          "Pour chaque prédiction, les k phrases annotées qui l'ont déterminée — l'explication elle-même.",
        lecture:
          "C'est la lecture qualitative qui compte : des voisins pertinents mais mal étiquetés révèlent un problème de GOLD, pas de modèle.",
      },
      {
        nom: "macro-F1 (contre le fine-tuning)",
        sens: "Le chiffre-titre, lu comme un écart au meilleur modèle.",
        lecture:
          "L'écart est le prix de l'explicabilité — à citer tel quel dans la discussion AI & Law.",
      },
      { ...NOTE_IC },
    ],
  },

  "learning-curve": {
    pourquoi:
      "L'annotation est LA ressource rare du projet : des semaines de travail humain qualifié par tranche de documents. « Faut-il continuer d'annoter ? » se décidait à l'intuition ; la courbe d'apprentissage en fait une mesure — le point où la courbe s'aplatit est le point où chaque document annoté supplémentaire cesse de payer. Le piège évité est l'extrapolation sans borne : au-delà de ~2,5× l'effectif observé, prolonger la courbe serait de la fiction.",
    teste:
      "La performance en fonction du **nombre de documents annotés** (5, 10, 20, 30, 39), chaque taille répétée 5 fois avec des tirages différents. Elle répond à la question la plus rentable du plan : **« quand peut-on arrêter d'annoter ? »**",
    role:
      "Figure F5 du papier long — et argument budgétaire pour la suite de la campagne d'annotation.",
    lire: [
      "Chaque point est un entraînement complet ; la bande autour de la moyenne vient de la variabilité des tirages.",
      "La courbe en pointillés est un **ajustement** (loi de puissance) : au-delà des données, c'est une **extrapolation** — la zone hachurée le rappelle, et elle s'arrête à ~100 documents : extrapoler plus loin serait de la fiction.",
      "Attention aux deux derniers points : avec 39 documents au total, les tailles 30 et 39 puisent presque tout le corpus — leur variance est artificiellement faible.",
    ],
    metriques: [
      {
        nom: "Taille d'entraînement (l'axe)",
        sens:
          "Le nombre de documents fournis à l'entraînement — tirés DANS le train de chaque pli (jamais dans le test : la fuite est bloquée par construction).",
        lecture:
          "Les répétitions à chaque taille (5 tirages différents) donnent la variance du hasard d'échantillonnage : c'est elle qui fait la bande autour de la moyenne.",
      },
      {
        nom: "Ajustement en loi de puissance",
        sens:
          "La courbe F1(n) = a − b·n^(−c) ajustée aux points observés — la forme standard des courbes d'apprentissage.",
        lecture:
          "Le paramètre « a » est le plateau suggéré. La zone d'extrapolation est bornée à 2,5× l'effectif : on écrit « la tendance suggère », jamais une promesse chiffrée au-delà.",
      },
      {
        nom: "macro-F1 par taille",
        sens: "Le chiffre-titre, à chaque taille d'entraînement.",
        lecture:
          "La lecture décisionnelle : le gain entre les deux dernières tailles, comparé à la dispersion — s'il est plus petit qu'elle, annoter davantage n'est plus le levier prioritaire (à confronter au coût réel d'un document annoté).",
      },
      {
        nom: "Artefact des dernières tailles",
        sens:
          "Aux tailles proches du corpus complet, les tirages « différents » se recouvrent presque entièrement.",
        lecture:
          "Leur variance est artificiellement FAIBLE — ne concluez pas à une stabilisation sur la seule foi des deux derniers points.",
      },
      { ...NOTE_IC },
    ],
  },

  "legal-bert-finetune": {
    pourquoi:
      "C'est LA question Q1 du plan : « peut-on prédire le thème d'une clause à un niveau utile ? » — sans ce chiffre, pas de papier. C'est aussi le chiffre que les relecteurs attaqueront en premier : d'où le blindage complet (validation croisée imbriquée, IC par document, calibration, analyse d'erreurs par classe d'accord humain) que les autres expériences n'ont pas toutes.",
    teste:
      "Le **résultat principal** de la tâche T1 : un Legal-BERT affiné, évalué en validation croisée imbriquée, avec calibration et analyse d'erreurs. C'est la réponse à Q1 : « peut-on prédire le thème d'une clause à un niveau utile ? »",
    role:
      "Le chiffre-titre du papier long, exprimé en **pourcentage du plafond humain approximé** — jamais en absolu isolé.",
    lire: [
      "**macro-F1 [IC]** est le chiffre-titre ; **κ** permet la comparaison directe avec l'accord humain (0,769) et les juges LLM.",
      "La **calibration** (ECE) dit si les confiances du modèle sont honnêtes — une suggestion à 95 % qui n'a raison que 60 % du temps détruirait la confiance des annotateurs dans l'atelier.",
      "Le panneau **par classe d'accord** est la lecture la plus instructive : le modèle échoue-t-il surtout là où les humains divergent aussi ? Un modèle qui n'échoue que sur les cas de divergence humaine a, en pratique, atteint le plafond.",
    ],
    metriques: [
      {
        nom: "macro-F1 [IC] — le chiffre-titre",
        sens:
          "Moyenne du F1 par thème (chaque thème compte autant), avec son IC par document.",
        lecture:
          "S'exprime en % du plafond humain approximé, jamais en absolu isolé. Le point de comparaison gratuit : les embeddings gelés (Q4) — l'écart mesuré au Palier 6 était de +0,02, non significatif.",
      },
      { ...NOTE_KAPPA_GOLD },
      { ...NOTE_ECE },
      {
        nom: "Erreurs par classe d'accord humain",
        sens:
          "Le taux d'erreur du modèle sur les phrases où les annotateurs étaient unanimes (strict), majoritaires, ou en divergence.",
        lecture:
          "LA lecture qui situe le modèle : des erreurs concentrées sur la classe « divergence » signifient qu'il échoue là où les humains hésitent aussi — en pratique, le plafond est atteint. Des erreurs sur « strict » sont les vraies fautes.",
      },
      {
        nom: "Paires de thèmes confondues",
        sens: "Les confusions les plus fréquentes de la matrice (vrai thème → prédit).",
        lecture:
          "Comparez-les aux confusions HUMAINES (α par thème de l'expérience Mesures d'accord) : une confusion partagée homme-machine est une ambiguïté du vocabulaire, pas un défaut du modèle.",
      },
      {
        nom: "Validation croisée imbriquée (inner_k)",
        sens:
          "Les hyperparamètres se choisissent sur un découpage INTERNE au train — jamais sur le pli de test.",
        lecture:
          "C'est ce qui rend le chiffre-titre citable : un tuning sur le test gonflerait le score sans que rien ne le signale.",
      },
      { ...NOTE_IC },
      { ...NOTE_DISPERSION },
      { ...NOTE_PLAFOND },
    ],
  },

  "ablation-context": {
    pourquoi:
      "La littérature classe presque toujours la phrase juridique ISOLÉE ; or un ToS est un document structuré, pas un sac de phrases. Si la fenêtre de voisinage ou la position portent une part mesurable du signal, c'est à la fois une contribution (« le thème est largement positionnel ») et une économie (un modèle plus simple suffit). L'ablation rend la lecture causale : UNE seule chose varie, tout le reste est constant.",
    teste:
      "La même architecture, en faisant varier UNE chose : le **contexte** donné au modèle (0, 1 ou 2 phrases voisines ; avec ou sans position dans le document). Toute différence s'interprète causalement, puisque tout le reste est constant.",
    role:
      "Figure F7 — présentée comme contribution originale : « le thème d'une phrase juridique est-il largement positionnel ? »",
    lire: [
      "Les 6 barres partagent les mêmes plis : les différences se testent **par paires appariées** (Δ, IC, p).",
      "Si la fenêtre n'apporte rien mais que la position apporte beaucoup, la réponse à Q2 est oui — et cela a une conséquence pratique : un modèle plus simple suffit.",
    ],
    metriques: [
      {
        nom: "Fenêtre de contexte (window_before)",
        sens:
          "Le nombre de phrases voisines concaténées à l'entrée du modèle (0, 1 ou 2) — toujours DANS le même document : une fenêtre qui déborderait sur le contrat suivant serait une fuite (testée).",
        lecture:
          "Comparez 0 → 1 → 2 : un gain qui sature à 1 dit que le voisinage immédiat suffit ; aucun gain renvoie le signal à la position ou au lexique seul.",
      },
      {
        nom: "Position dans le document (include_doc_position)",
        sens: "L'ajout (ou non) de la position relative comme feature explicite.",
        lecture:
          "À lire avec la baseline position-only : si la position seule prédit déjà beaucoup ET que cette feature ajoute encore au transformer, la structure documentaire est un signal indépendant du lexique.",
      },
      { ...NOTE_DELTA },
      { ...NOTE_IC },
    ],
  },

  "multilabel-finetune": {
    pourquoi:
      "La tâche RÉELLE du protocole d'annotation est multi-étiquettes — ~30 % des clauses portent plusieurs thèmes ; T1 (thème primaire seul) n'en est que la projection commode. C'est CE classifieur [F1] qui alimente l'hypergraphe de détection de clauses abusives : sa fiabilité conditionne toute la partie graphe. Et le plafond de référence change : l'accord humain multi-étiquettes (α-MASI) est plus dur que l'accord mono-label.",
    teste:
      "Le passage au **multi-étiquettes** (T2) : une clause peut porter plusieurs thèmes. C'est le classifieur du papier phare — celui dont les scores alimentent l'hypergraphe de détection de clauses abusives.",
    role:
      "Résultat central [F1] du papier long ; le plafond de référence n'est plus κ mais **α-MASI 0,635** (l'accord multi-étiquettes est plus dur).",
    lire: [
      "**micro-F1** (chaque étiquette compte autant) sera nettement au-dessus de **macro-F1** (chaque thème compte autant) : c'est attendu — les thèmes rares sont fragiles. **L'écart micro−macro est le point de rigueur** : le papier l'assume et le documente au lieu de le cacher.",
      "**LRAP** mesure la qualité du classement des étiquettes proposées, ce que F1 ne voit pas.",
      "Le nuage F1 par étiquette vs fréquence (la « longue traîne ») montre thème par thème où le modèle est utilisable et où il ne l'est pas encore.",
    ],
    metriques: [
      {
        nom: "micro-F1 vs macro-F1 (l'écart)",
        sens:
          "micro : toutes les étiquettes confondues (les fréquents dominent) ; macro : moyenne par thème (les rares pèsent autant). L'écart mesure la dépendance aux thèmes fréquents.",
        lecture:
          "Le repère du domaine : Legal-BERT sur UNFAIR-ToS affiche μ-F1 96 / macro 83 — un écart de 13 points chez le SOTA. Un écart comparable ici est attendu ; le papier le rapporte, jamais ne le cache.",
      },
      {
        nom: "LRAP",
        sens:
          "La qualité du CLASSEMENT des étiquettes proposées : 1 = les bonnes étiquettes sont toujours en tête de liste.",
        lecture:
          "Complète le F1 (qui ne voit pas l'ordre). Décisif pour l'atelier : des suggestions bien classées se valident vite, même si le seuil de coupure est imparfait. Absent si la tête ne produit pas de vraies probabilités — mieux vaut son absence qu'un chiffre faux.",
      },
      {
        nom: "Hamming loss",
        sens:
          "La fraction d'étiquettes erronées (oubliées ou ajoutées à tort) par phrase. Plus bas = mieux.",
        lecture:
          "La lecture « par erreur unitaire » : 0,05 = une étiquette sur vingt est fausse. Moins sévère que subset accuracy, plus parlante pour estimer la charge de correction.",
      },
      {
        nom: "Subset accuracy",
        sens:
          "La part des phrases dont le jeu d'étiquettes est EXACTEMENT correct — la métrique la plus sévère du multi-étiquettes.",
        lecture:
          "Toujours bien plus basse que les F1 : une seule étiquette secondaire manquante compte comme un échec total. À citer pour borner les attentes, pas pour comparer des modèles.",
      },
      {
        nom: "Plafond α-MASI 0,635",
        sens:
          "L'accord humain multi-étiquettes (α de Krippendorff, distance MASI) — le plafond propre à T2, plus dur que le κ de T1.",
        lecture:
          "Ne comparez JAMAIS un score T2 au κ 0,769 : les humains eux-mêmes perdent ~0,06 d'accord en passant au multi-étiquettes (Δ mesuré : 0,063, IC [0,031 ; 0,086], aperçu du 16 août 2026).",
      },
      { ...NOTE_IC },
      { ...NOTE_DISPERSION },
    ],
  },

  "sequence-boundary": {
    pourquoi:
      "La segmentation est le point dur MESURÉ du projet : les humains ne s'accordent sur les frontières qu'à 0,43–0,56 de Jaccard selon les paires (aperçu du 16 août 2026 ; fourchette publiée 0,39–0,63) — bien moins que sur les thèmes (0,69–0,75). Un modèle de frontières se juge donc contre une difficulté intrinsèque élevée ; l'ignorer conduirait à conclure à tort que « le modèle est mauvais » là où la tâche elle-même est ambiguë.",
    teste:
      "Le **découpage** : où commence et finit chaque clause. C'est le point dur du projet — les humains eux-mêmes ne s'accordent que modérément sur les frontières (Jaccard 0,39–0,63 selon les paires).",
    role:
      "Tableau T3 du papier long, en regard de la fourchette d'accord humain — troisième contribution du papier court (la frontière est le vrai point dur, pas le thème).",
    lire: [
      "**WindowDiff** pénalise les frontières manquées ou décalées ; **plus bas = mieux** (contrairement au F1).",
      "La référence humaine est une **fourchette** d'accord Jaccard (0,39 – 0,63 selon les paires) — une échelle différente de WindowDiff : un repère de difficulté de la tâche, pas une cible à croiser.",
    ],
    metriques: [
      {
        nom: "WindowDiff",
        sens:
          "L'erreur de découpage mesurée par fenêtre glissante : compte les endroits où les deux segmentations ne s'accordent pas sur le NOMBRE de frontières. 0 = parfait, 1 = maximalement discordant.",
        lecture:
          "PLUS BAS = MIEUX — l'inverse des F1. Plus juste que l'exactitude brute : une frontière décalée d'une phrase pénalise moins qu'une frontière absente.",
      },
      {
        nom: "Précision / rappel de frontière",
        sens:
          "Parmi les frontières prédites, la part correcte (précision) ; parmi les frontières réelles, la part trouvée (rappel).",
        lecture:
          "Le déséquilibre est diagnostique : précision haute + rappel bas = le modèle sous-segmente (fusionne des clauses) ; l'inverse = il sur-segmente.",
      },
      {
        nom: "Fourchette humaine (Jaccard 0,39–0,63)",
        sens:
          "L'accord de segmentation entre annotateurs, sur frontières RECONSTRUITES (changement d'ensemble de thèmes) — jamais sur les ancres, qui valent 1,0 par construction.",
        lecture:
          "Une FOURCHETTE (elle varie par paire), et une ÉCHELLE différente de WindowDiff : un repère de difficulté, pas une cible à croiser. La citer telle quelle dans le tableau T3.",
      },
      { ...NOTE_IC },
    ],
  },

  "encoders-comparison": {
    pourquoi:
      "« Les modèles pré-entraînés sur du droit sont meilleurs sur le droit » est une évidence supposée, rarement testée sur des CGU grand public — un genre à mi-chemin entre langue juridique et langue commerciale. La réponse est publiable dans les deux sens : un Legal-BERT qui ne gagne pas sur ce matériau est un résultat, pas un échec. À architecture et plis constants, seule l'origine du pré-entraînement varie.",
    teste:
      "À architecture constante, des encodeurs **juridiques** (Legal-BERT…) contre des **généralistes** (RoBERTa, DeBERTa, ModernBERT) : le pré-entraînement sur du droit paie-t-il sur nos CGU ?",
    role:
      "Tableau des encodeurs du papier long — et le choix d'encodeur de TOUTES les autres expériences en dépend : si un généraliste fait aussi bien, le pipeline gagne un écosystème plus riche.",
    lire: [
      "Comparaisons appariées (mêmes plis) : Δ par paire d'encodeurs, IC, p — un encodeur juridique qui ne gagne pas significativement est un résultat publiable.",
      "Lisez aussi le **par-thème** : le pré-entraînement juridique peut payer sur les thèmes techniques (ARBITRATION, GOVERNING_LAW) et rien ailleurs — un Δ global nul peut cacher deux effets opposés.",
    ],
    metriques: [
      {
        nom: "Checkpoint (l'axe du sweep)",
        sens:
          "Le point de départ du fine-tuning : mêmes données, mêmes hyperparamètres, seul le pré-entraînement diffère (juridique vs généraliste).",
        lecture:
          "Quatre encodeurs = six paires comparables. La conclusion s'énonce par PAIRE appariée, jamais par classement brut.",
      },
      {
        nom: "macro-F1 par encodeur",
        sens: "Le chiffre-titre, décliné par checkpoint.",
        lecture:
          "Les écarts typiques entre bons encodeurs sont de 1 à 3 points — souvent dans l'épaisseur des IC : c'est précisément pour cela que le test apparié est obligatoire.",
      },
      { ...NOTE_DELTA },
      { ...NOTE_IC },
      { ...NOTE_DISPERSION },
    ],
  },

  "ablation-gold-quality": {
    pourquoi:
      "L'arbitrage humain des conflits coûte cher (un comité phrase par phrase sur les divergences). Vaut-il ce coût POUR LE MODÈLE AVAL ? Attention au piège : le gold arbitré a DEUX usages — mesurer la fiabilité (là, l'arbitrage est indispensable) et entraîner un modèle (là, c'est une question empirique). Cette ablation ne tranche que le second usage.",
    teste:
      "Le même modèle entraîné sur des jeux de données de **maturités différentes** : annotations soumises brutes, consensus automatique, gold arbitré. L'arbitrage humain des conflits améliore-t-il réellement le modèle aval ?",
    role:
      "Décision stratégique de campagne (écho E5 du papier court) : poursuivre l'arbitrage ou s'en passer — pour l'entraînement. Sa valeur pour la MESURE de fiabilité n'est pas en cause.",
    lire: [
      "Test apparié entre maturités : si le Δ est nul, l'arbitrage garde sa valeur pour la MESURE de fiabilité, mais pas pour l'entraînement — deux usages à ne pas confondre.",
      "Tant qu'aucune résolution gold n'est **finalisée**, la comparaison n'a que deux points quasi identiques (post-V0, `submitted` ≈ `complete`) : le troisième point — le vrai test — attend le gold arbitré.",
    ],
    metriques: [
      {
        nom: "Maturité du dataset (submitted / complete / gold)",
        sens:
          "Le niveau d'exigence sur les annotations retenues : soumises (brutes), complètes (toutes clauses validées), gold (conflits arbitrés et figés).",
        lecture:
          "L'axe de l'ablation. Post-V0, submitted et complete coïncident presque — seule l'arrivée de résolutions FINALISÉES rendra le point « gold » réellement différent.",
      },
      {
        nom: "macro-F1 par maturité",
        sens: "Le chiffre-titre, entraîné sur chaque niveau de qualité du gold.",
        lecture:
          "La question n'est pas « quel score », mais « le Δ entre maturités est-il non nul » — un Δ nul est une économie de campagne documentée.",
      },
      { ...NOTE_DELTA },
      { ...NOTE_IC },
    ],
  },

  "ablation-label-noise": {
    pourquoi:
      "Le gold réel contiendra toujours des erreurs résiduelles : l'accord humain multi-étiquettes est de 0,625 d'α-MASI — en pratique, une part des étiquettes est disputée. Il faut savoir si le classifieur s'effondre au premier pourcent de bruit ou dégrade doucement : c'est ce qui décide si l'on peut entraîner sur des annotations imparfaites en attendant l'arbitrage complet.",
    teste:
      "La **robustesse au bruit** : on corrompt volontairement 5, 10, 20 % des étiquettes d'entraînement (corruption déterministe, jamais le test) et on mesure la dégradation.",
    role:
      "Ablation G5 du papier phare, versant classifieur : le modèle qui alimente l'hypergraphe résiste-t-il à des annotations imparfaites ?",
    lire: [
      "La pente de dégradation importe plus que chaque point : une chute douce = un modèle utilisable même si la campagne d'annotation contient des erreurs résiduelles.",
      "Le TEST n'est jamais corrompu : la dégradation mesurée est celle du modèle, pas celle de l'évaluation.",
    ],
    metriques: [
      {
        nom: "Taux de corruption (l'axe)",
        sens:
          "La fraction des étiquettes d'ENTRAÎNEMENT remplacées par une autre — sélection déterministe (hachage), reproductible d'une machine à l'autre.",
        lecture:
          "0 % est le point de référence ; les répétitions à chaque niveau donnent la variance. Un niveau ≈ un scénario de qualité de campagne : 10 % ≈ une campagne pressée, 20 % ≈ une campagne sans revue.",
      },
      {
        nom: "Pente de dégradation",
        sens:
          "La perte de macro-F1 par tranche de bruit — LA réponse de l'ablation, plus informative que chaque point isolé.",
        lecture:
          "Douce (quelques points de F1 pour 10 % de bruit) = robuste ; un décrochage brutal fixe le seuil de qualité au-dessous duquel la campagne ne doit pas descendre.",
      },
      {
        nom: "Corruption train-only",
        sens:
          "Le protocole : seules les étiquettes d'entraînement sont bruitées, l'évaluation reste propre.",
        lecture:
          "C'est ce qui rend la courbe interprétable — bruiter aussi le test mesurerait un artefact d'évaluation, pas la robustesse du modèle.",
      },
      { ...NOTE_IC },
    ],
  },

  /* ────────────────────────────────────────────────────────────────────────
   * Mesures d'accord & de gold (papier de mesure, E1–E5)
   * ──────────────────────────────────────────────────────────────────────── */

  "iaa-mesure": {
    pourquoi:
      "Règle des dossiers de publication : chaque chiffre d'accord doit être reproductible par un code versionné sur un **export daté** — jamais une requête ad hoc. Cette expérience est aussi le garde-fou contre les artefacts : l'ancien indicateur de frontières de la plateforme valait 1,000 par construction (une ancre par phrase) — le publier aurait été une erreur factuelle. Après V0 (16 août 2026), les mêmes calculs sont passés d'une paire à **3 paires sur 12 documents**, en un clic.",
    teste:
      "Les **mesures d'accord** des papiers, recalculées sur un export daté : le coût du multi-label (α-MASI contre α nominal, sur le même matériau), la matrice annotateurs × juges à vocabulaire constant, l'accord de **frontières reconstruites**, et la divergence de chaque annotateur au juge LLM le plus proche.",
    role:
      "Le socle chiffré du papier de mesure (E1 à E4) et du tableau « fiabilité » du papier long : chaque chiffre publié doit sortir d'ici, jamais d'une requête ad hoc.",
    lire: [
      "E1 se lit sur la **différence appariée** α nominal − α-MASI : son IC (par document) dit si le coût du multi-label est stable au rééchantillonnage.",
      "Dans la matrice, comparez humain↔humain et humain↔juge : le « mur du κ » est une **limite des modèles, pas de la tâche**.",
      "Par thème, lisez TOUJOURS l'α binaire AVEC le Gwet AC1 : sur un thème rare, l'α s'effondre mécaniquement (DMCA −0,32) pendant que l'AC1 reste haut — aucun des deux ne suffit seul.",
      "La divergence aux juges est une **borne inférieure** du travail d'édition réel (le juge de pré-remplissage n'est pas persisté — limite déclarée).",
    ],
    metriques: [
      {
        nom: "α-MASI (accord multi-étiquettes)",
        sens:
          "α de Krippendorff avec distance MASI : l'accord sur des ENSEMBLES de thèmes. Deux jeux partiellement recouvrants comptent comme accord partiel (via l'inclusion et le Jaccard), pas comme désaccord total.",
        lecture:
          "Seuils de Passonneau : ≥ 0,667 acceptable, ≥ 0,8 fiable. Mesuré : 0,625 [0,552 ; 0,694] (16 août 2026) — sous le seuil, et c'est LE résultat : le multi-label franchit le seuil vers le bas.",
      },
      {
        nom: "α nominal (projection mono-label)",
        sens:
          "Le même α, calculé sur le seul thème PRIMAIRE (distance 0/1) : ce que vaudrait l'accord si la tâche était mono-label — le terme de comparaison d'E1.",
        lecture:
          "Mesuré : 0,688 [0,599 ; 0,765]. La comparaison MASI/nominal n'a de sens que sur le MÊME matériau, les mêmes phrases, les mêmes annotateurs — c'est toute la construction d'E1.",
      },
      {
        nom: "Δ apparié (le coût) et stabilité du signe",
        sens:
          "α nominal − α-MASI calculés sur les MÊMES tirages bootstrap de documents : l'IC porte sur la différence elle-même, pas sur deux intervalles marginaux comparés à l'œil.",
        lecture:
          "Δ = 0,063 [0,031 ; 0,086], signe positif sur 100 % des tirages (16 août 2026). « pDirection » n'est pas une p-value de test nul : c'est la part des tirages où le coût s'inverse — 0 = coût parfaitement stable.",
      },
      {
        nom: "κ de Cohen par paire d'annotateurs",
        sens:
          "L'accord de chaque paire sur le thème primaire, corrigé du hasard — jamais un κ global seul (la charge entre annotateurs est inégale).",
        lecture:
          "Mesuré : 0,66–0,73 selon les paires (16 août 2026). La convergence des paires est l'argument contre « l'effet annotateur » ; une paire aberrante se verrait ici, pas dans une moyenne.",
      },
      {
        nom: "Jaccard des jeux de thèmes",
        sens:
          "Pour une paire, le recouvrement moyen des ensembles complets de thèmes (|A∩B| / |A∪B|) — la version multi-étiquettes de l'accord brut.",
        lecture:
          "Entre l'accord brut sur le primaire et l'α-MASI : il quantifie « d'accord sur l'essentiel, pas sur les secondaires » (0,67–0,72 mesuré).",
      },
      {
        nom: "Matrice annotateurs × juges (E2)",
        sens:
          "L'accord brut de chaque paire parmi {3 annotateurs} ∪ {4 juges}, sur le thème primaire (les juges ne produisent qu'un thème par phrase — limite déclarée).",
        lecture:
          "Trois blocs à lire : humain↔humain (0,69–0,75), humain↔juge (≤ 0,59 même pour le meilleur), juge↔juge (0,29–0,80). L'ordre humain ≫ juge est le cœur de la requalification du mur du κ.",
      },
      {
        nom: "α binaire par thème + Gwet AC1",
        sens:
          "Par thème : l'accord sur « ce thème est-il présent ? » (α binaire) et le même accord corrigé autrement de la chance (AC1, robuste aux prévalences extrêmes).",
        lecture:
          "Le paradoxe de prévalence, chiffré : DMCA α = −0,32 avec AC1 = 0,99 (support 27). Sous ~50 phrases de support, l'α n'est pas interprétable seul — c'est l'AC1 qui dit si les annotateurs s'accordent en pratique.",
      },
      {
        nom: "Support (par thème)",
        sens: "Le nombre d'unités multi-annotées où au moins un annotateur a posé ce thème.",
        lecture:
          "La première colonne à regarder : elle décide si l'α du thème a un sens. Publier un α sur support 9 sans le dire serait une faute.",
      },
      {
        nom: "Jaccard des frontières reconstruites (E3)",
        sens:
          "Une frontière = la phrase où l'ENSEMBLE de thèmes change (jamais les ancres de clause, qui valent 1,0 par construction). Jaccard des positions de début, par paire et par document.",
        lecture:
          "Mesuré : 0,43–0,56 par paire (16 août 2026), contre 0,69–0,75 d'accord thématique — la frontière est bien LE point dur. C'est la fourchette citée par le tableau T3.",
      },
      {
        nom: "Divergence au juge le plus proche (E4, aperçu)",
        sens:
          "Pour chaque annotateur, la part de ses phrases dont le jeu de thèmes diffère de CHAQUE juge — le minimum définit le « juge le plus proche ».",
        lecture:
          "41–52 % mesuré (16 août 2026) : très loin des ~5 % qu'on observerait si les annotateurs ratifiaient le pré-remplissage. Borne INFÉRIEURE du travail d'édition (le juge de seed n'est pas persisté — correctif V1.2 prospectif).",
      },
      { ...NOTE_IC },
    ],
  },

  "gold-cascade": {
    pourquoi:
      "Le protocole de gold promet que l'humain n'arbitre QUE les vrais conflits — c'est sa rentabilité, et la contribution « protocole » du papier de mesure exige de la chiffrer (E5). Il faut aussi vérifier que le comité SERT : un arbitre qui ne fait que ratifier le vote majoritaire serait un coût sans valeur. Aperçu du 16 août 2026 : ~71 % des phrases se résolvent automatiquement.",
    teste:
      "Le **coût de la cascade de résolution** : quelle part des phrases se résout automatiquement (unanimité, majorité ≥ 2/3), quelle part exige un arbitrage humain, et ce que cet arbitrage **change** par rapport à un simple vote.",
    role:
      "L'expérience E5 du papier de mesure — la rentabilité du protocole de gold, contribution « protocole » du papier.",
    lire: [
      "Tant qu'aucune résolution n'est **finalisée**, ces chiffres sont un aperçu : l'état s'affiche tel quel.",
      "« L'arbitre a contredit la pluralité N fois » est la ligne clé : elle sépare un comité utile d'une simple ratification.",
    ],
    metriques: [
      {
        nom: "Les trois étages (auto_1click / auto / manual)",
        sens:
          "auto_1click : accord UNANIME des annotateurs (même primaire, mêmes secondaires) — accepté d'un clic. auto : majorité ≥ 2/3 sur le primaire — accepté automatiquement. manual : divergence réelle — comité humain.",
        lecture:
          "Aperçu du 16 août 2026 : 40,9 % / 30,1 % / 28,9 %. La somme auto_1click + auto est la rentabilité du protocole ; la part manual est le budget d'arbitrage réel.",
      },
      {
        nom: "Part décidée",
        sens: "La fraction des phrases gold dont la décision est prise (auto ou arbitrée).",
        lecture:
          "0 % de décidé avec des étages calculés = la cascade a trié mais personne n'a encore arbitré ni finalisé — exactement l'état d'aperçu affiché.",
      },
      {
        nom: "Arbitrage : contredit / confirmé / sans pluralité",
        sens:
          "Parmi les conflits tranchés par l'arbitre : combien de décisions CONTREDISENT la pluralité des votes, la confirment, ou tranchent un cas sans pluralité (ex. 1-1-1).",
        lecture:
          "LA ligne qui justifie le comité : « contredit N fois » > 0 prouve que l'arbitre apporte autre chose qu'un vote — s'il ne fait que confirmer, un vote 2-1 automatique suffirait.",
      },
      {
        nom: "Ambiguïté résiduelle",
        sens: "Les conflits « manual » encore non tranchés.",
        lecture:
          "La mesure directe de l'« ambiguïté irréductible » quand l'arbitrage sera terminé : ce qui restera divergent APRÈS comité est l'ambiguïté réelle de la tâche, plus une statistique postulée.",
      },
      {
        nom: "Finalisé (gold figé)",
        sens:
          "Une résolution finalisée est IMMUABLE : recompute sans effet, décisions refusées — c'est ce qui rend un dataset gold citable.",
        lecture:
          "Les chiffres définitifs d'E5 (et le point « gold » de l'ablation qualité) exigent ≥ 3 résolutions finalisées — l'écran affiche cet état sans le masquer.",
      },
    ],
  },

  /* ────────────────────────────────────────────────────────────────────────
   * Hypergraphe & anomalies (papier long, partie graphe)
   * ──────────────────────────────────────────────────────────────────────── */

  "cooccurrence-abusivite": {
    pourquoi:
      "La raison d'être du programme est la détection d'anomalies dans les ToS — et son hypothèse centrale (« une clause abusive cumule une combinaison inhabituelle de thèmes ») doit être TESTÉE contre les labels CLAUDETTE, pas supposée : une combinaison rare peut être parfaitement licite. Le sondage ad hoc du 11 août (lift 7,4× sur l'identité des combinaisons, 1,09× sur leur simple nombre) devient ici une expérience versionnée, avec validation croisée par document et contrôles négatifs.",
    teste:
      "L'hypothèse centrale de la partie graphe : **l'identité des combinaisons de thèmes** d'une clause (pas leur nombre, pas leur rareté brute) porte un signal d'abusivité. Des scores d'anomalie non supervisés sont évalués **contre les labels CLAUDETTE**, en validation croisée par document.",
    role:
      "Le tableau 5 du papier long [G2] et l'artefact hypergraphe. Les contrôles négatifs (cardinalité, rareté) y figurent au même rang que les détecteurs — c'est ce qui rend le résultat défendable. Résultat d'aperçu (16 août 2026) : détecteurs non supervisés au niveau du taux de base, identité supervisée à 0,589 d'AUC-PR — la section se recentre sur « la co-occurrence comme signal supervisé faible ».",
    lire: [
      "**Rare ≠ abusif** : un détecteur ne vaut que s'il bat les contrôles négatifs.",
      "La « référence supervisée » (identité de combinaison) est une **borne haute**, pas un détecteur — elle dit ce que la structure seule pourrait donner avec supervision.",
      "Les combinaisons à fort lift (table descriptive) illustrent le motif juridique ; la **mesure de généralisation** est l'AUC-PR en validation croisée.",
      "Aperçu sur couches par annotateur (source `votes`) — à rejouer sur le gold arbitré.",
    ],
    metriques: [
      {
        nom: "AUC-PR (average precision)",
        sens:
          "L'aire sous la courbe précision-rappel : la qualité du CLASSEMENT des clauses par score, quand la classe positive (abusive) est minoritaire. Sa référence n'est pas 0,5 mais le TAUX DE BASE.",
        lecture:
          "Toujours lire contre le taux de base (18,6 % par segment, 16 août 2026) : AUC-PR 0,18 ≈ hasard ; 0,589 (référence supervisée) ≈ 3,2× le hasard. Préférée à l'AUC-ROC quand les positifs sont rares.",
      },
      {
        nom: "ROC-AUC",
        sens:
          "La probabilité qu'un segment abusif soit mieux classé qu'un non-abusif. 0,5 = hasard, insensible au déséquilibre de classes.",
        lecture:
          "Métrique secondaire ici (les positifs sont rares) — utile comme recoupement : un détecteur à ROC ≈ 0,5 ET AUC-PR ≈ base ne détecte rien, quelle que soit la lunette.",
      },
      {
        nom: "precision@k et lift",
        sens:
          "Sur les k segments les plus anormaux selon le score, la part réellement abusive ; le lift la divise par le taux de base (2× = deux fois mieux que le hasard).",
        lecture:
          "LA métrique « utilisateur » : que trouve un juriste qui lit le haut de la pile ? P@50 = 76 % (lift 4,1×) pour la référence supervisée, contre 12–22 % pour les détecteurs non supervisés (16 août 2026).",
      },
      {
        nom: "rarity (détecteur)",
        sens:
          "−log de la fréquence (lissée) de la combinaison exacte de thèmes, apprise sur les documents d'entraînement : « cette combinaison est-elle inhabituelle ? ».",
        lecture:
          "Le test direct de « rare = abusif » — mesuré au niveau du taux de base : la rareté brute ne détecte pas l'abusivité. Ce résultat négatif chiffré est une contribution, pas un échec.",
      },
      {
        nom: "npmi_min (détecteur)",
        sens:
          "La paire de thèmes LA PLUS atypique du segment, mesurée en information mutuelle normalisée (−1 : jamais ensemble · 0 : indépendants · +1 : toujours ensemble). Ne score que les segments multi-thèmes ; les mono reçoivent 0 (rang le moins anormal).",
        lecture:
          "Cible la co-occurrence pure, pas la rareté marginale. Même verdict que rarity à l'aperçu : au niveau du taux de base.",
      },
      {
        nom: "LOF / IsolationForest / OCSVM (détecteurs)",
        sens:
          "Trois détecteurs d'anomalies classiques appliqués au vecteur multi-hot des thèmes du segment — la « pile GAD » peu profonde de la littérature.",
        lecture:
          "Le socle de comparaison standard. S'ils sont au plancher comme les scores maison, la conclusion est structurelle : le signal n'est pas dans l'anomalie non supervisée. Absents si l'environnement n'a pas sklearn — c'est alors DIT (skippedScorers), jamais silencieux.",
      },
      {
        nom: "cardinality (contrôle négatif)",
        sens:
          "Le simple NOMBRE de thèmes du segment — le détecteur « naïf » que l'hypothèse doit battre.",
        lecture:
          "Mesuré dès le 11 août : lift 1,09×, quasi nul. Tout détecteur qui ne fait pas mieux que ce contrôle est réfuté — c'est sa fonction.",
      },
      {
        nom: "combo_identity (référence SUPERVISÉE)",
        sens:
          "P(abusif | combinaison) estimé sur l'entraînement (lissage vers le taux de base ; combinaison inédite → taux de base). La borne haute de ce que l'identité de combinaison peut donner AVEC supervision.",
        lecture:
          "Ce n'est PAS un détecteur non supervisé — l'écart entre cette référence (0,589) et les détecteurs (≈ 0,18) est la mesure exacte de ce que la supervision apporte. Ne jamais les confondre dans le texte.",
      },
      {
        nom: "Structure (segments, compression, combinaisons, hapax)",
        sens:
          "L'hypergraphe construit : combien de segments (clauses reconstruites), le taux de compression phrases→segments, combien de combinaisons distinctes et combien vues une seule fois (hapax).",
        lecture:
          "16 août 2026 : 4 384 segments (×1,74), 300 combinaisons dont 110 hapax, 42,3 % multi-thèmes. Beaucoup d'hapax = les statistiques de combinaisons rares sont fragiles — la raison pour laquelle un HGNN profond attendra plus de données.",
      },
      {
        nom: "Source `votes` (couches par annotateur)",
        sens:
          "Les segments sont construits par (document, annotateur) depuis les votes bruts — car l'agrégation consensus aplatit les secondaires des documents mono-annotateur (multi-thèmes 3,9 % contre ~42 % en brut).",
        lecture:
          "La validation croisée reste PAR DOCUMENT (toutes les couches d'un document dans le même pli — aucune fuite). À rejouer en source `aggregated` quand le gold arbitré existera : c'est la cible finale.",
      },
    ],
  },

  "cooccurrence-deontique": {
    pourquoi:
      "La nature déontique n'est PAS une donnée : le champ `legal_nature` est vide sur les 9 148 clauses, et CLAUDETTE ne la fournit pas. Le papier la traite donc en couche PRÉDITE, bruitée, dont on MESURE le coût ou le bénéfice — c'est la contribution D1 : personne ne quantifie l'effet d'une couche déontique imparfaite dans un pipeline d'anomalies juridiques. Un résultat négatif serait publiable ; l'aperçu du 16 août 2026 donne un résultat POSITIF.",
    teste:
      "L'ablation D1 : ajouter une **couche déontique prédite** (obligation / interdiction / permission, proxy à règles de modaux) à l'identité de combinaison améliore-t-elle ou dégrade-t-elle la détection ? Deux runs identiques en tout, sauf cette couche.",
    role:
      "La contribution méthodologique D1 du papier long. Aperçu du 16 août 2026 : détecteurs non supervisés inchangés, mais la référence supervisée passe de 0,589 à **0,637** d'AUC-PR (P@50 : 94 %) — la déontique prédite ajoute du signal discriminant.",
    lire: [
      "Comparez l'AUC-PR avec/sans : l'écart mesure ce que la déontique prédite apporte — ou le bruit qu'elle injecte.",
      "La couche est un **proxy à règles déclaré** (macro-F1 ~0,6 pour un vrai classifieur LexDeMod-style) : la conclusion porte sur la méthode de mesure, pas sur la déontique idéale.",
    ],
    metriques: [
      {
        nom: "Tag déontique (le proxy à règles)",
        sens:
          "Chaque segment reçoit une étiquette obligation / interdiction / permission / constat par détection de modaux (shall, must, may not, reserves the right…), avec priorité interdiction > obligation > permission.",
        lecture:
          "Un PROXY assumé d'un classifieur entraîné (dont le macro-F1 plafonne à ~0,6 dans la littérature) — le papier le déclare tel quel. Le tag s'ajoute à l'IDENTITÉ de la combinaison : (FEES+MODIF, obligation) ≠ (FEES+MODIF, permission).",
      },
      {
        nom: "Δ d'AUC-PR avec/sans (la réponse de D1)",
        sens:
          "L'écart de chaque scorer entre les deux runs — tout le reste (plis, segments, graine) est identique.",
        lecture:
          "Lisez-le par TYPE de scorer : +0,05 sur la référence supervisée avec détecteurs inchangés (aperçu du 16 août) signifie que la déontique enrichit l'identité de combinaison, pas l'anomalie non supervisée.",
      },
      {
        nom: "AUC-PR / precision@k / lift",
        sens: "Les mêmes métriques d'évaluation que le pivot G2 (voir cette expérience).",
        lecture:
          "Toujours contre le taux de base (18,6 %), avec IC par document ; P@50 = 94 % pour la référence supervisée avec déontique — le chiffre le plus parlant de l'ablation.",
      },
    ],
  },

  "cooccurrence-bruit": {
    pourquoi:
      "Le pipeline réel n'aura jamais des thèmes parfaits en amont : le classifieur multi-étiquettes est fragile sur les thèmes rares (macro-F1 ~0,6 dans le pire scénario réaliste). Avant de brancher la détection sur des thèmes PRÉDITS, il faut la borne de fiabilité : à quel niveau de dégradation des thèmes la détection s'effondre-t-elle ? C'est la « boucle de risque » du dossier — thèmes rares mal prédits ET porteurs d'anomalie.",
    teste:
      "L'ablation G5 côté détection : on **dégrade les thèmes d'entraînement** (10 à 35 % de corruption, simulant un classifieur amont qui passerait de 0,83 à ~0,60 de macro-F1) et on mesure la stabilité des anomalies détectées.",
    role:
      "La borne de fiabilité opérationnelle du pipeline complet. Aperçu du 16 août 2026 : la référence supervisée dégrade DOUCEMENT — 0,589 → 0,506 d'AUC-PR à 35 % de corruption, soit 86 % du signal conservé.",
    lire: [
      "La pente compte plus que chaque point : une chute douce = un pipeline utilisable même avec un classifieur imparfait en amont.",
      "Le test ne touche jamais l'évaluation — seule la « normalité » apprise est bruitée.",
    ],
    metriques: [
      {
        nom: "Taux de corruption (l'axe : 0 / 10 / 20 / 35 %)",
        sens:
          "La fraction des segments d'ENTRAÎNEMENT dont un thème est remplacé (sélection déterministe par hachage, reproductible) — chaque niveau simule une qualité de classifieur amont.",
        lecture:
          "35 % ≈ le pire scénario réaliste (macro-F1 ~0,60 sur les rares). Le point 0 % doit coïncider avec le pivot G2 — c'est le contrôle de cohérence de l'ablation.",
      },
      {
        nom: "AUC-PR par niveau de bruit",
        sens: "La métrique du tableau 5, recalculée à chaque niveau de dégradation.",
        lecture:
          "Lisez la SÉRIE, pas un point : 0,589 → 0,583 → 0,557 → 0,506 (16 août 2026) — une pente douce. Les détecteurs non supervisés, déjà au plancher, ne bougent pas : le bruit ne peut pas dégrader un signal absent.",
      },
      {
        nom: "Bruit train-only",
        sens:
          "Seule la « normalité » apprise (statistiques de combinaisons du train) est bruitée ; les segments évalués gardent leurs vrais thèmes et leurs vrais labels.",
        lecture:
          "C'est ce qui fait de la courbe une mesure de ROBUSTESSE : bruiter aussi l'évaluation mesurerait autre chose (la dégradation de la vérité terrain).",
      },
    ],
  },
};

/** Introduction générique pour une expérience libre (mode expert, sans preset). */
export const GENERIC_INTRO: ExperimentIntro = {
  pourquoi:
    "Le mode expert permet de sortir des presets — utile pour explorer une intuition, dangereux pour publier : une configuration libre n'a ni question décisionnelle posée à l'avance, ni place dans les figures des papiers. L'exploration est légitime ; la citation exige de repasser par un preset.",
  teste:
    "Une expérience **libre** : sa configuration ne suit aucun preset du plan scientifique. Les métriques standard s'appliquent, mais l'interprétation dépend de ce que vous avez fait varier.",
  role:
    "Hors du parcours des figures de l'article — utile pour explorer, à confirmer via un preset avant de citer.",
  lire: [
    "Lisez chaque score avec son **intervalle de confiance** et sa **dispersion inter-plis** — sur un petit corpus, la moyenne seule ment.",
    "Le **plafond humain approximé** reste la référence : un score s'exprime en pourcentage de ce plafond, jamais dans l'absolu.",
  ],
  metriques: [NOTE_IC, NOTE_DISPERSION, NOTE_PLAFOND, NOTE_DELTA],
};

export function introFor(preset: string | null | undefined): ExperimentIntro {
  return EXPERIMENT_INTROS[(preset ?? "").trim()] ?? GENERIC_INTRO;
}
