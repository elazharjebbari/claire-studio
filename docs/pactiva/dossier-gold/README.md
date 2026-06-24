# Dossier GOLD — résolution de conflits inter-annotateurs (étude design/UX)

Étude « agence » du **module GOLD** : décider du *gold standard* à partir des annotations
experts, via une interface collaborative de résolution de conflits aussi aboutie que `/annotate`.

Produit par une étude multi-agents : **12 aspects × 3 options** analysées
(forces/faiblesses/pertinence) + recommandation argumentée, puis synthèse design (navigation
deux sens, par-écran, systèmes UX & design). Le **dossier technique** est séparé :
`docs/pactiva/dossier-gold-tech/`.

## Plan
- `00-audit/` — socle réutilisé & anti-duplication
- `01-besoins/` — vision, exigences (.csv), personas
- `02-navigation/` — plan deux sens (.md) + raccourcis (.csv) + carte d'écrans (.puml)
- `03-ecrans/` — une fiche par écran (primaire/secondaire)
- `04-ergonomie/` — bus d'interaction, sticky-cursor, hovers riches, mémoire par document
- `05-design-system/` — charte (couleurs/typo/densité), tokens (.json), états accord/divergence, a11y
- `06-moteur-scoring/` — barème pondéré, auto-résolution (.yaml), risque, multi-label
- `07-config-campagne/` — schéma de config, presets (.yaml)
- `08-temps-reel-verrou/` — verrou d'arbitrage, diffusion WS
- `09-stats-concordance/` — A↔A, A↔LLM, A↔GOLD
- `10-export-gold/` — snapshot gold→pivot
- `_options/` — **l'étude comparative complète (3 options/aspect)**

> Mise en garde : numérotation/anti-duplication strictes. On RÉUTILISE iaa.py, concordance.py,
> ExportJob, divergence.ts, ResizablePanels, QuickActionRail, prefs par compte, WS de présence.
