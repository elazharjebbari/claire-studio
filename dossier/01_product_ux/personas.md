# Personas — CLAIRE Studio

> Les personas dérivent strictement des rôles du CONTRACT §2 (`User.role[annotator|reviewer|admin|owner]`)
> et des rôles projet (`ProjectMembership.role[annotator|reviewer|lead]`). Distinction clé : le **rôle
> système** (`User.role`) gouverne les permissions globales ; le **rôle projet** (`ProjectMembership.role`)
> gouverne la fonction dans une campagne donnée. Un `admin` système peut être `annotator` sur un projet.

Chaque persona est cadré pour piloter des décisions de conception (UX, raccourcis, permissions, états vides),
pas pour décorer. On documente : contexte, objectifs, frustrations, parcours dominant, métriques de succès,
surfaces et endpoints touchés.

---

## P1 — Salma, **Annotatrice** (juriste-linguiste vacataire)

- **Rôle système** : `annotator`. **Rôle projet** : `annotator`.
- **Contexte** : doctorante / vacataire juridique, annote 4 à 6 h/jour des ToS en anglais. Travaille
  sur écran 14", souvent en fin de journée. Fatigue oculaire et lassitude répétitive sont son ennemi n°1.
- **Compétence outil** : devient *power-user* en quelques jours si les raccourcis sont cohérents ;
  abandonne si elle doit lâcher le clavier pour la souris à chaque clause.
- **Objectifs**
  - Segmenter un document en clauses et attribuer thème + nature juridique + certitude **sans friction**.
  - Repartir d'une pré-annotation LLM (Claude/Codex) pour ne pas annoter de zéro (feature 2).
  - Justifier un choix difficile par un commentaire (feature 9) plutôt que de bloquer.
  - Voir où sont les zones « sensibles » (injustice CLAUDETTE, feature 12) sans qu'on lui impose un verdict.
- **Frustrations actuelles** (issues de l'audit κ ≈ 0,32–0,45)
  - Protocoles LLM instables → elle veut un cadre **fermé** (vocab non négociable) qui réduit l'arbitraire.
  - Outils génériques (tableurs, Doccano brut) sans certitude ni provenance ni reprise de session.
- **Parcours dominant** : `Accueil → reprendre où je m'étais arrêtée → /annotate/[id]` ; boucle clavier
  `j/k` (navigation) → `B` (frontière) → `T` (thème) → `0–3` (certitude) → `g d` (doc suivant).
- **Permissions** : édite ses propres annotations ; lecture/commentaire ailleurs ; **pas** d'accès `/admin/*`.
- **Métriques de succès** : temps médian / clause < 8 s après échauffement ; taux d'usage clavier > 80 % ;
  abandon de session (annotation `draft` jamais `submitted`) en baisse.
- **Surfaces** : `/annotate/[id]`, `/compare`, `/settings`. **Endpoints** : `POST /annotations` (avec
  `seed=preannotation:claude`), `POST /annotations/{id}/clauses`, `PATCH /clauses/{id}`,
  `POST /annotations/{id}/submit`, `POST /annotations/{id}/comments`.

---

## P2 — Marc, **Reviewer** (expert juridique senior)

- **Rôle système** : `reviewer`. **Rôle projet** : `reviewer`.
- **Contexte** : relit les annotations soumises, arbitre la qualité, fixe le gold. Temps rare et cher :
  il veut **lire vite, juger, commenter, trancher**. Ne segmente pas lui-même (lecture seule du workspace).
- **Objectifs**
  - Évaluer une annotation `submitted` → décision `approve | request_changes | reject` + score 1–5
    + rubrique (feature 10, `Review`).
  - Comprendre *pourquoi* l'annotateur a tranché : lire `rationale`, `certainty`, commentaires, et
    comparer à la pré-annotation LLM (diff).
  - Renvoyer un retour actionnable (commentaire ancré sur la clause litigieuse).
- **Frustrations** : revoir sans contexte de certitude ; ne pas distinguer humain vs LLM ; perdre le fil
  des points déjà commentés.
- **Parcours dominant** : `/projects/[slug] → file des annotations submitted → /review/[id]` ; lecture
  guidée par les clauses à faible `certainty` ; `C` pour commenter, formulaire de review, décision.
- **Permissions** : lecture + commentaire partout dans le projet ; notation/review ; voit « qui a annoté
  quoi » sans anonymisation ; **pas** d'accès `/admin/*`.
- **Métriques de succès** : temps de revue / annotation ; proportion de reviews avec rubrique remplie ;
  taux de `request_changes` traité (boucle fermée).
- **Surfaces** : `/review/[id]`, `/compare`, `/history/[id]`. **Endpoints** : `GET /annotations/{id}`,
  `POST /annotations/{id}/reviews`, `GET /annotations/{id}/reviews`, `POST /annotations/{id}/comments`,
  `POST /comments/{id}/resolve`, `GET /annotations/{id}/versions/{n}/diff`.

---

## P3 — Inès, **Lead de campagne** (chef de projet annotation)

- **Rôle système** : le plus souvent `reviewer` ou `admin`. **Rôle projet** : `lead`.
- **Contexte** : responsable d'une campagne (`Project`). Distribue le travail, suit l'avancement et
  l'accord inter-annotateurs (IAA / κ), débloque les annotateurs, garantit que le gold sort à temps.
  N'est pas forcément `admin` système : le rôle `lead` est **projet**, pas global.
- **Objectifs**
  - Voir d'un coup d'œil l'avancement et l'IAA du projet (feature 4, `GET /projects/{slug}/progress`).
  - Réaffecter, prioriser, repérer les documents en souffrance ou les désaccords à arbitrer.
  - Suivre l'activité (« qui a annoté quoi », cloche, `ActivityEvent`).
- **Frustrations** : pilotage à l'aveugle ; κ calculé hors-ligne dans un notebook ; pas de vue de désaccord.
- **Parcours dominant** : `/projects/[slug] (dashboard) → progression + IAA → /projects/[slug]/docs
  (filtres statut) → /compare (arbitrage 2 annotateurs)`.
- **Permissions** : gère membres/assignations **de ses projets** ; lecture complète de l'activité projet.
  L'accès `/admin/*` global dépend de son **rôle système** (un `lead` non-admin ne crée pas de corpus).
- **Métriques de succès** : % documents `approved` à l'échéance ; κ par paire d'annotateurs ; délai
  médian `submitted → approved`.
- **Surfaces** : `/projects/[slug]`, `/projects/[slug]/docs`, `/compare`, cloche d'activité.
  **Endpoints** : `GET /projects/{slug}/progress`, `GET /projects/{slug}/assignments`,
  `GET /activity?project=`, `GET /annotations?project=&status=`.

---

## P4 — Karim, **Admin / Owner** (architecte du dispositif)

- **Rôle système** : `admin` ou `owner` (l'`owner` = super-admin : facturation, suppression de corpus,
  gestion des `owner`/`admin` ; l'`admin` = configuration et exploitation courante).
- **Contexte** : met en place l'instrument. Importe le corpus CLAUDETTE, définit le `LabelScheme`
  (vocab **fermé et versionné**), crée les projets et y affecte les membres, branche les pré-annotations
  LLM, déclare les traductions, déclenche les exports, surveille l'audit. C'est le persona « réutilisabilité
  multi-corpus » (feature 11).
- **Objectifs**
  - Rendre la plateforme **agnostique au corpus** : déclarer un nouveau `Corpus` + cloner/versionner un
    `LabelScheme` sans toucher au code (feature 11).
  - Importer/normaliser les pré-annotations v9.2/v9.4 vers le pivot interne (feature 2).
  - Produire des exports multi-format traçables (feature 5) et garder un audit trail complet (feature 4).
- **Frustrations** : schémas d'annotation « ouverts » qui dérivent (catégories `OTHER_*` libres) →
  il impose le vocab fermé. Imports LLM hétérogènes (v9.2 vs v9.4) → il veut un mapping fiable.
- **Parcours dominant** : `/admin → /admin/corpora (import) → /admin/schemes (clone/version) →
  /admin/projects (membres/assignations) → /admin/preannotations (import+mapping) → /admin/exports`.
- **Permissions** : accès total `/admin/*` ; `owner` seul peut supprimer un corpus / gérer les admins.
- **Métriques de succès** : temps de mise en route d'un nouveau corpus ; taux de mapping réussi des
  pré-annotations ; exports reproductibles (manifest complet).
- **Surfaces** : `/admin/*` (corpora, schemes, projects, preannotations, translations, exports, users, audit).
  **Endpoints** : `POST /schemes`, `POST /projects`, `POST /projects/{slug}/preannotations/import`,
  `POST /translations/sets` + `/sync`, `POST /projects/{slug}/exports`, `GET /activity`.

---

## Matrice de permissions (synthèse, alignée navigation.md §4)

| Capacité | annotator | reviewer | lead (projet) | admin/owner |
|---|---|---|---|---|
| Éditer ses annotations (`POST/PATCH clauses`) | ✅ | — (lecture) | selon rôle projet | ✅ |
| Reviewer & noter (`POST reviews`) | — | ✅ | ✅ | ✅ |
| Commenter (`POST comments`) | ✅ | ✅ | ✅ | ✅ |
| Voir « qui a annoté quoi » | partiel (anonymisable) | ✅ | ✅ | ✅ |
| Gérer membres/assignations | — | — | ✅ (ses projets) | ✅ |
| `/admin/*` (corpus, schemes, exports) | ❌ | ❌ | ❌ (sauf si admin système) | ✅ |
| Supprimer corpus / gérer admins | ❌ | ❌ | ❌ | `owner` seul |

## Anti-personas (hors-périmètre explicite)

- **Le juriste qui veut un vocab libre** : refusé par design — le `LabelScheme` est fermé (ADR-0003).
- **L'annotateur qui veut un éditeur WYSIWYG riche** : hors-périmètre ; l'unité est la **phrase indexée**,
  la segmentation est **monotone** dérivée des ancres (CONTRACT §1).
- **L'utilisateur anonyme grand public** : pas de landing marketing (navigation.md) ; outil interne.
