# Architecture backend — Features A & B

> Périmètre : ce que le backend Django 5 + DRF doit faire (et **ne pas faire**) pour
> supporter la **réglette multi-pistes** (A) et l'**annotation hybride phrase/bloc** (B).
> **Thèse centrale, non négociable** : **aucune migration de schéma, aucun nouvel
> endpoint obligatoire**. A est une couche de **visualisation** (relit des données qui
> existent déjà) ; B est une couche d'**interaction** au-dessus du modèle `Clause` par
> phrase. Le backend reste la source de vérité de la *persistance*, jamais celle du
> « bloc » (qui est dérivé côté front) ni des « pistes » (projections de PreClause LLM).

Conventions : API montée sous `/api/v1/` (router `DefaultRouter(trailing_slash=False)`,
`config/api_urls.py`). Wire format **camelCase** via `djangorestframework-camel-case`
(renderer/parser configurés dans `config/settings/base.py::REST_FRAMEWORK`) ; les
serializers restent **snake_case** côté Python. Auth **SimpleJWT** (`JWTAuthentication`,
`AUTH_HEADER_TYPES=("Bearer",)`) + `SessionAuthentication` en secours.

---

## 1. Modèle de données — réutilisation intégrale (zéro migration)

### 1.1 `Clause` reste l'unité atomique « par phrase »

`backend/claire/annotations/models.py` :

- `Clause.annotation` → FK `Annotation` (CASCADE, `related_name="clauses"`).
- `Clause.anchor_sentence` → FK `corpora.Sentence` (**PROTECT**, `related_name="anchored_clauses"`).
  ⚠️ **Il n'existe pas de champ `anchor_index` sur le modèle** : l'`anchorIndex` exposé par
  le contrat est **dérivé** (`anchor_sentence.index`) dans `ClauseSerializer.to_representation`.
- `Clause.theme` → FK `schemes.Theme` (PROTECT) ; `legal_nature` → FK `schemes.LegalNature`
  (SET_NULL, nullable) ; `evidence_span`, `rationale` (TextField) ; `certainty`
  (PositiveSmallIntegerField, `{null,0..3}`) ; `order` (PositiveInteger) ; `client_op_id`
  (CharField, idempotence chantier C).
- **INV-2** : `UniqueConstraint(fields=["annotation","anchor_sentence"], name="uniq_clause_annotation_anchor")`.
  (C'est la garantie « une clause-start unique par phrase » — la formulation « unique par
  `anchor_index` » du cahier B se traduit ici par `anchor_sentence`.)
- **INV-4** : `UniqueConstraint(fields=["project","document","annotator"], name="uniq_annotation_project_doc_annotator")`.
- **INV-6** : `CheckConstraint(ck_clause_certainty_range)`.

**Pourquoi rien ne change pour B.** Le « bloc » du cahier des charges est une **suite
contiguë de clauses de même thème, dérivée côté front** (`lib/blocks.ts::deriveBlocks`).
Annoter « par bloc » ou « par phrase » produit **exactement le même état stocké** : N lignes
`Clause(anchor_sentence, theme)`, une par phrase. Donc **aucun** `end_index`, **aucun**
`block_id`, **aucune** table `Block`. L'identité d'un bloc (`(start, theme)`) n'a pas de
sens persistant ; la matérialiser violerait l'invariant « la vérité = une clause = une
phrase » et casserait l'IAA par phrase (§4). Cette innocuité est l'**invariant B-IAA-1**
(spec B §7) : pour tout état atteignable par gestes-bloc, il existe une suite de
gestes-phrase produisant le même `draftClauses`.

**Pourquoi rien ne change pour A.** Les « pistes » (Claude, Codex, Mistral…) sont des
**projections des `PreClause` LLM existantes** (§3). Rien n'est écrit ; la réglette ne
relit que ce que `useLlmAgreement` charge déjà via `/preannotations`.

### 1.2 `PreAnnotation` / `PreClause` (sources LLM) — inchangés

`backend/claire/imports/models.py` :

- `PreAnnotation(project, document, judge, schema_version, raw, imported_at, mapped)` ;
  unique `(project, document, judge, schema_version)` → **plusieurs versions** coexistent
  par (doc, juge), ce que la réglette exploite (sélecteur de version, déjà en place).
- `PreClause(preannotation, anchor_index, theme_code, evidence_span, rationale, order)`.
  Ici `anchor_index` **est** un champ entier réel (contrairement à `Clause`).

Conclusion §1 : **table-compatibilité totale**. Le diff de migration attendu pour A et B
est **vide**.

---

## 2. Permissions objet (clause / annotation) — aucun changement

L'écriture par bloc (B) passe **toujours** par les endpoints clause existants, donc hérite
**telle quelle** de la sécurité actuelle. Rien à ajouter.

### 2.1 `IsAnnotationOwner` (objet)

`backend/claire/common/permissions.py` :

```python
class IsAnnotationOwner(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        owner_id = getattr(obj, "annotator_id", None)
        if owner_id is None:                                  # obj est une Clause
            owner_id = getattr(getattr(obj, "annotation", None), "annotator_id", None)
        return owner_id is not None and owner_id == request.user.id
```

- **Pas de bypass de rôle** : même un reviewer/admin ne peut pas écrire les clauses d'autrui
  (intégrité IAA). C'est exactement la garantie **R1** côté front (`store.readOnly` neutralise
  les mutateurs en lecture seule) ; le backend la **rend opposable** côté serveur.
- `ClauseViewSet` clé la permission sur l'**annotation parente** :

```python
class ClauseViewSet(...):
    http_method_names = ["get", "patch", "delete"]   # PAS de POST
    permission_classes = [IsAnnotationOwner]
    def get_object(self):
        obj = super().get_object()
        self.check_object_permissions(self.request, obj.annotation)  # remonte au propriétaire
        return obj
```

- `AnnotationViewSet` restreint les actions de contenu au propriétaire :
  `_OWNER_ONLY_ACTIONS = {"update","partial_update","destroy","submit","add_clause"}` →
  `get_permissions()` renvoie `[IsAnnotationOwner()]`.

### 2.2 Conséquence pour B (gestes de bloc → lot de clauses)

Un geste « annoter une plage de 12 phrases » devient, après débounce, **12 écritures
clause unitaires** (create/patch) émises par l'autosave existant (`useAutosave`), chacune
filtrée par `IsAnnotationOwner`. **Aucun endpoint « batch »** n'est requis ni souhaitable :
introduire un POST « bulk clauses » obligerait à dupliquer la résolution INV-2 / la
résolution thème / la permission objet, pour un gain marginal (le débounce + l'idempotence
absorbent déjà le pic — §5). Si un jour le volume l'exige, un endpoint **optionnel**
`POST /annotations/{id}/clauses/batch` est esquissé dans `api-contrat.yaml` (marqué
**proposé**, non requis) ; il ne changerait **ni le modèle ni les permissions** (mêmes
contrôles, en boucle serveur).

---

## 3. Extensibilité des juges (Mistral) via loaders / `Judge` — sans refonte

La réglette A est « extensible à N modèles ». Ajouter Mistral est **additif** :

1. **Enum** `backend/claire/imports/models.py` :

```python
class Judge(models.TextChoices):
    CLAUDE = "claude", "Claude"
    CODEX = "codex", "Codex"
    OTHER = "other", "Other"
    MISTRAL = "mistral", "Mistral"   # ← seul ajout « métier »
```

   `PreAnnotation.judge` est un `CharField(choices=Judge.choices)` **sans CheckConstraint
   DB** : ajouter un membre d'enum **ne requiert pas de migration de données** (la colonne
   accepte déjà la chaîne). La migration générée serait au plus un `AlterField` cosmétique
   (mise à jour des `choices`), sans transformation de données — on peut même s'en passer
   fonctionnellement. **Aucune** migration structurelle.

2. **Loaders** `backend/claire/imports/loaders.py` : `normalize_v92` (segments `start_id →
   anchor_index`) et `normalize_v94` (`plan.clauses`, `anchor_id → anchor_index`) sont
   **agnostiques au juge** — un payload Mistral au format v9.2/v9.4 **passe sans une ligne
   de code spécifique**. La normalisation produit le pivot `{anchor_index, theme,
   evidence_span, rationale, order}` quel que soit l'auteur.

3. **Ingestion** : `ingest_preannotation(project, document, judge, raw)`
   (`imports/services.py`) transmet `judge` tel quel (pas de validation contre l'enum) et
   est idempotent sur `(project, document, judge, schema_version)`. L'endpoint d'import
   `POST /projects/{slug}/preannotations/import` (sur `ProjectViewSet`, `IsAdminRole`)
   accepte donc Mistral **sans modification**.

4. **Point de vigilance** (le seul) : la commande d'archive
   `imports/management/commands/import_annotations_archive.py` **code en dur**
   `judge = judge_raw if judge_raw in ("claude","codex") else "other"`. Pour un import
   Mistral *via cette commande*, étendre le tuple en `("claude","codex","mistral")`. Les
   chemins API (import endpoint, seed `preannotation:<judge>`) n'ont **pas** cette
   restriction.

5. **Lecture** : `GET /documents/{id}/annotation-versions` (sur `DocumentViewSet`) agrège
   déjà `(schema_version, judge, n_clauses)` ; Mistral y apparaît dès qu'il est importé.
   `GET /preannotations?document=…&judge=mistral&version=…` le sert (filtres existants).

**Bilan** : Mistral = **1 membre d'enum** (+ éventuellement 1 ligne dans une commande
batch). Le reste de la chaîne backend est déjà générique. La réglette front consomme ce
nouveau juge comme une piste de plus (cf. `architecture-frontend.md` §3).

---

## 4. IAA par phrase — strictement préservée

`backend/claire/projects/iaa.py` :

```python
def _theme_vector(annotation, n_sentences):
    clauses = annotation.clauses.select_related("anchor_sentence", "theme")
    starts = {c.anchor_sentence.index: c.theme.code for c in clauses}
    return [starts.get(i) for i in range(n_sentences)]   # phrase non étiquetée = None
```

- Le κ de Cohen (`cohen_kappa`) est calculé **par phrase**, sur deux vecteurs de longueur
  `n_sentences` ; **aucun forward-fill** ; `None` = phrase non annotée (catégorie à part
  entière dans `pe`). `pairwise_kappa_for_document` produit la matrice paire-à-paire
  (`/projects/{slug}/iaa`) ; `project_iaa_detail` ajoute `boundary_kappa` (accord sur
  l'appartenance « début de clause ») et `per_theme` (un-contre-tous).
- **Innocuité de B** : `deriveBlocks` est **pur front** et **lecture seule** ; le bloc
  n'apparaît **nulle part** dans `iaa.py`. Comme un bloc se stocke en N clauses par phrase
  identiques au geste phrase-à-phrase équivalent, le vecteur `_theme_vector` est **bit-à-bit
  identique** → κ **inchangé** (B-IAA-1). Un test d'équivalence côté front (06-plan-tests)
  prouve « plage via bloc » == « N clics phrase » au niveau `draftClauses`.
- **Innocuité de A** : la réglette n'écrit pas → aucun effet sur les annotations humaines
  ni sur l'IAA. Les frontières LLM sont déjà prises en compte côté détail
  (`boundary_kappa`) indépendamment de leur visualisation.

---

## 5. Persistance des gestes de bloc — le flux d'écriture existant suffit

Le contrat d'écriture est inchangé ; B s'y branche sans adaptation backend.

- **Création** : `POST /annotations/{id}/clauses` (action `add_clause`). Supporte
  l'**idempotence** : si `client_op_id` (= `localId` front) a déjà servi, renvoie la clause
  existante (200) au lieu de dupliquer ; doublé d'un `UniqueConstraint(annotation,
  client_op_id)` partiel en base. Vérifie INV-2 (`Conflict` si une clause démarre déjà sur
  la phrase) ; `order` par défaut = nombre de clauses.
- **Mise à jour** : `PATCH /clauses/{id}` (thème/nature/span/rationale/certitude) ;
  re-vérifie INV-2 si l'ancre change.
- **Suppression** : `DELETE /clauses/{id}`.

Le front émet ces opérations via `useAutosave` (débounce 1200 ms) qui calcule un **diff
incrémental par ancre** (`lib/autosave.ts::planClauseSync`) : un lot « bloc » de `p`
phrases ⇒ `p` `creates` (idempotents) séquencés **hors chemin critique UI**. La primitive
front `applyBlockOp` (un seul `set()` Zustand, un seul snapshot undo) ne change **rien** au
backend : elle produit un nouveau `draftClauses` que l'autosave réconcilie clause par
clause. Le durcissement « ne pas réessayer sur 401/403 » (dette identifiée audit §5) est un
correctif **front** (autosave), sans incidence sur les endpoints.

---

## 6. Ce qui change vs ce qui ne change pas — synthèse

| Élément backend | A (réglette) | B (phrase/bloc) | Verdict |
|---|---|---|---|
| Modèle `Clause` / INV-2 / INV-4 / INV-6 | inchangé | inchangé | **zéro migration** |
| Modèle `PreAnnotation` / `PreClause` | inchangé (relu) | n/a | inchangé |
| `IsAnnotationOwner` (objet, R1 opposable) | n/a (lecture) | inchangé (réutilisé) | inchangé |
| Endpoints clause (`add_clause`, PATCH/DELETE `/clauses`) | n/a | réutilisés tels quels | inchangé |
| `Judge` TextChoices | + `MISTRAL` (additif) | n/a | 1 membre d'enum |
| Loaders v9.2 / v9.4 | agnostiques juge (déjà) | n/a | inchangé |
| `projects/iaa.py` (κ par phrase) | n/a | inchangé (bloc invisible) | inchangé |
| Endpoints lecture LLM (`/preannotations`, `/documents/{id}/annotation-versions`) | réutilisés | n/a | inchangé |
| **Ajouts proposés (optionnels, non requis)** | — | `POST …/clauses/batch` (perf), cf. `api-contrat.yaml` | **différable** |

**Définition de fait backend** : A & B livrables avec **0 migration de schéma**, **0
endpoint nouveau obligatoire**, **0 modification de permission**, et au plus **1 membre
d'enum `Judge`** pour Mistral. Toute dérive (champ `end_index`, table `Block`, endpoint
batch rendu obligatoire) est un signal de conception à refuser.
