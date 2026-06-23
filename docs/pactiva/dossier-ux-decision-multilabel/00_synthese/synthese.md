# Synthèse — Clarté du triage C1–C5 & du multi-label (dossier UX/UI)

> **Dossier de conception (UX / UI / design / ergonomie) — sans code.** Objet : rendre l'UI
> beaucoup plus claire sur (a) les **3 types de validation**, (b) l'**état multi-label (C3)** à
> la validation, avec **annulation immédiate (toggle)**, et (c) le **multi-label hors C3**.
> Adapté à l'arborescence du dépôt (`docs/pactiva/`). Plateforme : Pactiva (claire-studio).

## L'idée directrice : 3 canaux visuels orthogonaux

Le manque de clarté actuel vient d'un seul signal (la couleur) qui porte trop de sens. On
sépare **trois canaux indépendants**, chacun avec son propre vecteur :

| Canal | Question | Vecteur | Conservé / Nouveau |
|---|---|---|---|
| **Niveau C1–C5** | difficulté / accord | **couleur** du badge (émeraude→rose, C3 violet) | conservé (déjà déployé) |
| **Provenance de validation** | pré-annotation, moteur, ou manuel ? | **forme** ★ / ⚡ / ✎ (couleur = état) | nouveau (unifie l'existant) |
| **Multi-label** | combien de thèmes, lequel domine ? | chip **plein** vs **pointillé** + toggle 🏷 + badge `+N` | nouveau |

## Les 5 améliorations clés

1. **Trois types de validation enfin distincts** — un trio de formes unifié sur la piste de
   validation, le `ClauseChip` et l'en-tête : **★** pré-annotation adoptée · **⚡ + Cx** validée
   par le moteur · **✎** validée manuellement. La **forme** dit *qui*, la **couleur** dit *l'état*
   (vert = validé, ambre = à valider) → lisible et accessible (jamais la couleur seule).
2. **État multi-label visible à la validation** — valider un set C3 fait **changer l'état** du
   composant (chips primaire plein + secondaires pointillés, badge `+N`), avec **feedback < 200 ms**.
3. **Annulation immédiate par toggle** — le bouton de validation multi-label est **réversible** :
   re-cliquer (toggle 🏷 Multi ↔ Mono) **annule** sans perdre le contexte ; undo/redo global en filet.
4. **Multi-label hors C3** — une affordance **« ＋ thème secondaire »** (palette) dans
   l'inspecteur permet d'ajouter un secondaire **même sans conflit**, avec le même rendu et le
   même toggle. Le refuge reste non sélectionnable en secondaire (invariant back-end).
5. **Hiérarchie primaire/secondaire évidente** — primaire **plein/gras/✓**, secondaire
   **pointillé/`+`/réduit** ; badge `+N` dans le plan pour repérer le multi-label d'un coup d'œil.

## Adaptativité au cas
- **C1/C2** : 1 clic (⚡), peu d'attention.
- **C3** : set multi-label + toggle, feedback bleu clair (#64B5F6).
- **C4/C5** : alerte (couleur vive + ❗), **jamais d'auto-validation**, décision manuelle (✎).

## Organisation du dossier
```
00_synthese/            synthese.md (ce fichier)
01_analyses/            audit_ergonomique · benchmark_concurrents · personas_annotateurs · scenarios_utilisation
02_conception/          principes_design · comportements
  systeme_visuel/       palette_couleurs.yaml · icones_validation.yaml · hierarchie_visuelle.md   ← SOCLE
  wireframes/           workflow_c3.puml · etats_ui.puml · hierarchie_annotations.puml
03_specifications/      interactions · accessibilite
  composants/           badge_annotation · toggle_multilabel · indicateur_provenance · indicateur_conflit
04_prototypage/         animations + maquettes/ (inspecteur_clause · plan_clausechip · carte_suggestion_c3 · file_triage)
05_runbook/             etapes.md · criteres_validation.md
```

## Couverture des deux briefs (UX_DESIGN_ERGONOMIE + OPTIMISATION_UX_C1_C5_MULTI_LABEL)
- **Système couleurs / icônes / formes** → `02_conception/systeme_visuel/*`.
- **Hiérarchie principale/secondaire** → `systeme_visuel/hierarchie_visuelle.md` + specs/maquettes.
- **Comportements / interactions / animations (< 200 ms)** → `02_conception/comportements.md`,
  `03_specifications/interactions.md`, `04_prototypage/animations.md`.
- **Wireframes** → `02_conception/wireframes/*.puml`. **Maquettes** → `04_prototypage/maquettes/*.txt`.
- **Accessibilité WCAG AA** → `03_specifications/accessibilite.md`. **Runbook + critères** → `05_runbook/*`.

## Décision d'harmonisation (à noter)
Les briefs proposaient des teintes Material (C3 bleu, C5 #EC4899…). **Décision retenue** :
conserver les **couleurs de niveau C1–C5 déjà déployées** (les annotateurs les ont apprises) et
réserver les teintes Material à des canaux **distincts** — provenance (ambre/bleu/vert) et
toggle multi-label (bleu clair) — pour éviter toute collision et tout réapprentissage.

## Hors périmètre
Conception uniquement (aucun code, aucun déploiement). La mise en œuvre est cadrée par
`05_runbook/etapes.md` (composants existants à faire évoluer : `ClauseChip`/`TocPanel`, piste de
validation, `SuggestionCard`, `InspectorPanel`, `QuickActionRail`) — à exécuter sur validation.
