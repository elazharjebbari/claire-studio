# Stratégie et batterie de tests

> Le projet a déjà **~425 tests pytest** et **~513 vitest**. Cette batterie s'y ajoute et suit
> les mêmes conventions. Règle : **aucun lot n'est livré sans ses tests**, et la suite existante
> doit rester verte.

---

## 1. Principe : tester par nature de code

| Nature | Où | Comment | Pourquoi |
|---|---|---|---|
| **Logique pure** (sélection, splits, agrégation, métriques, échelles) | `selectors.py`, `splits.py`, `masi.py`, `charts/scales.ts` | Unitaire + **propriété** | Rapide, déterministe, cerne les cas limites |
| **Orchestration** (états, file, ingestion) | `lab/services.py` | Intégration Django | Les bugs y sont des bugs d'état |
| **Calcul scientifique** | `pactiva_lab/` | Golden + déterminisme | Un chiffre qui change silencieusement est le pire des bugs |
| **Contrats** (JSON Schema, JSONL) | `contracts.py` | Validation croisée | Empêche la dérive entre les deux mondes |
| **Sécurité** | `crypto.py`, sérialiseurs, logs | Tests dédiés adversariaux | Un secret qui fuit ne se rattrape pas |
| **UI** | `features/lab`, `charts` | vitest + Testing Library | États vides, désactivés, erreurs |
| **Accessibilité** | tout écran | `a11y.spec` existant | Contrainte déjà tenue, à ne pas casser |

---

## 2. Tests par lot

### L0 — sélection et preflight (`backend/tests/test_lab_selectors.py`)

```
test_maturity_complete_exige_toutes_les_phrases_validees
test_maturity_complete_capte_un_brouillon_fini          ⭐ le cas fatima.ouali
test_maturity_submitted_ignore_un_brouillon_fini        ⭐ montre le manque comblé
test_annotation_partielle_est_exclue_avec_motif         ⭐ le cas Endomondo 59/498
test_aucune_exclusion_silencieuse                       ⭐ retenus + exclus == candidats
test_selectors_n_importe_pas_django                     (import isolé)
test_preflight_ne_cree_rien                             (aucune écriture en base)
test_preflight_empreinte_stable_pour_memes_criteres
test_scope_min_annotators_filtre_correctement
```

> `test_aucune_exclusion_silencieuse` est le test le plus important du lot : un dataset qui perd
> 12 documents sans le dire produit un article faux.

### L1 — dataset (`test_lab_dataset.py`, `test_lab_splits.py`)

```
test_fingerprint_identique_pour_memes_criteres
test_fingerprint_change_si_le_contenu_change
test_dataset_est_immuable_apres_creation                (save() lève)
test_groupkfold_aucun_document_dans_deux_plis           [propriété, hypothesis]
test_groupkfold_deterministe_a_graine_egale
test_groupkfold_refuse_moins_de_k_documents             → dataset_too_small
test_sentences_jsonl_conforme_au_dictionnaire
test_soft_labels_somment_a_un                           [propriété]
test_consensus_reutilise_gold_scoring                   (pas de logique dupliquée)
test_boundary_derive_des_plages_de_themes
test_construction_dupliquee_renvoie_409_et_id_existant
```

### L2 — métriques (`test_lab_metrics.py`)

```
test_boundary_agreement_ne_vaut_pas_un                  ⭐ le correctif
test_boundary_agreement_dans_la_plage_attendue          (0.39–0.63 sur fixture prod)
test_boundary_kappa_reste_calculable_et_deprecie        (non-régression)
test_alpha_masi_expose_aussi_alpha_nominal              (l'écart EST le résultat)
test_alpha_masi_mono_egale_alpha_nominal                (cohérence, déjà dans masi.py)
test_cooccurrence_lift_sur_paire_connue                 ⭐ 7,4× LICENSE_IP+TERMINATION
test_cooccurrence_multilabel_brut_donne_lift_faible     ⭐ ~1,09× — l'anti-résultat
test_campaign_readiness_compte_les_complets_non_soumis  ⭐ vaut 10 au 11/08
test_human_llm_matrix_suit_judge_display_order          (dérivé de Judge)
test_annotator_audit_refuse_a_un_annotateur_sur_ses_pairs
test_metriques_existantes_inchangees                    (golden sur payload figé)
test_metrique_sous_min_support_est_grisee_pas_masquee
```

### L3 — visualisations (`frontend/tests/charts.test.ts`, `figures.test.tsx`)

```
scaleLinear : domaine vide · valeur unique · négatifs · domaine inversé
scaleLog    : zéro dans le domaine · valeurs négatives (doit lever, pas produire NaN)
ticks       : nombre raisonnable · valeurs rondes
test_figure_etat_vide_dit_quoi_faire
test_csv_exporte_correspond_aux_valeurs_affichees       ⭐
test_aucune_couleur_en_dur_dans_les_charts              (garde anti-hex)
test_equivalent_tabulaire_present_pour_chaque_figure    (a11y)
```

### L4/L6 — package ML (`research/tests/`)

```
test_package_fonctionne_sans_django                     (env isolé)
test_meme_graine_meme_resultats                         ⭐ déterminisme
test_config_invalide_echoue_avant_tout_calcul           (avec chemin JSON-pointer)
test_results_json_valide_le_schema_de_sortie
test_plafond_humain_present_quand_demande
test_bootstrap_reechantillonne_des_documents_pas_des_phrases  ⭐
test_detokenize_restaure_la_ponctuation                 (cas réels CLAUDETTE)
test_contexte_ne_fuit_pas_entre_documents               ⭐ fenêtre bornée au document
test_cache_embeddings_evite_le_reencodage               (compte d'appels)
test_llm_judge_lit_la_base_sans_appel_reseau
test_sweep_respecte_max_runs
test_learning_curve_produit_un_point_par_taille_et_repetition
test_tableaux_latex_compilent
```

> `test_contexte_ne_fuit_pas_entre_documents` : une fenêtre de contexte qui déborde sur le
> document suivant est une fuite discrète et coûteuse. À tester explicitement.

### L5 — orchestration (`test_lab_runs.py`)

```
test_run_duplique_renvoie_409_et_run_existant           ⭐ économie de GPU
test_force_true_outrepasse_la_deduplication
test_run_zombie_sans_heartbeat_est_repris
test_results_invalide_echoue_sans_ingestion_partielle   ⭐
test_compare_refuse_des_splits_differents               ⭐ + motif
test_annulation_effective_en_moins_de_dix_secondes
test_worker_survit_a_un_run_qui_plante
test_retry_borne_a_trois_tentatives
test_estimate_refuse_au_dela_de_max_runs_avec_decompte
```

### L8 — Grid'5000 et sécurité (`test_lab_g5k.py`, `test_lab_credentials.py`)

```
test_put_sans_cle_de_chiffrement_renvoie_503            ⭐ jamais de clair
test_mot_de_passe_absent_de_toutes_les_serialisations   ⭐ balayage récursif
test_mot_de_passe_absent_des_journaux                   ⭐ capture de logs
test_url_avec_identifiants_est_masquee_dans_les_logs
test_credential_appartient_a_un_seul_utilisateur
test_credential_supprime_avec_le_compte
test_test_connexion_appelle_bien_sites                  (HTTP simulé)
test_walltime_depasse_ingere_en_partial_pas_failed      ⭐
test_sentinel_absent_signale_un_job_tronque
test_api_injoignable_donne_g5k_unreachable_et_rejouable_en_local
test_module_utilisable_sans_compte_g5k                  ⭐ jamais de dépendance dure
test_script_genere_contient_le_garde_fou_gpu
```

> Les tests de fuite de secret font un **balayage récursif** de la réponse sérialisée : un champ
> ajouté par inadvertance à un sérialiseur imbriqué serait sinon invisible.

---

## 3. Tests transverses

### 3.1 Non-régression scientifique (golden)
Un jeu de données jouet **versionné dans le dépôt** (5 documents, 3 annotateurs simulés,
distribution à longue traîne) ; les résultats attendus sont figés dans `tests/golden/`.
Toute variation de chiffre fait échouer le test — **c'est le but** : un changement de métrique
doit être délibéré et accompagné d'un incrément de version.

### 3.2 Cohérence des contrats
```
test_schema_json_et_dataclasses_python_concordent
test_dictionnaire_csv_couvre_toutes_les_colonnes_produites   ⭐
test_presets_yaml_valident_le_schema_de_config               ⭐
test_catalogue_metriques_couvre_le_registre_backend
```
> `test_presets_yaml_valident_le_schema_de_config` évite le classique : un preset qui plante au
> lancement parce qu'une clé a été renommée dans le schéma.

### 3.3 Propriété (hypothesis)
- Les splits partitionnent : ∪ plis = documents, ∩ = ∅.
- `masi_distance ∈ [0,1]`, symétrique, nulle sur ensembles égaux.
- Agrégation `soft` : distribution valide quelles que soient les entrées.
- Métriques : F1 ∈ [0,1] pour toute matrice de confusion valide.

### 3.4 Performance (garde-fous, pas de micro-optimisation)
```
test_preflight_sous_deux_secondes_sur_cinquante_documents
test_construction_dataset_sous_trente_secondes
test_pas_de_requete_n_plus_un_dans_le_builder        (assertNumQueries)
```

---

## 4. Ce qu'on ne teste pas, et pourquoi

| Non testé | Raison |
|---|---|
| Les poids réels des transformers | Trop lourd en CI ; testé sur modèle jouet + test d'intégration manuel documenté |
| L'API Grid'5000 réelle | Simulée en CI ; une commande de vérification manuelle est fournie dans le runbook |
| La qualité esthétique des figures | Non automatisable ; revue humaine à la livraison de L3 |
| Les performances GPU | Hors CI |

**Ces exclusions sont explicites et documentées** — c'est ce qui distingue un périmètre de test
assumé d'un oubli.

---

## 5. Intégration continue

```
1. ruff + mypy (backend + package)      rapide, bloquant
2. pytest backend                        ~425 + nouveaux
3. pytest research/ (sans Django)        isolé, prouve le découplage
4. tsc --noEmit                          0 erreur
5. vitest                                ~513 + nouveaux
6. a11y.spec                             2/2
7. golden scientifique                   toute variation = échec délibéré
```

**Commandes locales** (conventions du projet) :
```bash
backend/.venv/bin/python -m pytest                    # conda `claire` n'a pas reportlab
cd frontend && npx vitest run && npx tsc --noEmit
cd research && python -m pytest                       # environnement séparé
```
