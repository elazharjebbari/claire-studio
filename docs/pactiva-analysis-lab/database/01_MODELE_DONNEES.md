# Modèle de données, migrations et rétention

## Entités nouvelles

### AnalysisPreset

`id UUID`, projet, propriétaire, nom, module, configuration JSONB validée, visibilité
(`private/team/project`), version de contrat, timestamps. Contrainte de nom par propriétaire/projet ;
aucun résultat n’est stocké dans un preset.

### AnalysisRun

`id UUID`, projet, initiateur, mode, unité, configuration canonique JSONB, manifeste sources JSONB,
fingerprint SHA-256, manifeste métriques, schéma/GoldRun optionnels, statut, progression, résumé JSONB
borné, erreur typée, timestamps de queue/début/fin, expiration. Contrainte unique conditionnelle sur
un run actif de même fingerprint et manifeste.

### AnalysisArtifact

run, type, chemin opaque, format, taille, checksum SHA-256, content type, confidentialité, expiration.
Le chemin disque n’est jamais retourné directement au client.

### AnalysisIssue / DisagreementCase

Référence projet/run/document/unité, code ou typologie, gravité/entropie, acteurs pseudonymisés,
résumé des votes JSONB, statut, assignation, résolution et timestamps. Une ForeignKey vers une
action métier peut être ajoutée ; les décisions finales restent dans Review/Gold/Scheme.

### ReportJob / ReportArtifact

Configuration, runs sources, template, initiateur, confidentialité, état/progression/erreur ; puis
artefact, checksum, taille et expiration. Un rapport n’est téléchargeable qu’après nouvelle
évaluation des droits.

## Fingerprint exact

```text
sha256(canonical_json({
  contract_version,
  project_id,
  scheme_version,
  selected_document_ids_sorted,
  annotation_version_ids_sorted,
  preannotation_ids_and_schema_versions_sorted,
  gold_run_ids_sorted,
  statuses,
  normalized_filters,
  metric_versions
}))
```

Pour une annotation soumise, utiliser son `AnnotationVersion` immuable. Pour un draft explicitement
autorisé, hacher les valeurs analytiques ordonnées des clauses et enregistrer qu’il s’agit d’un
snapshot volatil. À terme, un compteur de révision transactionnel peut accélérer cette étape ; une
date `updated_at` seule n’est pas une preuve suffisante.

## Indexes candidats

- `AnalysisRun(project_id, status, created_at desc)` ;
- `AnalysisRun(project_id, fingerprint, metric_manifest_hash)` ;
- `DisagreementCase(project_id, status, disagreement_type, entropy desc)` ;
- `AnalysisIssue(run_id, severity, status)` ;
- `AnalysisPreset(project_id, owner_id, visibility)` ;
- `ReportJob(project_id, status, created_at desc)`.

Les indexes sur sources existantes ne sont ajoutés qu’après `EXPLAIN ANALYZE`. Toute migration est
expand/contract, compatible avec la version N-1, testée sur copie de taille production et précédée
d’une sauvegarde. Aucun champ obligatoire volumineux n’est ajouté en une transaction bloquante.

## JSONB et artefacts

JSONB convient aux configurations et petits résumés. Les colonnes souvent filtrées restent
normalisées. Une réponse ou série dépassant 1–5 Mo est un artefact compressé paginé, pas un JSONB.
Parquet est optionnel pour l’export scientifique ; JSON gzip reste le format d’échange interne
simple. `ArtifactStore` permet filesystem privé aujourd’hui, S3/MinIO demain.

## Rétention proposée

- presets : jusqu’à suppression du projet/utilisateur ;
- runs : 180 jours par défaut, runs épinglés conservés ;
- artefacts interactifs : 30 jours, régénérables ;
- rapports : 90 jours configurable ;
- issues/cas et audit d’action : politique projet/légale, pas de purge automatique aveugle ;
- texte contractuel dans les rapports : opt-in, chiffrement au repos et expiration courte.

La purge est un job idempotent qui supprime l’artefact puis marque la ligne, journalise uniquement
les identifiants/checksums et conserve le manifeste minimal nécessaire à l’audit.
