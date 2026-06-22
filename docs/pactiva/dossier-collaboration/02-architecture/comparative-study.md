# Étude comparative des architectures — Sessions d'annotation vs Collaboration

> Objet : choisir la modélisation qui (1) supprime la duplication des documents,
> (2) sépare nettement **la vraie session d'annotation** (chacun annote seul, son
> annotation lui appartient → base des concordances/IAA/exports) de **la
> collaboration** (échanger, comparer, discuter — jamais une référence), et
> (3) reste robuste, maintenable, intuitive et testable.

## 0. Rappel du socle existant (vérité terrain, lue dans le code)

Le modèle de données **porte déjà** la notion de session, de façon *implicite mais
solide* :

| Brique | Où | Garantie |
|---|---|---|
| 1 annotation par (projet, document, annotateur) | `annotations/models.py` `UniqueConstraint(project,document,annotator)` (INV‑4) | La session d'un annotateur = **son** `Annotation` ; isolée par construction |
| Récupérer/ouvrir SA session | `annotations/views.py` `create()` → `get_or_create(project,document,annotator=request.user)` | Idempotent ; on n'ouvre jamais la session d'autrui par erreur |
| Écriture **owner‑only** | `common/permissions.py` `IsAnnotationOwner` | **Même un admin/reviewer ne peut PAS éditer** le contenu d'un tiers (intégrité IAA) |
| Lecture admin | `annotations/views.py` `get_queryset()` | Admin/reviewer voient toutes les annotations ; un annotateur ne voit que les siennes / son projet |
| Soumission versionnée | `annotations/services.py` `transition_status` | `submitted` → snapshot `AnnotationVersion` immuable |
| Concordance (IAA) | `projects/iaa.py` | κ de Cohen **pairwise** N‑way, par phrase et par thème, sur les annotations **soumises** |
| Export attribué | `exports/services.py` + `build_snapshot` | Chaque ligne porte `annotator`, `doc`, `project`, `status` |
| Collaboration | `collaboration/models.py` (`Comment`, `Review`, `ShareLink`) + comparaison N‑way + présence | Couches **distinctes** de l'annotation |

**Conséquence majeure** : la séparation « session vs collaboration » est déjà
correcte **au niveau données et permissions**. Le problème est presque entièrement
**en couche présentation** : les listes de documents sont dérivées des
*assignations* (1 ligne par couple document×annotateur) et **non filtrées par
l'utilisateur courant**, d'où la duplication (×3) pour l'admin.

---

## 1. Axe A — D'où vient la liste des documents ? (corriger la duplication)

Le bug : `GET /projects/{slug}/assignments` renvoie l'**union** des assignations
(50 docs × 3 annotateurs = 150 lignes) ; `DocumentSwitcher` et le dashboard projet
les affichent **telles quelles** → chaque document apparaît 3×.

| Option | Description | Forces | Faiblesses | Maintenabilité | Verdict |
|---|---|---|---|---|---|
| **A1** Filtre client `assigneeId == me.id` | Comme `/work` déjà | Minimal, 0 backend, immédiat, cohérent | Sur‑télécharge 150 lignes ; ne sert pas la supervision admin | Moyenne (logique dupliquée) | Palliatif |
| **A2** Filtre serveur `?assignee=me` | L'endpoint ne renvoie que mes assignations | Réseau optimal | L'admin perd la vue « union » **sur ce endpoint** ; ne résout pas la sémantique « documents distincts » | Bonne | Complément |
| **A3** Dédup client par `document.id` | Réduction par document | Robuste si l'API renvoie l'union | Ne dit pas *quelle* session ouvrir | Moyenne | Complément |
| **A4 — RETENU** Endpoint **document‑centré** `GET /projects/{slug}/documents` | 1 ligne **par document** (distinct), enrichie de `mySession` + (admin) `sessions[]` | Supprime la duplication **par construction** ; sépare clairement *document* / *ma session* / *sessions des autres* ; sert annotateur ET admin ; 1 source de vérité | + endpoint à écrire & tester | **Excellente** (sémantique explicite, testable) | **CHOISI** |

### Pourquoi A4
La duplication est un **symptôme d'un manque conceptuel** : l'app n'a pas de notion
de « document du projet » distincte de « assignation ». A1/A2/A3 corrigent le
symptôme ; **A4 corrige la cause** en introduisant la bonne ressource :

```
GET /projects/{slug}/documents
→ results: [{
    document: DocumentSummary,                 # 1 par document, JAMAIS dupliqué
    mySession: { annotationId?, status, assigned: bool } | null,
    sessions: [                                # admin/lead uniquement
      { annotatorId, username, displayName, assigned, status, annotationId?, nClauses }
    ],
    sessionsSummary: { assigned, started, submitted }
  }]
```

- L'**annotateur** consomme `mySession` (sa session, dédupliquée d'office).
- L'**admin** consomme `sessions[]` pour superviser (matrice document×annotateur)
  et ouvrir une session **en lecture seule**.
- Le `DocumentSwitcher` n'utilise plus jamais la liste d'assignations brute.

> A1 reste implémenté en **défense en profondeur** (filtre + dédup côté hooks) pour
> que toute liste résiduelle dérivée des assignations soit robuste même si un
> appel hérité subsiste.

---

## 2. Axe B — Faut‑il une entité `Session` explicite en base ?

| Option | Description | Forces | Faiblesses | Verdict |
|---|---|---|---|---|
| **B1 — RETENU** `Annotation` **EST** la session | On garde le modèle ; on *nomme* et *surface* la session partout (UI, API, doc) | 0 migration risquée ; respecte l'invariant existant INV‑4 ; pas de duplication d'état ; permissions déjà alignées | La notion reste « dérivée » (pas une table dédiée) | **CHOISI** |
| **B2** Nouvelle table `AnnotationSession(project,document,annotator,status,…)` + `Annotation` FK session | Objet « session » de 1ʳᵉ classe | **Redondant** avec `Annotation` (même cardinalité 1‑1) ; migration lourde sur données prod ; 2 sources de vérité de statut à synchroniser ; risque de divergence | Rejeté (sur‑ingénierie) |
| **B3** `Assignment` devient la session (statut/annotation portés par l'assignation) | Réutilise l'assignation | L'assignation est **optionnelle** (on peut annoter sans être assigné) ; statut déjà sur `Annotation` ; casse l'idempotence `get_or_create` | Rejeté |

### Pourquoi B1
Ajouter une table `Session` 1‑pour‑1 avec `Annotation` **n'apporte aucune
information nouvelle** : la session, c'est précisément « l'annotation de cet
annotateur sur ce document ». Le coût (migration prod, double statut, synchro)
dépasse de loin le bénéfice. La bonne réponse d'ingénierie est de **rendre la
notion lisible** (API `mySession`/`sessions`, vocabulaire UI « Ma session »,
sérialiseur dédié) sans dupliquer l'état. C'est plus **maintenable** et plus
**robuste** (une seule source de vérité du statut).

---

## 3. Axe C — Ouverture d'une session

| Option | Forces | Faiblesses | Verdict |
|---|---|---|---|
| **C1 — RETENU** `createAnnotation({project, document})` → `/annotate/{id}` (pattern `/work`) | Ouvre **toujours MA** session (get_or_create idempotent) ; jamais celle d'un autre | 1 POST au clic | **CHOISI** |
| C2 Pousser `assignment.annotationId` brut | 0 requête | Peut pointer la session **d'autrui** → bascule lecture seule déroutante | Rejeté |
| **C3 — RETENU (admin)** Lien « œil » explicite vers `/annotate/{idDeLautre}` depuis la matrice de supervision | Supervision claire, lecture seule assumée (bannière jaune) | — | **CHOISI** (réservé admin/lead) |

---

## 4. Axe D — Distinguer « collaboration » de « vraie session » dans l'UI

Principe retenu (rendre **systématique** ce qui n'existe que dans le workspace) :

| Concept | Couleur/Signalétique | Éditable ? | Compte pour l'IAA/export ? |
|---|---|---|---|
| **Ma session** | Bannière **accent** « Ma session — édition » + pictogramme crayon | Oui | Oui (c'est MA référence) |
| **Lecture seule** (session d'un autre, supervision) | Bannière **warning** « Lecture seule — annotation d'un autre annotateur » | Non (store `readOnly`, autosave coupé) | Oui (c'est SA référence, pas la mienne) |
| **Collaboration** (commentaires, présence, comparaison N‑way, fantômes LLM) | Panneaux/overlays **secondaires** étiquetés « Aide / Comparaison » | N/A (aide) | **Non** — jamais une référence |

Décliné dans : `/work` (déjà : « session personnelle »), `DocumentSwitcher`
(« Mes documents »), dashboard projet (« Ma session » vs bloc « Supervision » pour
l'admin), workspace (déjà : `isMine`).

---

## 5. Axe E — IAA pour N annotateurs

| Option | Forces | Faiblesses | Verdict |
|---|---|---|---|
| **E1 — RETENU** Cohen κ **pairwise**, moyenné par paire | Lisible, exposé par paire (où l'accord chute), déjà branché UI | `per_theme`/`boundary` **double‑comptent** si N≥3 (concatènent les observations de toutes les paires) | **CHOISI + correction** (moyenner les κ par paire au lieu de concaténer) |
| E2 Fleiss κ (multi‑annotateurs) | 1 mesure N‑way unique | Moins lisible par paire ; refonte UI | Optionnel ultérieur (exposable en complément) |

---

## 6. Axe F — Exports

| Sujet | État | Décision |
|---|---|---|
| Attribution annotateur/session | OK (`annotator` dans chaque ligne) | Conserver |
| Scope par annotateur | Absent (`scope` ne gère que `statuses`/`documents`) | **Ajouter** `scope.annotators` |
| Formats `conll/xml/md/huggingface` | **Retombent silencieusement sur jsonl** | **Tracer dans le manifeste** (`format_requested` vs `format_effective` + `warnings[]`) — jamais de troncature silencieuse ; implémenter au moins `md` lisible |
| Export « concordance » | Absent | **Ajouter** un export *matrice IAA* (CSV) réutilisant `project_iaa` |

---

## 7. Décision globale

**A4 + B1 + C1/C3 + D + E1(corrigé) + F.** On capitalise sur un socle déjà sain :
on **n'invente pas** de session redondante, on **nomme** et **expose** proprement
la session existante via une ressource *document‑centrée*, on supprime la
duplication **par construction**, et on rend la frontière session/collaboration
**visible** partout. Voir `decision-record.md` (ADR) pour le détail et les
conséquences.
