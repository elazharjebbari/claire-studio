# Export en tâche de fond — plan d'ingénierie complet

> Objectif : lancer un export **sans bloquer** l'utilisateur ; suivre son **statut**,
> **notifier** quand l'artefact est prêt, permettre le **téléchargement**, gérer
> **erreurs** et **relance**, avec une UI/UX soignée (animations, états clairs).

## 1. État actuel (point de départ)
`POST /projects/{slug}/exports` exécute `run_export()` **synchrone** dans la requête
(jusqu'à plusieurs secondes), renvoie le job `done` et l'UI affiche le `artifactPath`
brut. Problèmes : requête bloquante, pas de progression, pas de téléchargement réel
(chemin serveur), pas de relance, `run_export` re-`raise` sous `@transaction.atomic`
→ le statut `failed` est annulé par le rollback (le job reste `pending`).

## 2. Machine à états (FSM)
```
pending ──(worker démarre)──▶ running ──(succès)──▶ done
   │                              │
   │                              └──(exception)──▶ failed
   └──(jamais démarré, timeout)─────────────────▶ failed (timeout, self-heal)
failed ──(retry)──▶ pending ──▶ running ──▶ …
done ──(retry/re-export)──▶ pending ──▶ …
```
Voir `fsm.puml`. Invariants :
- Transitions **idempotentes** et **persistées hors transaction de lecture** (le
  rollback ne doit jamais effacer `failed`).
- Un job `running` trop vieux (> `EXPORT_TIMEOUT`, déf. 15 min) est **auto‑réparé**
  en `failed (timeout)` à la lecture → l'UI propose la relance (anti‑job zombie).

## 3. Exécution asynchrone — étude comparative
| Option | Forces | Faiblesses | Verdict |
|---|---|---|---|
| **A. Thread daemon Django** (`threading.Thread` + `close_old_connections`) | **Zéro nouvelle infra** ; immédiat ; suffisant à l'échelle actuelle (~50 docs, export < 5 s) ; robuste avec self‑heal timeout | Pas de file durable : un redémarrage process pendant l'export laisse un job `running` (→ self‑heal) ; pas de parallélisme borné global | **RETENU (v1)** — flag `EXPORTS_RUN_INLINE` pour exécuter en synchrone (tests déterministes) |
| B. Celery/RQ + Redis worker systemd | File durable, retries natifs, scalable, monitoring | Ajoute Redis + worker + supervision sur un **VPS OLS mutualisé** (coût/complexité) ; sur‑dimensionné aujourd'hui | **v2** (si volumes/concurrence augmentent) — l'API/FSM/UI ne changent PAS (même contrat), seul l'« exécuteur » est remplacé |
| C. Cron + table de file maison | Simple, durable | Latence (tick), réinvente Celery | Écarté |

**Décision** : A maintenant (le contrat API et l'UI sont conçus pour survivre au
passage à B sans rien changer côté frontend). L'exécuteur est une seule fonction
`run_export_async(job_id)` → trivialement remplaçable par `task.delay(job_id)`.

## 4. Contrat d'API (delta) — voir `01-api-contract.yaml`
- `POST /projects/{slug}/exports` → **202** + job `pending` (ne bloque plus).
- `GET /exports/{id}` → job courant (statut/manifeste/erreur) + self‑heal timeout.
- `GET /exports/{id}/download` → artefact (déjà en place, confiné `EXPORTS_DIR`).
- `POST /exports/{id}/retry` → réinitialise (`pending`) + relance (admin).
- `GET /projects/{slug}/exports` → **liste** des jobs récents (historique, reprise).

## 5. Frontend — UX (voir `02-ui-ux.md`)
- **Lancement** : bouton « Lancer l'export » → job ajouté en tête de liste, statut
  `pending` (spinner). Le formulaire reste utilisable (non bloquant).
- **Polling** : `useQuery(getExport, refetchInterval)` adaptatif — 1,2 s tant que
  `pending/running`, **stop** dès `done/failed`. Pas de polling inutile.
- **Statut** : puce animée par état (pending = pulse ambre, running = spinner accent,
  done = ✓ emerald, failed = ✗ rouge). Transition `done` → **toast** « Export prêt »
  + bouton **Télécharger** mis en évidence (animation `fade-in`).
- **Erreur** : message lisible (taxonomie `03-errors-retry.md`) + bouton **Relancer**.
- **Historique** : liste des jobs récents (format, date, statut, taille, download/retry).
- **a11y** : statut en `role=status aria-live=polite` ; respect `prefers-reduced-motion`.

## 6. Gestion des erreurs & relance — voir `03-errors-retry.md`
Taxonomie (corpus vide, format non implémenté → repli tracé, I/O disque, scope
invalide, timeout) → message utilisateur clair + action (relancer / ajuster le scope).
Relance idempotente : un `retry` ne crée pas de doublon, il réutilise le même job.

## 7. Tests (voir `04-tests-runbook.md`)
- pytest : POST → 202 `pending` (inline en test → `done`) ; retry d'un `failed` →
  `done` ; self‑heal d'un `running` périmé → `failed` ; download confiné.
- vitest/MSW : polling stoppe sur état terminal ; bouton download n'apparaît qu'à
  `done` ; toast + retry sur `failed`.
- playwright : lancer → voir le job apparaître → (mock) passer `done` → télécharger.

## 8. Risques & parades
| Risque | Parade |
|---|---|
| Job zombie (`running` après crash) | self‑heal timeout à la lecture + management command `reap_stale_exports` |
| Thread + SQLite lock (dev/test) | `EXPORTS_RUN_INLINE=True` en test (pas de thread) ; prod = Postgres |
| Connexions DB orphelines (thread) | `close_old_connections()` au début, `connection.close()` à la fin |
| `failed` effacé par rollback | statut écrit **hors** `transaction.atomic` (refactor `run_export`) |
| Tempête de polling | `refetchInterval` arrêté sur état terminal ; borne basse 1 s |
