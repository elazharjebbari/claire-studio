# Navigation — Architecture de l'information (annotateur + admin)

Pas de landing marketing. L'application est un **atelier de travail**. La navigation suit la règle
« 3 zones, profondeur ≤ 3 clics » et s'adapte au rôle (`annotator | reviewer | admin | owner`).

## 1. Carte des routes (Next.js App Router)

```
/                         Accueil — explication courte + accès rapide (reprend où on s'est arrêté)
/login                    Authentification (JWT) + SSO-ready
/projects                 Liste des projets visibles (cartes : avancement, IAA, rôle)
/projects/[slug]          Tableau de bord projet (progression, mes assignations, activité, IAA)
/projects/[slug]/docs     Liste des documents (statut, annotateurs, filtres)
/annotate/[annotationId]  ★ WORKSPACE D'ANNOTATION (cœur du produit)
/review/[annotationId]    Mode revue (reviewer) : lecture + notation + commentaires
/compare?doc=&a=&b=       Comparaison côte-à-côte (humain vs LLM, ou 2 annotateurs) + diff
/history/[annotationId]   Historique & versions (timeline + diff)
/settings                 Préférences perso (thème, raccourcis, densité, langue)
/admin                    Console admin (réservé admin/owner)
/admin/corpora            Corpus & documents (import CLAUDETTE)
/admin/schemes            Schémas d'annotation (vocab fermé, versions, clone)
/admin/projects           Création/édition de campagnes, membres, assignations
/admin/preannotations     Import & mapping des pré-annotations LLM (claude/codex)
/admin/translations       Déclaration des dossiers de traductions (file-based)
/admin/exports            Exports et formats
/admin/users              Utilisateurs & rôles
/admin/audit              Journal d'audit global
```

## 2. Chrome applicatif (shell)

- **Barre latérale gauche (collapsible)** : navigation primaire contextuelle au projet courant
  (Tableau de bord, Documents, Mes annotations, Revue, Comparer, Historique). Icônes + labels,
  repliable pour maximiser l'espace de lecture.
- **Top bar** : sélecteur de projet, recherche globale (⌘K palette de commandes), avancement perso,
  bascule thème clair/sombre, menu utilisateur, cloche d'activité (qui a annoté quoi — feature 4).
- **Zone admin** : accessible via le menu utilisateur (badge rôle) ou `/admin` ; sépare clairement
  « travail d'annotation » et « pilotage ».
- **Command palette (⌘K)** : sauter à un document, lancer un export, changer de thème de clause,
  ouvrir l'aide — accélère les power-users.

## 3. Le Workspace d'annotation `/annotate/[id]` (cœur)

Disposition **3 panneaux** redimensionnables, pensée anti-fatigue (voir `06_design_system`) :

```
┌───────────────┬──────────────────────────────────────┬───────────────────┐
│  PLAN / TOC    │   DOCUMENT (lecture + annotation)      │  INSPECTEUR        │
│  (gauche)      │   (centre, colonne ~70ch, line-height  │  (droite)          │
│                │    1.7, thème sombre doux)             │                    │
│ • Clauses du   │  [0] we recently revised these terms   │ Clause sélectionnée│
│   doc (thèmes  │  [1] ...                               │ • Thème (palette)  │
│   colorés)     │  ┌─ clause START (ancre) ───────────┐  │ • Nature juridique │
│ • Progression  │  │ [6] fitbit designs products ...   │  │ • Certitude 0–3    │
│ • Sauts rapides│  │ [7] ...                           │  │ • Evidence span    │
│                │  └───────────────────────────────────┘  │ • Rationale        │
│ Overlays:      │  Surlignage injustice CLAUDETTE (12)   │ • Commentaires (9) │
│  ☑ injustice   │  Fantôme pré-annotation LLM (2)        │ • Diff vs LLM      │
│  ☑ LLM claude  │                                        │                    │
│  ☐ LLM codex   │                                        │                    │
└───────────────┴──────────────────────────────────────┴───────────────────┘
```

Interactions clés (feature 1 — simplifier l'annotation) :

- **Poser une frontière de clause** : cliquer une phrase → devient ancre de clause ; ou raccourci
  `B`. Le thème s'attribue au clavier (palette colorée + recherche typée) ou `T` puis frappe.
- **Pré-remplissage LLM** (feature 2) : bouton « Pré-remplir depuis Claude / Codex » charge les
  ancres+thèmes du LLM comme **brouillon éditable** (provenance tracée). Les frontières LLM non
  retenues restent en « fantôme » pour comparaison.
- **Certitude** (feature 10) : 0–3 au clavier sur la clause sélectionnée ; agrégée en certitude
  globale d'annotation.
- **Commentaire** (feature 9) : `C` ouvre un fil sur la clause/phrase pour justifier le choix.
- **Injustice CLAUDETTE** (feature 12) : surlignage natif togglable, info-bulle catégorie+niveau,
  aide à repérer les zones sensibles sans imposer de choix.
- **Navigation clavier** complète (j/k phrases, B frontière, T thème, C commentaire, 0–3 certitude,
  ⌘S snapshot, g d → document suivant). Documentée dans l'aide `?`.

## 4. Adaptation par rôle

| Élément | annotator | reviewer | admin/owner |
|---|---|---|---|
| Workspace d'annotation | ✅ édite | ✅ lecture + commente | ✅ |
| Mode revue & notation | — | ✅ | ✅ |
| Comparaison / diff | ✅ | ✅ | ✅ |
| `/admin/*` | ❌ | ❌ | ✅ |
| Voir « qui a annoté quoi » | partiel (anonymisable) | ✅ | ✅ |

## 5. États vides & onboarding

- Accueil avec **0 projet** : explication du produit + CTA (rejoindre/créer un projet selon rôle).
- Projet sans assignation : « rien ne vous est encore assigné » + lien progression.
- Premier document : tour guidé léger (raccourcis, overlays) déclenchable, jamais bloquant.
