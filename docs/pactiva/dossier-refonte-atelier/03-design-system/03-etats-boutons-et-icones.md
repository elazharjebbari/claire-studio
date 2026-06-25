# Design system — états des boutons & iconographie

## Matrice des états de boutons

| État | Traitement visuel | Exemple |
| --- | --- | --- |
| Repos | Surface tokenisée selon la variante (primary = accent plein ; neutral = bordure --line + fond --panel ; warning/danger/success = teinte sémantique en bordure/fond translucide). Libellé + icône Lucide 14px alignés. Cible tactile conforme (≥24px, idéalement 44px en zones tactiles). | Soumettre (primary au repos) |
| Survol (hover) | Élévation subtile : fond +1 cran d'opacité du token, bordure légèrement renforcée, transition douce (~120ms). Aucun changement de teinte sémantique (un hover ne change pas le SENS). | Valider (hover sur variante success) |
| Actif / pressé / sélectionné (toggle on) | État enfoncé explicite : fond plein du token, aria-pressed/aria-expanded reflété visuellement (anneau ou fond plein). Comble le trou actuel des toggles 'Annoter' sans état pressed malgré aria-expanded. | Toggle 'Annoter' actif (aria-expanded=true) |
| Désactivé | Opacité réduite (~45%), curseur not-allowed, perte de l'interactivité hover, contraste maintenu suffisant pour rester lisible (pas un gris illisible). aria-disabled annoncé. | Soumettre désactivé (clauses non finalisées) |
| Chargement (pending) | Spinner Lucide (Loader2 en rotation) en slot d'icône, libellé conservé ou remplacé par un libellé d'attente, bouton non re-cliquable (anti double-clic), largeur stable (pas de saut de layout). Branché sur saveState/SubmissionProgressDialog pour les actions longues (flush jusqu'à 8s). | Soumettre… (flush en cours, 12 passes) |
| Succès | Bascule transitoire en token --sem-success : icône CheckCircle, libellé de confirmation bref (~1,5s) puis retour au repos. Feedback non bloquant, doublé par notification pour les actions critiques. | Snapshot enregistré (flash success) |
| Erreur | Bascule en token --sem-danger : icône AlertCircle, libellé d'échec, bouton redevient cliquable pour réessayer, message d'erreur annoncé (role=alert). Distinct visuellement du désactivé (danger ≠ atténué). | Échec de soumission — Réessayer |


## Icônes par thème CLAUDETTE (renfort subtil de la couleur)

| Thème | Icône (lucide) | Rationale |
| --- | --- | --- |
| PREAMBLE (préambule) | FileText | Document fondateur / texte introductif — distingue d'emblée le bloc liminaire des clauses normatives. |
| GOVERNING_LAW (droit applicable) | Scale | Balance de la justice = règle de droit applicable ; désambiguïse le violet de PREAMBLE et THIRD_PARTY par la forme. |
| ARBITRATION (arbitrage) | Gavel | Maillet du juge/arbitre = résolution des litiges ; sépare nettement du magenta voisin (PROMOTIONS/THIRD_PARTY). |
| THIRD_PARTY (tiers) | Users | Plusieurs personnes = parties tierces ; forme humaine qui tranche avec les symboles juridiques de la même famille violette. |
| PROMOTIONS (promotions) | Tag | Étiquette commerciale = offres et promotions ; lève l'ambiguïté avec ARBITRATION malgré le magenta proche. |
| WARRANTY (garantie) | ShieldCheck | Bouclier validé = garantie offerte ; forme positive qui distingue du rouge de LIMITATION (déni). |
| LIMITATION (limitation de responsabilité) | ShieldOff | Bouclier barré = exclusion/limitation ; oppose visuellement à WARRANTY dans la même famille rouge — cas jumeau le plus piégeux résolu par la forme. |
| DMCA (retrait de contenu) | Copyright | Symbole de droit d'auteur = notice et retrait DMCA ; distingue du rouge WARRANTY/LIMITATION. |
| ACCEPTABLE_USE (usage acceptable) | CheckCircle | Validation = règles d'usage permis ; forme nette qui sépare des deux autres verts (USER_CONTENT, FEES_PAYMENT). |
| USER_CONTENT (contenu utilisateur) | Upload | Téléversement = contenu publié par l'utilisateur ; tranche avec les autres verts par la métaphore d'action. |
| FEES_PAYMENT (frais & paiement) | CreditCard | Carte = paiement et frais ; lève l'ambiguïté du vert émeraude voisin par une forme financière non équivoque. |
| PRIVACY (confidentialité) | Lock | Cadenas = protection des données personnelles ; métaphore universelle, lisible même en monochrome dense. |
| TERMINATION (résiliation) | LogOut | Sortie = fin de la relation contractuelle ; geste directionnel reconnaissable au scan. |
| CHANGES (modifications des conditions) | RefreshCw | Cycle = révision/mise à jour des termes ; forme rotative distincte au premier coup d'œil. |
| LICENSE (licence) | KeyRound | Clé = droits d'usage concédés ; métaphore d'accès qui se distingue de PRIVACY (verrou). |
| LIABILITY (responsabilité) | AlertTriangle | Triangle d'alerte = engagement de responsabilité ; signal de vigilance immédiat sans recourir au rouge d'état. |
| INDEMNITY (indemnisation) | HandCoins | Main + pièces = dédommagement ; distingue de FEES_PAYMENT par la notion de réparation. |
| DATA_SECURITY (sécurité des données) | ShieldAlert | Bouclier vigilant = mesures de sécurité ; varie la famille bouclier (vs WARRANTY/LIMITATION) par le glyphe d'alerte. |
| DISPUTE (litige) | MessageSquareWarning | Bulle d'alerte = différend/réclamation ; sépare d'ARBITRATION (résolution) par la phase amont du conflit. |
| MISCELLANEOUS (divers) | MoreHorizontal | Points de suspension = clauses résiduelles non catégorisées ; neutre et non mémo-coûteux, signale l'absence de catégorie forte. |


## Palette d'usage (tokens sémantiques)

| Usage | Token | Note |
| --- | --- | --- |
| Validé / succès (clause validée, état succès d'un bouton, accord LLM) | --sem-success | Remplace tous les #34D399 / #34C77B / emerald-400/500/300 et bg-emerald-400. Canaux RGB déjà déclinés clair (52 199 123) / sombre (30 122 77), opacité via <alpha-value>. AA recalculé en clair via readableTextColor. |
| Alerte / attention (adopté non validé, triage à arbitrer, prefill destructeur, divergence LLM, vue-juge) | --sem-warning | Remplace amber-300/400/200, #FBBF24, #F59E0B. Déclinaison clair (224 161 0) / sombre (154 103 0). Le prefill passe en warning pour signaler le caractère destructeur AVANT le clic. |
| Danger / destructif (Désannoter, Supprimer, Effacer, écrasement, erreur de bouton, sévérité haute injustice) | --sem-danger | Remplace red-400, #F43F5E, #EC4899 (repli injustice), #DC2626/#EF4444. Déclinaison clair (242 88 95) / sombre (180 35 42). Réservé aux actions irréversibles et à l'état erreur. |
| Info / secondaire (badge +N multi-label, source LLM, niveau d'info neutre) | --sem-info | Remplace #64B5F6 / #5B9DFF et rgb(100 181 246/0.x). Déclinaison clair (91 157 255) / sombre (12 68 124). Opacité de fond via <alpha-value>, jamais par concaténation hex. |
| Couleur métier de THÈME (20 thèmes CLAUDETTE) — distincte des tokens d'état | --theme-* (par code, injecté via getThemeToken) | Frontière formalisée : une couleur de thème ne doit JAMAIS servir de 'succès/alerte'. Glyphe monochrome en currentColor porté par cette couleur ; jamais l'unique vecteur de sens (forme + libellé en doublure). |
| Niveaux de triage / certitude C1→C5 (token métier, pas token d'état) | --triage-c1..c5 (ex-TRIAGE_LEVEL_META) | Remplace les 5 hex bruts #10B981/#84CC16/#8B5CF6/#F59E0B/#F43F5E. Badge avec texte auto-contrasté (readableTextColor) sur fond translucide ; jauge d'accord doublée d'un motif, pas purement chromatique. |
| Identité de juge LLM (pastilles d'attribution) | --judge-* (ex-LLM_JUDGES identityColor) | Remplace #94A3B8/#A78BFA/#5EEAD4. Contraste AA garanti pour les pastilles ; couleur doublée par initiale/forme. |
| Surfaces & structure (panneaux, lignes, bandeaux d'état, rails de repli) | --panel / --panel-muted / --line / --ink / --bg | Remplace slate-300/400, sky-300/400 dans les bandeaux. Les bandeaux d'état fusionnés s'appuient sur warning/info tokenisés, jamais sur des teintes brutes. |

