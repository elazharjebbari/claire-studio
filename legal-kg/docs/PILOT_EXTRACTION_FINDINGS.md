# Pilote d'extraction (100 clauses × 3 passes) — constats et décisions à prendre

Run `results/extraction/inline-opus5-pilot100-20260915/` (backend inline, Claude Opus 5, 12 sous-agents à contexte
vierge). Chiffres agrégés sans texte de contrat ; le détail par clause est dans la feuille de validation (locale).
Aucun chiffre ci-dessous n'est un résultat publiable : population de **conception**, normes **non validées**.

## 1. Ce qui tient

| Mesure | Valeur | Lecture |
|---|---|---|
| Conformité au schéma | 300/300 | validation Pydantic a posteriori (pas de décodage contraint) |
| Contrôles structurels / sémantiques | 100 % / 99,3 % | 2 `counterparty = actor` sur 608 normes |
| Normes par clause · clauses vides | 2,03 · 10,7 % | accord vide/non-vide entre passes : 99 % |
| Sorties strictement identiques | 8 % | attendu sans température 0 ; **la bonne mesure est celle des signatures** |
| Jaccard des signatures décisives (actor, modality, action, condition, notice, remedy) | 0,80 | stabilité du contenu normatif |
| Phrases signalées par les règles gelées : Jaccard par paire · κ de Fleiss | 0,62–0,73 · **0,77** | 25 phrases signalées par les 3 passes, 36 par la majorité |
| Diagnostic de conception (P / R / F1 par passe) | 0,67–0,69 / 0,46–0,48 / 0,55 | stable entre passes ; pilote enrichi en thèmes à risque |

Conclusion : la variabilité d'une passe à l'autre touche surtout la **rédaction** des objets et le **nombre** de normes,
peu les champs décisifs, et les règles gelées y sont robustes (κ 0,77). Le backend inline suffit pour le pilote.

## 2. Actions `other` : 39 % des normes ne peuvent déclencher aucune règle

Part de `other` par thème (3 passes) : ACCOUNT_USE **88 %**, CONTENT_IP **63 %**, WARRANTY_DISCLAIMER 39 %,
DISPUTES_LAW 35 %, MODIFICATION_OF_TERMS 31 %, FEES_PAYMENT 30 %, PRIVACY_DATA 30 %, THIRD_PARTY_SERVICES 25 %,
TERMINATION 22 %, FRAMEWORK 15 %, LIMITATION_LIABILITY 12 %.

Motifs dominants (modalité/acteur et mots-clés des objets), et code candidat pour `action_by_theme_T11` v0.2 :

| Thème | Motif observé | Code candidat | Item annexe potentiellement concerné |
|---|---|---|---|
| ACCOUNT_USE | prohibition/obligation **user** : usage acceptable, exactitude des informations de compte, restrictions d'accès/export | `acceptable_use`, `provide_accurate_information`, `restrict_export` | aucun (obligations du consommateur : hors grey list, mais utiles à l'asymétrie R3) |
| CONTENT_IP | prohibition user (contenu diffamatoire), permission user (avis/notes), permission provider (modifier/créer œuvres dérivées) | `content_restrictions`, `submit_reviews`, `create_derivative_works` | (o) via licence ; (i) si acceptation par usage |
| DISPUTES_LAW | obligation **provider** de payer les frais d'arbitrage ; délai de prescription (« within one year… barred ») | `pay_arbitration_fees`, `limit_claim_period` | **(q)** : la limitation du délai d'action est un obstacle au recours **non couvert par l'inventaire actuel** |
| MODIFICATION_OF_TERMS | « continued use = acceptance » (obligation user / power provider) | `deem_acceptance_by_use` | **(i)** / (j) : aujourd'hui `bind_by_use` n'existe que dans FRAMEWORK et ACCOUNT_USE |
| TERMINATION | annulation de réservations avec/sans remboursement, mesures d'application (retrait de contenu, désactivation) | `cancel_booking`, `enforce_measures` | (f), (d) |
| WARRANTY_DISCLAIMER | contenu « ne constitue pas un conseil médical/professionnel » (obligation user de consulter) | `disclaim_advice` | (b) en périphérie |
| FEES_PAYMENT | biens virtuels : licence limitée, interdiction de revente/transfert | `restrict_virtual_goods` | (o) |
| FRAMEWORK | signification d'actes (subpoenas), notification par courrier | `serve_notices` | aucun |
| LIMITATION_LIABILITY | taxes à la charge de l'utilisateur ; responsabilité exclusive des interactions entre utilisateurs | `allocate_taxes`, `disclaim_user_interactions` | (b) |

**Décision humaine requise (porteur + juristes)** : `ontology/legal_kg_schema.yaml` est gelé (hash dans FROZEN.txt). Étendre
les inventaires = **schéma v0.2 + nouveau gel**, autorisé tant qu'aucune exécution n'a eu lieu sur le hold-out (c'est le
cas). Les règles v0.1 restent inchangées ; seule `Q-q` pourrait, en v0.2, admettre `limit_claim_period` — ce serait une
**modification de règle**, donc une nouvelle version gelée, à décider avant tout run hold-out.

## 3. Ancrage lexical : 20,6 % de normes signalées, surtout `specified_reason`

Drapeaux (3 passes) : `condition=specified_reason` **69**, `remedy=none` 37, `remedy=compensation` 6, `notice=reasonable` 3,
`notice=none` 3, `condition=discretion` 3, `remedy=right_to_cancel` 2, `condition=for_cause` 2.

Dans les phrases témoins des `specified_reason` signalés, les marqueurs présents sont : « if » (42), « where » (11),
« legal » (9), « upon » (7), « suspect » (5), « fraud » (5), « event » (4), « abuse » (4), « necessary » (3), « security » (3).
La liste actuelle (`reason`, `because`, `due to`, `in order to`) ne couvre pas la forme conditionnelle « if/where/upon … »
qui est la façon normale, en anglais contractuel, de **nommer une raison**. La correction automatique rétrograde donc à
`none_stated` des conditions probablement correctes, ce qui **favorise** les règles (Q-g/Q-j exigent `discretion` ou
`none_stated`) : biais à corriger avant le hold-out, dans le sens de la prudence.

**Proposition (prompt v0.2, hors règles)** : ajouter à `LEXICAL_TRIGGERS["condition"]["specified_reason"]` les marqueurs
`if`, `where`, `upon`, `in the event`, `suspect`, `fraud`, `security`, `legal`, `necessary`, et à `remedy["none"]`
`no liability`, `not liable`, `without any refund`. La liste reste **déclarée** (heuristique), le taux de drapeaux
sera re-mesuré sur le pilote et la validation juriste tranchera au cas par cas.

## 4. Prochaines étapes dans l'ordre

1. Validation des 100 templates par les deux juristes (feuille `validation/validation_sheet.{csv,md}`, passe 0 ;
   44 clauses `unstable` à regarder en priorité) → `validation_sheet.py merge` → jsonl validé → Gate 5.
2. Décision schéma v0.2 (inventaires) et prompt v0.2 (ancrage), consignées dans `PROMPT_REGISTRY.md` et `FROZEN.txt`.
3. Répétition du pilote avec le prompt v0.2 (3 passes) pour mesurer l'effet sur `other` et sur les drapeaux.
4. Seulement ensuite : extraction du hold-out (1 087 clauses), sous le protocole gelé.

## 5. Répétition du pilote avec le schéma et l'ancrage v0.2 (15 sept., `results/extraction/inline-opus5-pilot100-v02-20260915/`)

Même backend (12 sous-agents Claude Opus 5 à contexte vierge, lots de 25, 3 passes), même 100 clauses, inventaires v0.2 et
déclencheurs d'ancrage v0.2. Chiffres de **conception**, non publiables.

| Mesure | v0.1 | v0.2 | Lecture |
|---|---|---|---|
| Lignes conformes au schéma | 300/300 | 294/300 | 6 objets > 120 caractères rejetés (2 %) : bruit déclaré, pas de re-prompt en mode inline |
| Normes (3 passes) · par clause | 608 · 2,03 | 644 · 2,19 | légèrement plus de normes |
| Part d'actions `other` | 39,8 % | 39,6 % | inchangée en global : ACCOUNT_USE (88 %) et CONTENT_IP (65 %) restent non décrits par choix ; **DISPUTES_LAW 35 → 21 %**, THIRD_PARTY 25 → 11 % ; FEES et WARRANTY montent (43 %, 45 %) |
| Nouveaux codes utilisés | — | `deem_acceptance_by_use` 8, `pay_arbitration_fees` 8, `limit_claim_period` 6, `disclaim_user_interactions` 3, `disclaim_advice` 3, `cancel_booking` 2 | tous employés |
| Drapeaux d'ancrage par norme | 0,206 | 0,185 | `condition=specified_reason` **69 → 37** (objectif atteint) ; `remedy=none` 37 → 53 |
| Jaccard des signatures décisives | 0,80 | 0,81 | stable |
| Phrases signalées par les règles (gelées v0.2) : Jaccard par paire · κ de Fleiss | 0,62–0,73 · 0,77 | 0,72–0,92 · **0,86** | 33 phrases signalées par les 3 passes (25 en v0.1) |
| Diagnostic P / R / F1 (passe 0) | 0,68 / 0,48 / 0,56 | 0,51 / 0,42 / 0,46 | attendu : l'ancrage v0.2 conserve davantage de `specified_reason` (Q-g/Q-j se déclenchent moins, dans le sens de la prudence) et **Q-i élargi à `deem_acceptance_by_use` signale 13 phrases** dont la plupart sont étiquetées CH et non USE par CLAUDETTE : un désaccord de mapping item ↔ catégorie, pas un défaut à corriger après coup (règles gelées) |

Décisions : rien n'est retouché après ces mesures (gel v0.2 du 15 sept. antérieur à toute exécution sur le hold-out). Les
échecs de longueur d'objet et l'effet de Q-i sont consignés comme constats à discuter dans le papier.
