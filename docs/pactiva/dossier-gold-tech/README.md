# Dossier GOLD — technique (backend/frontend/data/archi/dev/tests/plan)

Pendant technique du dossier design (`docs/pactiva/dossier-gold/`). Réconcilie les
recommandations de l'étude en décisions d'architecture, un modèle de données, la spec du
**moteur de scoring** (pur, testable), le schéma de **config de campagne**, le **verrou temps
réel**, les **endpoints**, le **plan de tests** et le **plan d'exécution phasé**.

Décisions structurantes (ADR) :
- ADR-001 Atelier de décision dédié `/projects/[slug]/gold/[documentId]` (conflit-first), pas un clone de /annotate.
- ADR-002 Verrou d'arbitrage **DB source de vérité** (durable/partagé) + diffusion WS (pas de dépendance Redis).
- ADR-003 Moteur = **électorat pondéré** branché sur le moteur de triage existant (pas de 2ᵉ vérité multi-label).
- ADR-004 Config **typée versionnée** dans `Project.settings.resolution{}` (pattern mergeUiPrefs).
- ADR-005 Export gold = **adaptateur gold→pivot** réutilisant les writers ExportJob.
- ADR-006 Modèles GOLD **dédiés** (`claire/gold/`) — ne PAS surcharger `Annotation`.
