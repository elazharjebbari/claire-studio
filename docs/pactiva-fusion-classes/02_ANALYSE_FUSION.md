# 02 — Analyse : quelles fusions, pourquoi, avec quels effets mesurés

## 1. Position du problème

La taxonomie v1 (20 thèmes) a été conçue pour la **finesse descriptive** de
l'atelier d'annotation. Trois pathologies mesurées (fascicule 01) la rendent
sous-optimale pour le **traitement** :

1. **Queue de distribution famélique** : 7 thèmes sous 300 phrases, 4 sous 100.
   À cet effectif, ni un classifieur ni une statistique par classe ne convergent.
2. **Fiabilité bimodale** : FEEDBACK α = 0,099, DMCA 0,240, COMMUNICATIONS 0,328 —
   trois classes dont l'existence même n'est pas reproductible entre annotateurs,
   pendant que ARBITRATION_DISPUTES atteint 0,858.
3. **Recouvrements sémantiques systématiques** : 29,7 % des paires d'annotateurs
   divergent sur le primaire, et cette masse est **concentrée dans 5 grappes**
   stables (cadrage, contenu/PI, compte/usage, risque, litiges/droit) — ce ne sont
   pas des erreurs d'inattention mais des frontières conceptuelles floues entre
   classes voisines.

La littérature nomme ce phénomène le compromis **granularité vs fiabilité** (connu
en annotation de discours et acté par LEDGAR, qui a réduit ~12 000 intitulés de
provisions contractuelles à 100 classes exploitables). Notre apport : le trancher
**par la mesure**, pas par convention.

## 2. Cadre de décision — quatre critères, un garde-fou

Une fusion {A, B} → C n'est candidate que si les signaux convergent :

| Critère | Mesure | Seuil indicatif |
|---|---|---|
| **C1. Confusabilité** | C(A,B) = désaccords/(accords_A+accords_B+désaccords) | parmi le haut du classement (≥ 0,06) |
| **C2. Fiabilité déficiente** | α binaire de A ou B | l'une des deux < 0,60 |
| **C3. Cohérence juridique** | les clauses relèvent de la même fonction contractuelle | jugement métier explicite |
| **C4. Support** | support résultant | classe fusionnée ≥ 300 phrases |

**Garde-fou G (strates d'abusivité)** : ne jamais fusionner deux thèmes dont les
P(abusif | thème) appartiennent à des strates opposées (lift ≥ 3 vs lift ≤ 1).
Motif : la fusion diluerait le signal que la détection aval doit exploiter — le
gain de fiabilité serait payé en pouvoir de détection, ce qui contredit l'objectif
du papier long. Ce garde-fou est le **critère décisif** entre T10 et T11 (§5).

Corollaire assumé : une classe **fiable mais rare** (PROMOTIONS, α = 0,796,
33 phrases) est fusionnée quand même si C1/C3/C4 l'exigent — la fiabilité ne
compense pas un support inexploitable ; l'information fine reste dans les
annotations (la fusion est un remapping amont, réversible).

## 3. Les grappes, une à une

### Grappe 1 — Cadrage (PREAMBLE_SCOPE, MISC_BOILERPLATE, META, COMMUNICATIONS, PROMOTIONS)

La plus grosse masse de confusion du corpus (143 + 38 + 38 paires…, C jusqu'à
0,235). Fonction commune : **encadrer le contrat** (objet, définitions, divers,
notifications, offres) sans créer d'obligation substantielle pour l'utilisateur.
Fiabilités : 0,561 / 0,455 / 0,535 / 0,328 / 0,796. Abusivité : toute la grappe
est sous le taux de base (lift ≤ 0,8) sauf un résidu USE sur PREAMBLE_SCOPE
(« contract by using » — capté par le schéma de clause du fascicule 05, pas par la
taxonomie). → **FRAMEWORK** (1 544 phrases, α simulé 0,660).

### Grappe 2 — Contenu & propriété intellectuelle (LICENSE_IP, USER_CONTENT, DMCA, FEEDBACK)

Le quatuor des licences croisées : licence de la plateforme sur le contenu de
l'utilisateur (USER_CONTENT), licence de l'utilisateur sur le contenu de la
plateforme (LICENSE_IP), leur police (DMCA), leur cas limite (FEEDBACK — licence
sur les suggestions). Les annotateurs tracent la frontière chacun à leur endroit :
114 + 92 + 38 désaccords. FEEDBACK (α = 0,099) et DMCA (0,240) sont les deux
classes les moins fiables du corpus. Abusivité homogène basse (0,035–0,095), le CR
(« content removal ») restant identifiable par catégorie CLAUDETTE.
→ **CONTENT_IP** (1 684 phrases, α simulé 0,751 — **au-dessus de sa meilleure
composante isolée**, car les désaccords internes deviennent des accords).

### Grappe 3 — Compte & usage (ELIGIBILITY_ACCOUNT, ACCEPTABLE_USE)

90 désaccords : conditions d'accès au service et conditions d'usage du service
sont deux faces d'une même police d'accès (« qui peut l'utiliser, pour quoi »).
Fiabilités moyennes (0,699 / 0,654), abusivité basse homogène (0,036 / 0,040).
→ **ACCOUNT_USE** (1 838 phrases, α simulé 0,717).

### Grappe 4 — Litiges & droit (ARBITRATION_DISPUTES, GOVERNING_LAW)

45 désaccords ; GOVERNING_LAW (144 phrases, α = 0,587) est un satellite rare
d'ARBITRATION_DISPUTES (0,858). Fonction commune : régler le contentieux (forum,
procédure, droit applicable). Abusivité compatible (0,125 / 0,434 — même strate
intermédiaire-haute ; les catégories CLAUDETTE A, J et LAW restent distinctes dans
la référence). → **DISPUTES_LAW** (1 054 phrases, α simulé 0,855 — la fiabilité
d'ARBITRATION_DISPUTES n'est pas diluée).

### Grappe 5 — Risque (LIMITATION_LIABILITY, WARRANTY_DISCLAIMER) : **REJETÉE**

66 désaccords, sémantique voisine (clauses exculpatoires) — les critères C1–C4
passent, et l'α simulé de la fusion (0,799) est bon. **Mais le garde-fou G
l'interdit** : P(abusif | LIMITATION_LIABILITY) = 0,385 (lift 3,5, cœur de la
catégorie LTD) contre P(abusif | WARRANTY_DISCLAIMER) = 0,039. La fusion diluerait
le thème le plus prédictif de l'abusivité dans une classe deux fois plus grosse et
quatre fois moins dense — l'effet est mesuré au §5 : −12,6 % d'average precision.
C'est toute la différence entre T10 et T11.

### Cas gardés séparés (décisions négatives explicites)

- **FEES_PAYMENT ↔ TERMINATION** (67 désaccords) : confusion réelle mais
  fonctions contractuelles disjointes ET strates opposées (0,062 vs 0,386). Les
  désaccords viennent de clauses biface (résiliation d'abonnement) — c'est un
  problème de **multi-étiquetage**, pas de taxonomie : la consigne doit autoriser
  {TERMINATION, FEES_PAYMENT} en jeu de thèmes, ce que le format supporte déjà.
- **PRIVACY_DATA** (218 phrases, α = 0,578) : sous le seuil de support C4 et sous
  0,60 de fiabilité, mais **aucun partenaire de fusion légitime** (C1 faible avec
  tout, domaine juridique propre — RGPD — et rôle central dans les requêtes du
  fascicule 05). Conservée ; c'est la classe la plus faible de T11, dette déclarée.
- **MODIFICATION_OF_TERMS, TERMINATION, LIMITATION_LIABILITY** : les trois piliers
  de l'abusivité (lifts 4,5 / 3,5 / 3,5), tous fiables (α ≥ 0,67) — intouchables.

## 4. Les schémas candidats

| Schéma | Principe | Mapping (départ → arrivée) |
|---|---|---|
| **T20-statuquo** | témoin | identité |
| **T14-fiabilite** | fusion minimale : seulement les classes sous α 0,50 et leurs cibles | DMCA, FEEDBACK → LICENSE_IP · META, MISC_BOILERPLATE → PREAMBLE_SCOPE · PROMOTIONS → COMMUNICATIONS · GOVERNING_LAW → ARBITRATION_DISPUTES |
| **T11-fonctionnel-strate** | grappes 1–4 fusionnées, grappe 5 rejetée (garde-fou G) | FRAMEWORK ← {PREAMBLE_SCOPE, MISC_BOILERPLATE, META, COMMUNICATIONS, PROMOTIONS} · CONTENT_IP ← {LICENSE_IP, USER_CONTENT, DMCA, FEEDBACK} · ACCOUNT_USE ← {ELIGIBILITY_ACCOUNT, ACCEPTABLE_USE} · DISPUTES_LAW ← {ARBITRATION_DISPUTES, GOVERNING_LAW} · inchangés : FEES_PAYMENT, TERMINATION, MODIFICATION_OF_TERMS, LIMITATION_LIABILITY, WARRANTY_DISCLAIMER, THIRD_PARTY_SERVICES, PRIVACY_DATA |
| **T10-fonctionnel** | T11 + RISK_ALLOCATION ← {LIMITATION_LIABILITY, WARRANTY_DISCLAIMER} | test à charge du garde-fou G |

T14 est délibérément timide (il ne touche pas USER_CONTENT ni ACCEPTABLE_USE) ;
T10 est délibérément trop gourmand (il viole G). T11 est l'hypothèse principale ;
les deux autres bornent l'espace et rendent le choix **falsifiable**.

## 5. Effets simulés — sans entraînement, sur les votes réels

Méthode : remapping des 15 984 votes et 9 414 phrases agrégées de l'export
`f68c4e9e…` ; α-MASI avec IC bootstrap par document (1 000 tirages) ; **Δ appariés
sur les mêmes tirages** ; signal d'abusivité mesuré par information mutuelle et par
**average precision en validation leave-one-document-out** (LODO) du prédicteur
P(abusif | clé) — clé = thème primaire ou combinaison de thèmes, lissage de Laplace
vers le taux de base. Scripts en annexe.

### 5.1 Fiabilité (l'argument du papier court)

| Schéma | α-MASI [IC 95 %] | Δ apparié vs T20 [IC 95 %] | Stabilité du signe | α nominal (primaire) | Désaccords primaires |
|---|---|---|---|---|---|
| T20 | 0,613 [0,567 ; 0,670] | — | — | 0,680 | 29,7 % |
| T14 | 0,653 [0,606 ; 0,715] | +0,040 [+0,029 ; +0,054] | 100 % | 0,726 | 24,9 % |
| **T11** | **0,685 [0,638 ; 0,741]** | **+0,072 [+0,059 ; +0,086]** | **100 %** | 0,756 | 21,4 % |
| T10 | 0,699 [0,645 ; 0,757] | +0,086 [+0,070 ; +0,104] | 100 % | 0,764 | 20,5 % |

**T11 franchit le seuil d'acceptabilité de Passonneau (0,667)** — le point ET le
bas de l'IC du Δ le garantissent contre le hasard du tirage de documents. Sous T11,
649 des 2 316 désaccords primaires (28,0 %) deviennent des accords : 263 dans
CONTENT_IP, 251 dans FRAMEWORK, 90 dans ACCOUNT_USE, 45 dans DISPUTES_LAW.

Fiabilité par classe sous T11 : toutes ≥ 0,578, et **chaque classe fusionnée est
plus fiable que sa pire composante** — CONTENT_IP 0,751 (vs FEEDBACK 0,099),
FRAMEWORK 0,660 (vs COMMUNICATIONS 0,328), DISPUTES_LAW 0,855, ACCOUNT_USE 0,717.

### 5.2 Supports et déséquilibre (l'argument de l'apprenabilité)

| Schéma | Support min | Ratio max/min | Classes < 300 | Multi-label (votes) |
|---|---|---|---|---|
| T20 | 33 | 31,9 | 7 | 23,3 % |
| T14 | 133 | 10,6 | 2 | 21,9 % |
| **T11** | **218** | **8,4** | 1 (PRIVACY_DATA) | 18,8 % |
| T10 | 218 | 8,4 | 1 | 18,0 % |

La baisse du taux multi-label (23,3 → 18,8 %) est une **résorption d'ambiguïté**,
pas une perte : les jeux {LICENSE_IP + FEEDBACK} ou {PREAMBLE + META} devenaient
des singletons cohérents. Le multi-étiquetage restant (18,8 %) est le signal
« de fond » (clauses réellement bifaces) que le papier long exploite.

### 5.3 Signal d'abusivité (le garde-fou, chiffré)

| Schéma | I(primaire;abusif) | I(combo;abusif) | AP LODO (primaire) | AP LODO (combo) | Δ relatif AP combo |
|---|---|---|---|---|---|
| T20 | 0,0672 | 0,0756 | 0,310 | 0,331 | — |
| T14 | 0,0603 | 0,0681 | 0,296 | 0,316 | −4,6 % |
| **T11** | 0,0591 | 0,0665 | 0,293 | **0,315** | **−4,9 %** |
| T10 | 0,0477 | 0,0542 | 0,270 | **0,290** | **−12,6 %** |

(Taux de base 11,0 % — une AP de 0,315 = 2,9 × le hasard.) Le passage T11 → T10
ne fusionne qu'UNE paire de plus (LTD + garanties) et coûte à lui seul −7,7 points
relatifs d'AP : le garde-fou G n'est pas un principe esthétique, c'est le prix
mesuré d'une fusion trans-strate. À l'inverse, les quatre fusions de T11 réunies ne
coûtent que −4,9 % relatif, car elles agrègent des thèmes de MÊME strate.

### 5.4 Effet de bord instructif : l'écart humain ↔ LLM

Exactitude primaire juge vs consensus humain : 41,2 % (T20) → 44,6 % (T14) →
47,7 % (T11) → 48,2 % (T10). Environ **6,5 points de l'écart humain↔LLM sont de la
granularité de taxonomie**, pas du désaccord de fond — un résultat à verser au
papier court (il précise l'interprétation du κ humain 0,769 vs 48–60 % LLM).

## 6. Recommandation

**Adopter T11 comme taxonomie de traitement** (classifieurs, graphe, statistiques
d'accord « papier »), avec :

1. T20 conservé comme vérité d'annotation (l'atelier ne change pas) ;
2. la validation pré-enregistrée du fascicule 03 avant toute publication
   (les chiffres ci-dessus sont des simulations sur votes, pas des runs entraînés) ;
3. PRIVACY_DATA déclarée comme limite (classe faible conservée pour motif métier) ;
4. la paire FEES_PAYMENT/TERMINATION traitée par consigne de multi-étiquetage,
   pas par fusion.

## 7. Menaces de validité — déclarées

- **Circularité partielle** : les grappes sont dérivées des confusions du corpus,
  puis évaluées sur le même corpus. Parade : la validation 03 se fait en validation
  croisée par document sur des **tâches différentes** (classification, frontières,
  détection) et sera rejouée sur le gold arbitré ; le garde-fou G vient d'une source
  indépendante (référence CLAUDETTE).
- **Déséquilibre des annotateurs** : zahra.boulaich porte 58 % des votes ; les
  confusions reflètent en partie SES frontières. Parade : les mesures d'accord ne
  comptent que les phrases multi-annotées (paires), et l'audit par annotateur (A1,
  papier court) reste au programme.
- **AP LODO ≠ AUC-PR d'un vrai détecteur** : c'est une borne d'information
  (le mieux qu'un prédicteur par identité de clé puisse faire), utilisée en
  RELATIF entre schémas — l'absolu viendra des runs G2 du protocole 03.
- **α-MASI de l'export ≠ référence verrouillée** : 0,613 ici (33 docs, 24 août)
  vs 0,635 publié (12 docs, 16 août) — la valeur bouge avec la couverture ; toutes
  les comparaisons de ce dossier sont internes au MÊME export, datées, appariées.
