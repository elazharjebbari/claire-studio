# 15 — Runbook (exécution de bout en bout)

> Paths utilisateur (machine locale). Le sandbox ne peut ni écrire la base SQLite ni
> héberger un serveur durable : les étapes serveur/e2e sont **locales**.

## 0. Pré-requis
```
cd /Users/elazhar/PycharmProjects/claire-studio
```

## 0bis. Orchestration globale (TOUS les serveurs en parallèle)

Ports prédéfinis dans `scripts/ports.env` : REST **8000**, ASGI/WS **8001**,
frontend **3000**, Redis **6379**.

```
make ports        # affiche les ports prédéfinis
make dev-all      # Redis + REST(:8000) + ASGI(:8001) + frontend(:3000) en parallèle
                  #   - health-checks, logs unifiés préfixés, Ctrl-C arrête tout
make dev-all-mocks  # variante : frontend en mode MSW (sans backend requis)
make stop-all     # libère tous les ports + arrête le Redis docker
```

Via Docker (pile complète, profil temps réel inclus) :
```
docker compose --profile realtime up   # postgres + redis + backend + asgi + frontend
docker compose ps                       # état + ports publiés
```

`dev_all.sh` démarre **ce qui est disponible** : si `redis-server`/`daphne`/Channels
ne sont pas installés, le temps réel est sauté proprement (mode dégradé REST), le
reste tourne. Idempotent et sans fuite de port (best-effort `lsof`).

## 1. Backend
```
cd backend
rm -f db.sqlite3*
make feed-all                 # migrate + feed_db --all + import archive multi-versions
make run                      # http://localhost:8000
```
Pour le temps réel (cycle suivant) : Redis + ASGI
```
redis-server &                # channel layer
daphne -b 0.0.0.0 -p 8001 config.asgi:application   # ou: uvicorn config.asgi:application
```

## 2. Frontend
```
cd ../frontend
cp .env.local.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

## 3. Vérification fonctionnelle — ce cycle (points 0, 1, 2)
1. **Pré-remplir (point 0a)** : ouvrir une annotation → barre d'outils, segment
   « Pré-remplir : Claude » puis « Codex » → la segmentation **bascule** réellement ;
   les clauses humaines posées restent.
2. **Navigation documents (point 0b)** : la barre de documents permet de **chercher**
   (autocomplete) ; le **voyant draft** s'affiche si modifications non enregistrées ;
   sélectionner un autre document y navigue.
3. **Sticky (point 1)** : faire défiler le document → l'en-tête (Version/Frontières/
   source/Comparer/langue) **reste visible** et utilisable.
4. **Soumission versionnée (point 2)** : « Soumettre » → dialogue **nom + description**
   → version créée (visible dans l'historique des versions) + statut **submitted**.
5. **Historique des actions (point 2)** : ouvrir le panneau « Historique » → chaque
   action listée (qui/quoi) ; cliquer une entrée **recentre** sur la phrase/clause.

## 4. Tests automatisés
```
cd frontend && node_modules/.bin/tsc --noEmit && npx vitest run
NEXT_PUBLIC_ENABLE_MOCKS=true npm run dev & npm run e2e
cd ../backend && pytest -q
```

## 5. Definition of Done — ce cycle
- [ ] Pré-remplir bascule Claude↔Codex sans détruire l'annotation humaine.
- [ ] Barre documents : recherche autocomplétée + voyant draft + navigation.
- [ ] En-tête sticky au scroll.
- [ ] Soumission versionnée (nom+description) + historique d'actions cliquable.
- [ ] `tsc` 0 erreur ; Vitest 100 % ; e2e des parcours ci-dessus verts (en local).
- [ ] Dossier technique complet (0–7) committé.

## 6. Étapes suivantes (cycles ultérieurs, déjà spécifiés)
Undo/redo (04) → attribution & commentaires (05, 03) → temps réel Channels+WS+CRDT
(06, 09) → analytics (07) → explorateur de versions phrase/doc (08). Chaque lot suit la
même discipline : conception → implémentation → tests → runbook.
