# Plan de correctifs — Annotation (C1 → C4)

Audit approfondi de 4 problèmes signalés en prod, causes racines, et corrections.

## C1 — 404 sur `/history?_rsc=…`
**Cause** : `Breadcrumbs` rend chaque segment du chemin comme lien. Sur
`/history/[id]`, il crée un lien vers `/history` (segment intermédiaire) — or il
n'existe que `app/(app)/history/[id]/page.tsx`, pas d'index `/history`. Next.js
**préfetch** ce lien (`?_rsc=`) → 404.

**Correction** : dans `Breadcrumbs`, les segments « parents sans page d'index »
(routes dynamiques uniquement) sont rendus en **texte simple** (pas de `<Link>`).
Ensemble `NO_INDEX_SEGMENTS = {history}`. Robuste et sans 404 de préfetch.

## C2 — Pré-annotations LLM (Claude/Codex) absentes en prod
**Cause** : `campagne-pactiva` a **0 PreAnnotation** en prod (vérifié) ; seuls
4 existent sur l'ancien projet démo. Les 50 fichiers `claude` + 50 `codex`
(`data/preannotations/{claude,codex}/<doc>_<judge>.json`) sont **gitignorés**
(`/data/preannotations/`) → jamais déployés ni importés. Sans PreAnnotation, le
sélecteur LLM et le pré-remplissage n'ont rien à afficher.

**Correction** :
1. **Commande d'import** `manage.py import_preannotations --project <slug> [--dir]` :
   pour chaque document du corpus du projet, lit `claude/<ext_id>_claude.json` et
   `codex/<ext_id>_codex.json`, appelle `ingest_preannotation` (idempotent). Rapport
   (importés / manquants / erreurs).
2. **Script d'envoi** `deploy/push-preannotations.sh` : `rsync`/`scp` du dossier
   `data/preannotations/` vers le VPS (clé `corolle_deploy`), puis exécute la
   commande d'import sous `config.settings.prod` pour `campagne-pactiva`.

## C3 — Toggle de désannotation (même catégorie = retirer)
**Cause** : `setBoundary(anchor, theme)` quand une clause existe avec le **même
thème** → simple re-sélection (`return {selectedClauseId}`), aucune suppression.

**Correction** : comportement **toggle**. Re-choisir le thème déjà posé sur une
phrase **retire** la clause (désannotation). Appliqué au chemin manuel
(`SentenceMenu` clic-droit, `InspectorPanel`, raccourcis). Implémenté via une
action store dédiée `toggleBoundary(anchor, theme)` :
- pas de clause à l'ancre → crée (thème) ;
- clause avec thème **différent** → re-thématise ;
- clause avec **même** thème → supprime (toggle off).

## C4 — Annoter une phrase colore toutes celles d'en dessous
**Cause** : modèle **span / forward-fill**. `computeRuns` fait couvrir à une
clause `[ancre, ancre_suivante − 1]` (ou la fin du doc). `_theme_vector`
(backend, IAA) propage de même. Annoter la phrase 5 sans frontière après ⇒ 5..fin
colorées. C'est volontaire pour les **segments LLM** (data `start_id` + `theme`),
mais le corpus CLAUDETTE est **par phrase** et l'utilisateur veut annoter
**précisément la phrase**.

**Décision retenue — annotation HUMAINE par phrase** (le LLM reste en spans) :
- **Frontend** : `computeRuns(drafts, n, { perSentence })`. Les runs **humains**
  passent en `perSentence: true` (chaque clause = `[ancre, ancre]`, le reste =
  runs neutres) → plus aucun débordement. Les runs **LLM** (ghosts/segments)
  gardent le forward-fill (spans).
- **Backend** : `_theme_vector` en mode par phrase (phrase i = thème de la clause
  ancrée en i, sinon `None`) → l'IAA devient **par phrase** (plus juste pour un
  corpus par phrase ; les phrases non étiquetées comptent comme `None`).
- **Sélection multi-phrases** (`SelectionToolbar`) : « Annoter la sélection »
  crée **une clause par phrase** de la plage (au lieu d'une clause couvrante).
- **Pré-remplissage LLM** (`replacePrefill`) + **seed backend**
  (`seed_annotation_from_preannotation`) : **dépliage** de chaque segment LLM en
  clauses **par phrase** sur `[start, nextStart − 1]`, pour que l'adoption d'un
  segment étiquette bien toutes ses phrases (et reste éditable phrase à phrase).

**Implication** (à valider) : l'IAA passe de « par span (forward-fill) » à
« par phrase ». Plus fidèle au corpus, mais change la valeur de κ. Réversible
(le mode `perSentence` est un paramètre ; le forward-fill reste l'option LLM).

## Ordre d'exécution
1. C1 (trivial) → C3 (store + menu) → C4 (runs + IAA + sélection + prefill) →
   C2 (commande + script + envoi/exécution prod).
2. Tests : vitest (runs perSentence, toggle), pytest (IAA par phrase, commande
   import), tsc, build.
3. Déploiement + envoi des pré-annotations + vérification prod.

**Rollback** : correctifs indépendants ; C4 réversible via le paramètre
`perSentence`. Aucune migration de schéma.
