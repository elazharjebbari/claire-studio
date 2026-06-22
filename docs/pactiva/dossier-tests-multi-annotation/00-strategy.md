# Stratégie de tests — validation multi-annotation (avant campagne)

> But : **valider** que l'app est prête pour l'annotation en équipe (3 annotateurs,
> 50 ToS, 3 juges LLM). Critère de GO : tous les invariants `01-invariants.md` tiennent
> sous des séquences agressives, **zéro perte de données**, **étanchéité totale** des
> sessions, **aucune corruption** par la collaboration, **analytics exacts**.

## Priorités (par ordre, dictées par le risque métier)
1. **Zéro perte de données** — toute clause validée est persistée et récupérable.
2. **Pas de corruption par la collaboration** — commentaires/reviews/comparaison
   n'altèrent jamais le contenu d'une session.
3. **Étanchéité des sessions** — aucune fuite d'une session vers une autre (lecture/écriture).
4. **Comportement de session bout‑en‑bout** — assignation → annotation → soumission →
   revue → IAA → export, pour chaque annotateur indépendamment.
5. **Exactitude des analytics** — progress, annotators‑progress, IAA pairwise, insights.

## Pyramide & types
| Niveau | Outil | Rôle | Volume |
|---|---|---|---|
| Unitaire / logique | pytest, Vitest | invariants atomiques, store, helpers | dizaines |
| Intégration API | pytest + DRF APIClient | endpoints, permissions, isolation, analytics | dizaines |
| **Property‑based** | **hypothesis** | séquences aléatoires d'opérations multi‑annotateur → invariants à CHAQUE pas | **centaines→milliers** (N exemples × pas) |
| **Simulation de campagne** | pytest | cycle complet randomisé, 3 annotateurs, jusqu'à clôture | centaines de pas/exécution |
| Concurrence | pytest (threads) | écritures simultanées, retries dupliqués → pas de perte/doublon | dizaines |
| E2E multi‑utilisateur | Playwright + MSW | 3 sessions, supervision, anti‑fuite UI, export async | dizaines |

## Comment on atteint « centaines / milliers » de cas (sans bruit)
- **Property‑based (hypothesis)** : un test génère des *programmes* d'annotation
  (suites d'opérations create/retag/delete/validate/submit attribuées à des
  annotateurs aléatoires) et **rejoue** chacun en vérifiant les invariants à chaque
  étape. `--hypothesis-seed` + `max_examples` (100 par défaut, **1000** en mode
  « validation campagne ») ⇒ des milliers d'états explorés, **minimisés** en cas
  d'échec (contre‑exemple minimal).
- **`@pytest.mark.parametrize`** : matrices opération × rôle × statut × format.
- **Simulation de campagne** : une longue séquence (N pas) qui mime la vraie campagne.

## Definition of Done « GO campagne »
- 100 % des tests verts : pytest + Vitest + (e2e ciblés). Property‑based à
  `max_examples>=300` sans contre‑exemple. Aucune régression.
- Invariants `01-invariants.md` : tous **couverts** par ≥1 test (traçabilité dans
  `03-backend-tests.md`).
- Aucune fuite inter‑session détectée ; export intègre (records == clauses validées).

## Outillage / exécution
Voir `07-runbook.md`. Backend : `DJANGO_SECRET_KEY=x pytest` (env conda `claire` ou
`backend/.venv`), exports en `EXPORTS_RUN_INLINE`. Property : `hypothesis`. Front :
`vitest run`, `tsc --noEmit`. E2E : `playwright test` (mode MSW).
