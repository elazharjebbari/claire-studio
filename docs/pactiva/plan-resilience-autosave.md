# Plan — Résilience de l'autosave (réessais réseau)

## Audit (état actuel `useAutosave.ts`)
- **Réessai infini** : le `finally` replanifie une synchro (1200 ms) tant que le plan
  n'est pas vide et que l'état n'est pas terminal (401/403). Une erreur **persistante**
  (5xx, ou tout autre statut) boucle indéfiniment.
- **Pas de backoff / jitter / plafond** : martèlement du serveur (≈ 1 req/1,2 s).
- **Classification binaire** : 401/403 = terminal (L0) ; **tout le reste** est traité
  comme réessayable, y compris les **4xx non réessayables** (400 payload invalide, 409
  conflit, 422) → boucle inutile.
- **Pas d'état « abandon »** explicite ni de **réessai manuel** offert à l'utilisateur.
- Acquis OK à conserver : debounce 1200 ms, écriture optimiste, **idempotence**
  (`clientOpId`), diff par ancre, MAJ incrémentale de `persistedRef`, reprise `online`.

## Décision (stratégie de réessai)
1. **Classer l'erreur** :
   - `401/403` → **auth terminal** (stop ; « session expirée / lecture seule »).
   - autres **4xx** (400/404/409/422…) → **client terminal** (réessayer n'aide pas ; stop ;
     état « erreur » + réessai manuel possible).
   - `5xx` **ou** échec réseau (throw sans statut) → **transitoire** → réessai **borné**.
2. **Backoff exponentiel + jitter, borné** pour le transitoire :
   `delay = min(BASE·2^(n−1), CAP) ± jitter`, `BASE=1000 ms`, `CAP=30 s`,
   `MAX_ATTEMPTS=5`. Au-delà → **abandon** (stop auto) + état « erreur » avec **réessai
   manuel**.
3. **Distinguer** « nouvelles modifs pendant la synchro » (convergence → debounce normal)
   de « l'op a échoué » (→ backoff). Un **succès remet le compteur à 0**.
4. **Réessai manuel** : action store `triggerRetry()` (compteur) ; le hook réarme
   (attempts=0, terminal=false) et relance. Bouton **« Réessayer »** dans l'indicateur
   quand l'état est « erreur » (abandon).
5. **États** `SaveState` : ajout de `retrying` (réessai auto en cours) distinct de `error`
   (arrêté). `unauthorized` inchangé (L0).
6. **Hors-ligne** : inchangé (écoute `online`), non décompté des tentatives.

## Tests (vitest + faux timers, MSW non requis car endpoints mockés)
- 400 → **1 seul** appel (pas de réessai), état `error`.
- 5xx → réessais **bornés** (≤ MAX_ATTEMPTS+1) même après plusieurs minutes ; finit `error`.
- succès après un échec transitoire → compteur remis à 0.
- réessai manuel après abandon → relance et réussit.
- 401/403 → terminal (non-régression L0).

## Exécution
1. `store/autosave.ts` : `SaveState += "retrying"` ; `manualRetry`/`triggerRetry`.
2. `useAutosave.ts` : classification + backoff borné + compteur + manuel + états.
3. `WorkspaceToolbar` (SaveIndicator) : libellés `retrying` / `error` + bouton « Réessayer ».
4. Tests, tsc, build, déploiement, vérif prod.
