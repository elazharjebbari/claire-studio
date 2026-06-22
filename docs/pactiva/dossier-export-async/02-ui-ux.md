# UX de l'export en tâche de fond

## États visuels (puce de statut, `role=status aria-live=polite`)
| Statut | Visuel | Animation | Action proposée |
|---|---|---|---|
| `pending` | puce ambre « En file » | pulse léger | (attendre) |
| `running` | spinner accent « Export en cours… » | spin | (attendre) |
| `done` | ✓ emerald « Prêt » | `fade-in` | **Télécharger** (bouton accent mis en avant) |
| `failed` | ✗ rouge « Échec » | — | **Relancer** + message d'erreur lisible |

Respect `prefers-reduced-motion` : animations neutralisées (cf. globals.css).

## Parcours
1. L'admin choisit un format (+ scope optionnel) et clique **Lancer**. Le job apparaît
   **immédiatement** en tête de l'historique (statut `pending`) ; le formulaire reste
   utilisable (on peut enchaîner plusieurs exports).
2. **Polling adaptatif** (`refetchInterval` ~1,2 s) tant que `pending/running` ; arrêt
   net dès `done`/`failed` (zéro polling superflu).
3. À `done` : **toast** « Export {format} prêt » + le bouton **Télécharger** s'illumine
   (déclenche `GET /exports/{id}/download`).
4. À `failed` : carte d'erreur (message taxonomisé) + **Relancer** (réutilise le job).

## Historique
Liste des jobs récents du projet : format · date · statut (puce) · nb annotations ·
action (Télécharger si `done`, Relancer si `failed`). Permet la reprise après un
rechargement de page (l'état vit côté serveur, pas dans le composant).

## Composants
- `ExportStatusPill` (puce animée par statut).
- `ExportJobRow` (ligne d'historique : statut + actions).
- `useExportJob(id)` (polling adaptatif, stop sur terminal) ; `useProjectExports(slug)`
  (liste) ; `useRetryExport()` (mutation).
- Toast : réutiliser le store d'erreurs/notifications existant ou un toast léger.
