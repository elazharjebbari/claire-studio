# Décision F0 — schéma et prompt v0.2 (à trancher avant toute extraction du hold-out)

*15 septembre 2026. Source des constats : `legal-kg/docs/PILOT_EXTRACTION_FINDINGS.md` (pilote 100 clauses × 3 passes,
Opus 5 ; second extracteur Codex). Rien ici n'a encore été appliqué : le schéma v0.1 et les règles v0.1 restent gelés.
Une fois les cases cochées, l'exécution est : éditer les YAML/prompt → tests → nouvelles empreintes dans `FROZEN.txt`
→ répétition du pilote (3 passes) pour mesurer l'effet → hold-out.*

## A. Inventaire d'actions (`ontology/legal_kg_schema.yaml`, `action_by_theme_T11`)

Critère de recommandation : **ajouter un code seulement s'il peut porter un item de l'annexe ou une asymétrie R3** ;
sinon, le laisser en `other` (il ne coûte rien aux règles et évite d'allonger l'inventaire que le modèle doit apprendre).

| Thème | Code candidat | Part de `other` du thème | Item / usage | Recommandation | ☐ |
|---|---|---|---|---|---|
| DISPUTES_LAW | `limit_claim_period` (délai de prescription contractuel) | 35 % | **(q)** obstacle au recours | **ajouter** ; règle Q-q v0.2 : `action` += `limit_claim_period` avec `actor: user, modality: obligation` | ☐ |
| DISPUTES_LAW | `pay_arbitration_fees` (obligation du fournisseur) | | asymétrie R3 (qui paie) | ajouter (utile à l'audit, aucune règle) | ☐ |
| MODIFICATION_OF_TERMS | `deem_acceptance_by_use` (« continued use = acceptance ») | 31 % | **(i)** / (j) | **ajouter** ; Q-i v0.2 : `action` += `deem_acceptance_by_use` (aujourd'hui `bind_by_use` limité à FRAMEWORK / ACCOUNT_USE) | ☐ |
| TERMINATION | `cancel_booking`, `enforce_measures` | 22 % | (f), (d) | ajouter `cancel_booking` (recours/remboursement mesurables), laisser `enforce_measures` en `other` | ☐ |
| LIMITATION_LIABILITY | `allocate_taxes`, `disclaim_user_interactions` | 12 % | (b) périphérique | ajouter `disclaim_user_interactions` seulement (exclusion de responsabilité déguisée) | ☐ |
| WARRANTY_DISCLAIMER | `disclaim_advice` | 39 % | (b) périphérie | ajouter (fréquent, distinct de `exclude_warranty`) | ☐ |
| FEES_PAYMENT | `restrict_virtual_goods` | 30 % | (o) non exprimable | laisser en `other` | ☐ |
| CONTENT_IP | `content_restrictions`, `submit_reviews`, `create_derivative_works` | 63 % | obligations du consommateur | laisser en `other` (hors grey list) ; mentionner dans la discussion comme limite du périmètre | ☐ |
| ACCOUNT_USE | `acceptable_use`, `provide_accurate_information`, `restrict_export` | 88 % | obligations du consommateur | laisser en `other` (idem) | ☐ |
| FRAMEWORK | `serve_notices` | 15 % | aucun | laisser en `other` | ☐ |

Effet attendu si la recommandation est suivie : 6 codes ajoutés, `other` passe d'environ 39 % à environ 25 % (les deux
thèmes majoritaires ACCOUNT_USE / CONTENT_IP restant volontairement non décrits), **deux règles modifiées** (Q-q, Q-i) →
règles v0.2, nouveau gel, cas dorés à ajouter dans `tests/test_rules_engine.py`.

## B. Ancrage lexical (`llm/prompts/…`, `LEXICAL_TRIGGERS`) — prompt v0.2, hors règles

| Champ | Ajouts proposés | Justification | Recommandation | ☐ |
|---|---|---|---|---|
| `condition = specified_reason` | `if`, `where`, `upon`, `in the event`, `suspect`, `fraud`, `security`, `legal`, `necessary` | 69 drapeaux sur 3 passes ; la forme conditionnelle est la façon normale de nommer une raison ; la rétrogradation vers `none_stated` **favorise** Q-g/Q-j (biais à corriger dans le sens de la prudence) | **accepter** | ☐ |
| `remedy = none` | `no liability`, `not liable`, `without any refund` | 37 drapeaux | accepter | ☐ |
| Autres (`notice=reasonable`, `condition=discretion`…) | aucun | ≤ 3 drapeaux chacun | ne rien changer | ☐ |

Après modification : re-mesurer le taux de drapeaux sur le pilote (cible < 10 %) ; la validation juriste tranche les cas.

## C. Champs du template

| Proposition | Recommandation | ☐ |
|---|---|---|
| Garder `counterparty` (2 erreurs `counterparty = actor` sur 608) | oui, ajouter un contrôle sémantique bloquant | ☐ |
| Ajouter `scope` (à qui la norme s'applique : tous / certains utilisateurs) | non en v0.2 (aucune règle ne l'utilise) | ☐ |

## D. Conséquences protocolaires (rappel)

1. Toute modification de règle = **règles v0.2** : nouvelle empreinte, nouvelle date, mention « ce que les auteurs
   savaient » (pilote de conception uniquement, aucun chiffre du hold-out).
2. Répéter le pilote avec le prompt v0.2 (3 passes) **avant** le hold-out ; comparer `other`, drapeaux, κ de Fleiss.
3. La validation juriste des 100 templates (F2) se fait sur les sorties v0.2 si la décision intervient avant sa tenue ;
   sinon sur v0.1, et les codes ajoutés sont appliqués par correction manuelle.

## E. Décision

- [ ] Option 1 — **recommandée** : A (6 codes), B, C-1 ; règles v0.2 (Q-q, Q-i).
- [ ] Option 2 — minimale : B seulement (prompt), aucune modification de schéma ni de règle ; hold-out sous v0.1.
- [ ] Option 3 — étendue : A complet (tous les codes candidats), B, C ; risque : inventaires longs, instabilité accrue.

Décidé par : ______  Date : ______  Consigné dans `legal-kg/docs/GATES_LOG.md` et `llm/prompts/PROMPT_REGISTRY.md`.
