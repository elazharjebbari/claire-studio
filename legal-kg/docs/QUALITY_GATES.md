# QUALITY_GATES — huit portes, des critères vérifiables

| Gate | Question | Critères (tous requis) | Preuve | Décideur |
|---|---|---|---|---|
| **G1 État de l'art** | sait-on ce qui existe ? | ≥ 90 % des références marquées ✅ ; les 6 axes couverts ; tableau « traité / ouvert » ; positionnements avec risques | `STATE_OF_THE_ART.md`, bib | porteur + reviewer |
| **G2 Données comprises** | CLAUDETTE et la couche sont-ils profilés ? | `DATA_PROFILE.md` régénérable ; cas limites listés ; décisions §7 actées ; sévérité/sections : réimport planifié ou fait | profil, `outliers.json` | Data Audit + porteur |
| **G3 Schéma juridique** | l'annexe est-elle correctement modélisée ? | 17 items encodés (acteur, effet, élément absent, exceptions §2, mapping, expressibilité) ; **relecture par une juriste** tracée ; règles de projection figées | `directive_93_13.yaml`, PV de relecture | juriste |
| **G4 Schéma du KG** | le graphe peut-il porter les expériences ? | X1–X9 satisfaites ; contraintes Memgraph exécutées sans erreur ; build L1–L2 sur 50 documents ; ADR-001/002/003 approuvés ; test d'étanchéité vert | `memgraph_schema.cypher`, build log, tests | KG Architect + porteur |
| **G5 Extraction fiable** | peut-on faire confiance aux templates ? | pilote 100 clauses : conformité ≥ 0,98, hallucination ≤ 5 %, reproductibilité ≥ 0,95 ; κ inter-validateurs ≥ 0,67 sur modalité/condition ; modèle retenu par score déclaré | `results/extraction/pilot/` | juristes + porteur |
| **G6 Baseline reproductible** | les points de comparaison sont-ils solides ? | B0–B3 exécutées sur les 5 plis avec enregistrement complet ; Legal-BERT sur cible `unfair` ; résultats stables (2 graines) | runs | Experiment Agent + reviewer |
| **G7 Pipeline complet** | tout tourne de bout en bout ? | un `run_id` traverse extraction → graphe → détection → évaluation → tableaux ; règles gelées (hash + date) ; contrôles anti-fuite verts | log de pipeline, `FROZEN.txt` | reviewer |
| **G8 Résultats suffisants** | y a-t-il un papier ? | pour chaque RQ : H1 acceptée ou rejetée avec IC ; réplication sur modèle ouvert ; revue adversariale sans finding bloquant ; tableaux imposés produits | rapport de consolidation | porteur + co-auteurs |

Règles : une gate ne se franchit pas « en partie » ; un critère manquant se documente comme dette avec
échéance ; le passage est un commit taggé (`gate-k`) contenant les preuves.
