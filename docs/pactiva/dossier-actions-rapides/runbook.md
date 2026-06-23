# Runbook — Rail d'actions rapides (AGENT_DELIVERY, adapté à claire-studio)

> **Adaptation.** La consigne `AGENT_DELIVERY` cible un projet standalone (Vercel/NestJS).
> Ici c'est une **feature dans une application existante** (Pactiva / claire-studio) :
> l'implémentation et les tests vivent dans le dépôt (`frontend/src/…`, `frontend/tests/…`,
> `e2e/`), le déploiement se fait sur la **prod réelle `pactiva.legal`** via le pipeline
> maison (gate pytest+vitest → push → pull/build/restart → healthcheck → rollback). Les
> artefacts d'analyse/spec sont sous `01_analyses/` et `02_specifications/`.

| Étape | Action | Statut | Preuve |
|---|---|---|---|
| Analyse / décision | Placement, sémantique des 2 boutons, curseur collant, modes du bouton 2 | ✅ | `01_analyses/decision.yaml` |
| Spécification | Layout, états, animation, couleurs, a11y | ✅ | `02_specifications/spec.md` |
| Implémentation — store | `showQuickActions` + `toggleQuickActions` | ✅ | `frontend/src/store/workspace.ts` |
| Implémentation — composant | `QuickActionRail` (2 boutons + popover SuggestionCard) | ✅ | `frontend/src/components/workspace/QuickActionRail.tsx` |
| Implémentation — intégration | rail rendu par phrase, padding/track décalés, curseur collant, toggle toolbar | ✅ | `frontend/src/components/workspace/DocumentPanel.tsx` |
| Tests — unit/RTL | rail (6) + store toggle (1) | ✅ | `frontend/tests/quickActionRail.test.tsx`, `tests/workspaceStore.test.ts` |
| Tests — e2e | activation, valider+suivant, recommandation au survol | ✅ | `frontend/e2e/triage.spec.ts` |
| Type-check | `tsc --noEmit` | ✅ | exit 0 |
| Suite vitest | run complet | ✅ | 299 tests verts (37 fichiers) |
| Revue adversariale | 4 angles → vérif 1-vote (27 agents) | ✅ | 21 findings → corrigés (voir ci-dessous) |
| Corrections | re-design bouton 1 + 5 correctifs | ✅ | tsc + 299 vitest verts |
| Déploiement | `./deploy/deploy-claire.sh` (gate + healthcheck + rollback) | ✅ | `05_deployment/deploy.md` |

## Revue adversariale → corrections appliquées
- **Bouton 1 redessiné (drafts-only)** : valide la clause existante (seed du modèle) ; suppression
  de l'adoption de juge qui (a) fragmentait les segments multi-phrases en clauses parasites,
  (b) adoptait un juge arbitraire en mode humain. `quickCanValidate` = présence d'ancre (O(1),
  supprime aussi le coût de scan par phrase). [findings #1,#3,#4,#10,#15]
- **suppressFocusScroll** armé seulement si le focus change réellement (sinon drapeau coincé →
  scrollIntoView du prochain focus sauté). [#2]
- **Layout** : piste de validation décalée à `left-14`, ligne `pl-16` (plus de chevauchement) ;
  rail `pointer-events-none` quand masqué (n'intercepte plus les clics sur la track). [#14]
- **Popover** : timer de fermeture nettoyé au démontage [#8] ; suppression du piège clavier
  (onFocus/onBlur retirés) [#13,#16] ; `refY` = clientY ou rect.top du bouton (clavier) [#9,#11] ;
  zone morte réduite (`ml-1`) [#18].
- **readOnly** : rail masqué en lecture seule (plus de faux retour d'action). [#19]
- Conservé tel quel (cohérent avec la file de triage déployée) : application de la recommandation
  par phrase via `applyTriageDecision` (#5 = sémantique per-phrase existante du protocole).

## Critères de succès
- [x] Autonomie (aucune question intermédiaire).
- [x] Feature complète : 2 boutons, gauche/avant la track, valider+suivant (curseur collant), recommandation (clic règle / hover carte), activable/désactivable.
- [x] Réutilise l'existant (moteur de triage, SuggestionCard, TRIAGE_LEVEL_META, store).
- [x] Tests verts (unit + e2e écrits), tsc clean.
- [ ] Déploiement fonctionnel (health 200, prod = local).

## Notes de conception
- Opt-in (défaut OFF) → zéro impact layout quand masqué.
- Bouton 2 visible seulement si `TRIAGE_ENABLED && triage.ready` (≥ 2 juges).
- Curseur collant : scroll de l'ancêtre scrollable de `Δ = top(bouton suivant) − clientY`,
  avec drapeau anti-`scrollIntoView` concurrent.
