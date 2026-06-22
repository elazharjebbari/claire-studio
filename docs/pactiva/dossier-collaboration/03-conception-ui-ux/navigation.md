# Carte de navigation — Pactiva

> Vocabulaire : `../01-besoins/glossaire.md`. Décisions : `../02-architecture/decision-record.md`.
> Principes des états : `ui-ux.md`. Finding directeur : `nav-supervision-matrix-topbar`
> (`../00-audit/findings.csv`).

## 1. Les quatre espaces de navigation

La navigation doit refléter la séparation conceptuelle du glossaire. On distingue
**quatre espaces** ; chacun a un rôle, un public et un état d'écriture clairs :

| Espace | But | Public | Écriture | Routes principales |
|---|---|---|---|---|
| **Corpus / Documents** | parcourir la campagne et ses textes (1 ligne/document) | annotateur + admin | non (consultation) | `/projects/[slug]/docs`, `/admin/corpora` |
| **MA session** | annoter mes documents (état A éditable) | annotateur (et admin sur ses propres docs) | **oui** (autosave, owner-only) | `/work`, `/projects/[slug]`, `/annotate/[id]` |
| **Supervision (admin)** | piloter assignations, avancement, IAA ; **lire** les sessions | admin / lead | non (lecture seule sur sessions d'autrui) | `/admin`, `/admin/projects`, `/admin/projects/[slug]` |
| **Collaboration** | s'aider : présence, commentaires, comparaison N-way | tout membre projet | n/a (jamais une référence) | panneaux du workspace, `/compare` |

Principe : **les espaces « MA session » et « Supervision » ne se mélangent jamais**.
Un admin reste dans « Supervision » pour piloter et **lire** ; il bascule
explicitement vers « MA session » pour annoter lui-même.

---

## 2. Chrome de navigation (composants)

- **`Sidebar.tsx`** — navigation primaire, repliable.
  - Bloc projet (`projectNav`, lignes 42-56) : Accueil, Mes annotations, Tableau de
    bord (si projet), Documents (si projet), Mes projets, Projets publiés, Comparer,
    Préférences.
  - Bloc **Administration** (`ADMIN_NAV`, 58-68) — visible si `isAdminRole(me.role)`
    seulement (`Sidebar.tsx:78-79,128`) : Console admin, Corpus, Schémas, Campagnes,
    Pré-annotations, Traductions, Exports, Utilisateurs, Audit.
- **`TopBar.tsx`** — sélecteur de projet courant (`project-select`), ⌘K, bouton
  « Console admin » (si admin), Documentation, aide, cloche d'activité, bascule thème,
  identité + rôle.

> ⚠️ Finding `nav-supervision-matrix-topbar` : la `TopBar` auto-sélectionne le premier
> projet dès qu'aucun n'est courant (`TopBar.tsx:30-34`). Acceptable pour un annotateur
> mono-projet ; à **ne pas** appliquer pour un admin multi-campagnes (choix arbitraire
> trompeur). Cible : auto-sélection seulement si l'utilisateur a un unique projet, ou
> mémoriser le dernier projet réellement ouvert.

---

## 3. Arbre des routes (`src/app/(app)/**`)

```
(app)/                         layout = AuthGuard + AppShell (Sidebar + TopBar)
├── home/                      Accueil — reprise rapide du travail
├── work/                      « Mes annotations » — file de travail (MA session)
├── projects/
│   ├── (page)                 Mes projets (liste)
│   └── [slug]/
│       ├── (page)             Tableau de bord projet — Ma session, progression, IAA
│       ├── docs/              Documents du projet — 1 ligne/doc + statut MA session
│       └── insights/
│           ├── (page)         Insights corpus (annotations humaines)
│           └── [documentId]/  Insights document
├── annotate/
│   └── [annotationId]/        WORKSPACE — états A (édition) / B (lecture seule)
├── compare/                   Comparaison humain ↔ Claude (Collaboration)
├── history/[id]/              Versions d'une annotation
├── review/[id]/               Revue d'une annotation
├── help/                      Documentation / centre d'aide
├── settings/                  Préférences
└── admin/                     layout admin (réservé rôles admin)
    ├── (page)                 Console admin
    ├── corpora/               Corpus
    ├── schemes/               Schémas
    ├── projects/
    │   ├── (page)             Campagnes (liste)
    │   └── [slug]/            Campagne : Assignations · Avancement · IAA · Membres · Publication
    ├── preannotations/        Pré-annotations LLM
    ├── translations/          Traductions
    ├── exports/               Exports
    ├── users/                 Utilisateurs
    └── audit/                 Journal d'audit
```

Mapping route → espace :

| Espace | Routes |
|---|---|
| Corpus / Documents | `projects/[slug]/docs`, `admin/corpora`, `admin/projects/[slug]` (onglet Assignations) |
| MA session | `work`, `projects/[slug]`, `annotate/[annotationId]` (état A) |
| Supervision | `admin`, `admin/projects`, `admin/projects/[slug]` (Avancement / IAA), `annotate/[id]` ouvert en œil (état B) |
| Collaboration | panneaux du workspace (présence, commentaires), `compare`, `LlmSourceSwitch` `compare` |

---

## 4. Recommandations de regroupement (finding `nav-supervision-matrix-topbar`)

Le finding consolide quatre symptômes. Recommandations, par priorité :

### 4.1 Grouper explicitement la sidebar par espace

Aujourd'hui `projectNav` produit une liste plate qui mêle « Mes annotations »
(MA session) et « Comparer » (Collaboration) sans intitulé. Proposer des **sections
nommées** alignées sur les quatre espaces :

```
ESPACE DE TRAVAIL
  • Accueil
  • Mes annotations        (MA session)
  • Tableau de bord        (projet courant)

CORPUS
  • Documents              (projet courant)
  • Mes projets · Projets publiés

COLLABORATION
  • Comparer

ADMINISTRATION  (admin uniquement — déjà séparé, Sidebar.tsx:128-139)
  • Console admin · Corpus · Schémas · Campagnes · …
```

Le bloc Administration est déjà correctement isolé et conditionné au rôle ; il sert de
modèle pour les autres sections.

### 4.2 Lier la supervision au tableau de bord

Le dashboard projet pose déjà un renvoi vers « Console admin → Campagnes »
(`projects/[slug]/page.tsx:61-71`) et la liste documents aussi (`docs/page.tsx:57-66`).
Compléter par le **lien retour** : depuis la campagne admin, un lien « Voir le tableau
de bord / ouvrir ma session » pour que l'admin bascule sans repasser par la sidebar.

### 4.3 Statut par cellule + œil dans la matrice de supervision

La matrice admin (`admin/projects/[slug]/page.tsx:189-208`) n'affiche que des **cases à
cocher d'assignation** — pas le statut de session ni d'accès lecture. Cible (wireframe
(2) de `wireframes.txt`) : chaque cellule `document × annotateur` montre le **statut**
(`— / draft / submitted / validated`) **et** un **œil** ouvrant la session de cet
annotateur en **lecture seule** (état B). C'est le seul chemin propre vers la
supervision d'une session tierce, et il matérialise la frontière lecture/édition.

### 4.4 TopBar : pas d'auto-sélection arbitraire pour l'admin

Voir §2. Limiter l'auto-sélection au cas mono-projet ou au dernier projet ouvert.

---

## 5. Règles de navigation invariantes

1. **Tout chemin vers l'annotation passe par `createAnnotation`** → ouvre MA session
   (INV-4), jamais celle d'un autre : `work/page.tsx:47`, `projects/[slug]/page.tsx:45`,
   `docs/page.tsx:28`, `DocumentSwitcher.tsx:80`.
2. **La supervision d'une session tierce passe par l'« œil » (lecture seule)** ; aucun
   lien ne doit ouvrir l'état A sur la session d'un autre.
3. **Le projet courant suit le document ouvert** (`AnnotationWorkspace.tsx:66-68`) pour
   garder file de travail, fil d'Ariane et sélecteur cohérents.
4. **Les routes admin sont protégées par rôle** (sidebar conditionnelle + `admin/layout`)
   et n'apparaissent pas pour un annotateur.
