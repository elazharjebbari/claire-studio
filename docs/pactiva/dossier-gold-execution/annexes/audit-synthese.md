# Synthèse décisionnelle — Module de résolution GOLD (Pactiva)

> Base : audit du 13/09/2026 (9 dimensions + vérification adversariale : 26 constats confirmés, 14 réfutés), recoupé avec l'état réel du dépôt au commit `0e9e900` et le dossier `/Users/elazhar/PycharmProjects/claire-studio/docs/pactiva/dossier-gold-execution/`.

---

## 0. Correction de prémisse (à lire avant tout)

**Le chiffre « 123 cas manuels » est mort.** C'est un instantané stocké dans `gold_goldsentence` à l'époque où les annotations n'étaient pas terminées (dont 93 phrases `empty` sur le seul document `Google`). L'annotation est terminée depuis le 13/09. La simulation à blanc du moteur sur les annotations d'aujourd'hui donne :

| Population | Phrases | Part |
|---|---|---|
| `auto_1click` (accord strict) | 4 406 | 46,8 % |
| `auto` (majorité ≥ 2/3) | 4 546 | 48,3 % |
| **`manual` (arbitrage humain réel)** | **462** | **4,9 %** |
| Total corpus (50 documents) | 9 414 | 100 % |

Sur les 3 documents déjà ouverts : **13 cas manuels** (Google 5, Academia 1, 9gag 7), et non 123. `empty` retombe à 0 après recalcul. 49 documents sur 50 comportent au moins un cas manuel (Airbnb 55, Endomondo 48, Microsoft 44, WoW 23, Skype 22).

**Le dimensionnement du chantier est donc : 462 arbitrages, pas 123.** Et l'état de base est vierge : `decided = 0`, `ArbitrationEvent = 0` — **il n'y a strictement rien à perdre aujourd'hui**, ce qui autorise les corrections de fond sans migration de données ni précaution particulière. Cette fenêtre se referme au premier arbitrage réel.

---

## 1. VERDICT GÉNÉRAL

**Non — le module n'est pas utilisable en l'état, et il ne l'a jamais été** : en production, 0 document sur 50 est `ready`, donc toute décision renvoie 409, le verrou n'est jamais acquis et la finalisation est inatteignable ; ce n'est pas un module « jamais utilisé », c'est un module **jamais utilisable**. Le correctif de cause racine (participants attendus déclarés, L1+L2) est **écrit, testé et commité en local (`0e9e900`) mais PAS déployé** — la prod est restée à `6bbddda`.

Une fois ce déblocage mis en service, le module devient **partiellement utilisable** : l'arbitre pourra cliquer, mais il produira un gold **non citable** (auto-résolution « accord strict / confiance 100 % » sur des phrases couvertes par un seul annotateur ; proposition en 1 clic qui n'est qu'un départage alphabétique sur les égalités ; secondaires jamais arbitrables alors que le corpus est multi-étiquettes à 16,4 % et que la politique de prod est `advisory`, qui les vide).

Le socle technique, lui, est **sain et ne doit pas être refait** : moteur pur avec parité TS↔PY par golden partagé, invariant « les LLM ne sont jamais parties au conflit » verrouillé à quatre niveaux, recompute idempotent avec décision humaine sacrée, verrou à bail sans fenêtre TOCTOU, export en deux couches. **Tout le reste-à-faire est du câblage, pas de la conception** — l'essentiel est frontend.

---

## 2. LE CHEMIN CRITIQUE

Liste ordonnée et minimale. Trois paliers : ce qui bloque **le premier clic**, ce qui bloque **une décision qui compte**, ce qui bloque **le gel du gold**.

### Palier A — sans quoi l'arbitre ne peut pas cliquer une seule fois

| # | Action | Nature | Effort |
|---|---|---|---|
| **A1** | **Déployer `0e9e900`** (L1+L2, aucune migration). Vérifier `git rev-parse HEAD` côté serveur. | mise en service | 15 min |
| **A2** | **Déclarer les participants réels** dans le studio GOLD de `campagne-pactiva` : `zahra.boulaich`, `fatima.ouali`, `elazhar.jebbari`. Sans cette donnée, le code déployé ne change rien : `jc.lamirel` (assigné, 0 annotation) continue de geler les 50 documents. | donnée | 5 min |
| **A3** | **Rafraîchir les 3 résolutions périmées + matérialiser les 47 autres** (un GET d'atelier par document, en boucle). Sinon le cockpit reste aveugle et affiche l'instantané pré-campagne. | exécution | 20 min |

**Critère de sortie du palier A :** le cockpit affiche 50/50 `ready` ; le document témoin `9gag` montre 132 auto-résolues et 7 cas manuels ; un POST `decide` renvoie 200.

### Palier B — sans quoi les décisions enregistrées seront fausses ou incomplètes

| # | Action | Pourquoi c'est bloquant, pas confortable |
|---|---|---|
| **B1** | **Quorum de couverture ≥ 2 annotateurs** avant toute auto-résolution (garde posée dans `services.recompute_document`, pas dans le moteur pur ; champ additif `n_covering` exposé). | Aujourd'hui une phrase ancrée par **un seul** des trois annotateurs sort en `strict` / `auto_1click` / risque faible / **confiance 1,0**, est écrite d'office dans le gold et **n'apparaît jamais** dans la file de l'arbitre. Écrire « accord inter-annotateurs » sur une étiquette posée par une personne est indéfendable en revue. **Mesurer d'abord** la distribution de `n_covering` sur les 9 414 phrases : elle décide si ce garde déplace 10 ou 2 000 phrases vers `manual`. |
| **B2** | **Booléen `tie` + suppression du rail « ✓ » sur `manual`/égalité.** | Sur un 1-1-1, `_argmax` retient le **vainqueur alphabétique** (`ARBITRATION_DISPUTES` bat `TERMINATION`), présenté à l'arbitre avec les mêmes affordances qu'un consensus et validable d'un clic, sous un curseur collant. C'est le principal générateur de gold bruité non détectable au fil de l'eau. |
| **B3** | **Inspecteur d'arbitrage complet** : thème hors candidats (schéma entier), secondaires éditables, commentaire. | Trois impossibilités dures : (a) sur une divergence 1-1-1 où les trois se trompent, l'arbitre n'a que trois mauvaises options ; (b) toute phrase non couverte (`empty`) n'offre **zéro bouton** et rend `can_finalize` inatteignable — 0 aujourd'hui, mais 1 seule suffit à bloquer un document à vie ; (c) `onDecide` renvoie toujours `proposedSecondaries`, donc le gold des cas durs est mono-label. Le backend accepte déjà les trois champs : **zéro changement serveur**. |
| **B4** | **Décision de protocole : `secondaryPolicy` `advisory` → `required`** (un clic dans le studio), **avant toute finalisation**. | En `advisory` (défaut de prod), `recompute_document` écrit `secondaries = []` sur **toutes** les phrases auto-résolues, y compris quand les 3 annotateurs portent le même secondaire. Rétroactif tant que le document n'est pas finalisé ; **irréversible après** (recompute NO-OP si `finalized_at`). Pour un article « Reliable Multi-Label Themes », c'est une perte garantie d'information. |

### Palier C — sans quoi le gel du gold n'est pas fiable

| # | Action |
|---|---|
| **C1** | **`finalize_resolution` / `reopen_resolution` sous `transaction.atomic()` + `select_for_update()` + `_assert_holder()` + `assert_not_finalized()`** (`/Users/elazhar/PycharmProjects/claire-studio/backend/claire/gold/services.py:549-587`). Ce sont aujourd'hui les **seules écritures conséquentes** hors transaction, hors verrou et hors garde d'immuabilité. Côté front, ajouter `disabled={!lock.heldByMe}` sur `gold-finalize` (`GoldWorkspace.tsx:150-160`), comme c'est déjà fait sur « Auto-résoudre ». |
| **C2** | **Afficher les erreurs serveur** : `apiErrors.ts` doit lire `err.body.detail` (les messages 409/423 sont rédigés, nomment le détenteur du verrou et les annotateurs manquants — ils ne sont simplement jamais rendus), et `lock.error` doit apparaître dans `LockBanner`. Sans cela, sur 462 arbitrages enchaînés, chaque échec se traduit par « API 409 on /… » et un curseur qui recule. |

**Tout ce qui n'est pas dans A, B, C est du confort.** En particulier : les `CheckConstraint` manquants, le modèle mort `GoldRun`, la traçabilité `SET_NULL`, le TOCTOU du recompute (inexploitable : Daphne mono-processus, `thread_sensitive=True` ⇒ exécution sérialisée) — tous réfutés ou reclassés « durcissement », **à ne pas mettre sur le chemin critique**.

---

## 3. LES AMÉLIORATIONS À FORT RENDEMENT

Ordre de grandeur de départ : **462 cas × ~6 gestes souris** (repérer → scroller → sélectionner → lire les votes → cliquer → re-scroller), soit 60–90 s/cas ≈ **8 à 11 heures** d'arbitrage. Cible : 15–25 s/cas ≈ **2 à 3 heures**.

| Levier | Gain | Coût |
|---|---|---|
| **Filtre + navigation `manual`** (`nextManual`/`prevManual`, filtre par défaut à l'ouverture) | **Le plus gros gain, de loin.** `needsAttention = agreementClass !== "strict"` fait traverser ~5 000 phrases dont 4 546 déjà auto-résolues pour en trouver 462. Sur le bon critère, l'arbitre voit 462 arrêts et zéro bruit. | petit (fonctions pures additives dans `blocks.ts`) |
| **Raccourcis clavier** `n`/`p` (cas suivant), `1..9` (adopter le k-ième candidat), `Entrée`, `u` (annuler), `?` (aide) | 6 gestes → 1–2 frappes. **×3 sur le débit.** 0 des 14 raccourcis spécifiés dans `02-navigation/02-raccourcis.csv` n'est implémenté ; `lib/shortcuts.ts` + `ShortcutsHelp` existent déjà en prod. | moyen (câblage) |
| **Compteur « N cas manuels restants »** (`aria-live`) + colonne `manual` au cockpit | Évite d'ouvrir 50 documents pour en trouver le travail. L'agrégation cockpit est déjà un seul GROUP BY : ajouter `Count(filter=Q(auto_level="manual"))` est une ligne. | petit |
| **Libellé + couleur de thème** au lieu du code brut (`ACCEPTABLE_USE`) | 16 codes en MAJUSCULES_SOULIGNÉES à décoder 462 fois. `ClauseChip` et `setRuntimeThemes` existent. | petit |
| **Heartbeat tolérant + `visibilitychange`** | Un seul échec réseau détruit l'intervalle de heartbeat et éjecte l'arbitre **de son propre document** en lecture seule, sans message, sans bouton de récupération s'il n'est pas lead (le bail serveur est pourtant encore à lui : un simple retry ou un F5 le récupère). Sur une session de plusieurs heures, c'est quasi certain. | petit |
| **Confirmation de finalisation + `undo`** | Évite le gel accidentel et le retour arrière par `reopen` (réservé lead). `SubmitDialog` existe déjà. | moyen (`undo` = migration `AlterField` sur `choices`) |

À **ne pas** faire au nom de la vitesse : filtrer sur `autoLevel === 'manual'` **à la place** de `!decided` dans la boucle de travail — `autoLevel` est une propriété du score, pas de l'état ; une phrase `auto` non auto-résolue (config, readiness) serait masquée. Le critère de la file reste `!decided` ; `manual` est un **filtre de vue**, pas le pilote du curseur.

---

## 4. CE QU'IL NE FAUT SURTOUT PAS TOUCHER

1. **L'invariant « les LLM ne sont JAMAIS parties au conflit ».** Tenu de bout en bout (`decision = dict(human_tally)`), verrouillé par un property-test Hypothesis 300 exemples, un test d'API, un test de simulation et l'étiquetage UI « Modèles · référence (hors décision) ». **Ne jamais réintroduire de logique « humain ≠ LLM »** (`human_dissent` est déprécié à dessein).
2. **Le golden PARTAGÉ** (`/Users/elazhar/PycharmProjects/claire-studio/frontend/src/lib/gold/golden.cases.json`, lu par pytest ET vitest). On **ajoute** des cas, on ne duplique pas, on ne déplace pas. Toute modification du moteur doit être simultanée dans `gold_scoring.py`, `goldScoring.ts` et le golden, sinon `test_gold_parity` casse.
3. **`recompute_document`** : idempotence par diff champ à champ, `if gs.decided and not gs.auto_resolved: pass  # décision humaine : sacrée`, et `.exclude(decided=True, auto_resolved=False)` à l'élagage. C'est le cœur de sûreté du module.
4. **Le verrou à bail** : 90 s / heartbeat 20 s, `_assert_holder` sous `select_for_update` dans la transaction d'écriture, `_lock_active` juge unique de l'expiration, `steal` lead-only et tracé. Et **garder** la clause « le même utilisateur peut reprendre son propre verrou » : c'est la propriété de reprise de session (F5, crash d'onglet), pas un oubli.
5. **`compute_status()`** partagé cockpit/atelier, et la nouvelle `readiness_payload()`/`readiness_by_document()` (source unique). Ne pas recréer de calcul parallèle en SQL dans une vue.
6. **La contrainte `UniqueConstraint(resolution, index)`** : elle est équivalente au `(project, document, index)` du dossier de conception et plus économe. Ne pas la « corriger ».
7. **L'ordre des contrôles de `gold_decide`** (403 → 423 → 409 → 400 → matérialisation → 409 verrou/gel) et l'**ordre de déclaration des actions DRF** (`gold/documents`, `gold/stats`, `gold/llm-annotators` avant la regex `gold/<id>`) — piège réel, déjà neutralisé.
8. **L'export en deux couches** (`hard` + `tally` + votes bruts), qui réutilise la même projection que le moteur et écrit hors pipeline DRF. Ne pas le faire passer par le renderer (camélisation).
9. **Les FK en `SET_NULL`** sur `decided_by` / `ArbitrationEvent.actor` : les passer en CASCADE effacerait les arbitrages, en PROTECT bloquerait. SET_NULL est la clause conservatrice.
10. **L'électorat votant non filtré par rôle** dans `build_document_data` : filtrer reviendrait à jeter silencieusement l'annotation réelle du lead — c'est exactement le bug de prod corrigé en sens inverse. L'alignement se fait par `expected_annotators` (nominatif), pas par un filtre de rôle.
11. **L'a11y déjà acquise** : `GoldHelpModal` (focus piégé et restauré), `ArbiterPicker` (combobox clavier), encodage jamais par couleur seule, tokenisation intégrale de `styling.ts`.

---

## 5. RISQUES DE PERTE DE DONNÉES ET PARADES

| Risque | Réalité | Parade |
|---|---|---|
| **`feed_db --reset` détruit tout le gold en CASCADE** (`Project.delete()` → `GoldResolution` → `GoldSentence` / `ArbitrationEvent` / `GoldRun`), sans nommer une seule table gold, sous `@transaction.atomic`. | Réel. Flag opt-in, absent du Makefile et des scripts de deploy, mais rien n'avertit l'opérateur. L'arbitrage est la ressource la plus coûteuse et la moins reproductible du projet. | **Refuser `_reset` si `GoldSentence.objects.filter(decided=True).exists()` ou une résolution finalisée existe, sauf `--force-gold`** ; nommer explicitement les 4 modèles gold dans la purge ; test de non-régression dans `test_feed_db.py` (aucun test n'exerce `--reset` aujourd'hui). |
| **Re-segmentation d'un document** (`imports/loaders.py:105`) : les phrases hors-bornes sont élaguées. | Les décisions humaines sont explicitement exclues de l'élagage, mais elles deviennent orphelines et faussent le comptage (déjà borné par `index__lt=n` dans finalize). | Étendre le garde-fou existant : refuser la re-segmentation si des `GoldSentence` décidées existent pour le document. |
| **Aucun instantané immuable à la finalisation** (`GoldRun` n'est jamais écrit : 0 ligne, jamais lu — code mort). | Le « gold figé » est un booléen. Mais l'artefact citable existe : `run_gold_export` écrit un JSONL horodaté et non réutilisable sous `EXPORTS_DIR` + un manifeste dans `ExportJob.manifest`, et `ArbitrationEvent` est un journal append-only qui porte le payload complet de chaque décision. | **Procédure, pas code** : exporter immédiatement après chaque finalisation et archiver le fichier ; `pg_dump` avant le démarrage de la campagne d'arbitrage et après chaque lot de 10 documents. Supprimer ou câbler `GoldRun` (dette, pas urgence). |
| **Perte silencieuse des secondaires à la finalisation** (`advisory`). | Réel et **irréversible après finalisation** (recompute NO-OP). | Basculer `secondaryPolicy` sur `required` **avant** la première finalisation (B4), vérifier sur le document témoin. |
| **Double `POST /submit`** : réécrit `finalized_at` + second `ArbitrationEvent FINALIZE`. | Non atteignable par l'UI (bouton masqué si `finalized`, `Button` désactivé pendant la mutation), atteignable par API directe ou deux onglets. Aucun contenu gold n'est altéré. | C1 (`assert_not_finalized` + verrou). |
| **Perte de complétude (annotation repassée en `draft`)** : les lignes auto sont dé-décidées, `pct_resolved` tombe à 0. | **Pas une perte** : dérivation pure, restaurée à l'identique au GET suivant ; les décisions humaines sont sanctuarisées ; un gold finalisé est totalement immunisé. Seul `decided_at` des lignes auto est réémis. | Aucune action de code requise. Procédure : ne pas rouvrir d'annotation après déclaration des participants. |
| **Suppression d'un compte utilisateur** : perte du « qui » sur les arbitrages. | Aucun chemin applicatif ne supprime de User (`/admin/` uniquement). `remove_llm_annotator` ne supprime pas le compte. Et `Annotation.annotator` est en CASCADE : supprimer un compte détruirait d'abord les votes bruts. | Procédure : ne jamais supprimer de compte ; retirer l'appartenance au projet. |
| **Les 425 `GoldSentence` périmées** | **Aucun risque** : `decided = 0`, `ArbitrationEvent = 0`. Le recalcul est gratuit. | Rafraîchir sans précaution (A3). Cette fenêtre se ferme au premier arbitrage. |

---

## 6. DÉCOUPAGE EN LOTS

Le dossier `/Users/elazhar/PycharmProjects/claire-studio/docs/pactiva/dossier-gold-execution/04_RUNBOOK.md` porte déjà une numérotation L1–L7 ; **L1 et L2 sont faits et commités** (`0e9e900`, 7 tests backend + 2 frontend, 812 backend verts) mais pas déployés — le tableau de synthèse du runbook est périmé sur L2, à corriger. Le découpage ci-dessous reprend cette colonne vertébrale et ajoute trois lots que le runbook ne couvre pas (L0 mise en service, L7 étanchéité, L8 citabilité).

---

### L0 — Mise en service du déblocage et mesure du reste-à-faire réel
**Objectif** : passer de 0/50 à 50/50 `ready` et remplacer les chiffres périmés par la mesure réelle.
**Fichiers / actions** : déploiement de `0e9e900` (`/Users/elazhar/PycharmProjects/claire-studio/deploy/deploy-claire.sh` — **aucune migration dans L1+L2**) ; studio GOLD de `campagne-pactiva` → « Participants attendus » = `zahra.boulaich`, `fatima.ouali`, `elazhar.jebbari` ; boucle de GET `/api/v1/projects/campagne-pactiva/gold/<external_id>` sur les 50 documents ; script à blanc de distribution de `n_covering` (prérequis de L3).
**Critère de succès** : `git rev-parse HEAD` serveur = `0e9e900` ; cockpit = 50 `ready` / 0 `awaiting` ; `9gag` = 132 auto + **7 manuels** ; total corpus ≈ **462 manuels** ; un `POST decide` de test renvoie 200 puis est annulé par `reopen`/re-décision. **Aucune décision définitive n'est prise à ce stade.**
**Effort** : ~1 h. **Dépendances** : aucune. **Rollback** : redéployer `6bbddda` ; vider `expected_annotators` restaure exactement le comportement antérieur.

---

### L3 — Garde-fous de qualité du gold (moteur, strictement additif)
**Objectif** : empêcher la production d'un gold faux mais plausible.
**Fichiers** : `/Users/elazhar/PycharmProjects/claire-studio/backend/claire/projects/gold_scoring.py` (champs additifs `n_covering`, `tie`) ; miroir `/Users/elazhar/PycharmProjects/claire-studio/frontend/src/lib/goldScoring.ts` ; `/Users/elazhar/PycharmProjects/claire-studio/backend/claire/gold/services.py` (garde « auto-résolution ⇒ ≥ 2 couvrants », posée hors moteur pur) ; `/Users/elazhar/PycharmProjects/claire-studio/frontend/src/components/gold/GoldReadingPanel.tsx:68` (`showValidate`) ; `/Users/elazhar/PycharmProjects/claire-studio/frontend/src/lib/gold/golden.cases.json` ; `backend/tests/test_gold_scoring.py`, `test_gold_parity.py`, `frontend/tests/goldParity.test.ts`.
**Critère de succès** : cas d'or `partial-coverage-not-auto` et `tie-1-1-1` verts des deux côtés ; **les 15 golden existants inchangés** (aucune décision modifiée) ; le rail « ✓ » n'apparaît plus sur `autoLevel === 'manual'` ni sur `tie` ; `test_single_annotator_is_strict` révisé et documenté ; delta de volume `manual` mesuré et consigné.
**Effort** : 0,5–1 j. **Dépendances** : L0 (la mesure). **Risque** : toucher au moteur — mitigé par le caractère strictement additif + golden de non-régression.

---

### L4 — Inspecteur d'arbitrage complet (le lot qui rend l'arbitrage possible)
**Objectif** : rendre toute phrase décidable, et toute décision complète (primaire + secondaires + justification).
**Fichiers** : `/Users/elazhar/PycharmProjects/claire-studio/frontend/src/components/gold/GoldInspectorPanel.tsx` (candidats ordonnés par le schéma et numérotés ; sélecteur « Autre thème… » sur tout le schéma via `useScheme` ; bloc **Secondaires** éditable, initialisé sur `sentence.secondaries` si décidée sinon `proposedSecondaries`, refuges désactivés en secondaire, primaire exclu ; champ **commentaire** repliable) ; `/Users/elazhar/PycharmProjects/claire-studio/frontend/src/components/gold/GoldWorkspace.tsx` (propager `comment`) ; `/Users/elazhar/PycharmProjects/claire-studio/frontend/src/lib/gold/types.ts` ; `/Users/elazhar/PycharmProjects/claire-studio/backend/claire/gold/services.py:483-521` (`if comment: gs.comment = comment` — ne pas écraser par une chaîne vide) ; nouveau `frontend/tests/goldInspector.test.tsx`.
**Critère de succès** : décider un thème absent des votes ; ajouter puis retirer un secondaire ; refuge refusé en secondaire (400) ; commentaire présent dans `ArbitrationEvent.payload` et dans `arbitration.comment` de l'export (test d'API backend) ; **une phrase fabriquée `agreement_class = "empty"` reste décidable et `can_finalize` devient atteignable**.
**Effort** : 1–1,5 j. **Dépendances** : L0, types de L2. **Backend** : aucune modification d'API, `decide_sentence` valide déjà les trois champs contre le schéma.

---

### L5 — Vitesse d'arbitrage (le lot qui divise le temps par 3)
**Objectif** : passer de ~6 gestes souris à 1–2 frappes par cas, et cibler les 462 cas au lieu des 9 414 phrases.
**Fichiers** : `/Users/elazhar/PycharmProjects/claire-studio/frontend/src/lib/gold/blocks.ts` (`nextManual`/`prevManual`, `manual` dans `outlineStats`, `needsAttention` restreint à `majority|divergence` + 4ᵉ cas `empty` distinct) ; `/Users/elazhar/PycharmProjects/claire-studio/frontend/src/store/goldStore.ts` ; `GoldWorkspace.tsx`, `GoldOutlinePanel.tsx`, `GoldCockpit.tsx` ; `/Users/elazhar/PycharmProjects/claire-studio/backend/claire/projects/views.py:709-721` (ajouter `manual=Count(filter=Q(auto_level="manual"))` à l'agrégation existante) ; `frontend/tests/goldBlocks.test.ts`, nouveau `goldKeyboard.test.tsx`.
**Critère de succès** : `n`/`p` atteignent uniquement des cas `manual` ; `1..9` adoptent le k-ième candidat ; raccourcis **inertes sans verrou** et **inertes dans un `input`/`textarea`/`contenteditable`** (tests dédiés) ; compteur « N cas manuels restants » exact et `aria-live` ; **le compteur cockpit et le compteur atelier affichent le même nombre pour un même document** (fin de la rupture de parité actuelle, où `empty` est compté à l'atelier et exclu au cockpit) ; test anti-N+1 du cockpit toujours vert.
**Effort** : 1–1,5 j. **Dépendances** : L4 (numérotation stable des candidats).

---

### L6 — Robustesse de l'acte d'arbitrage
**Objectif** : qu'aucune décision ne se perde en silence et que le gel du gold soit un acte sûr.
**Fichiers** : `/Users/elazhar/PycharmProjects/claire-studio/backend/claire/gold/services.py:549-587` (finalize/reopen : `transaction.atomic` + `select_for_update` + `_assert_holder` + `assert_not_finalized`, recompte de `decided` sous le verrou) ; `/Users/elazhar/PycharmProjects/claire-studio/backend/claire/projects/views.py` (route `decide/undo`) ; `/Users/elazhar/PycharmProjects/claire-studio/backend/claire/gold/models.py` (verbe `UNDO` — migration `AlterField` sur `choices` uniquement, précédent `gold/0002`) ; `/Users/elazhar/PycharmProjects/claire-studio/frontend/src/store/apiErrors.ts:44-51` (`err.body.detail ?? err.message`) ; `GoldWorkspace.tsx` (`disabled={!lock.heldByMe}` sur `gold-finalize`, rendu de `lock.error` dans `LockBanner`, confirmation de finalisation avec récapitulatif via `SubmitDialog`) ; `/Users/elazhar/PycharmProjects/claire-studio/frontend/src/components/gold/useArbitrationLock.ts` (heartbeat : ne déclasser que sur 409 explicite, back-off 2 s/5 s, découpler l'intervalle de `heldByMe` via `heldRef` déjà présent ; listener `visibilitychange` + `pageshow` ; compte à rebours depuis `expiresAt`).
**Critère de succès** : double `POST /submit` → 409, `finalized_at` inchangé, **un seul** `ArbitrationEvent FINALIZE` ; `submit` par un non-détenteur pendant un bail actif → 409 ; un 409 affiche à l'écran le `detail` français nommant le détenteur ; un échec réseau simulé du heartbeat ne fait pas perdre le verrou (retry réussi) ; `u` restaure l'état moteur et trace l'événement. **Ajouter les tests de verrou manquants** : `test_gold_lifecycle.py:105-140` et `test_gold_simulation.py:355` finalisent aujourd'hui SANS acquérir le verrou et passent.
**Effort** : 1–1,5 j. **Dépendances** : L0.

---

### L7 — Étanchéité : confidentialité, écritures sur GET, destruction accidentelle
**Objectif** : fermer les deux trous de surface qui ne gênent pas l'arbitre mais exposent le projet.
**Fichiers** : `/Users/elazhar/PycharmProjects/claire-studio/backend/claire/projects/views.py:863-873` (`gold_detail` : `is_arbiter` → 403 **avant** toute matérialisation de résolution ; même contrôle sur `gold_cockpit`/`gold_stats`) ; `/Users/elazhar/PycharmProjects/claire-studio/backend/claire/gold/services.py:394` (`resolve_and_payload` : recompute en écriture réservé au détenteur du bail, sinon payload en lecture seule) ; `/Users/elazhar/PycharmProjects/claire-studio/backend/claire/annotations/management/commands/feed_db.py:227` (garde `--reset`) ; `backend/claire/imports/loaders.py:105` (garde re-segmentation) ; `backend/tests/test_gold_api.py`, `backend/tests/test_feed_db.py`.
**Critère de succès** : un compte de rôle `annotator` reçoit **403** sur `GET /gold/<doc>` et **aucune** `GoldResolution` n'est créée par cet appel (la politique d'indépendance ADR-001 n'est plus contournable par une URL, et les votes nominatifs des pairs ne fuient plus) ; un GET par un non-détenteur pendant un bail actif n'émet **aucun** `INSERT`/`UPDATE` sur `gold_goldsentence` (CaptureQueriesContext) ; `feed_db --reset` refuse de s'exécuter en présence d'une décision humaine ou d'une résolution finalisée sans `--force-gold`.
**Effort** : 0,5–1 j. **Dépendances** : aucune (parallélisable avec L4/L5).

---

### L8 — Citabilité de l'artefact
**Objectif** : que le fichier exporté suffise à répondre à un relecteur JURIX, sans requête complémentaire.
**Fichiers** : `/Users/elazhar/PycharmProjects/claire-studio/backend/claire/gold/export.py` (manifeste : config de résolution effective, liste des participants attendus et leur source, ventilation décidé/auto/manuel/non décidé/finalisé ; bloc `arbitration` enrichi de `proposed_primary`, `agreement_class`, `tie`, `n_covering` ; `finalized_at` réellement exporté) ; `/Users/elazhar/PycharmProjects/claire-studio/frontend/src/components/gold/GoldCockpit.tsx` (avertissement explicite quand l'export porte sur un périmètre partiel — aujourd'hui le bouton produit sans un mot un artefact à 0 résolution finalisée) ; `backend/tests/test_gold_api.py`.
**Critère de succès** : à partir du seul JSONL exporté, on calcule le **taux de suivi de la proposition du moteur par l'arbitre** et le **taux d'égalités** ; le manifeste nomme les 3 participants et la config ; l'export d'un projet non finalisé porte un avertissement visible.
**Effort** : 0,5 j. **Dépendances** : L3 (`tie`, `n_covering`), L4 (`comment`).

---

### L9 — Mise en service réelle et arbitrage de production
**Objectif** : valider de bout en bout sur un document témoin avant de toucher aux 49 autres.
**Étapes** : (9.1) déployer L3→L8, vérifier le SHA serveur ; (9.2) basculer `secondaryPolicy` sur `required` et vérifier sur `9gag` que les secondaires réapparaissent sur les phrases auto ; (9.3) arbitrer **au clavier** les 7 cas manuels de `9gag`, avec commentaire sur au moins un cas ; (9.4) finaliser sous verrou, exporter, archiver le JSONL + `pg_dump` ; (9.5) étendre aux 49 autres documents ; (9.6) relancer les mesures E5 / `gold-cascade` du Lab sur données réelles.
**Critère de succès** : `ArbitrationEvent` = 7 `decide` + 1 `finalize` sur `9gag` ; gold figé, second `submit` → 409 ; export deux couches complet avec secondaires non vides ; **un test e2e Playwright couvre le parcours complet** (ouvrir → prendre le verrou → décider 3 cas dont une phrase non couverte → finaliser → exporter), qui n'existe aujourd'hui nulle part — c'est le trou de couverture n°1 des 114 tests backend.
**Effort** : 0,5 j de mise en service + **2 à 3 h d'arbitrage effectif** si L5 est livré (8 à 11 h sinon).
**Garde-fou** : aucune écriture sur les 49 autres documents avant que 9.3 et 9.4 ne soient vérifiés.

---

### Séquencement recommandé

```
L0 ──► L3 ──► L4 ──► L5 ──┐
                          ├──► L9
        L6 ───────────────┤
        L7 (parallèle) ───┤
        L8 ───────────────┘
```

**Chemin minimal pour commencer à arbitrer sans produire de déchet : L0 + L3 + L4 + (C1/C2 de L6).** L5 n'est pas bloquant mais c'est le meilleur rapport effort/gain du chantier : il transforme 8–11 h de clics en 2–3 h. L7 et L8 sont indépendants et peuvent être menés par une seconde paire de mains.

### Réserve de fin

Une note de prudence sur les suites : les 114 tests backend tournent sur **SQLite `:memory:`**, où `select_for_update()` est un no-op — toute la garantie d'exclusivité est donc verte sur un moteur qui ne l'exerce pas, alors que la prod est PostgreSQL. Les tests de verrou ajoutés en L6 devraient au minimum être marqués comme tels, idéalement rejoués une fois sur Postgres avant L9.