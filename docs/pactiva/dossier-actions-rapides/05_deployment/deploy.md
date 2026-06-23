# Déploiement — Rail d'actions rapides

| Champ | Valeur |
|---|---|
| Cible | https://pactiva.legal (VPS, pas Vercel) |
| Pipeline | `DJANGO_SECRET_KEY=… ./deploy/deploy-claire.sh` |
| Gate | pytest (backend 214) + `tsc --noEmit` + vitest (299) — bloquant |
| Commit déployé | `16094bf` |
| prod == local | ✅ `16094bf` |
| Healthcheck | ✅ `https://pactiva.legal/api/v1/health` → 200 |
| Bundle | ✅ « Actions rapides » / `quick-actions-toggle` présents dans `.next/static/chunks` |
| Rollback | automatique au SHA précédent si health ≠ 200 (non déclenché) |

Statut final : **✅ Succès** — feature livrée, testée, revue (adversariale), durcie et en production.

## Comment l'utiliser
Atelier d'annotation → barre d'overlays du document → cocher **« Actions rapides »**.
Deux boutons apparaissent à gauche de chaque phrase (phrase focalisée ou survol) :
- **✓** : valide la clause du modèle et passe à la suivante (la vue suit, bouton suivant sous le curseur).
- **pastille de niveau (Cx)** : clic = applique la règle (C1–C4) ; survol = carte de recommandation (choix).
Désactivable en décochant la case ; masqué en lecture seule.
