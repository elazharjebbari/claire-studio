# Audit approfondi — collaboration multi‑annotateurs

Méthode : lecture du code (backend `claire/`, frontend `src/`) + inspection **lecture seule**
de la prod (`ssh corolle_deploy`, ORM `.count()/.values()`). Aucune écriture.

## 1. Backend — socle (SOLIDE)

| Aspect | État | Preuve |
|---|---|---|
| Isolation par annotateur | ✓ | `annotations/models.py` `UniqueConstraint(project,document,annotator)` (INV‑4) |
| Récupération de SA session | ✓ | `annotations/views.py` `get_or_create(project,document,annotator=request.user)` (idempotent) |
| Écriture owner‑only | ✓ | `common/permissions.py IsAnnotationOwner` : `owner_id == request.user.id`, aucune dérogation de rôle |
| Lecture admin (read‑only) | ✓ | queryset annotations : admin/reviewer voient tout ; SAFE_METHODS autorisées |
| Soumission/fin de doc | ✓ | `services.transition_status` → `status=submitted` + snapshot `AnnotationVersion` (immuable) |
| Export | ✓ (réserves) | `exports/services.py` jsonl+csv, colonne `annotator`, couvre les 3 ; **pas** de scope par annotateur ; conll/xml/md/hf retombent sur jsonl ; pas de management command |
| IAA | ✓ (bug mineur) | `projects/iaa.py` Cohen κ pairwise N‑way par phrase/thème, filtré `submitted` ; `per_theme`/`boundary` **double‑comptent** si N≥3 |
| Avancement admin | ✓ | `GET /projects/{slug}/annotators-progress` (IsAdminRole) couvre les 3 |
| Membres projet | ✓ | `GET /projects/{slug}/members` renvoie bien les 3, sans filtre |

## 2. Frontend — listes (DÉFAUTS)

- **Documents en triple** — `DocumentSwitcher.tsx` et `projects/[slug]/page.tsx` mappent
  `GET /projects/{slug}/assignments` **tel quel**. En mode réel, l'admin reçoit **1 ligne
  par (document × annotateur)** = 150 lignes → 3 entrées par document. La file `/work`
  filtre, elle, par `me.id` (`work/page.tsx`) → **pattern de référence non appliqué** ailleurs.
  `data-testid="document-option-<docId>"` se retrouve répété 3×.
- **Ouverture de session fragile** — `DocumentSwitcher`/dashboard poussent
  `assignment.annotationId` brut, qui peut être **l'annotation d'un autre** (workspace bascule
  alors en lecture seule via `isMine`, mais c'est déroutant). `/work` fait correctement
  `createAnnotation({project, document: externalId})` → ouvre toujours MA session.
- **« moi + Bruno »** — `admin/users/page.tsx` contient une **table codée en dur**
  (« Bruno (reviewer) » + « moi »). « Bruno » vient aussi des fixtures MSW
  (`mocks/fixtures.ts`). **Absent du backend.** Le dashboard projet n'affiche pas de membres,
  seulement « Activité récente » (`actorName`).
- **Distinction solo vs collab** — BIEN faite **dans le workspace** (`isMine`, bannière
  « Ma session » vs « Lecture seule », autosave coupé, store `readOnly`), mais pas en amont
  dans les listes.

## 3. Prod (état réel, 2026‑06‑22)

- Corpus `claudette-tos` : **50 documents** ✓.
- **150 assignations** (50×3), 3 annotateurs (elazhar/jc.lamirel/zahra) ✓.
- Membres `campagne-pactiva` : 3, rôles lead/annotator/annotator ✓ — **aucun « Bruno »**.
- **Annotations : 1 seule** (elazhar, `draft`) ; **jc.lamirel & zahra : 0** → à débloquer.
- **Accès** : les 3 comptes s'authentifient (HTTP 200) ; un throttle 429 apparaît sur logins rapprochés (sécurité OK).
- **Hygiène** : 4 comptes démo résiduels `@claire.local` (`admin` superuser, `alice`,`bob`,`rita`)
  + projet démo `claudette-gold-v1` ; sans impact sur la campagne mais à assainir.
- Bundle prod : `NEXT_PUBLIC_ENABLE_MOCKS=false` ✓ (donc le triple = backend réel, pas un mock).

## 4. Causes racines (synthèse)

1. **Listes non filtrées par l'utilisateur** (contrat « assignations DE l'utilisateur » non
   respecté hors `/work`) → triple documents + liens vers sessions d'autrui.
2. **Reliquats de démo** (table codée en dur `admin/users`, fixtures MSW, comptes `@claire.local`).
3. **Réserves recherche** : IAA `per_theme` double‑comptage N≥3 ; export sans scope annotateur.
