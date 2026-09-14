# ERROR_ANALYSIS — taxonomie des erreurs et procédure d'analyse

> Une erreur n'est jamais « le système s'est trompé » ; elle est localisée dans un étage, attribuée à
> une cause, et enregistrée avec un identifiant pour suivre sa correction. La taxonomie ci-dessous est
> **exhaustive et exclusive** au premier niveau (un cas = une catégorie primaire), avec causes
> secondaires optionnelles.

## 1. Taxonomie

| Code | Catégorie | Étage | Définition | Exemple | Détection |
|---|---|---|---|---|---|
| **E-SEG** | erreur de segmentation | L1/L2 | frontière de clause fausse : énoncé coupé ou fusionné | une exception dans la clause suivante | frontières alternatives par annotateur ; audit |
| **E-THM** | erreur de thème | L2 | thème consensus faux ou ambigu (clause mal typée) | LIMITATION_LIABILITY typé WARRANTY_DISCLAIMER | désaccord annotateurs ; gold ≠ consensus (261 cas) |
| **E-EXT-ENT** | erreur d'entité | L3 | `Norm` inventée, manquante, ou dédoublée | énoncé « may terminate » non extrait | validation humaine (rappel d'énoncé) |
| **E-EXT-REL** | erreur de relation / de champ | L3 | acteur, modalité, action, condition, préavis, recours faux | `user` au lieu de `provider` ; `none` au lieu de `not_stated` | exactitude par champ |
| **E-HAL** | hallucination | L3 | champ ou énoncé sans ancrage textuel | `notice: 30 days` absent du texte | contrôle d'ancrage (étape 4) |
| **E-GRF** | erreur de construction du graphe | L1–L5 | violation d'invariant, doublon, arête mal typée, provenance manquante | `MATCHES_ITEM` sans `run_id` | tests de contraintes |
| **E-RUL-M** | erreur de règle (appariement) | L4 | règle correcte, appariement faux par sémantique de champ (`not_stated` traité comme `none`) | (g) déclenché sur une clause qui renvoie à une politique de préavis | audit |
| **E-RUL-D** | erreur de règle (conception) | L4 | règle trop large/étroite par rapport à l'item | (q) déclenché sur tout arbitrage, même optionnel | audit ; comparaison item ↔ règle |
| **E-CLS** | erreur de classification | L5 | modèle appris : FP/FN sans cause structurelle | — | confusion ; analyse par catégorie |
| **E-AMB** | ambiguïté | tous | la clause admet deux lectures légitimes (désaccord 1-1-1, tally partagé) | « we may suspend… where required » | gold `risk_band=high` ; audit |
| **E-DIS** | désaccord d'annotation | référence | la référence CLAUDETTE est discutable (label absent ou excédentaire) | signalement fondé, phrase non labellisée | audit RQ6 |
| **E-LAW** | erreur d'interprétation juridique | L4 | item mal compris ou hors champ (art. 4(2), annexe §2) | juger l'adéquation du prix | relecture juriste des règles |
| **E-PRJ** | erreur de projection clause → phrase | évaluation | evidence mal attribuée ; TP compté sur la mauvaise phrase | — | variante clause entière |

## 2. Procédure

1. Chaque signalement/prédiction du hold-out reçoit un identifiant `err_id` s'il est FP ou FN.
2. Deux juristes attribuent la catégorie primaire (double codage sur 20 % ; κ rapporté).
3. Agrégation par méthode × catégorie d'erreur × catégorie CLAUDETTE × famille de règle.
4. Pour E-DIS : constitution de la liste des **omissions candidates** de la référence (livrable RQ6).
5. Boucle de correction : E-RUL-D et E-LAW ne peuvent être corrigées **que pour la version suivante**
   des règles (nouvelle empreinte), jamais sur l'évaluation en cours.

## 3. Ce que l'analyse doit produire

- Table erreurs × étage × fréquence ; part attribuable à l'amont (E-SEG/E-THM/E-EXT) vs aux règles vs
  à la référence.
- Pour chaque règle : ses 5 FP et 5 FN les plus fréquents en type.
- Pour RQ5 : les cas détectés par le graphe seuls (R3) et manqués par le texte, commentés.
- Fiche par erreur systémique (≥ 5 occurrences) : cause, correctif proposé, coût, version cible.
