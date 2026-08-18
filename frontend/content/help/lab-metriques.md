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

## Les mesures d'accord (expérience « Mesures d'accord », E1–E4)

**α-MASI** — α de Krippendorff avec distance MASI : l'accord sur des **ensembles**
de thèmes (multi-étiquettes). Deux jeux partiellement recouvrants comptent comme un
accord partiel — via l'inclusion et le Jaccard — pas comme un désaccord total.
Seuils de Passonneau : **≥ 0,667 acceptable, ≥ 0,8 fiable**. *Sanity-check du
protocole : sur des étiquettes mono, α-MASI = α nominal.*

**α nominal (projection mono-label)** — Le même α, calculé sur le seul thème
**primaire** (distance 0/1) : ce que vaudrait l'accord si la tâche était mono-label.
C'est le terme de comparaison d'E1 — la différence α nominal − α-MASI est **le coût
du multi-label**, mesuré sur le même matériau. *Aperçu du 16 août 2026 : 0,688
contre 0,625, soit Δ = 0,063 [0,031 ; 0,086] en différence appariée par document.*

**Différence appariée (et « stabilité du signe »)** — Les deux α sont recalculés
sur les **mêmes tirages** bootstrap de documents : l'IC porte sur la différence
elle-même, pas sur deux intervalles comparés à l'œil. La « stabilité du signe » est
la part des tirages où le coût s'inverse — 0 % = un coût parfaitement stable. Ce
n'est pas une p-value de test nul.

**Gwet AC1** — Un accord corrigé de la chance **robuste aux prévalences extrêmes**,
là où κ et α s'effondrent mécaniquement. Le cas d'usage : un thème quasi absent
(DMCA, support 27) peut afficher α = −0,32 avec AC1 = 0,99 — les annotateurs sont
d'accord en pratique (« absent presque partout »), mais le peu de cas positifs les
divise. **Toujours lire l'α par thème AVEC l'AC1 et le support** ; aucun des trois
ne suffit seul.

**Jaccard des frontières reconstruites** — L'accord de segmentation entre deux
annotateurs, mesuré sur les **frontières reconstruites** : une frontière = la phrase
où l'ensemble de thèmes change. Jamais sur les ancres de clause — le pré-remplissage
dépose une ancre par phrase chez tout le monde, et cet « accord »-là vaut 1,000 par
construction (l'artefact que le correctif V1.1 a retiré). *Mesuré : 0,43–0,56 selon
les paires — la frontière est bien plus dure que le thème (0,69–0,75).*

**Divergence au juge le plus proche** — Pour un annotateur, la part de ses phrases
dont le jeu de thèmes diffère de chaque juge LLM ; le minimum désigne son « juge le
plus proche ». C'est une **borne inférieure** du travail d'édition réel (le juge de
pré-remplissage n'est pas persisté — limite déclarée). *41–52 % mesuré : très loin
d'une ratification du pré-remplissage.*

## La cascade gold (expérience « Cascade gold », E5)

**Les trois étages** — `auto_1click` : accord **unanime** des annotateurs (même
primaire, mêmes secondaires) — accepté d'un clic. `auto` : **majorité ≥ 2/3** sur le
primaire — accepté automatiquement. `manual` : **divergence réelle** — comité
humain. La somme des deux premiers est la rentabilité du protocole ; la part
`manual` est le budget d'arbitrage réel.

**« L'arbitre a contredit la pluralité »** — Parmi les conflits tranchés, combien de
décisions contredisent le vote majoritaire des annotateurs. C'est la ligne qui
justifie le comité : s'il ne fait que confirmer, un vote 2-1 automatique suffirait.

**Ambiguïté résiduelle** — Les conflits encore non tranchés. Une fois l'arbitrage
terminé, ce qui reste divergent est la mesure directe de l'**ambiguïté irréductible**
de la tâche — une statistique mesurée, plus un chiffre postulé.

**Finalisé (gold figé)** — Une résolution finalisée est **immuable** : recalcul sans
effet, décisions refusées. C'est ce qui rend un dataset gold citable dans un
article ; tant que rien n'est finalisé, la page affiche « chiffres d'aperçu ».

## La détection par co-occurrence (expériences « Co-occurrence », G2)

**Taux de base** — La part de segments abusifs dans le corpus (~19 % à l'aperçu).
C'est LA référence de toutes les métriques de détection : un « bon score » se lit
toujours **contre le taux de base**, pas contre 0,5.

**AUC-PR (average precision)** — L'aire sous la courbe précision-rappel : la qualité
du **classement** des clauses par score d'anomalie quand la classe positive est
rare. Un détecteur au niveau du taux de base ne détecte rien ; la référence
supervisée à 0,589 fait 3,2× mieux que le hasard. Préférée à l'AUC-ROC sur classes
déséquilibrées.

**precision@k et lift** — Sur les k clauses les plus anormales selon le score, la
part réellement abusive ; le **lift** la divise par le taux de base (2× = deux fois
mieux que le hasard). C'est la métrique « utilisateur » : que trouve un juriste qui
lit le haut de la pile ?

**NPMI (information mutuelle normalisée)** — Pour une paire de thèmes : −1 = jamais
ensemble, 0 = indépendants, +1 = toujours ensemble. Le score `npmi_min` d'une clause
est sa paire **la plus atypique** — il cible la co-occurrence pure, pas la rareté
marginale. Les clauses mono-thème reçoivent 0 (rang le moins anormal).

**Détecteurs, contrôles, référence — trois statuts à ne jamais confondre** — Les
**détecteurs non supervisés** (rareté de combinaison, NPMI min, LOF, IsolationForest,
OCSVM) n'utilisent jamais les labels. Le **contrôle négatif** (cardinalité : le
simple nombre de thèmes) est le détecteur naïf que l'hypothèse doit battre — mesuré
à un lift de 1,09×, quasi nul. La **référence supervisée** (`combo_identity` :
P(abusif | combinaison) apprise sur l'entraînement) est une **borne haute** de ce
que l'identité de combinaison peut donner avec supervision — ce n'est PAS un
détecteur, et l'écart entre elle et les détecteurs mesure exactement ce que la
supervision apporte.

**Segments, compression, hapax** — L'unité est le **segment reconstruit** (phrases
contiguës au même jeu de thèmes) ; la compression dit combien de phrases fusionnent
par segment. Un **hapax** est une combinaison vue une seule fois : beaucoup d'hapax
(110 sur 300 à l'aperçu) = les statistiques de combinaisons rares sont fragiles.

**Source `votes` (couches par annotateur)** — Les segments sont construits par
(document, annotateur) depuis les votes bruts : l'agrégation consensus aplatit les
thèmes secondaires des documents mono-annotateur, et le multi-étiquettes y
disparaîtrait (3,9 % contre ~42 % en brut). La validation croisée reste **par
document** — toutes les couches d'un document tombent dans le même pli, aucune
fuite. La cible finale reste la couche `aggregated` sur le gold arbitré.
