# Archivage, rétention & restauration

> Périmètre : feature **F10** (archivage). État : `Annotation.status = archived` (CONTRACT §2).
> Relié au versioning (`07_collaboration_versioning/versioning.md`), à l'audit
> (`activity_feed.md`) et à la rétention RGPD (`12_security/rgpd_dpia.md`).

## 1. Archivage = retrait du flux actif, pas suppression

CLAIRE ne **détruit** jamais une annotation par une action utilisateur courante. L'archivage est un
**changement d'état réversible** :

- `archived` retire l'annotation des vues de travail (tableau de bord, « mes annotations », exports
  gold par défaut) **sans** supprimer les données ni l'historique.
- Les `AnnotationVersion`, `Comment`, `Review`, `ActivityEvent` rattachés **demeurent** (audit
  préservé). C'est un soft-state, pas un soft-delete destructif.

Cas d'usage : annotation obsolète (schéma changé), doublon, brouillon abandonné, document retiré du
périmètre projet, mise au propre du tableau de bord.

## 2. Transition & permissions

`PATCH /api/v1/annotations/{id}` avec `{"status": "archived"}` (ou action dédiée) :

- Autorisé : auteur de l'annotation (sur ses brouillons/rejetés), `lead`/`admin` (toute annotation du
  projet). Un reviewer seul n'archive pas (il `reject`).
- **Garde-fous** :
  - une annotation `approved` ne s'archive pas sans confirmation explicite `?confirm=archive_approved`
    (on protège le gold validé) ;
  - l'archivage **crée une `AnnotationVersion`** (snapshot de l'état archivé, raison `archive`) et
    émet `ActivityEvent verb=annotation.archived`.
- **Restauration (désarchivage)** : `{"status": <statut antérieur>}` ou
  `POST .../restore` → remet l'annotation dans son statut **précédent l'archivage** (lu dans le
  dernier snapshot non-archivé), crée une version `restore`, émet `annotation.restored`. Forward-only
  (cohérent avec `versioning.md` §4) : on n'efface jamais l'épisode d'archivage.

## 3. Rétention

La politique de rétention est **par projet/corpus** (`Project.settings.retention` /
`Corpus`-level), pour concilier valeur scientifique (reproductibilité) et minimisation RGPD :

```json
{
  "retention": {
    "archived_annotations_days": 365,
    "activity_events_days": 730,
    "export_artifacts_days": 180,
    "hard_delete_requires": "admin_with_dpia_reference"
  }
}
```

- Au-delà du délai, une tâche planifiée propose (jamais n'exécute en silence) une **purge** des
  éléments archivés expirés. La purge réelle (hard delete) est :
  - réservée `admin`/`owner`, exige une **référence de motif** (DPIA / demande d'effacement, cf.
    `12_security/rgpd_dpia.md`),
  - **journalisée** (`ActivityEvent`), avec conservation d'un **enregistrement de purge minimal**
    (id, date, motif, périmètre) — pas le contenu, mais la preuve que la purge a eu lieu.
- Les `ActivityEvent` sont append-only ; leur purge suit `activity_events_days` et n'est admissible
  que pour la conformité (droit à l'effacement), jamais pour réécrire l'histoire produit.

## 4. Effet sur les autres features

- **Exports** (`08_import_export/export_formats.md`) : les annotations `archived` sont **exclues par
  défaut** ; un `scope.status` explicite peut les inclure (audit, reproductibilité d'un état passé).
- **IAA** : exclues du calcul par défaut (elles ne représentent pas le gold courant).
- **Comparaison** (`/compare`) : une version archivée reste comparable via l'historique (on compare
  des snapshots, pas l'état vivant).
- **Versioning** : l'archivage et le désarchivage sont des nœuds normaux de la timeline d'historique.

## 5. Garanties

- Réversibilité : tout archivage est annulable tant que la rétention n'a pas déclenché de purge.
- Non-destruction par défaut : aucune action de routine ne supprime des données.
- Traçabilité totale : archivage, désarchivage et purge sont des `ActivityEvent` ; la purge garde une
  preuve minimale.

## 6. Tests (CONTRACT §6)

- `pytest archival` : archivage réversible ; snapshot créé ; restauration au statut antérieur ; garde
  `approved` ; purge réservée admin + motif + preuve minimale.
- `pytest archival_export` : `archived` exclu par défaut des exports/IAA ; inclus si `scope` explicite.
- `e2e review.spec` : archivage depuis le tableau de bord, désarchivage, vérification audit.
