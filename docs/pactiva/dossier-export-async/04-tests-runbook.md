# Tests & runbook — export en tâche de fond

## Tests
### pytest (backend)
- `POST /projects/{slug}/exports` → **202** + statut `pending` (avec
  `settings.EXPORTS_RUN_INLINE=True` → exécution synchrone déterministe → `done`).
- `run_export` sur erreur → statut **`failed` PERSISTÉ** (hors transaction de lecture)
  + `manifest.error` rempli (refactor : plus de re-`raise` qui annulait le statut).
- `POST /exports/{id}/retry` sur un job `failed` → repasse `pending`→`done`, même id.
- self‑heal : un job `running` avec `created_at` ancien → `GET /exports/{id}` le
  renvoie `failed` (timeout).
- `GET /exports/{id}/download` : 200 si `done` + artefact présent ; 404 sinon ;
  confiné à `EXPORTS_DIR` (anti path‑traversal, déjà testé).
- `GET /projects/{slug}/exports` → liste (récents d'abord), admin only.

### vitest / MSW (frontend)
- `useExportJob` : `refetchInterval` actif tant que `pending/running`, **0** dès terminal.
- Bouton **Télécharger** rendu uniquement à `done` ; **Relancer** + message à `failed`.
- `ExportStatusPill` : classe/animation par statut.

### playwright (e2e)
- Lancer un export → la ligne apparaît `pending` → (handler MSW passe `done`) →
  bouton Télécharger visible → clic.

## Runbook de déploiement
1. Gate : `pytest` + `tsc` + `vitest` (cf. `deploy/deploy-claire.sh`, `DJANGO_SECRET_KEY=x`).
2. Migration : champ `ExportJob.error` (+ index éventuel) → `migrate` côté VPS.
3. Déploiement standard (push → pull → migrate → build → restart → healthcheck + rollback auto).
4. Vérifs post‑déploiement :
   - `POST .../exports` répond < 1 s avec `pending` (non bloquant).
   - polling : le job passe `running`→`done` ; `GET /exports/{id}/download` renvoie le fichier.
   - relancer un export volontairement échoué (scope vide) → message + retry OK.
5. Job zombie : `manage.py reap_stale_exports` (ou self‑heal automatique à la lecture).

## Bascule v2 (Celery/RQ) — sans changer le contrat
Remplacer le corps de `run_export_async(job_id)` par `export_task.delay(job_id)` (tâche
Celery) ; ajouter worker + Redis. L'API, la FSM et toute l'UI restent identiques.
