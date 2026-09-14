# RESEARCH_QUESTIONS — questions, hypothèses, métriques, méthode statistique

> Les RQ proposées dans le programme ont été reformulées pour être **falsifiables** et **attribuables à
> une expérience** ; RQ0 et RQ6 sont ajoutées parce que sans elles les autres ne sont pas
> interprétables. Chaque RQ donne : hypothèse principale (H1), hypothèse nulle (H0), métriques,
> protocole (renvoi à [EXPERIMENTAL_PROTOCOL.md](EXPERIMENTAL_PROTOCOL.md)), méthode statistique.
> Conventions statistiques communes : **unité de rééchantillonnage = le document** (les phrases d'un
> ToS ne sont pas indépendantes) ; IC 95 % par bootstrap sur documents (1 000 tirages) ; comparaisons
> **appariées** sur les mêmes documents ; tests de permutation appariés (par document) ou test de
> Wilcoxon signé sur les scores par document ; correction de Holm quand plusieurs comparaisons partagent
> une conclusion ; seuil α = 0,05 ; tailles d'effet toujours rapportées (Δ métrique avec IC).

---

## RQ0 — Fiabilité de la structure (prérequis)

**Question.** Les énoncés normatifs (templates) extraits par LLM et validés par des juristes sont-ils
suffisamment fiables pour servir de substrat à des règles ?

- **H1** : après validation humaine, l'accord inter-validateurs par champ (acteur, modalité, action,
  condition, préavis, recours) atteint κ ≥ 0,67 sur chaque champ fermé, et la proportion de templates
  proposés acceptés sans modification est ≥ 60 %.
- **H0** : au moins un champ décisif (modalité, condition) reste sous κ 0,67 après validation.
- **Métriques** : κ de Cohen par champ sur un échantillon doublement validé (≥ 200 clauses) ; taux
  d'acceptation / correction / rejet des propositions ; conformité au schéma (100 % attendu après
  validation structurale) ; fidélité par champ des propositions brutes (exactitude vs validé).
- **Protocole** : EXPERIMENTAL_PROTOCOL §E0 ; **Statistique** : IC bootstrap par document sur κ.

## RQ1 — Structure vs texte : la représentation graphe améliore-t-elle la détection ?

**Question (reformulée).** À supervision égale, une représentation structurée (thèmes + énoncés
normatifs + relations documentaires) améliore-t-elle la détection des phrases abusives par rapport à
une classification textuelle, et sur quelles catégories ?

- **H1** : un détecteur exploitant les caractéristiques du graphe (thème T11, champs normatifs,
  composition) atteint une macro-F1 supérieure à celle d'un encodeur textuel fine-tuné sur les **mêmes
  plis par document**, avec un gain concentré sur les catégories compositionnelles (CR, USE, TER).
- **H0** : Δ macro-F1 ≤ 0 (IC couvrant 0) ; ou le gain n'existe que sur les catégories où le thème seul
  suffit (A, LAW).
- **Métriques** : macro-F1, micro-F1, PR-AUC par catégorie (déséquilibre 3,9–26 %), κ ; Δ apparié avec IC.
- **Protocole** : §E1 (baselines B0–B3 vs approches A3, A7, A8) ; **Statistique** : permutation appariée
  par document sur macro-F1 ; Holm sur les 8 catégories.

## RQ2 — Connaissance juridique : l'annexe 93/13 exécutée apporte-t-elle du signal ?

**Question.** Les règles dérivées de l'annexe, écrites sans accès aux labels et gelées, retrouvent-elles
les phrases abusives de référence ; et qu'ajoutent-elles au thème seul ?

- **H1** : les règles structurelles (11 items) atteignent une précision ≥ 0,60 sur les catégories
  mappées et un rappel ≥ 0,50 sur LTD, TER, CH ; le gain de F1 par rapport au prédicteur thème-seul est
  positif sur au moins ces trois catégories.
- **H0** : les règles ne font pas mieux que P(catégorie | thème) — la structure n'ajoute rien au type.
- **Métriques** : P/R/F1 par règle et par item ; Δ F1 vs thème-seul ; couverture (part des labels
  atteignable par les items exprimables).
- **Protocole** : §E2 (pré-inscription : empreinte des règles avant tout calcul sur le hold-out) ;
  **Statistique** : bootstrap par document ; petits effectifs (A 17 labels sur le hold-out) déclarés.

## RQ3 — Hybride LLM + KG : explicabilité sans perte significative ?

**Question.** Une architecture où le LLM construit la structure et où des règles/classifieurs jugent
sur le graphe fournit-elle des explications utilisables sans dégrader significativement la
performance par rapport au meilleur modèle texte-seul ?

- **H1** : la perte de macro-F1 de l'approche hybride par rapport au meilleur texte-seul est
  **≤ 0,05** (borne de non-infériorité pré-déclarée) **et** ses explications sont jugées suffisantes par
  des juristes dans ≥ 70 % des cas.
- **H0** : perte > 0,05 ou suffisance < 70 %.
- **Métriques** : Δ macro-F1 (test de non-infériorité, IC unilatéral) ; taux de suffisance, exactitude,
  utilité des explications (EVALUATION_PLAN §3) ; fidélité (suppression de l'évidence → disparition du
  signalement).
- **Protocole** : §E3 ; **Statistique** : IC 95 % de la différence ; accord inter-juristes sur les
  jugements d'explication (κ).

## RQ4 — Fiabilité de la construction automatique du graphe

**Question.** À quel point la construction par LLM est-elle fiable, reproductible et économe, et
quelle part de la validation humaine peut-elle être évitée ?

- **H1** : précision d'entité ≥ 0,85 et de relation ≥ 0,75 des propositions brutes contre le validé ;
  taux d'hallucination (nœuds/relations sans ancrage textuel) ≤ 5 % ; reproductibilité inter-exécutions
  ≥ 0,95 (même sortie à température 0 sur 3 exécutions) ; les règles exécutées sur templates **bruts**
  perdent ≤ 0,05 de F1 par rapport aux templates validés.
- **H0** : l'une de ces bornes n'est pas atteinte par le meilleur modèle.
- **Métriques** : EVALUATION_PLAN §1 (entity/relation P/R, schema compliance, completeness,
  consistency, hallucinated nodes/relations, reproducibility, coût/latence).
- **Protocole** : §E4 (pilote multi-modèles sur 100 clauses, puis extraction complète) ; **Statistique** :
  IC par document ; comparaison de modèles par test apparié.

## RQ5 — Quelles erreurs le graphe voit-il que le texte ne voit pas (et inversement) ?

**Question.** Existe-t-il des classes de clauses abusives détectables par raisonnement sur le graphe
(composition, asymétrie, absence) et manquées par les classifieurs textuels — et symétriquement ?

- **H1** : parmi les vrais positifs des règles R3 (composition/asymétrie), une fraction ≥ 30 % est
  manquée par le meilleur classifieur texte-seul ; les erreurs des règles se concentrent sur les items
  quantitatifs et procéduraux.
- **H0** : les ensembles de vrais positifs sont emboîtés (le graphe ne détecte rien que le texte ne
  détecte).
- **Métriques** : analyse d'ensembles (Venn) des TP par méthode ; taux par famille R1–R4 ; taxonomie
  d'erreurs (ERROR_ANALYSIS.md).
- **Protocole** : §E5 ; **Statistique** : test de McNemar sur les désaccords de prédiction par phrase,
  avec IC bootstrap par document.

## RQ6 — Le benchmark et la loi : ce que les faux positifs révèlent

**Question.** Quelle part des faux positifs des règles correspond à des omissions du corpus de
référence, et quelle part de l'annexe est hors du benchmark ?

- **H1** : ≥ 20 % des faux positifs audités sont jugés « signalement fondé, référence absente » par
  deux juristes ; les items (c), (d), (h), (n), (o) n'ont aucun label de référence dans le hold-out.
- **H0** : les faux positifs sont majoritairement des erreurs de template ou de règle.
- **Métriques** : proportions {correct, discutable, faux} × origine {template, règle, référence} ;
  accord inter-juristes.
- **Protocole** : §E6 (audit) ; **Statistique** : IC de Wilson sur les proportions ; κ inter-juristes.

## Tableau de synthèse

| RQ | Expériences | Baselines | Ablations principales | Livrable |
|---|---|---|---|---|
| RQ0 | E0 | — | validé vs brut | κ par champ, taux d'acceptation |
| RQ1 | E1 | B0 majorité, B1 TF-IDF, B2 BERT/Legal-BERT, B3 LLM prompté | KG sans normes / sans composition / sans thèmes | Δ macro-F1 par catégorie |
| RQ2 | E2 | thème-seul | règles sans exceptions ; R1 seul ; R1+R2 ; +R3 | P/R par item |
| RQ3 | E3 | meilleur texte-seul | explication par attention vs sous-graphe | non-infériorité + jugement humain |
| RQ4 | E4 | — | modèles ; zero/few-shot ; schéma contraint ou non | métriques KG |
| RQ5 | E5 | — | — | Venn, McNemar |
| RQ6 | E6 | — | — | audit |
