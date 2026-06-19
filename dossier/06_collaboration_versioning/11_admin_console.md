# 11 — Console d'administration (piloter / personnaliser / adapter)

Côté **admin**, tout ce qui pilote l'expérience annotateur doit être paramétrable
**sans redéploiement** (config + back-office Django + endpoints dédiés).

## Domaines administrables

### Projets & membres
- CRUD projets, affectation de documents, **membres & rôles** (owner/reviewer/annotator),
  couleurs d'annotateur (palette `config-flags.yaml`).
- Liens de partage : créer / lister / révoquer ; quotas & expirations.

### Vocabulaire & schéma
- Édition du `LabelScheme` (thèmes, natures juridiques, échelle de certitude) via
  `vocabulary.yaml` → régénère `design-tokens.json` (couleurs de thème). Versionné.

### Feature flags & limites (`config-flags.yaml`)
- Activer/désactiver : collaboratif temps réel, attribution, commentaires multi-niveaux,
  undo/redo, analytics, explorateur de versions.
- Limites : profondeur d'undo, débit WS, taille d'update, TTL des verrous, fréquence des
  snapshots, rafraîchissement analytics.

### Gouvernance & audit
- Consultation de l'**audit append-only** (`ActivityEvent`) filtrable (acteur, verbe,
  projet, période) ; export.
- Tableau de bord conflits & sessions collaboratives.

### Données
- Import de pré-annotations (versions LLM) — déjà en place (multi-versions).
- Reconstruction des agrégats analytics (commande de management).

## Surfaces
- **Django Admin** durci (read-mostly sur l'audit ; pas d'édition des events).
- **Back-office applicatif** `/admin-console` (Next) pour les actions courantes
  (membres, partages, flags, vocabulaire) avec garde de rôle `owner`.
- **Endpoints** : cf. `12_api_contract.md` (projects, memberships, share-links, flags).

## Sécurité
- Toutes les routes admin derrière `IsAdminRole` / `owner` ; audit de toute action admin.
- Les flags sont lus côté front via un endpoint `GET /config/flags` (cache court) →
  l'UI se conforme (un flag OFF masque proprement la surface concernée).
