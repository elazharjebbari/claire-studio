# Endpoints
| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/projects/{slug}/gold/documents` | liste docs gold (statut, % , difficulté κ, autoLevel, arbitres, verrou) — @action sur ProjectViewSet, réutilise ann_idx/assign_idx + project_iaa |
| GET | `/projects/{slug}/gold/{docId}` | données de résolution d'un doc (par phrase : votes annotateurs+LLM, agreement_class, score, risk, proposition) |
| POST | `/projects/{slug}/gold/{docId}/decide` | écrit la décision GOLD d'une phrase (primary+secondaries, comment) → GoldSentence + ArbitrationEvent |
| POST | `/projects/{slug}/gold/{docId}/auto-resolve` | applique l'auto-résolution (accord absolu / cas peu risqués) selon la config |
| POST | `/projects/{slug}/gold/{docId}/lock:acquire\|heartbeat\|release\|steal` | verrou d'arbitrage |
| GET | `/projects/{slug}/gold/stats` | matrices A↔A, A↔LLM, classement A↔GOLD (réutilise iaa/concordance) |
| PATCH | `/projects/{slug}` (settings.resolution) | config de campagne (ResolutionConfigSerializer) |
| POST | `/exports` (scope `{gold:true, documents?, provenance?}`) | export gold (writers réutilisés + bloc arbitration additif) |
