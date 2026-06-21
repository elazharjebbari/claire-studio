# Runbook d'exécution — Annotation avancée (A & B + dette autosave)

> Procédure **opérationnelle** pour exécuter les lots (`plan-execution.md`) et déployer en
> production (`pactiva.legal`). Commandes concrètes, points de vérification, rollback,
> communication. À suivre dans l'ordre. Toutes les commandes supposent la racine du repo
> `/Users/elazhar/PycharmProjects/claire-studio` sauf indication.

## 0. Pré-checks (avant de commencer)

```bash
# Repo propre, sur une branche de travail (jamais master/main directement).
git status                          # doit être clean
git checkout -b feat/annotation-avancee   # ou la branche dédiée du chantier

# Outils présents.
node -v && (cd frontend && npx playwright --version)
test -x backend/.venv/bin/python && echo "venv backend OK"

# Dépendances à jour (le déploiement réinstalle de toute façon le front).
cd frontend && npm install --no-audit --no-fund && cd ..
```

Vérifs d'entrée :
- [ ] Conception A & B validée (`02-feature-A-*`, `03-feature-B-*`) et plan de tests lu
      (`06-plan-tests/`).
- [ ] Accès VPS opérationnel : clé `~/.ssh/corolle_deploy` présente (le script l'utilise) ;
      `https://pactiva.legal/api/v1/health` répond **200** (état de référence avant).
- [ ] Aucune migration prévue (A & B sans schéma) — confirmer qu'aucun fichier
      `*/migrations/0*.py` nouveau n'est introduit par les lots.

## 1. Ordre d'exécution (rappel)

`L0 → L1 → L2 → L3 → L4 → L5 → L6`. Chaque lot se termine par sa **porte de tests** (§2)
verte avant de passer au suivant. **Commits atomiques par lot** (message FR, voir §6).

## 2. Commandes de tests par niveau

### 2.1 Unitaire + intégration (vitest)
```bash
cd frontend
node_modules/.bin/vitest run                 # toute la suite (CI)
node_modules/.bin/vitest run tests/blocks.test.ts            # L1 : deriveBlocks/blockAt/bench
node_modules/.bin/vitest run tests/workspaceStore.test.ts    # L1 : applyBlockOp, undo lot, B-IAA-1
node_modules/.bin/vitest run tests/autosave.test.ts tests/autosaveNetwork.test.tsx  # L0
node_modules/.bin/vitest run tests/runs.test.ts tests/tokens.test.ts                # L3/L4 : segments/abbr
node_modules/.bin/vitest run --coverage      # vérifier couverture blocks.ts ≥ 95 %
cd ..
```

### 2.2 Type-check (porte du déploiement)
```bash
cd frontend && node_modules/.bin/tsc --noEmit && cd ..
```

### 2.3 e2e (Playwright)
```bash
cd frontend
node_modules/.bin/playwright test                              # tous les parcours
node_modules/.bin/playwright test e2e/block-annotation.spec.ts # L2 : B (plage/override/undo)
node_modules/.bin/playwright test e2e/model-gutter.spec.ts     # L3/L4 : réglette A
node_modules/.bin/playwright test e2e/a11y.spec.ts             # L5 : axe + clavier
node_modules/.bin/playwright test --ui                         # debug local interactif
cd ..
```

### 2.4 Backend (pytest)
```bash
cd backend
.venv/bin/python -m pytest -p no:warnings -q                   # toute la suite
.venv/bin/python -m pytest -p no:warnings -q tests/test_permissions.py   # régression 403
.venv/bin/python -m pytest -p no:warnings -q tests/test_iaa.py           # IAA par phrase
cd ..
```

### 2.5 Build front (parité avec la prod)
```bash
cd frontend && npm run build && cd ..   # `next build` ; doit passer sans erreur
```

## 3. Points de vérification par lot (avant commit)

| Lot | Vérification clé | Commande / oracle |
|-----|------------------|-------------------|
| L0 | 0 réessai après 401/403 ; état terminal | `vitest run tests/autosaveNetwork.test.tsx` (TC-38/39) |
| L0 | 403 owner→200/204, tiers→403/404 | `pytest tests/test_permissions.py` (TC-35/36/37) |
| L1 | dérivation + lot atomique + équivalence | `vitest run tests/blocks.test.ts tests/workspaceStore.test.ts` |
| L1 | perf 300 phrases < 5 ms | bench TC-44 vert |
| L2 | gestes B + undo unique | `playwright test e2e/block-annotation.spec.ts` |
| L3 | marqueur au seul début ; clic centre | test composant TC-23 + `e2e/model-gutter.spec.ts` |
| L4 | catégorie AA + tooltip + Mistral | TC-24/27/29 |
| L5 | a11y 0 violation ; perf nœuds | `playwright test e2e/a11y.spec.ts` (TC-45/46) |
| L6 | health 200 prod | `curl` health (voir §5) |

**Règle d'arrêt** : si une porte échoue, on **ne passe pas** au lot suivant ; on corrige.

## 4. Déploiement (L6) — procédure

> Le script `deploy/deploy-claire.sh` fait tout : **gate de tests** (pytest + tsc +
> vitest) → `git push` → VPS `git pull` → backend `migrate`/`collectstatic` → front
> `npm install && npm run build` → `systemctl restart` des 2 services → **healthcheck**
> (jusqu'à ~30 s) → **rollback automatique** vers le SHA précédent si health != 200.

### 4.1 Pré-déploiement
```bash
# La branche est verte localement (toutes les portes §2).
git status                          # clean
# (Optionnel mais recommandé) merger la branche dans la branche de déploiement
# selon le flux du projet, puis se placer dessus. Le script déploie la branche courante.
```

### 4.2 Lancer le déploiement
```bash
# Commandes RÉSEAU côté agent : exécuter hors sandbox (dangerouslyDisableSandbox).
./deploy/deploy-claire.sh           # gate complète → prod
# Variante si la gate a déjà été passée à la main (déconseillé) :
# ./deploy/deploy-claire.sh --no-tests
```

Le script affiche les 4 étapes (`[1/4] gate`, `[2/4] push`, `[3/4] VPS pull/build/restart`,
`[4/4] healthcheck`). Il **note le SHA prod courant** (`PREV_SHA`) pour le rollback.

### 4.3 Critère de succès
- Sortie finale : `✓ Déploiement OK — claire-studio @ <branche> (health 200).`
- Si `✗ health != 200 → ROLLBACK …` : le script a **déjà** restauré `PREV_SHA` et rebuild ;
  le déploiement est **abandonné** proprement (voir §7).

## 5. Vérifications prod (post-déploiement)

### 5.1 Santé
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://pactiva.legal/api/v1/health   # attendu : 200
```

### 5.2 Parcours fonctionnels (manuels, navigateur)
- **B — bloc/phrase** : ouvrir un document assigné ; glisser une plage → choisir un thème
  (bloc continu apparaît) ; clic-droit sur une phrase interne → override (split visible) ;
  `Ctrl+Z` (le bloc/override se défait **en une fois**) ; désannoter un bloc.
- **A — réglette** : activer « Frontières » ; vérifier 1 piste/modèle alignée aux phrases ;
  masquer un modèle (piste retirée) ; activer « Catégories » (teinte + abréviation) ;
  survol = tooltip (modèle + plage) ; clic = phrase centrée.
- **Autosave (dette)** : ouvrir DevTools (onglet Réseau). Si la session expire (401/403),
  l'autosave **affiche « non autorisé / session expirée » et s'arrête** — **aucune**
  rafale de requêtes `clauses` (vérifier qu'il n'y a pas ~1 req/1,3 s).

### 5.3 Logs serveur (si doute)
```bash
ssh -i ~/.ssh/corolle_deploy root@46.202.128.168 \
  "journalctl -u claire-studio -u claire-studio-web -n 100 --no-pager"
```

## 6. Communication

- **Avant déploiement** : annoncer la fenêtre à l'équipe (3 comptes :
  elazhar / jc.lamirel / zahra.boulaich) — « mise en prod annotation avancée (A & B) +
  correctif autosave, brève bascule des services, pas de perte de données ».
- **Après succès** : message « ✅ Prod à jour (health 200). Nouveautés : réglette
  frontières par modèle (A), annotation par bloc/phrase (B). Le correctif autosave stoppe
  les rafales réseau sur session expirée. Signaler tout comportement inattendu. »
- **Après rollback** : « ⚠️ Déploiement annulé (health != 200), prod restaurée sur la
  version précédente. Investigation en cours, aucune action requise de votre côté. »
- Consigner le SHA déployé (et `PREV_SHA`) dans le canal de suivi.

## 7. Rollback

### 7.1 Automatique (intégré)
Le script déclenche le rollback **lui-même** si health != 200 : il recharge `PREV_SHA`,
relance `migrate`/`build` et redémarre les services. Aucune action manuelle nécessaire ;
le déploiement se termine par « ↩ rollback effectué — déploiement ABANDONNÉ ».

### 7.2 Manuel (si besoin après coup)
```bash
SSH="ssh -i ~/.ssh/corolle_deploy root@46.202.128.168"
$SSH "cd /var/www/claire-studio && \
  export GIT_SSH_COMMAND='ssh -i /root/.ssh/claire_repo -o IdentitiesOnly=yes' && \
  git checkout <PREV_SHA> && \
  cd backend && DJANGO_SETTINGS_MODULE=config.settings.prod .venv/bin/python manage.py migrate --noinput && \
  cd ../frontend && npm run build && systemctl restart claire-studio claire-studio-web"
# Revérifier la santé :
curl -s -o /dev/null -w '%{http_code}\n' https://pactiva.legal/api/v1/health
```

> A & B n'introduisent **aucune** migration : le rollback de code suffit (pas de
> migration descendante à gérer). Si un futur lot ajoutait une migration, prévoir le plan
> de migration inverse **avant** le déploiement.

## 8. Pièges connus (rappels prod)

- **OpenLiteSpeed (OLS mutualisé)** : sensibilité au format des vhosts, WebSocket, et
  `vhssl` post-certificat (cf. mémoire « Déploiement prod pactiva.legal »). Ne pas modifier
  la conf OLS dans le cadre de ce chantier (purement applicatif).
- **Daphne** met quelques secondes à répondre après restart : le healthcheck du script
  retente jusqu'à ~30 s — ne pas interrompre.
- **`npm install` côté VPS** restaure `package-lock.json` ; ne pas committer un lock
  divergent qui casserait le build prod.
- **Sandbox agent** : les commandes réseau (ssh/curl/deploy) doivent tourner hors sandbox
  (`dangerouslyDisableSandbox`).
