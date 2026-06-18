# Flux d'annotation propre & comparaison LLM (Claude / Codex)

> Audit → solutions comparatives → solution retenue → plan d'action → runbook.
> Objectifs : (1) ne plus annoter par accident ; (2) importer le contenu RICHE des
> annotations LLM (rationales) pour les 50 contrats ; (3) une UI de comparaison
> Claude/Codex soignée (accords/désaccords, scores, explications).

## 1. Audit & limitations

1. **Annotation accidentelle.** Un clic simple sur une phrase appelle
   `setBoundary(index)` dont le thème par défaut est `MISC_BOILERPLATE` → une clause
   « Boilerplate divers » est créée sans intention. Le clic devrait seulement
   *focaliser/sélectionner* ; l'annotation ne doit survenir que sur action explicite.
2. **Annotations LLM pauvres.** L'app importe le format **v9.4** (par clause :
   `theme` + `open_span` seulement). Les **raisons** (`rationale`) et le résumé global
   (`rationale_global`) ne sont disponibles que dans le format **v9.2**
   (`document_plan.segments[{start_id, theme, rationale, evidence_span}]` +
   `rationale_global`), présent pour **50 docs × 2 juges**. Le loader (`normalize_v92`)
   et le serializer exposent déjà `rationale`/`evidenceSpan` ; il manque l'import v9.2 et
   l'exposition de `rationale_global`.
3. **Pas d'UI de comparaison.** Les fantômes affichent un thème ; aucune vue n'explicite
   Claude vs Codex (un/l'autre/les deux), leurs accords/désaccords, un score d'accord, ni
   les explications de chaque juge.

## 2. Solutions comparatives

### Axe A — Empêcher l'annotation accidentelle
| Option | Forces | Faiblesses |
|---|---|---|
| **A1. Clic = focus/sélection seule ; thème explicite crée la clause** (✅) | Aucune annotation involontaire ; modèle mental clair (sélectionner → qualifier) ; aligne clic-droit + palette. | Demande de revoir le flux inspecteur (état « phrase focalisée sans clause → choisir un thème »). |
| A2. Clic crée une clause « non typée » (sans thème) | Garde 1 clic = 1 clause. | Laisse des clauses sans thème (bruit) ; pas ce que l'utilisateur veut. |
| A3. Double-clic pour créer | Simple. | Peu découvrable, collisions avec sélection de texte. |
→ **A1.** Clic simple = focus + sélection (mono). Création de clause UNIQUEMENT via : (a)
sélection (1+ phrases) puis clic sur un **thème** (palette de l'inspecteur), ou (b) **clic-droit →
Annoter**. `setBoundary` n'a plus de thème par défaut (thème requis). Touche `B` = « marquer le
début ici » ouvre la palette de thème (ne crée rien sans thème).

### Axe B — Importer le contenu riche (50 contrats)
| Option | Forces | Faiblesses |
|---|---|---|
| **B1. Importer v9.2 (riche) pour les 50 docs/2 juges** (✅) | Rationales par clause + `rationale_global` ; loader/serializer déjà compatibles ; même ancrage (start_id = index). | Spans v9.2 = phrase entière (vs partiel v9.4) — acceptable. |
| B2. Garder v9.4 + re-générer des rationales | — | Coûteux, hors-périmètre (pas d'appel LLM). |
| B3. Importer v9.2 ET v9.4 | Deux vues. | Complexité, ambiguïté d'affichage. |
→ **B1.** v9.2 devient la source de pré-annotation active (copiée dans `data/preannotations/`),
importée pour les 50 docs/2 juges. Expose `rationaleGlobal` + `estimatedNBlocks` (lus depuis `raw`).
`PreAnnotation.raw` conserve déjà le JSON complet (traçabilité).

### Axe C — UI de comparaison Claude / Codex
| Option | Forces | Faiblesses |
|---|---|---|
| **C1. Vue comparative dédiée + overlays workspace enrichis** (✅) | `/compare` devient Claude‑vs‑Codex : score d'accord global (κ + %), tableau par phrase (thème de chaque juge, accord/désaccord coloré, rationales dépliables, evidence). En complément, le menu phrase et les fantômes du workspace montrent rationale + evidence par juge. Sélecteur **Claude / Codex / Les deux**. | Surface à concevoir avec soin (lisibilité). |
| C2. Tout dans le workspace (pas de page) | Contexte unique. | Surcharge le panneau ; comparaison fine peu lisible. |
| C3. Page séparée seulement | Net. | Perte du lien avec l'annotation en cours. |
→ **C1.** (a) **Sélecteur de source** dans le workspace : `Humain / Claude / Codex / Comparaison`
pilotant les overlays + le menu phrase (rationale & evidence par juge + indicateur d'accord). (b)
**Page `/compare`** repensée Claude‑vs‑Codex : entête avec **score d'accord** (κ de Cohen + %
phrases concordantes), tableau par phrase (2 colonnes juges, vert=accord / ambre=désaccord, thème +
rationale au survol/dépli), filtre « désaccords seulement ». Design : couleurs de thème en accent
non-textuel, contrastes AA, dépliage progressif (pas de surcharge), clavier.

## 3. Solution retenue (synthèse)
A1 + B1 + C1. Le clic n'annote plus ; l'annotation est explicite (thème/clic-droit). Les
annotations LLM v9.2 riches (50 docs) sont importées et exposées (rationale + global). Une vue
comparative Claude/Codex soignée (score d'accord, désaccords, explications) + overlays/menu enrichis,
avec un sélecteur de source unique.

## 4. Plan d'action
- **Q1 (backend, données)** : copier v9.2 → `data/preannotations/{claude,codex}` (50×2) ; loader OK ;
  serializer expose `rationaleGlobal`/`estimatedNBlocks` ; `feed_db --all` importe tout. Test pytest
  (rationale non vide, rationaleGlobal présent).
- **Q2 (frontend, flux)** : `setBoundary` sans thème par défaut ; clic = focus/sélection ; inspecteur
  « phrase sans clause → choisir un thème » ; touche `B` ouvre la palette ; clic-droit → Annoter.
- **Q3 (frontend, comparaison)** : store `llmSource: 'human'|'claude'|'codex'|'compare'` ; hook
  `useLlmAgreement(documentId)` (projette les thèmes par phrase pour chaque juge, calcule κ + %) ;
  `LlmSourceSwitch` ; menu phrase enrichi (rationale+evidence par juge + accord) ; `/compare` refondue.
- **Q4 (tests)** : MSW (préannotations claude+codex riches + endpoints) ; Vitest (agreement/κ, projection
  runs, store source) ; Playwright (`llm-compare.spec` : switch source, désaccords, score, rationale ;
  `annotate-flow.spec` : clic simple ne crée PAS de clause, thème explicite la crée).

## 5. Runbook
```
# Q1 backend (données + API)
cp -r <CLAIRE v9.2 claude/codex> data/preannotations/{claude,codex}     # 50×2, riches
cd backend && export DATABASE_URL="sqlite://:memory:" DJANGO_SETTINGS_MODULE=config.settings.dev DJANGO_SECRET_KEY=k
python3 manage.py check && python3 -m pytest -q tests/test_preannotations_rich.py tests/test_api_contract_shapes.py
#   smoke : runserver + curl GET /preannotations?project=claudette-gold-v1&document=Instagram (rationale + rationaleGlobal)

# Q2/Q3/Q4 frontend (copie /tmp/fe)
cd frontend
node_modules/.bin/tsc --noEmit && npx vitest run        # unit verts (agreement, store, flux)
npx playwright test e2e/annotate-flow.spec.ts e2e/llm-compare.spec.ts
npx playwright test                                      # non-régression

# Sur la machine (DB réelle) : rebuild propre
cd backend && rm -f db.sqlite3* && make feed-all && make run   # importe les 50 docs riches
cd frontend && npm run dev
```
Critères de fin : clic simple n'annote plus ; thème/clic-droit annotent ; rationales Claude+Codex
visibles pour les 50 docs ; comparaison (score + désaccords + explications) lisible ; tsc 0 ; Vitest,
pytest, Playwright verts.
