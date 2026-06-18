# Export

Les exports produisent des fichiers réutilisables pour l'analyse ou l'archivage,
depuis `/admin/exports`.

## Formats

- **JSONL** — une ligne par document/annotation, format pivot riche (clauses,
  thèmes, certitudes, provenance, evidence spans). Adapté au traitement programmatique.
- **CSV** — format tabulaire, pratique pour l'inspection rapide ou les tableurs.

## Manifeste

Chaque export est accompagné d'un **manifeste** décrivant son contenu : projet,
schéma utilisé, périmètre (documents inclus), horodatage et options de format.
Le manifeste garantit la reproductibilité et la traçabilité de l'export.

> Les formats explicatifs incluent les justifications et la certitude, ce qui
> permet de reconstituer le raisonnement derrière chaque annotation.
