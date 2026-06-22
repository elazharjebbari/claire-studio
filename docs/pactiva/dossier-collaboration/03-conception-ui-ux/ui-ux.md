# Conception UI/UX — Séparation « session » vs « collaboration »

> Source de vérité du vocabulaire : `../01-besoins/glossaire.md`. Décisions :
> `../02-architecture/decision-record.md` (ADR-001). Wireframes : `wireframes.txt`.
> Findings UX : `../00-audit/findings.csv` (`area=ux`).

## 0. Principe directeur

Tout l'enjeu UX de Pactiva tient en une phrase du glossaire : un utilisateur ne
doit **jamais** confondre « multi-annotation pour s'aider » et « vraie session
d'annotation ». L'interface matérialise donc en permanence **trois états mutuellement
exclusifs** de la zone centrale, et **un quatrième espace périphérique** (la
collaboration) qui ne se substitue jamais à un état d'édition.

| État | Qui | Peut écrire ? | Compte comme référence ? | Signal visuel |
|---|---|---|---|---|
| **A — Ma session (édition)** | propriétaire (`isMine`) | Oui (autosave) | Oui (mes clauses validées = gold) | accent (`bg-accent/10`, crayon) |
| **B — Lecture seule / supervision** | admin/lead sur la session d'autrui | Non | Non (intégrité IAA) | warning (`bg-warning/10`, œil) |
| **C — Aide LLM (source juge)** | propriétaire, source ≠ humain | Non (overlay) | **Jamais** (INV-COLLAB) | doit afficher un bandeau « lecture seule » |
| **D — Collaboration** | tout membre du projet | n/a (commentaires, présence) | **Jamais** (INV-COLLAB) | panneaux latéraux, espace nommé distinct |

La règle d'or de l'UX : **un seul état d'édition à la fois, et il est toujours nommé
et coloré**. La collaboration (D) est de la *progressive disclosure* (rien en solo,
discret à plusieurs) et n'emprunte jamais l'accent réservé à « Ma session ».

---

## 1. Les trois états de la zone centrale

### État A — « Ma session » (éditable)

- **Détermination** : `AnnotationWorkspace.tsx:37` —
  `isMine = !!me && !!annotation && String(annotation.annotatorId) === String(me.id)`.
  Choix **sûr par défaut** : tant que `me` ou `annotation` n'est pas confirmé, on
  considère que ce n'est PAS ma session (lecture seule), ce qui évite toute écriture
  sous identité incertaine (et tout 403 d'autosave parasite).
- **Bannière** (`AnnotationWorkspace.tsx:119-125`) : barre accent, icône `Pencil`,
  texte « Ma session — édition », `data-testid="session-banner"`.
- **Conséquences fonctionnelles** : le store s'initialise avec `readOnly: false`
  (`AnnotationWorkspace.tsx:53-59`) ; l'autosave est armé **uniquement** sur ma
  session (`useAutosave(isMine ? annotation?.id : null)`, ligne 86) ; la barre
  d'outils active soumission, snapshot, certitude, pré-remplissage.
- **Wireframe** : `wireframes.txt` (4) — ligne `[accent]✎ Ma session — édition`.

### État B — « Lecture seule / supervision » (owner-only respecté)

- **Détermination** : `!isMine` → bannière warning (`AnnotationWorkspace.tsx:126-134`),
  icône `Eye`, texte « Lecture seule — annotation d'un autre annotateur (non
  modifiable) ».
- **Conséquences fonctionnelles** : le store reçoit `readOnly: true` (ligne 58) ; la
  barre d'outils **neutralise toutes les actions serveur** — `disabled={readOnly}` sur
  Snapshot (`WorkspaceToolbar.tsx:290`), Soumettre (312), pré-remplissage (202), et la
  certitude est `pointer-events-none opacity-50` (275). L'autosave n'est jamais armé,
  donc l'intégrité de la session d'autrui (base de l'IAA) est garantie côté UI **en
  plus** de la garde API `IsAnnotationOwner`.
- **Wireframe** : `wireframes.txt` (4) — ligne `[warn] 👁 Lecture seule…`.

### État C — « Aide LLM » (source de segmentation ≠ humaine)

Dans le `DocumentPanel`, `LlmSourceSwitch.tsx` pilote la source affichée :
`human` (édition) / un juge LLM (Claude, Codex, Mistral) / `compare` (overlay
d'accord par phrase). Lorsque la source est un juge, **le rail affiché n'est pas mon
annotation** : c'est une aide visuelle, jamais une référence (INV-COLLAB). La puce de
phrase porte déjà la légende « Pré-rempli — à valider (n'est pas la référence) »
(`DocumentPanel.tsx:716`) et le statut « Annoté — à valider » (649).

- Le **pré-remplissage** (barre d'outils) est un *écrasement explicite et annulable* :
  toute application sur une annotation non vide passe par un dialogue de confirmation
  « Remplacer l'annotation par … ? » qui prévient « écrase TOUTES vos annotations
  actuelles … vous pourrez annuler (⌘Z) » (`WorkspaceToolbar.tsx:330-372`). C'est la
  matérialisation UX de « la collaboration aide, ne fait pas référence » : le LLM ne
  peut entrer dans ma session que par un acte délibéré et réversible.

### État D — « Collaboration » (aide latérale, jamais une référence)

- **Présence + invitation** : `CollabBar.tsx` (avatars empilés, voyant live/REST,
  bouton « Inviter »), intégré dans la barre du document (`DocumentPanel.tsx:392`).
  Progressive disclosure : `if (!presenceEnabled) return null` (ligne 31).
- **Commentaires multi-niveaux** : `CommentsPanel.tsx` (document / phrase / sélection
  de plage / clause), panneau latéral togglable depuis la barre d'outils
  (`WorkspaceToolbar.tsx:228-236`), filtre « non résolus », couleurs d'auteur.
- **Comparaison N-way** : `LlmSourceSwitch` (`compare`) + comparaison côte-à-côte
  (`/compare`). Sert l'accord (IAA) et la discussion, **n'écrit jamais** dans une
  session par construction.

---

## 2. Parcours utilisateurs

### Annotateur — « j'annote MA session »

```
/work (Mes annotations)         ← file de travail, regroupée En cours / À faire / Terminé
   └─ [Annoter] sur un document
        → createAnnotation({project, document})   (get_or_create, INV-4 idempotent)
        → /annotate/{id}                            ← TOUJOURS MA session
             • bannière accent « Ma session — édition »
             • autosave actif, soumission/gate de validation disponibles
```

- Point d'entrée alternatif identique : tableau de bord projet
  (`projects/[slug]/page.tsx:40-50`) et liste documents
  (`projects/[slug]/docs/page.tsx:24-33`) — **tous** ouvrent via `createAnnotation`,
  donc jamais la session d'un autre par accident.
- Le `DocumentSwitcher` (barre d'outils) navigue entre **mes** documents
  (`useProjectDocuments(slug, {mine:true})` → 1 entrée/document) et rouvre toujours ma
  session (`DocumentSwitcher.tsx:80`). Voir wireframe (3).
- Aucune assignation ≠ blocage : le tableau de bord propose « Annoter (libre) »
  (`docs/page.tsx:90-92`) ; l'assignation est une *intention*, pas une porte fermée
  (glossaire).

### Admin / lead — « je supervise, je ne co-édite pas »

```
Console admin (TopBar/Sidebar)  → /admin/projects (Campagnes)
   └─ campagne → onglets : Assignations · Avancement · Accord (IAA) · Membres · Publication
        • Assignations : matrice document × annotateur (cases à cocher)
        • Avancement   : assignés / démarrés / soumis / % par annotateur
        • IAA          : κ global, par thème, paire-à-paire par document, export CSV
   └─ pour LIRE une session d'un autre : ouverture en LECTURE SEULE (œil)
        → /annotate/{id} en état B (bannière warning, écriture neutralisée)
```

- L'admin a **deux casquettes nettement séparées** : sur ses propres pages projet
  (`projects/[slug]`), un encart rappelle « ci-dessous **votre propre** session ;
  la supervision est dans Console admin → Campagnes » (`projects/[slug]/page.tsx:61-71`
  et `docs/page.tsx:57-66`). Il n'édite jamais la session d'autrui.
- Wireframes (1) vue annotateur et (2) vue admin/supervision.

---

## 3. Réduction d'ambiguïté (synthèse des dispositifs)

1. **Un document = une ligne** partout : `useProjectDocuments({mine:true})` côté
   dashboard, docs et `DocumentSwitcher` (INV-DOC-UNIQUE). Fin des `9gag, 9gag, 9gag`
   du wireframe (3).
2. **Bannière d'état permanente** en haut du workspace (accent vs warning), jamais
   ambiguë sur « qui possède cette session ».
3. **Couleur sémantique réservée** : l'accent = MON édition ; le warning = lecture
   seule ; le LLM/collaboration = teintes neutres + mention « à valider / n'est pas la
   référence ».
4. **Actions destructrices confirmées et réversibles** : écrasement par
   pré-remplissage = dialogue + ⌘Z + historique.
5. **Vocabulaire aligné sur le glossaire** dans les libellés visibles : « Ma session »,
   « Lecture seule », « Assignation », « Accord (IAA) ».

---

## 4. États vides / chargement / erreur

| Écran | Chargement | Vide | Erreur |
|---|---|---|---|
| Workspace (`AnnotationWorkspace.tsx:98-104`) | « Chargement du workspace… » centré | n/a | identité incertaine ⇒ retombe en lecture seule (sûr par défaut) |
| `/work` (`work/page.tsx`) | rien tant que `isLoading` | pas de projet → « Sélectionnez un projet… » (63-67) ; rien d'assigné → consigne « Console admin → Campagnes » (75-80) | bandeau danger + « réessayez » (69-73), `createAnnotation` réessayable sans double création |
| Dashboard projet (`projects/[slug]/page.tsx`) | placeholders KPI | « Rien ne vous est encore assigné » (112-116) | IAA non calculable → encart explicatif (133-140) |
| Documents (`docs/page.tsx:98-100`) | — | « Aucun document. » | — |
| `DocumentSwitcher` (157-198) | — | « Aucun document. » (155) | ouverture verrouillée par `opening` (anti double-clic) |
| Commentaires (`CommentsPanel.tsx:131-133`) | — | « Aucun commentaire. » | — |
| IAA dashboard (`projects/[slug]/page.tsx:136-139`) | — | « calculé dès qu'au moins deux annotateurs auront soumis le même document » | — |
| Présence (`CollabBar.tsx:31`) | voyant live/REST | masquée si flag off | dégradé REST si WebSocket KO (voyant gris) |
| Autosave (`WorkspaceToolbar.tsx:379-414`) | « ● enregistrement… » | « ● non enregistré » si dirty | « ✗ échec » + bouton **Réessayer** ; « non enregistré — session expirée ou lecture seule » |

---

## 5. Findings UX de l'audit et leur traitement

Source : `../00-audit/findings.csv` (lignes `area=ux`). « État » = situation actuelle
vérifiée dans le code ; « Cible » = traitement prescrit par ADR-001.

| ID | Sév. | Sujet | État vérifié | Cible / traitement |
|---|---|---|---|---|
| `switcher-wrong-session-on-nav` | blocker | La nav ouvrait la session d'un autre | **Résolu** : `DocumentSwitcher` source `{mine:true}` + ouverture `createAnnotation` (ma session, INV-4) `DocumentSwitcher.tsx:44,80` | conservé ; couvert par test anti-doublon |
| `nav-supervision-matrix-topbar` | major | Nav non séparée en espaces ; supervision non liée au dashboard ; matrice sans statut ; TopBar auto-select | **Partiel** : encarts de renvoi dashboard→Console admin posés ; matrice = cases à cocher **sans statut par cellule ni œil** (`admin/projects/[slug]/page.tsx:189-208`) ; TopBar auto-sélectionne le 1er projet (`TopBar.tsx:30-34`) | Grouper la nav (Corpus / MA session / Supervision / Collaboration — voir `navigation.md`) ; **statut + œil par cellule** ; ne pas auto-sélectionner pour l'admin |
| `judge-view-no-readonly` | major | Source juge sans signal « lecture seule » ; menus actifs écriraient dans ma session | **Partiel** : les puces portent « à valider / n'est pas la référence » (`DocumentPanel.tsx:649,716`) mais **pas de bandeau global** quand `llmSource ≠ human` | Bandeau « lecture seule (aide LLM) » dès source non humaine ; bloquer/confirmer les menus d'édition sur overlay juge |
| `collab-not-grouped` | major | Collaboration ni regroupée ni nommée comme espace distinct | **À traiter** : `CollabBar` et `CommentsPanel` coexistent sans intitulé « Collaboration » commun (`DocumentPanel.tsx:388-392`) | Regrouper présence + invitation + commentaires sous un espace **« Collaboration »** explicitement distinct de « Mon annotation » |
| `adopt-no-confirm` | minor | « Reprendre » / arbitrages de divergence écrivent sans confirmation | **À traiter** : `InspectorJudgeCompare.tsx:110-123` | Retour visuel + annulation, ou sortir ces actions des zones nommées « Comparer » |
| `help-vs-session-naming` | minor | Aide LLM vs vraie session jamais nommées | **Partiel** : pré-remplissage confirmé/annulable ; libellé reste « Pré-remplir » (`WorkspaceToolbar.tsx:190`) | Légende persistante des pastilles + reformuler en « Pré-remplir (aide, à valider) » |
| `compare-redundancy` | info | Deux comparaisons (`/compare` humain↔Claude vs `ComparePanel` N-way) sans lien | **À clarifier** : `/compare` est humain↔Claude (`compare/page.tsx`) ; le N-way vit dans le workspace | Distinguer « Comparer les modèles entre eux » vs « Comparer ma session au modèle » |
| `comment-author-raw` | minor | `CommentThread` affiche l'id brut de l'auteur | **Partiel** : `CommentsPanel` résout déjà le nom via `useContributors` (`CommentsPanel.tsx:60-64,149-151`) ; `CommentThread.tsx:35` non | Unifier l'affichage d'auteur via `useContributors` dans les deux composants |
| `presence-flag-silent` | info | Présence/invitation disparaît totalement si flag off | **Connu** : `CollabBar.tsx:31` `return null` | Garder un point d'entrée « Collaboration » cohérent même sans temps réel |

### Findings accessibilité / design touchant l'UX (`dimension=design-a11y`)

| ID | Sév. | Sujet | Cible |
|---|---|---|---|
| `theme-fouc-no-blocking-script` | major | FOUC du thème (appliqué en `useEffect`) | script inline bloquant light/dark avant le 1er paint |
| `no-prefers-reduced-motion` | major | `prefers-reduced-motion` ignoré | `@media (prefers-reduced-motion: reduce)` : durées ~0, scroll auto |
| `save-indicator-no-live-region` | major | Autosave sans `role=status`/`aria-live` | `role=status aria-live=polite aria-atomic` + annonces pose/undo/redo (`WorkspaceToolbar.tsx:397`) |
| `hardcoded-tailwind-state-colors` | major | ~86 couleurs Tailwind en dur hors tokens | tokens sémantiques centralisés (`StatusPill`/`SaveIndicator`) |

---

## 6. Invariants UX à ne jamais casser

1. **Un seul état d'édition visible** (A), toujours nommé et coloré ; B et C n'écrivent
   pas.
2. **La collaboration (D) reste périphérique** : couleurs neutres, panneaux latéraux,
   jamais l'accent de « Ma session ».
3. **Aucune donnée de collaboration n'est silencieusement promue en référence**
   (INV-COLLAB) : tout passage LLM → session est explicite et réversible.
4. **Un document = une ligne** dans toute liste (INV-DOC-UNIQUE).
5. **L'admin lit, n'édite pas** : l'œil de supervision ouvre l'état B, jamais l'état A
   d'un tiers.
