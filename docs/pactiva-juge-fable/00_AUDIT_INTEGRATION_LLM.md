# Audit — comment les juges LLM s'intègrent à Pactiva

> Objet : comprendre, avant d'ajouter **Fable** comme 4ᵉ juge, la totalité de la chaîne
> « fichier JSON produit par un modèle » → « surface visible dans l'atelier / le gold ».
> Périmètre audité : `backend/claire/{imports,gold,projects,triage,analysis,annotations}`,
> `frontend/src/{lib,components/workspace,components/gold}`, `deploy/`.

---

## 1. Le matériau : la session 4 « Fable »

`/Users/elazhar/PycharmProjects/CLAIRE/annotations/v9_2_session4_fable/` — **50 fichiers**
`<doc>_fable.json`, produits selon `PROMPT_V9_2_FABLE.md` (segmentation thématique pure,
juge aveugle) et `RUNBOOK_V9_2_FABLE.md`.

Contrôle d'intégrité effectué sur les 50 fichiers :

| Contrôle | Résultat |
|---|---|
| Nombre de fichiers | **50 / 50** |
| `judge` | `"fable"` partout |
| `version` | `"v9.2-nature-derived"` partout (idem Claude/Codex) |
| `doc` == nom de fichier | **0 divergence** |
| `document_plan.segments` non vide | **50 / 50** (aucun repli nécessaire) |
| Total segments / phrases | **1 728 segments**, **9 414 phrases** |
| Thèmes | 19 codes du vocabulaire fermé, **aucun `OTHER_*`** |
| `legal_nature` (dérivée par script) | 58 % `UNKNOWN`, 42 % renseignée (≥ cible 40 %) |
| Couverture du corpus | **identique** à Claude et Codex (50 docs) ; Mistral n'en a que **22** |

**Conséquence de fond** : Fable est le **troisième juge complet** du corpus (avec Claude et
Codex). Il double la couverture de Mistral. C'est important pour les mesures à N juges
(concordance, triage, oracle de majorité) : le triage exige `min_judges = 2`, et passer de
2–3 à 3–4 votants sur 50 documents change le régime de majorité.

---

## 2. La chaîne d'intégration, de bout en bout

```
data/preannotations/<judge>/<doc>_<judge>.json
        │
        │  manage.py import_preannotations --project <slug> --judges <liste>
        ▼
claire.imports.loaders.normalize_preannotation(raw)      ← détection de schéma v9.2 / v9.4
        │      · v9.2 : document_plan.segments[] → clauses pivot
        │      · repli : _segments_from_annotations() si le plan est vide
        │      · _nature_by_index() : legal_nature de la phrase d'ancre
        ▼
claire.imports.services.ingest_preannotation(...)        ← idempotent, upsert
        │      clé d'unicité = (project, document, judge, schema_version)
        ▼
PreAnnotation ──1..N──> PreClause {anchor_index, theme_code, evidence_span,
        │                          rationale, legal_nature, order}
        ▼
   ┌────┴─────────────────────────────────────────────────────────────┐
   │                                                                  │
GET /api/v1/preannotations?project=&document=            claire.gold.services.build_document_data
   │  (PreAnnotationSerializer, thème normalisé)             │  votes par phrase (forward-fill)
   ▼                                                        ▼
FRONT — useLlmAgreement / useTriage                     gold_scoring.score_sentence
   · réglette des frontières (ModelBoundaryRail)        · LLM = RÉFÉRENCE, jamais votant
   · fantômes de frontière, menu phrase, hover          · llm_details affichés à l'arbitre
   · comparaison N-way (ComparePanel)                        │
   · pré-remplissage (seed=preannotation:<judge>)            ▼
   · overlay de triage C1–C5                        claire.gold.llm_seed.add_llm_annotator
                                                     (promotion optionnelle en annotateur)
```

Autres consommateurs, tous **génériques** (itèrent sur les juges *présents*, sans liste en dur) :

- `claire/projects/concordance.py` — accord humain↔juge et juge↔juge, `per_judge` trié ;
- `claire/triage/engine.py` (+ miroir TS `frontend/src/lib/triage/engine.ts`) — routage
  C1–C5 à partir d'un dict `{juge: thème}` ; seuil `min_judges = 2` ;
- `claire/analysis/snapshots.py` — `actorKey = "llm:<judge>:<version>"` pour le labo ;
- `GET /documents/{id}/annotation-versions` — inventaire `{version, judge, nClauses}`.

---

## 3. Revue de code : ce qui est bien fait

1. **Une seule porte d'entrée d'écriture** — tout passe par `ingest_preannotation`, qui est
   *réellement* idempotent : il compare `raw` **et** la liste de clauses désirée avant de
   toucher la base (`preannotation_unchanged` en log), et ne réécrit que le delta.
2. **Le juge n'est jamais partie au conflit** — `gold_scoring` acte que la résolution est
   strictement inter-annotateurs ; les LLM apparaissent en `llm_details` (référence pour
   l'arbitre) et sont **retirés** du calcul dès qu'un juge est promu annotateur
   (`build_document_data` filtre `judge in annotator_usernames`) : pas de double-comptage.
3. **Source unique côté front** — `frontend/src/lib/llmJudges.ts` alimente la réglette, les
   fantômes, le sélecteur de source, le pré-remplissage, la comparaison N-way et le hover.
   Le commentaire d'en-tête dit explicitement : « ajouter un juge = une entrée ici (+ le
   `Judge` backend + l'import des données) ».
4. **Multi-versions assumé** — la contrainte d'unicité inclut `schema_version`, donc un même
   (doc, juge) peut porter v9.2 et v9.4 ; l'UI sait proposer le choix.
5. **Normalisation des thèmes centralisée** — `theme_mapping.normalize_theme_code` réconcilie
   le vocabulaire v9.x (`THIRD_PARTY`, `LIABILITY_LIMITATION`, `PAYMENT_BILLING`…) avec le
   schéma canonique, avec repli `MISC_BOILERPLATE` : un import ne peut pas violer INV-3.
6. **Promotion réversible** — `add/remove_llm_annotator` avec garde anti-hijack (refus si un
   compte humain porte déjà le nom du juge) et e-mail dédié `<judge>@llm.pactiva.local`.

## 4. Revue de code : les points durs (ce qui bloque l'ajout de Fable)

| # | Fichier | Problème | Gravité |
|---|---|---|---|
| **P1** | `imports/models.py:12-16` | `Judge` TextChoices ne contient pas `fable`. Django valide les choices au niveau **formulaire/serializer**, pas en base — l'import passerait quand même, mais le juge serait hors-nomenclature (admin, sérialisation, cohérence). | bloquant |
| **P2** | `projects/views.py:826` | `if judge not in {"claude", "codex", "mistral"}` — **liste en dur**, dupliquée de la source unique. Un juge absent de ce set ne peut jamais être promu annotateur (400 « juge inconnu »). | bloquant |
| **P3** | `gold/config.py:21` | `KNOWN_JUDGES = {"claude","codex","mistral","other"}` — **2ᵉ duplication**. Filtre `llm.per_judge` : un poids déclaré pour un juge inconnu est silencieusement supprimé. | bloquant |
| **P4** | `imports/.../import_preannotations.py:36` | défaut `--judges "claude,codex,mistral"` — **3ᵉ duplication**. Sans `--judges fable`, l'import de prod ignore le dossier. | bloquant |
| **P5** | `frontend/src/types/contract.ts:25` | `type Judge = "claude" \| "codex" \| "other"` — **déjà périmé** (Mistral manque) : le type ment sur la réalité de la base. | moyen |
| **P6** | `frontend/src/lib/llmJudges.ts` | liste des 3 juges ; sans entrée `fable`, **aucune** surface d'atelier ne montre Fable, même si les données sont en base. | bloquant |
| **P7** | — | **Aucun garde-fou** n'empêche ces quatre listes de re-diverger. C'est exactement ce qui s'est produit pour Mistral (P5 encore non corrigé aujourd'hui). | structurel |

**Diagnostic** : l'architecture est saine (une porte d'écriture, une source unique côté
front, des consommateurs génériques) mais la **nomenclature des juges est dupliquée en 4
endroits côté backend + 2 côté frontend**, sans test de cohérence. Le coût d'ajout d'un juge
est donc artificiellement élevé et fragile.

**Décision** : ne pas se contenter d'ajouter `"fable"` aux 6 endroits. On **dérive** P2, P3,
P4 de `Judge` (source unique backend) et on **ajoute un test de parité** backend ↔ frontend,
qui échouera au prochain juge oublié. C'est le correctif qui rend l'ajout du 5ᵉ juge trivial.

---

## 5. Ce qui ne demande aucune modification (vérifié)

- `concordance.py`, `triage/engine.py`, `analysis/snapshots.py`, `annotation-versions` :
  itèrent sur les juges présents en base.
- `DocumentPanel.tsx`, `TocPanel.tsx`, `WorkspaceToolbar.tsx`, `LlmSourceSwitch.tsx`,
  `ComparePanel.tsx`, `InspectorJudgeCompare.tsx`, `ModelBoundaryRail.tsx` : bouclent sur
  `LLM_JUDGES`, aucune largeur ni cardinalité figée à 3.
- `gold/llm_seed.py` : paramétré par `judge`, aucune liste en dur.
- Pagination DRF `PAGE_SIZE = 25` : 4 juges par document passent largement.
- Alias `claudeRuns` / `codexRuns` conservés dans `DocumentPanel` pour l'ancien chemin
  2-way (`agreement`) : inoffensifs, ils coexistent avec la voie N-way.

## 6. Risques identifiés et parades

| Risque | Parade retenue |
|---|---|
| Fable écrase / duplique les préannotations existantes | Clé d'unicité `(project, doc, judge, version)` : `fable` est un 4ᵉ enregistrement, jamais un écrasement. Import relancé = no-op (`preannotation_unchanged`). |
| Le passage de 3 à 4 juges change les niveaux de triage déjà affichés | Attendu et **souhaité** (l'oracle de majorité s'affine, cf. runbook §7 du dossier CLAIRE). À documenter, pas à empêcher. Aucun gold **finalisé** n'est touché : `recompute` est NO-OP si `finalized_at`. |
| Un compte humain nommé « fable » | `_judge_user` lève `Conflict` — comportement déjà correct, couvert par test. |
| `data/preannotations/` est gitignoré | Le déploiement passe par `deploy/push-preannotations.sh` (rsync + import), pas par `git pull`. |
| Couleur d'identité de Fable confondue avec une couleur de thème | Palette d'identité désaturée + initiale distincte ; test « couleurs distinctes » étendu. |
