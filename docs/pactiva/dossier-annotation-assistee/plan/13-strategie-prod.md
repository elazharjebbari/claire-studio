# Stratégie de mise en production

Objectif : livrer **sans risque** sur un atelier en campagne réelle. Le système est
**additif et désactivable** ; on ouvre l'accès **progressivement**, mesures à l'appui.

## 1. Feature flags
| Flag | Portée | Défaut | Effet |
|---|---|---|---|
| `NEXT_PUBLIC_TRIAGE` | front (build) | `false` | affiche/masque le mode File + la carte de suggestion |
| `TRIAGE_ENABLED` | back | `false` | active les endpoints batch/triage + le service miroir |
| `TRIAGE_QUEUE_PERSIST` | back | `false` | pré-calcule & persiste la file (sinon calcul client) |

Le **multi-label en base reste lisible** même flag OFF (via le primaire) ⇒ aucune
régression pour l'atelier classique.

## 2. Rollout progressif (4 paliers)
1. **Interne / pilote** : flag ON pour 1 annotateur (Ahmed) sur 3 docs (facile/cluster/dur).
   Mesure temps/clic par niveau + α MASI post-validation. **Critère GO** : α visé ≥ 0,67,
   zéro perte, gain de vitesse net sur C1+C2.
2. **Équipe (canary)** : flag ON pour l'équipe d'annotation (3 comptes), 1 semaine.
   Surveiller : taux d'override annulés, % multi-label réellement validés, frontières molles
   tranchées, erreurs 409/422. **Critère** : pas de hausse d'erreurs, retours qualitatifs OK.
3. **Campagne complète** : flag ON par défaut pour tous les annotateurs du projet.
4. **Bascule par défaut** : retirer le flag (le triage devient le mode standard) une fois
   les métriques stables sur ≥ 2 semaines.

## 3. Métriques de succès (et garde-fous)
| Métrique | Source | Cible / alerte |
|---|---|---|
| Temps médian / phrase C1+C2 | events front | ≪ C4+C5 (sinon UX à revoir) |
| % corpus auto/quasi-auto traité par lot/1-clic | events | ≈ 43 % (calibration) |
| α Krippendorff-MASI (post-humain) | iaa_multilabel | ≥ 0,67 (sinon raffiner vocab/prompt) |
| κ frontière (dures) | iaa_multilabel | ≥ 0,60 |
| Taux d'override annulés | audit | faible & stable (sinon revoir la règle anti-refuge) |
| Erreurs 409 (INV-2) / 422 (invariant) | logs API | ~0 (sinon bug client) |
| Zéro perte de données | tests + audit | 100 % (bloquant) |

## 4. Sécurité & gouvernance
- **Owner-only** writes (inchangé) ; idempotence `client_op_id` sur le batch.
- **Traçabilité** : tout override automatique journalisé + réversible ; provenance des votes
  conservée → re-triage possible, exclusion d'un juge biaisé a posteriori.
- **Versionnement des règles** : `RULES.version` inscrit dans l'audit de chaque clause ; un
  changement de YAML = nouvelle version + ré-exécution documentée.
- **Indépendance des sessions** : préservée (un annotateur ne voit pas la file d'un pair).

## 5. Plan de repli (si incident)
1. **Flag OFF** (front+back) → retour immédiat à l'atelier classique, données intactes.
2. Si corruption de données suspectée : `migrate annotations 0003` (réversible) +
   restauration depuis snapshot/export.
3. Communication équipe : bannière « triage temporairement désactivé », pas de blocage du
   travail (l'annotation manuelle reste disponible).

## 6. Critères de « Definition of Done » prod
- [ ] Gate vert (pytest invariants + parité + IAA ; vitest moteur/composants ; e2e parcours).
- [ ] a11y AA validée (clavier complet, contrastes, ARIA).
- [ ] Pilote 3 docs : gain de vitesse mesuré, α MASI mesuré, zéro perte.
- [ ] Rétro-compat vérifiée (lecture legacy `theme` = primaire ; exports inchangés).
- [ ] Flags en place + runbook de rollback testé.
- [ ] `theme_aliases` figé et validé sur corpus réel.

## 7. Suite (post-prod)
- Boucle d'amélioration : thèmes/clusters peu fiables (κ < 0,40) → raffiner le vocabulaire
  ou le prompt des juges, ré-exécuter le triage.
- Comité mixte (LLM + pré-annotateur humain) comme K-ième juge (le protocole est K ≥ 2).
- Étendre l'explication à un lien « En savoir plus » vers le centre d'aide (section dédiée).
