# Plan d'action — Gestion des annotations de bout en bout (Pactiva)

> Document de pilotage (conception → architecture → dev → runbook). **Aucune exécution
> avant validation de ce plan.** Objectif : gérer **campagnes, documents et assignations
> de bout en bout**, donner un **accès très robuste et fiable au document à annoter**, et
> distinguer sans ambiguïté la **vraie session d'annotation (solo)** de la **collaboration
> (aide/discussion)**, le tout alimentant l'**accord inter‑annotateurs (IAA)**.

---

## 0. Résumé exécutif

Pactiva = atelier d'annotation **multi‑annotateurs où chacun annote seul, sur sa propre
session**. La « multi‑annotation » n'est PAS de l'édition partagée : c'est (a) la
**collaboration** (présence, commentaires, comparaison — pour s'aider/discuter) et (b) la
production de **plusieurs annotations indépendantes du même document** afin de calculer
l'**accord inter‑annotateurs (kappa)**. L'admin **pilote** (campagnes, documents,
assignations) et **supervise** (avancement, IAA) sans annoter à la place des gens.

Principe directeur : **« une personne, une session, une annotation »** (INV‑4) ; la
collaboration est une **surcouche en lecture** ; l'admin est un **espace séparé**.

---

## 1. Principes & invariants (non négociables)

| # | Principe |
|---|---|
| P1 | **Annotation mono‑propriétaire** : unique par `(projet, document, annotateur)` (INV‑4 backend). On n'édite **jamais** l'annotation d'autrui. |
| P2 | **Ma session = mon annotation** : le workspace `/annotate/[id]` n'ouvre QUE l'annotation de l'utilisateur courant. |
| P3 | **Collaboration ≠ édition** : présence, commentaires, comparaison, « fantômes » LLM = **lecture/discussion**, visuellement distincts, jamais d'écriture croisée. |
| P4 | **IAA par construction** : plusieurs annotateurs sur les mêmes documents → kappa pairwise + agrégé (`projects/iaa.py`). |
| P5 | **Admin = pilotage/supervision**, séparé de l'annotation (chantier G) : campagnes, assignations, avancement, IAA. |
| P6 | **Robustesse d'accès** : ouvrir/reprendre une session doit être **idempotent, résilient (offline/erreurs), sans perte** (chantier C : autosave + `client_op_id`). |
| P7 | **Désambiguïsation UX** : à tout moment l'utilisateur sait s'il est en *Ma session* (édition) ou en *Comparaison/Collaboration* (lecture). |

---

## 2. État des lieux (audit du système réel)

### 2.1 Ce qui existe déjà (à réutiliser)
**Backend**
- `Annotation` (INV‑4, statut, `source`, **versions**), `Clause` (idempotence `client_op_id`, chantier C).
- `POST /annotations` → **get_or_create** de l'annotation de l'utilisateur pour un document (= ouverture de session lazy), option `seed=preannotation:<judge>`.
- Actions `AnnotationViewSet` : `submit`, `clauses`, `versions`, `versions/<n>/diff`, `comments`, `attribution`.
- `projects/iaa.py` : **Cohen's kappa** par thème de phrase — `pairwise_kappa_for_document`, `project_iaa` (moyenne sur docs ≥ 2 annotateurs).
- `ProjectViewSet` : `assignments` (GET), `progress`, `iaa`, `insights/<doc>`, `share-links` (admin), `preannotations/import` (admin), visibilité.
- `ProjectMembership` (annotator/reviewer/lead), `Assignment` (project, document, assignee, statut pending/in_progress/done), présence temps réel (Channels), commentaires.

**Frontend**
- Workspace 3 panneaux `/annotate/[id]`, `/review/[id]`, `/compare`, `/history/[id]`, `/projects/[slug]/insights` (KPI/IAA partiels), divergence (`DivergenceNav`), présence (`useLivePresence`).
- Admin (lecture surtout) : `corpora`, `schemes`, `projects` (publier/dépublier), `preannotations`, `translations`, `exports`, `users`, `audit`.
- Nav refondue (fil d'Ariane, retour, Console admin, sidebar lucide).

### 2.2 Gap analysis (ce qui manque)
| Domaine | Manque | Type |
|---|---|---|
| **Assignation** | CRUD UI + endpoints (créer/supprimer/réassigner, **bulk**, **overlap N annotateurs** pour IAA, auto‑équilibrage) | Back + Front |
| **Campagne** | Écran détail campagne (documents, membres, paramètres) ; ajout de documents depuis le corpus ; gestion des membres | Back + Front |
| **Accès annotation** | File « Mes annotations » robuste + **ouverture/repise fiable** de ma session (flux idempotent UI) | Front (+ durcissement) |
| **Supervision** | Dashboard **avancement par annotateur** (qui/où/% / retard) | Back (agrégat) + Front |
| **IAA** | Dashboard **kappa** (matrice annotateurs, par doc, par campagne/dataset, seuils, export) | Front (back ~prêt) |
| **Désambiguïsation** | Séparation visuelle nette *Ma session* vs *Comparaison/Collaboration* | Design/UX |

---

## 3. Modèle conceptuel & terminologie (lever toute ambiguïté)

**Glossaire produit (et libellés UI figés) :**
- **Campagne** (`Project`) : corpus + schéma + membres + paramètres (dont *overlap*).
- **Document** : unité à annoter (phrases indexées).
- **Assignation** (`Assignment`) : « tel document est à annoter par tel annotateur ».
- **Session d'annotation** : l'espace **solo** où j'édite **mon** annotation d'un document.
- **Annotation** (`Annotation`) : le travail **mono‑propriétaire** d'un annotateur sur un document.
- **Collaboration** : présence + commentaires + comparaison = **aide/discussion en lecture**.
- **Accord inter‑annotateurs (IAA)** : kappa entre annotations **soumises** d'un même document.
- **Revue** : un *reviewer* lit/note/commente (sans réécrire l'annotation).

**Codes visuels de désambiguïsation (charte) :**
- *Ma session* : chrome **accent navy**, badge « Ma session — édition », autosave visible.
- *Comparaison/Collaboration* : chrome **neutre/gris**, badge « Lecture — comparaison », bandeau « vous consultez le travail d'un autre annotateur, non modifiable ».
- *Revue* : badge « Revue » distinct.

---

## 4. Spécification fonctionnelle

### F1 — Gestion de campagne (admin) `/admin/projects/[slug]`
Écran **détail campagne** à onglets : **Vue d'ensemble · Documents · Membres · Assignations · Avancement · IAA · Publication**.
- Créer/éditer une campagne (nom, corpus, schéma, guidelines, **overlap = nb d'annotateurs/doc** ex. 1, 2, 3 ; anonymisation IAA on/off).
- Membres : ajouter/retirer, rôle (annotator/reviewer/lead).
- Documents : lister, **ajouter depuis le corpus** (sélection/filtre), retirer.

### F2 — Assignation de bout en bout (admin) — onglet *Assignations*
- **Matrice** documents × annotateurs (cocher = assigner).
- **Assignation en masse** : sélection de N docs → M annotateurs.
- **Overlap pour IAA** : « assigner chaque doc à *k* annotateurs » (auto, équilibré round‑robin).
- **Auto‑équilibrage** de charge (répartir équitablement les docs restants).
- Désassigner / réassigner ; voir statut par assignation.
- *Garde‑fou* : désassigner un doc déjà annoté avertit (l'annotation reste, mais sort de la file).

### F3 — Accès robuste au document à annoter (annotateur) — *Mes annotations*
- File de travail **« Mes annotations »** : mes documents assignés, groupés par statut (À faire / En cours / Terminé), recherche/tri, progression.
- Bouton **« Annoter / Reprendre »** → flux **fiable & idempotent** :
  1. `POST /annotations {project, document}` (get_or_create INV‑4) → renvoie l'`annotationId` (le mien).
  2. Redirection vers `/annotate/<annotationId>`.
  3. Reprise au dernier point ; autosave (chantier C) + récupération offline.
- États : *assigné non démarré*, *en cours*, *soumis*. Action **« Soumettre »** (fige pour l'IAA).
- *Robustesse* : retries réseau, anti‑double‑création (INV‑4), message clair si non assigné / doc indisponible.

### F4 — Session d'annotation solo (cœur) `/annotate/[id]`
Existant (3 panneaux), à **fiabiliser + baliser** : bandeau « Ma session », indicateur autosave/soumission, garde anti‑perte, raccourcis. Aucune écriture sur autrui.

### F5 — Collaboration (aide/discussion, **non éditante**)
- **Présence** (qui regarde), **commentaires** (fil par clause/phrase), **comparaison côte‑à‑côte** (ma version vs un autre annotateur / LLM) + **diff/divergence**.
- Accès depuis la session via un bouton **« Comparer / Collaborer »** ouvrant un mode **lecture** distinct (chrome neutre). On peut discuter, jamais réécrire l'annotation de l'autre.

### F6 — Supervision admin (avancement) — onglet *Avancement*
- Tableau **par annotateur** : assignés / en cours / soumis / % ; détection **retards**.
- Tableau **par document** : nb annotateurs requis (overlap) vs soumis.
- Filtres (annotateur, statut), export CSV.

### F7 — Accord inter‑annotateurs (IAA) — onglet *IAA*
- **Matrice kappa** annotateur×annotateur (campagne), **kappa par document** (pairwise), moyenne campagne (`project_iaa`).
- Seuils colorés (ex. <0,4 faible / 0,4–0,6 moyen / >0,6 bon), drill‑down doc → clauses divergentes, export.
- Sélecteur **dataset/corpus** pour comparer plusieurs bases.

### F8 — Revue (reviewer)
Intégrer `/review/[id]` dans le parcours (badge « Revue », accès depuis l'avancement).

---

## 5. Navigation / Architecture de l'information (par rôle)

```
ESPACE ANNOTATEUR
/home                       Accueil (reprendre)
/work            ★ NOUVEAU « Mes annotations » (file de travail robuste)
/annotate/[id]              Ma session (solo, édition)
/annotate/[id]?compare=…    Mode Comparaison/Collaboration (lecture)
/review/[id]                Revue (reviewer)
/projects, /projects/[slug] Projets / tableau de bord
/projects/[slug]/docs       Documents (vue annotateur)

ESPACE ADMIN (Console admin)
/admin                      Console
/admin/projects             Campagnes (liste)
/admin/projects/[slug]      ★ NOUVEAU Détail campagne (onglets F1/F2/F6/F7/Publication)
/admin/corpora, /schemes, /users, /audit, /exports, /preannotations, /translations
```
- Fil d'Ariane + retour (déjà en place) sur tous les écrans.
- Entrées **désambiguïsées** : « Annoter » (→ ma session) vs « Comparer » (→ lecture).
- Garde de rôle : `/admin/*` réservé admin/owner (existant).

---

## 6. Design / UI / UX / ergonomie

- **Désambiguïsation** (cf. §3) : chrome/badges/bandeaux différenciant édition vs lecture.
- **File de travail** : cartes claires (titre doc, statut, progression, dernière activité), action primaire unique « Annoter/Reprendre », tri par priorité/échéance.
- **Matrice d'assignation** : grille dense lisible, cases à cocher, actions bulk en barre flottante, compteur de charge par annotateur.
- **Dashboards** (avancement, IAA) : KPI en tête, tableaux triables, codes couleur de seuils, états vides explicites, export.
- **États vides & onboarding** : « rien ne vous est assigné », « campagne sans documents », tour guidé léger (existant).
- **Ergonomie** : raccourcis clavier (workspace), profondeur ≤ 3 clics, actions réversibles (retour), confirmations sur destructif (désassigner).
- **A11y AA** (axe‑core en CI), **responsive** (admin desktop‑first, file de travail adaptative), thèmes clair/sombre (charte).
- **Cohérence** : tokens design (`design-tokens.json`), composants `ui/primitives` + `admin/AdminTable`, icônes lucide.

---

## 7. Architecture technique

### 7.1 Données (deltas légers, pas de refonte)
- `Project.settings` : ajouter `overlap` (int), `anonymize_iaa` (bool) — déjà `JSONField`.
- Réutiliser `Assignment` (statut), `Annotation` (INV‑4), `AnnotationVersion`, `iaa.py`.
- Éventuel `Assignment.status` synchronisé sur l'état de l'annotation (signal/service).

### 7.2 API (nouveaux endpoints, alignés DRF + camelCase)
| Méthode | Endpoint | Rôle | Usage |
|---|---|---|---|
| POST | `/projects/{slug}/assignments` | admin | créer une assignation (document+assignee) |
| POST | `/projects/{slug}/assignments/bulk` | admin | assigner [docs]×[annotateurs], `overlap=k` |
| DELETE | `/projects/{slug}/assignments/{id}` | admin | désassigner |
| GET | `/projects/{slug}/annotators-progress` | admin | avancement par annotateur |
| POST | `/projects/{slug}/members` / DELETE | admin | gérer membres |
| POST | `/projects/{slug}/documents` / DELETE | admin | ajouter/retirer docs (depuis corpus) |
| POST | `/annotations` | annotateur | **ouvrir/reprendre ma session** (existant, idempotent) |
| GET | `/projects/{slug}/iaa`, `/iaa/matrix` | admin/reviewer | IAA (existant + matrice) |

Permissions : `IsAdminRole` (gestion), membre du projet (annotation), reviewer (revue). Validation : un annotateur ne peut ouvrir une session que sur un doc **qui lui est assigné** (ou selon politique campagne).

### 7.3 Frontend
- React Query (cache, invalidation après mutations d'assignation), Zustand (UI), optimistic + rollback sur erreurs.
- Composants nouveaux : `WorkQueue`, `AssignmentMatrix`, `CampaignTabs`, `ProgressTable`, `IaaMatrix`, `SessionBanner` (désambiguïsation).
- Mode comparaison : paramètre d'URL `?compare=annotatorId|llm` → vue lecture.

### 7.4 Temps réel & robustesse
- Présence via Channels (existant) ; ne bloque jamais le solo (repli REST).
- Idempotence (INV‑4 + `client_op_id`), autosave debouncé (chantier C), retries, anti‑boucle 401 (existant), garde concurrence (optimistic locking sur version d'annotation).

---

## 8. Plan de développement (lots, dépendances, jalons)

| Lot | Contenu | Dépend de | Estimation |
|---|---|---|---|
| **L0** | Conception détaillée + wireframes + revue (ce plan validé) | — | 1 j |
| **L1 — Backend assignation/campagne** | endpoints assignments CRUD/bulk, members, documents, settings overlap ; tests pytest | L0 | 2 j |
| **L2 — Détail campagne (admin) + matrice d'assignation** | `/admin/projects/[slug]` onglets, `AssignmentMatrix`, bulk/overlap/équilibrage | L1 | 3 j |
| **L3 — File « Mes annotations » + ouverture robuste** | `/work`, flux idempotent ouvrir/reprendre, états, durcissement | L1 | 2 j |
| **L4 — Désambiguïsation session vs collaboration** | `SessionBanner`, mode comparaison lecture, libellés/chromes | L3 | 1,5 j |
| **L5 — Supervision avancement (admin)** | `annotators-progress` + `ProgressTable` | L1 | 1,5 j |
| **L6 — Dashboard IAA** | `IaaMatrix` + drill‑down (back ~prêt) | L1 | 1,5 j |
| **L7 — Recette, a11y, perf, doc** | e2e, axe, runbook, doc utilisateur | L2–L6 | 1,5 j |

Total ≈ **14 j** (séquencable ; L1 débloque tout).

---

## 9. Plan de conception (artefacts à produire en L0)
- **Flows** : ouvrir/reprendre une session ; assigner en masse + overlap ; consulter l'IAA.
- **Wireframes** : file de travail, détail campagne (onglets), matrice d'assignation, dashboards avancement/IAA, bandeaux de désambiguïsation.
- **Spéc d'états** : machine d'états Assignation↔Annotation (pending→in_progress→submitted), états vides/erreurs.
- **Tokens/biblio** : badges de statut, codes couleur de seuils IAA.
- Revue de conception (go/no‑go) avant L1.

---

## 10. Runbook d'exécution (pilotage)

**Préparation**
- Branche `feat/annotation-management` ; feature‑flag `NEXT_PUBLIC_FEATURE_ANNOTATION_MGMT` + `ANNOTATION_MGMT` (back) pour livrer progressivement sans casser le chemin actuel.

**Par lot (L1…L6) — boucle**
1. Implémenter (petits diffs revus).
2. **Tests** : back `pytest` (endpoints, permissions, overlap, idempotence) ; front `tsc` + `vitest` (logique assignation/IAA) ; `e2e` Playwright (parcours admin assigne → annotateur ouvre/soumet → IAA visible).
3. **A11y** axe‑core ; **build** `next build`.
4. Migrations : `makemigrations`/`migrate` (deltas settings/Assignment) — réversibles.
5. **Critères d'acceptation (DoD) par lot** (voir §11).
6. Merge sur `main`.

**Déploiement** (`./deploy/deploy-claire.sh`)
- migrate + collectstatic + build + restart + **healthcheck (retry)** + rollback auto si ≠ 200.
- **Smoke prod** : admin assigne un doc → l'annotateur le voit dans *Mes annotations* → ouvre sa session → soumet → IAA se calcule. Vérifier voisins/infra intacts (pgbouncer/reaper).

**Rollback** : feature‑flags off + `git revert` + redeploy ; migrations réversibles.

---

## 11. Definition of Done (recette globale)

- [ ] **Admin** crée une campagne, ajoute des documents, **assigne** (unitaire + masse + overlap *k*) et **réassigne/désassigne** depuis l'UI.
- [ ] **Annotateur** accède à *Mes annotations*, **ouvre/reprend sa session** de façon **fiable** (idempotent, offline‑safe, zéro perte) et **soumet**.
- [ ] **Multi‑annotation** : plusieurs annotateurs annotent le **même** doc **chacun sur sa session** ; aucune écriture croisée.
- [ ] **Désambiguïsation** : impossible de confondre *Ma session (édition)* et *Comparaison/Collaboration (lecture)*.
- [ ] **Supervision** : l'admin voit l'**avancement par annotateur**.
- [ ] **IAA** : **kappa** par document et par campagne/dataset, lisible et exportable.
- [ ] Robustesse : reprises sans perte, idempotence, gestion d'erreurs ; **a11y AA**, tests verts (`pytest`/`vitest`/`e2e`/`build`), déploiement healthcheck OK.

---

## 12. Risques & mitigations
| Risque | Mitigation |
|---|---|
| Confusion solo/collab (objectif central) | Chromes/badges/bandeaux dédiés + mode lecture explicite (P7, §3, L4) |
| Concurrence/écriture croisée | INV‑4 strict + lecture seule sur autrui + optimistic locking |
| Perte de travail | Autosave (chantier C) + `client_op_id` + reprise offline (L3) |
| Assignations incohérentes (overlap) | Service back transactionnel + tests dédiés (L1) |
| Charge/infra (multi‑annotateurs simultanés) | pgbouncer + reaper en place ; présence non bloquante (repli REST) |
| Régression du chemin actuel | Feature‑flags + petits diffs + e2e + rollback (L0/runbook) |

---

*Réf. code : `claire/annotations/models.py` (INV‑4), `claire/projects/iaa.py` (kappa),
`AnnotationViewSet`/`ProjectViewSet`, `frontend/src/components/shell/*` (nav),
`design-tokens.json` (charte). Validation de ce plan → passage à L0/L1.*
