# ABLATION_PLAN — isoler d'où vient le signal

> Chaque ablation retire **une** source d'information ou **une** couche du modèle D, à protocole
> constant (mêmes plis, mêmes métriques, même graine). Une ablation n'est retenue que si elle répond à
> une RQ ; les combinaisons sont limitées pour rester interprétables (≤ 14 configurations).

| Code | Configuration | Ce qu'on enlève / change | RQ | Lecture attendue |
|---|---|---|---|---|
| AB-1 | KG **sans règles juridiques** (L1+L2+L3, classifieur sur features) | L4-règles | RQ2 | ce que valent thèmes + normes sans l'annexe |
| AB-2 | KG **avec règles** (référence) | — | RQ2 | — |
| AB-3 | KG **sans relations sémantiques** (L1+L4-règles sur thèmes seuls) | L3 (normes) | RQ1/RQ2 | règles réduites au type = baseline thème-seul déguisée ? |
| AB-4 | KG **sans composition** (R1+R2 seulement) | R3 | RQ5 | part du signal due à la structure inter-clauses |
| AB-5 | KG **sans provenance/confiance** (consensus aplati, pas de `confidence`) | attributs L2 | RQ1 | la confiance aide-t-elle le classifieur A7 ? |
| AB-6 | KG construit **manuellement** (templates validés) | — | RQ4 | plafond de la structure |
| AB-7 | KG construit **automatiquement** (templates bruts, sans validation) | validation humaine | RQ4 | prix de la validation |
| AB-8 | LLM **seul** (B3) | graphe | RQ3 | — |
| AB-9 | LLM **+ KG** (A6 : prompt enrichi du sous-graphe) | — | RQ3 | le contexte structuré aide-t-il le LLM ? |
| AB-10 | KG **+ embeddings** (A8) | règles | RQ1 | la géométrie du graphe suffit-elle ? |
| AB-11 | KG **+ règles + embeddings** (A7 ∪ A8) | — | RQ1 | complémentarité |
| AB-12 | règles **sans exceptions** de l'annexe §2 | `unless` | RQ2 | les exceptions changent-elles quelque chose sur des ToS ? |
| AB-13 | taxonomie **T20 au lieu de T11** dans les règles | granularité | RQ2 | fiabilité du type → décidabilité des règles |
| AB-14 | clauses **par annotateur** au lieu du consensus | frontières | RQ0/RQ2 | sensibilité aux frontières (Jaccard 0,37–0,47) |

Règles de lecture : (i) une ablation est rapportée avec IC et Δ apparié contre la configuration de
référence AB-2 (ou A7 pour AB-5/10/11) ; (ii) les ablations AB-6/7 partagent exactement les mêmes
règles (empreinte) ; (iii) AB-13 est la seule qui change le vocabulaire — ses macro-F1 ne sont pas
comparables terme à terme, on rapporte la **couverture** des règles (part des clauses typées par un
thème fiable) et la précision.
