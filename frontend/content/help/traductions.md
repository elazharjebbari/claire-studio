# Traductions

CLAIRE Studio gère des traductions **fondées sur des fichiers** (*file-based*),
permettant d'afficher un document dans plusieurs langues sans dupliquer
l'annotation.

## Overlay multilingue

Dans le panneau Plan, la bascule **traduction** affiche le texte traduit en regard
du texte source. L'annotation (clauses, thèmes) reste alignée sur le document
d'origine : seules les phrases affichées changent de langue.

## Déclaration des dossiers

Côté admin (`/admin/translations`), on déclare des **dossiers de traductions**
puis on lance une **synchronisation** qui aligne chaque traduction sur les phrases
du document source.

> Le modèle file-based facilite l'ajout de langues : il suffit de fournir un
> dossier de traductions aligné, sans toucher au schéma d'annotation.
