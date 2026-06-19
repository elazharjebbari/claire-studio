# Dossier technique — Collaboration, versioning & exploration des annotations humaines

**Produit** : CLAIRE Studio — atelier d'annotation juridique (LORIA / Université de
Lorraine, partenaire Batt & Associés).
**Portée de ce dossier** : conception **et** implémentation des huit chantiers
demandés (points 0 à 7), côté **annotateur** comme côté **administrateur**, sur
toutes les dimensions : backend, frontend, UI/UX, design, tracking, données,
architecture, plan de conception, plan de développement, plan d'action.

> Ce dossier est la **source de vérité** de conception. Le code doit l'incarner :
> robuste, fiable, évolutif, débogable, modulable, optimal, fonctionnel, sécurisé.

## Cartographie des chantiers

| # | Chantier | Fichier de référence | Statut impl. |
|---|---|---|---|
| 0 | Pré-remplissage commutable + barre de navigation documents | `10_prefill_document_nav.md` | **livré ce cycle** |
| 1 | En-tête d'annotation **sticky** au scroll | `10_prefill_document_nav.md` | **livré ce cycle** |
| 2 | Versioning à la soumission (nom + description) + historique d'actions | `03_versioning_history.md` | **livré ce cycle (socle)** |
| 4a | Undo / redo (Ctrl+Z / Ctrl+Y) + boîte d'actions | `04_undo_redo.md` | spécifié → cycle suivant |
| 3 | Attribution multi-annotateurs + commentaires (phrase/bloc/partie) | `05_attribution_comments.md` | spécifié → cycle suivant |
| 4b | Collaboration **temps réel** + gestion de conflits + lien de partage | `06_realtime_collaboration.md` | spécifié → cycle suivant |
| 5 | Écran d'exploration / qualification des annotations humaines | `07_analytics_screen.md` | spécifié → cycle suivant |
| 6 | Explorateur de versions (document **et** phrase) | `08_version_explorer.md` | spécifié → cycle suivant |
| 7 | UX du mode collaboratif (ergonomie maximale) | `09_collab_ux.md` | spécifié → cycle suivant |

## Index des documents

```
06_collaboration_versioning/
├── README.md                      ← ce fichier (index + cartographie)
├── 00_vision_scope.md             Vision produit, personas, objectifs, non-objectifs
├── 01_architecture.md             Architecture cible (front/back/temps réel/données)
│   └── architecture.puml          Diagramme de composants
├── 02_data_model.md               Modèle de données (entités, migrations, contraintes)
│   ├── data-model.puml            Diagramme entités-relations
│   └── entities.json              Schéma machine des entités (source de génération)
├── 03_versioning_history.md       Versioning + journal d'événements (points 2, 6)
│   └── event-types.csv            Taxonomie des événements traçés
├── 04_undo_redo.md                Undo/redo, pile de commandes, boîte d'actions (point 4a)
├── 05_attribution_comments.md     Attribution + commentaires multi-niveaux (point 3)
├── 06_realtime_collaboration.md   Temps réel : Channels+WS+CRDT, conflits, partage (4b,7)
│   └── collab-sequence.puml       Diagramme de séquence de l'édition concurrente
├── 07_analytics_screen.md         Écran d'exploration des annotations humaines (point 5)
│   └── metrics.csv                Catalogue des métriques + définitions
├── 08_version_explorer.md         Explorateur de versions document & phrase (point 6)
├── 09_collab_ux.md                UX/UI/design du mode collaboratif (point 7)
├── 10_prefill_document_nav.md     Pré-remplissage commutable + nav documents + sticky (0,1)
├── 11_admin_console.md            Console admin : piloter/personnaliser/adapter
├── 12_api_contract.md             Contrat d'API (REST + WS)
│   └── openapi-additions.yaml     Ajouts OpenAPI (endpoints nouveaux)
├── 13_test_strategy.md            Stratégie de tests MSW/Vitest/Playwright/pytest
├── 14_seeders.md                  Seeders & jeux de données de démonstration
├── 15_runbook.md                  Runbook d'exécution de bout en bout
├── config-flags.yaml              Feature flags & paramètres administrables
└── roles-permissions.json         Matrice rôles × permissions
```

## Principes directeurs

1. **Non-destructif par défaut** : aucune action automatique (overlay LLM, switch de
   version/source, présence d'un collaborateur) ne modifie l'annotation humaine.
2. **Tout est un événement** : chaque action humaine est journalisée (qui, quoi, où,
   quand, pourquoi) → fonde l'historique, l'undo/redo, l'attribution et l'analytics.
3. **Source de vérité serveur, optimisme client** : écriture optimiste + réconciliation,
   CRDT pour l'édition concurrente, idempotence des mutations.
4. **Progressive disclosure** : le collaboratif ne surcharge pas l'écran ; voyants
   discrets, panneaux à la demande, raccourcis.
5. **Administrable** : rôles, permissions, vocabulaire, flags et limites pilotables
   par l'admin sans redéploiement (config + back-office).
6. **Sécurité & RGPD** : liens de partage signés expirables, scoping par projet,
   audit immuable, données d'annotation hébergées (MLflow/Postgres) RGPD-safe.
