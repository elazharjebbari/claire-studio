# Centre d'aide — resynchronisation N-way (suite de l'audit)

Le centre d'aide (`frontend/content/help/`, 22 sections markdown + `manifest.ts`)
était à la **même « ère binaire »** que la visite guidée : vocabulaire « Claude /
Codex », **Mistral jamais mentionné**, et 3 blocs UI récents non documentés.

## Constats (scan)
- **7 fichiers** au vocabulaire binaire : `introduction`, `faq`, `guide-annotation`,
  `annotation-types`, `themes-segmentation`, `preannotations-llm`, `comparaison-llm`.
- **Mistral** : absent partout.
- **Blocs récents non documentés** : minimap, confort de lecture (zoom/largeur),
  gouttière des catégories. (Nature juridique et undo/redo : déjà couverts.)
- ✅ Pas de « à venir » périmé. ✅ `raccourcis.md` déjà exact (1/2 adopt en comparaison,
  0–3 certitude, e, g, ⌘Z/⌘Y) — confirme la sémantique clavier.

## Corrections appliquées
- **N-way** : `comparaison-llm.md` réécrit (vue / œil 👁 à onglets dynamiques /
  panneau **une colonne par juge** / divergence sur l'ensemble des juges) ;
  `preannotations-llm.md` réécrit (pré-remplir/fantômes **par juge**) ; titre du
  manifeste « Comparer & arbitrer (Claude/Codex) » → « (juges LLM) » ; phrasés
  binaires généralisés dans `introduction`, `faq`, `guide-annotation`,
  `annotation-types`, `themes-segmentation`.
- **Nuance d'adoption préservée (exacte)** : l'**adoption au clavier reste binaire**
  (`1` = Claude, `2` = Codex, en mode comparaison — `useDivergenceShortcuts`) ; les
  **autres juges (Mistral…) s'adoptent via l'œil 👁 « Choisir »**. Note ajoutée dans
  `raccourcis.md` et `comparaison-llm.md`. Les touches **0–3 = certitude** hors
  comparaison (`useShortcuts`).
- **Blocs récents** : section « Repères de lecture & d'écran » ajoutée à `workspace.md`
  (minimap & position, confort de lecture, gouttière des catégories).

## Cohérence avec la visite guidée
Le récap de la visite a été corrigé en conséquence : « 1/2 adopter Claude/Codex (en
comparaison) » rétabli (l'audit initial l'avait retiré à tort), aux côtés de
« 0–3 certitude ». Visite et centre d'aide disent désormais la même chose.
