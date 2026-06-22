# Compréhension du protocole (analyse fine)

Source : `CLAIRE/docs/reflexion/2026-06-22_protocole-annotation-multilabel/`
(`PROTOCOLE.md`, `GUIDE_ANNOTATEUR.md`, `SCHEMA.md`, `VOCABULAIRE.md`, `exemples/`).

## 1. Principes fondateurs (ce que le système DOIT respecter)
1. **Effort proportionnel à l'incertitude** (triage / active learning) : toutes les
   phrases sont validées par un humain, mais un clic groupé pour le consensus, un
   arbitrage complet pour le dissensus.
2. **La confiance se dérive de l'ACCORD inter-juges, JAMAIS de la `confidence`
   auto-déclarée d'un modèle** (Mistral mesuré à 0,956 de confiance alors qu'il est le
   plus en désaccord → signal écarté). ⇒ **Conséquence de design : ne pas réutiliser la
   certitude 0–3 comme niveau ; dériver C1–C5 de l'accord.**
3. **Multi-label natif** : une phrase/clause peut porter un *ensemble* de thèmes
   (primaire + secondaires). On ne force plus « un thème par bloc ».
4. **Frontières non rigides** : la frontière est **découplée** de l'étiquette
   (dure vs molle) ; un glissement de sujet sur un cluster devient **multi-label**, pas
   une nouvelle frontière (supprime la sur-segmentation).
5. **Traçabilité** : tout override automatique est **journalisé et réversible**.

## 2. Les deux signaux (par phrase), N-way (K ≥ 2 juges)
- **Accord de thème** : unanime 3/3 (29,5 %) · majorité 2/3 (50,2 %) · éclaté 1/1/1 (20,3 %).
- **Accord de frontière** (`is_block_start`) : unanime 65,2 % · dissensus 34,8 %
  (κ Fleiss frontière = 0,184 → frontières non rigides justifiées).

## 3. Les 5 niveaux (partition EXACTE du corpus)
| Niveau | Définition (accord) | Mode | Action humaine | needs_human |
|---|---|---|---|---|
| **C1 — Or** | thème 3/3 **et** frontière 3/3 | mono | `batch_accept` | non |
| **C2 — Haute** | thème 3/3 + frontière molle (2/3) **ou** majorité avec override refuge→précis | mono | `confirm` | oui |
| **C3 — Multi-label** | désaccord sur un **couple de cluster** | **multi** | `validate_set` | oui |
| **C4 — Majorité** | majorité 2/3 hors refuge/cluster | mono | `verify` | oui |
| **C5 — Arbitrage** | éclaté refuge/bruit | open | `arbitrate` | oui |

## 4. Arbre de décision (le cœur du moteur)
```
votes thème (3) + votes is_block_start (3) :

thème unanime 3/3 ─┬ frontière 3/3 ............................. C1  batch_accept (mono)
                   └ frontière 2/3 ............................. C2  confirm      (mono)

thème majorité 2/3 ┬ dissident ∈ {PREAMBLE_SCOPE, MISC_BOILERPLATE} .. C2 confirm (override refuge→précis)
                   ├ {majorité, dissident} ∈ CLUSTERS ........... C3  validate_set (multi)
                   └ sinon ....................................... C4  verify       (mono = majorité)

thème éclaté 1/1/1 ┬ un couple CLUSTER présent (sans refuge) .... C3  validate_set (multi)
                   └ sinon (refuge/bruit) ....................... C5  arbitrate    (open, 3 candidats)
```

## 5. Règles de pré-résolution
1. **Override anti-refuge** (→ C2) : 2 juges « précis » + 1 juge « refuge »
   (`PREAMBLE_SCOPE`/`MISC_BOILERPLATE`) ⇒ on **impose le précis**. Justifié : refuges =
   thèmes les moins fiables (κ 0,18 / 0,27 vs 0,73). **Réversible + journalisé.**
2. **Cluster → multi-label** (→ C3) : désaccord sur un couple de cluster = chevauchement
   juridique **réel** ⇒ on conserve **les deux** thèmes.
3. **Refuge jamais en secondaire** : un refuge n'est jamais étiquette secondaire d'un
   multi-label (soit unique d'un vrai boilerplate, soit écarté).

## 6. Choix du PRIMAIRE (multi-label)
1. **Préséance directionnelle documentée** : `LICENSE_IP` > `USER_CONTENT` ;
   `LICENSE_IP` > `ACCEPTABLE_USE` (la PI prime).
2. sinon **majorité de votes**.
3. sinon **liste de priorité** (DEFINITIONS > DISPUTE_ARBITRATION > … > refuges en queue).
Le secondaire = l'autre membre du cluster. L'humain **permute en 1 clic**.

## 7. Clusters éligibles au multi-label (7 couples mesurés)
`LICENSE_IP↔USER_CONTENT` · `ACCEPTABLE_USE↔LICENSE_IP` · `ACCEPTABLE_USE↔USER_CONTENT` ·
`PAYMENT_BILLING↔SUBSCRIPTION_RENEWAL` · `LIABILITY_LIMITATION↔WARRANTY_DISCLAIMER` ·
`ELIGIBILITY_ACCOUNT↔PAYMENT_BILLING` · `ACCEPTABLE_USE↔ELIGIBILITY_ACCOUNT`.

## 8. Frontières dures / molles
- **Dure (▮)** : 3/3 ou portée par numérotation/titre → segmentation stable.
- **Molle (┄)** : 2/3, d'origine thématique → **découpe optionnelle** (fusion/scission 1 clic).
- Glissement de sujet **intra-clause** ⇒ multi-label, **pas** de nouvelle frontière.
- Mesures séparées : κ frontière, Pk (0,32), WindowDiff (0,40).

## 9. Modèle de données attendu (cf. SCHEMA.md)
- **Item de file** (sortie du triage) : `{doc, id, text, judges{judge→{theme,is_block_start}},
  confidence_level, human_action, disagreement_type, proposal{boundary, label_mode, labels[], candidates[], override?}, needs_human}`.
- **Clause validée** : `{span{start_id,end_id}, boundary{type,support,trigger,validated_by},
  themes[{label,role}], confidence_level, provenance{judges}, audit[]}`.
- **Invariants** : ≥1 thème ; **exactement un `primary`** ; refuge jamais `secondary` ;
  clauses **contiguës et couvrantes** ; soft ⇒ fusion/scission possible tant que non validée.
- **Rétro-compatibilité** : mono-label = liste de taille 1 (rôle primary) ; convertisseur
  trivial `theme → [{label, role:primary}]`.

## 10. Métriques & garde-fous
- **α Krippendorff-MASI** = indicateur tête de gondole (intègre le multi-label) ; 0,422
  aujourd'hui, cible ≥ 0,67 après validation humaine. Sanity-check : α = κ sur mono.
- κ frontière 0,184 → cible ≥ 0,60 (dures). Pk/WindowDiff à baisser.
- **Garde-fous** : fiabilité ≠ validité ; ne jamais pondérer par la confidence d'un
  modèle ; surveiller le biais par juge (refuge) ; le « plafond modéré » reflète une
  ambiguïté juridique réelle (que le multi-label **assume** au lieu de masquer).

## 11. Implications directes pour le système (extraites de l'analyse)
| Exigence protocole | Implication système |
|---|---|
| Confiance = accord, pas auto-déclaration | C1–C5 **dérivé** de `agreementNway` (déjà dispo), **distinct** de la certitude 0–3 |
| Multi-label natif | `Clause.themes[]` (primaire+secondaires), refuge jamais secondaire |
| Frontière dure/molle | `boundary{type,support}` stocké + proposé (fusion/scission) |
| Override anti-refuge réversible | trace `audit[]` + bouton « annuler l'override » |
| Primaire par préséance/majorité/priorité | table `PRECEDENCE`/`PRIORITY` versionnée (YAML) |
| Effort proportionnel | **file de triage** par niveau + gestes par niveau |
| Explication (contexte/décision/logique) | **dérivée de la règle** qui s'applique, déterministe |
| Traçabilité | provenance (votes K juges) + audit conservés et réversibles |
