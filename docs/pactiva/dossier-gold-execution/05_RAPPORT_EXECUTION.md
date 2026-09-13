# 05 — Rapport d'exécution

> Exécution du runbook du 13 septembre 2026. Commits `0e9e900` (L1+L2) et `975bcae`
> (L3–L6), déployés et vérifiés en production (`git rev-parse HEAD` serveur identique).

## 1. Ce qui a été fait, lot par lot

| Lot | Livré | Vérification |
|---|---|---|
| **L1** | `expected_annotators` en config (validée comme `arbiters`), `expected_annotator_ids()` → (ids, source), `readiness_payload()` pur, `readiness_by_document()` en lot ; le cockpit cesse de recalculer la complétude en SQL parallèle | 7 tests neufs dont la **régression de prod** et l'égalité cockpit ≡ atelier |
| **L2** | `readiness` typé avec les noms, bandeau « En attente de X » + lien config, section « Participants attendus » au studio (`ArbiterPicker` réutilisé, préfixe de testid paramétrable) | 2 tests neufs |
| **L3** | Quorum de deux voix pour l'auto-résolution (ramené à une voix si une seule est attendue), `n_covering` et `tie` exposés, rail « ✓ » retiré sur égalité/cas manuel | 8 tests neufs ; **moteur pur non modifié** (parité et cas d'or intacts) |
| **L4** | `GoldDecisionComposer` : thème hors votes, secondaires éditables, justification ; candidats en ordre stable et numérotés ; grille vide sur égalité | 9 tests neufs |
| **L5** | `nextTodo`/`prevTodo`, compteur « N à trancher · M sans consensus », raccourcis `n p 1..9 Entrée ?` | 7 tests neufs |
| **L6** | `finalize`/`reopen` sous verrou + idempotents, refus serveur **affichés**, confirmation avant gel | 2 tests backend, 1 frontend |

Suites complètes après exécution : **822 tests backend**, **839 frontend**, `tsc` et
`eslint` propres. Aucun test désactivé, aucune suppression de code existant.

## 2. Mise en service (L7)

| Étape | Résultat mesuré |
|---|---|
| 7.1 Déploiement | `975bcae` ; API et frontend 200 ; SHA serveur = SHA local |
| 7.2 Participants déclarés (`zahra.boulaich`, `fatima.ouali`, `elazhar.jebbari`) | **documents prêts : 0 → 50** ; `source: "config"` ; arbitres et réglages d'auto-résolution inchangés ; changement tracé |
| 7.3 Parcours de bout en bout sur `9gag` (API réelle) | GET 200 · 139 phrases · 132 auto-résolues · **7 à trancher, toutes en égalité** · couverture minimale 3 · verrou 200 · décision 200 avec secondaires et justification persistés · `ArbitrationEvent` créé |
| 7.3-bis Remise à zéro | La décision de vérification a été **remise à l'état non tranché** (c'est à l'arbitre de décider) ; la trace d'audit est conservée |
| 7.5 Matérialisation des 50 documents | **9 414 phrases · 8 952 auto-résolues (95,1 %) · 462 à arbitrer** ; `YouTube` n'en demande aucun |

## 3. La charge réelle d'arbitrage

| Document | À trancher | | Document | À trancher |
|---|---|---|---|---|
| Airbnb | 55 | | musically | 16 |
| Endomondo | 48 | | Netflix | 15 |
| Microsoft | 44 | | eBay | 14 |
| WorldOfWarcraft | 23 | | Deliveroo | 13 |
| Skype | 22 | | Headspace | 13 |

**462 arbitrages au total**, et non 123 : ce chiffre était l'état stocké d'avant la fin
de la campagne (dont 93 phrases « non couvertes » sur le seul document `Google`, qui
disparaissent au recalcul). Les 3 documents historiquement ouverts n'en demandent que 13.

## 4. Le fait à connaître avant d'arbitrer

**Les 462 cas sont tous des égalités 1-1-1** : les trois annotateurs proposent trois
thèmes différents. La « proposition » affichée par le moteur y est le vainqueur
**alphabétique**, pas un consensus — c'est vérifiable, renommer un thème change la
proposition. C'est pourquoi l'interface, désormais :

- **retire** la validation en un clic sur ces phrases ;
- **affiche** un avertissement d'égalité explicite ;
- **ouvre** le composeur avec une **grille vide** — l'arbitre choisit, il ne ratifie pas.

## 5. Une décision de protocole vous revient

`secondary_policy` vaut **`advisory`** en production : les étiquettes secondaires ne sont
**jamais** promues dans le gold auto-résolu, même quand les trois annotateurs portent la
même. Mesure sur la campagne : **444 phrases** ont des secondaires consensuels, soit
**453 étiquettes** que le gold n'enregistre pas.

| Option | Conséquence |
|---|---|
| Conserver `advisory` | Le gold auto-résolu est **mono-label** ; les secondaires ne subsistent que sur les phrases arbitrées à la main |
| Passer à `required` | Les secondaires consensuels entrent dans le gold ; **rétroactif** tant qu'aucun document n'est figé, **irréversible après** (un gold figé ne se recalcule plus) |

Pour un article « Reliable Multi-Label Themes », `required` est cohérent avec l'objet
même de la ressource — mais c'est un choix de protocole, pas une correction technique :
il n'a pas été fait à votre place. Le réglage est dans le studio de configuration.

## 6. Ce qui reste ouvert (non bloquant)

- **Annulation (`u`)** d'une décision : spécifiée au runbook L6, non implémentée
  (demande un nouveau verbe d'audit et une migration `AlterField`). Le remplacement
  d'une décision fonctionne déjà (tracé `override`).
- **Heartbeat tolérant** à un échec réseau isolé et revalidation au retour d'onglet :
  un échec unique fait aujourd'hui perdre le verrou (récupérable par « Reprendre la main »,
  désormais proposé dans le bandeau d'erreur).
- **Garde `feed_db --reset`** : la commande détruirait le gold en cascade sans avertir.
  À protéger dès qu'un arbitrage réel existera.
- **Colonne « à trancher » au cockpit** : le compteur existe dans l'atelier ; l'ajouter
  au cockpit éviterait d'ouvrir les documents pour trouver le travail.

## 7. Critères d'acceptation — état

| # | Critère | État |
|---|---|---|
| 1 | Un document réel passe à `ready` | ✅ 50/50 |
| 2 | Le bandeau nomme les participants manquants | ✅ testé |
| 3 | Décision complète possible (thème libre, secondaires, justification) | ✅ testé, vérifié en prod |
| 4 | Aucune phrase indécidable | ✅ (composeur ouvert d'office si aucun candidat) |
| 5 | Aucune validation en 1 clic sur une égalité | ✅ |
| 6 | Auto-résolution ≥ 2 voix couvrantes | ✅ (0 phrase déplacée : la couverture est de 3 partout) |
| 7 | `n` / `1..9` / `?` opérationnels | ✅ testé |
| 8 | Toute erreur serveur affichée | ✅ testé |
| 9 | Finalisation confirmée et sous verrou | ✅ testé |
| 10 | Parcours complet couvert de bout en bout | ⚠️ couvert **en production** (7.3) ; un test automatisé bout-en-bout reste à écrire |
| 11 | Suites complètes vertes | ✅ 822 + 839 |
