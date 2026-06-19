# 05 — Attribution multi-annotateurs & commentaires (point 3)

## Attribution « qui a modifié quoi, pourquoi »

Source : `ActivityEvent` (actor, verb, before/after, sentence_index, payload). On en
dérive une **couche d'attribution** affichable/masquable sur le document.

### Affichage (togglable)
- **Voyant d'auteur** par clause/phrase : pastille de la **couleur de l'annotateur**
  (Membership.color) + initiales, au survol → infobulle « Alice · a re-thémé en
  TERMINATION · il y a 2 h · “car clause de résiliation” ».
- **Mode “blame”** (à la git blame) : chaque phrase teintée discrètement par la couleur
  du dernier contributeur ; bascule `Attribution` dans l'en-tête.
- **Filtre par auteur** : n'afficher que les modifications d'un annotateur.

### Pourquoi
Le « pourquoi » provient (a) du `rationale` de la clause, (b) du **commentaire**
attaché, (c) du label d'événement. L'infobulle d'attribution agrège ces trois sources.

## Commentaires multi-niveaux

`Comment.scope` ∈ {`sentence`, `clause`, `range`, `document`} (+ `range_start/end`).
Un commentaire **général** = scope `document`. Un commentaire de **bloc** = scope
`range`. Fils de discussion via `thread_root`, résolution via `resolved`.

### Ergonomie (UI/UX)
- **Ancre visuelle** : un liseré/onglet discret dans la gouttière marque les phrases
  commentées ; le compteur de fils s'affiche au survol.
- **Composer contextuel** : sélection d'une plage → action « 💬 Commenter la
  sélection » (range) ; clic-droit phrase → « Commenter la phrase » ; bouton global
  « Commentaire général » (document).
- **Panneau Commentaires** (onglet de l'inspecteur) : fils groupés par portée
  (document → parties → clauses → phrases), filtrables (non résolus, à moi, par auteur),
  réponses inline, résolution en un clic.
- **Mentions** `@membre` (notifie via l'activité ; pas d'email ce cycle).
- **Temps réel** (cycle suivant) : nouveaux commentaires diffusés par WS, badge live.

### Design
- Couleurs d'auteur stables (palette accessible, contraste AA), jamais porteuses de la
  seule information (toujours doublées d'initiales/texte).
- Densité réglable ; commentaires résolus repliés par défaut.

## Permissions
- Tout membre du projet commente. Résolution : auteur du fil, owner, ou relecteur.
- L'attribution est **lecture seule** (dérivée de l'audit), non éditable.

## API (cf. `12_api_contract.md`)
- `GET /annotations/{id}/attribution?by=sentence|clause` → map cible→dernier auteur+verbe.
- `GET/POST /annotations/{id}/comments` (scope, range_start/end).
- `GET /documents/{id}/contributors` → annotateurs ayant contribué (+ couleurs).
