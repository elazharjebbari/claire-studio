# Modèle de données (détail)
- **GoldResolution** (1 par projet×document) : statut, % résolu, arbitres (M2M), **verrou** (locked/by/at/expires) = source de vérité durable, finalized_at.
- **GoldSentence** (1 par projet×document×index) : décision GOLD multi-label (primary + secondaries[]), `agreement_class`, `confidence`, `risk_band`, `auto_resolved`, `resolution` (tally pondéré, human_block, llm_block, human_dissent, level), `decided_by/decided_at/comment`. Contrainte unique (project, document, index).
- **GoldRun** : snapshot horodaté (draft par lot / final corpus) pour audit & export figé (calqué sur AnnotationVersion).
- **ArbitrationEvent** : traçabilité append-only « qui a arbitré quoi » (decide/override/comment/lock/steal) + note optionnelle.
- **ResolutionConfig** : PAS de table — typé/versionné dans `Project.settings.resolution{}` (cf. 03-config-schema.md).
