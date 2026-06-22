# Nos thèmes de segmentation (vocabulaire fermé)

C'est **le vocabulaire que vous appliquez** : chaque bloc-clause reçoit exactement
**un** de ces 20 thèmes. Ils sont conçus pour **segmenter physiquement et
logiquement** un ToS de bout en bout — tout passage du document doit pouvoir tomber
dans l'un d'eux (à défaut : `MISC_BOILERPLATE`).

> Astuce : tapez dans « Filtrer un thème… » (palette) pour retrouver un thème par son
> nom ou son code. La pastille colorée du thème se retrouve sur le rail gauche du
> document et dans le plan.

## Tableau de référence

| Thème (code) | Libellé | La clause traite de… | Repères / exemples |
|---|---|---|---|
| `META` | Méta / dates / adresses | en-têtes, dates d'effet, coordonnées, titres de document | « Terms of Service », « effective as of… », adresse du siège |
| `PREAMBLE_SCOPE` | Préambule & périmètre | objet du contrat, périmètre, acceptation | « these Terms apply to your use of… », « by using, you agree » |
| `PRIVACY_DATA` | Données & vie privée | collecte/usage des données, renvoi à la politique de confidentialité | « we collect data about… », « see our Privacy Policy » |
| `ELIGIBILITY_ACCOUNT` | Éligibilité & compte | conditions d'accès, âge, création/sécurité du compte | « at least 13 years old », « keep your password secure » |
| `ACCEPTABLE_USE` | Usage acceptable | comportements interdits, abus, restrictions d'usage | « you must not misuse », « prohibited conduct » |
| `USER_CONTENT` | Contenu utilisateur | contenu posté par l'utilisateur, droits/licences accordés dessus | « content you post », « you grant us a license to… » |
| `LICENSE_IP` | Licence & propriété intel. | PI du fournisseur, licence d'usage du service/logiciel | « we grant you a limited license », « all IP rights reserved » |
| `MODIFICATION_OF_TERMS` | Modification des conditions | droit de modifier les CGU ou le service | « we may modify these terms », « we can change the service » |
| `TERMINATION` | Résiliation | suspension/clôture du compte ou du service | « we may terminate or suspend your account » |
| `WARRANTY_DISCLAIMER` | Exclusion de garantie | service fourni « en l'état », absence de garanties | « as is and as available », « no warranties » |
| `LIMITATION_LIABILITY` | Limitation de responsabilité | plafonds/exclusions de responsabilité et dommages | « shall not be liable », « total liability capped at… » |
| `ARBITRATION_DISPUTES` | Arbitrage & litiges | résolution des litiges, arbitrage, renonciation à l'action collective | « binding arbitration », « class action waiver » |
| `GOVERNING_LAW` | Loi applicable | loi applicable et/ou tribunal compétent | « laws of the State of California », « courts of… » |
| `THIRD_PARTY_SERVICES` | Services tiers | liens/intégrations/services de tiers | « links to third-party websites », « third-party services » |
| `FEES_PAYMENT` | Frais & paiement | prix, abonnements, facturation, remboursements | « subscription fees », « billing », « refunds » |
| `COMMUNICATIONS` | Communications | notifications, e-mails, communications administratives | « administrative communications », « we may contact you » |
| `FEEDBACK` | Retours / feedback | suggestions/retours de l'utilisateur et droits dessus | « any feedback you provide may be used… » |
| `PROMOTIONS` | Promotions | offres, concours, codes promo | « sweepstakes », « promotional offers » |
| `DMCA` | DMCA / contrefaçon | signalement de contrefaçon, procédure de retrait | « DMCA notice », « copyright infringement » |
| `MISC_BOILERPLATE` | Boilerplate divers | clauses standard non spécifiques (divisibilité, intégralité, cession…) | « severability », « entire agreement », « assignment » |

## Comment choisir le bon thème

1. **Lisez le bloc entier**, pas la seule phrase d'ancrage : le thème qualifie la
   **fonction dominante** du bloc.
2. **Évitez le réflexe `MISC_BOILERPLATE`** : c'est le **dernier recours**, réservé aux
   clauses réellement standard (divisibilité, intégralité, cession, renonciation).
3. **Une clause = un thème.** Si deux sujets cohabitent (ex. données + résiliation),
   c'est souvent le signe qu'il faut **deux blocs** (deux frontières).
4. En cas de doute entre deux thèmes proches, regardez la **catégorie CLAUDETTE** de la
   zone (overlay) et l'**evidence span** : ils orientent le choix.
5. Comparez aux **juges LLM** (Claude, Codex, Mistral… ; mode Comparer, ou sélecteur de source dans
   l'inspecteur) : utile, mais **vous tranchez** — les juges peuvent diverger.

## Pièges fréquents

- *Préambule vs Méta* : `META` = en-têtes/dates/coordonnées ; `PREAMBLE_SCOPE` = objet
  et acceptation.
- *Licence & PI vs Contenu utilisateur* : `LICENSE_IP` = PI **du fournisseur** ;
  `USER_CONTENT` = contenu **de l'utilisateur** et licence accordée dessus.
- *Garantie vs Responsabilité* : `WARRANTY_DISCLAIMER` (pas de garanties) ≠
  `LIMITATION_LIABILITY` (plafond de dommages) — souvent **deux blocs** voisins.
- *Loi vs Arbitrage* : `GOVERNING_LAW` (loi/tribunal) ≠ `ARBITRATION_DISPUTES`
  (mécanisme d'arbitrage / action collective).

➡️ Suite : *Bien annoter : méthode & bonnes pratiques*.
