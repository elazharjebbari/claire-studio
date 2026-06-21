# Besoins fonctionnels

## Feature A — Barre des frontières par modèle
- **A1** Afficher, simultanément, les **frontières de clause de chaque modèle**
  (Claude, Codex, +Mistral) le long du document, alignées aux phrases.
- **A2** **Togglable** : montrer/masquer la réglette globalement, et par modèle.
- **A3** **Catégorie optionnelle** : afficher/masquer la teinte/abréviation de
  catégorie par segment, sans surcharger.
- **A4** **Lecture immédiate** : comprendre « qui coupe où » d'un coup d'œil.
- **A5** **Non intrusif** : compact, élégant, n'empiète pas sur la zone de lecture.
- **A6** **Interactif** : survol = détail (modèle, catégorie, plage de phrases) ;
  clic = naviguer/centrer la phrase ; (option) adopter une frontière de modèle.
- **A7** **Extensible** : ajout d'un modèle = une piste de plus, sans refonte.
- **A8** **Accessible** : contrastes AA, navigable clavier, lisible daltonisme
  (forme + couleur).

## Feature B — Annotation bloc/phrase
- **B1** Annoter **une phrase** précisément (déjà : C4).
- **B2** Annoter **une plage** (bloc) en un geste (thème appliqué à toutes ses phrases).
- **B3** **Surcharger une phrase** d'un bloc sans casser le reste (split visuel).
- **B4** **Étendre/réduire** un bloc par ses bords (poignées) ou re-sélection.
- **B5** **Fusionner/diviser** des blocs adjacents intelligemment.
- **B6** **Désannoter** (toggle) une phrase ou un bloc.
- **B7** **Cohérence IAA** : rester par phrase au stockage (κ juste).
- **B8** **Découpage propre** : pouvoir bâtir SON découpage indépendamment des LLM,
  ou partir d'un modèle puis ajuster.
- **B9** **Ergonomie experte** : gestes rapides (souris + clavier), feedback visuel
  clair (bloc vs phrase), annulable (undo/redo).

## Contraintes transverses
- Pas de migration de schéma si évitable (robustesse, déploiement simple).
- Performance : documents jusqu'à ~300 phrases, plusieurs modèles, fluide.
- Réversibilité : chaque couche activable/désactivable.
- Respect de la lecture seule (annotation d'autrui non modifiable — R1).
