# Lire les métriques du Lab

Chaque chiffre d'une page de résultats porte une info-bulle de définition ; cette page
donne la version longue, avec des exemples.

## Les scores

**macro-F1** — Moyenne du F1 calculé thème par thème : chaque thème compte autant,
qu'il ait 19 ou 966 phrases. C'est la métrique exigeante : elle chute si les thèmes
rares échouent. *Exemple : un modèle parfait sur les 10 thèmes fréquents mais nul sur
les 10 rares plafonne à ~0,50 de macro-F1.*

**micro-F1** — F1 calculé sur toutes les phrases confondues : les thèmes fréquents
dominent. Toujours lire l'**écart micro−macro** : un grand écart signifie que le modèle
vit sur les thèmes fréquents. En multi-étiquettes, cet écart est le « point de
rigueur » que le papier documente au lieu de le cacher.

**κ (kappa de Cohen)** — Accord avec le gold, corrigé de la chance. C'est la seule
unité qui permette la comparaison directe modèle / humains / juges LLM — l'accord
humain de référence est **κ = 0,769**.

**LRAP** — Qualité du CLASSEMENT des étiquettes proposées en multi-étiquettes : 1 = les
bonnes étiquettes sont toujours en tête de liste. Complète le F1, qui ne voit pas
l'ordre.

**Hamming loss** — Fraction d'étiquettes erronées (oubliées ou ajoutées à tort) par
phrase. Plus bas = mieux.

**Subset accuracy** — Part des phrases dont le jeu d'étiquettes est EXACTEMENT
correct — la métrique la plus sévère du multi-étiquettes.

**WindowDiff / Pk** — Erreur de découpage en segments, mesurée par fenêtre glissante :
pénalise les frontières manquées ou décalées. **Plus bas = mieux** — attention, c'est
l'inverse des F1.

## L'incertitude

**IC 95 % (bootstrap par document)** — L'intervalle dans lequel le score se
déplacerait si l'on rejouait l'étude avec d'autres documents du même type. Calculé en
rééchantillonnant les **documents**, jamais les phrases : les ~195 phrases d'un même
contrat se ressemblent (vocabulaire, style, structure) — les rééchantillonner
donnerait des intervalles faussement étroits. *Un résultat sans IC ne va pas dans
l'article.*

**Dispersion inter-plis (±)** — Écart-type du score entre les 5 plis de validation
croisée. Sur un petit corpus, la dispersion compte autant que la moyenne : ± 0,03
signifie que le hasard du découpage déplace le score de 3 points.

**Δ apparié [IC], p (permutation)** — La différence entre deux modèles évalués sur
LES MÊMES documents, avec l'intervalle de confiance de cette différence, et la
probabilité d'observer un tel écart par hasard (obtenue en échangeant les prédictions
des deux modèles document par document, ~milliers de permutations). **Si l'IC du Δ
contient 0 : aucune différence démontrée à cet effectif** — ce qui n'est pas « les
modèles sont équivalents », mais « cet effectif ne permet pas de trancher ».

## Les références

**Plafond humain (approximé)** — Taux d'accord strict entre annotateurs, pris comme
borne haute réaliste : un modèle ne peut pas être « plus d'accord avec les humains que
les humains entre eux ». C'est une **approximation** (calculée sur le sous-ensemble
multi-annoté du dataset agrégé), affichée en bande avec sa propre incertitude — un
repère, pas un adversaire. *Un modèle à 0,72 quand le plafond est à 0,74 a
pratiquement tout appris de ce qui est apprenable.*

**Classes d'accord (strict / majorité / divergence)** — Phrases où tous les
annotateurs sont d'accord / où une majorité se dégage / où ils divergent. Le taux
d'erreur du modèle **par classe** est la lecture la plus instructive d'une page de
résultats : un modèle qui n'échoue que là où les humains divergent aussi a, en
pratique, atteint le plafond.

**ECE (erreur de calibration)** — Écart moyen entre la confiance annoncée et la
justesse observée. 0 = parfaitement calibré. Un modèle sûr de lui et souvent dans
l'erreur est dangereux en assistance à l'annotation : une suggestion à « 95 % » qui
n'a raison que 60 % du temps détruit la confiance dans l'outil. La courbe de
fiabilité montre OÙ le modèle est mal calibré, ce qu'un ECE agrégé cache.
