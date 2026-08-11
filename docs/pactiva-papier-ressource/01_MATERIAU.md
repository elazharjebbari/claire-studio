# Le matériau réel — inventaire au 11 août 2026

> Ce que contient la base de production, sans arrondi favorable. Toute stratégie qui contredit
> ce document est une stratégie qui échouera à la relecture.

---

## 1. Vue d'ensemble

```
Corpus        50 ToS CLAUDETTE · 9 414 phrases (EN)
              ReferenceLabel (abusivité) : 1 137 labels sur 1 032 phrases (11,0 %), 50/50 docs
Vocabulaire   20 thèmes (scheme claire-themes-v1), multi-label natif (1 primaire + n secondaires)
Annotations   50 au total : 35 soumises · 15 brouillons
Clauses       9 148 · 12 199 étiquettes de thème · 2 731 clauses multi-thèmes (29,9 %)
Juges LLM     4 × 50 documents (fable, claude, codex, mistral) — référence, hors conflit
```

**Unité d'annotation réelle : la phrase.** Le pré-remplissage d'un modèle est *déplié par
phrase* avant édition, donc chaque phrase porte exactement une clause. Les « clauses » au sens
segment se **reconstruisent** a posteriori comme plages de phrases consécutives portant le même
jeu de thèmes (7 508 phrases soumises → **3 290 segments**, compression ×2,28).
→ **Le papier doit assumer « sentence-level multi-label theme annotation ».** C'est ce que
l'utilisateur a lui-même formulé, et c'est exact.

---

## 2. La répartition du travail — le fait dominant

| Annotateur | Annotations | Soumises | Phrases soumises | Clauses validées | Divergence / meilleur LLM |
|---|---:|---:|---:|---:|---:|
| **zahra.boulaich** | 32 | **31** | **6 725** | 6 725 / 6 883 (97,7 %) | 50,3 % |
| **fatima.ouali** | 10 | **0** | 0 | 1 030 / 1 031 (**99,9 %**) | 47,6 % |
| **elazhar.jebbari** | 8 | 4 | 783 | 892 / 1 234 (72,3 %) | 38,1 % |

> **90 % des phrases soumises viennent d'une seule personne.** C'est le fait qui gouverne toute
> la stratégie : on ne peut pas présenter comme « ressource multi-annotée » un corpus dont
> l'essentiel est mono-annoté.

**Corollaire souvent manqué :** l'α-MASI de 0,635 publié aujourd'hui ne mesure qu'**une seule
paire** (zahra ↔ elazhar), sur 4 documents. Ce n'est pas une mesure de fiabilité
inter-annotateurs, c'est une mesure de compatibilité entre deux personnes.

---

## 3. Couverture multi-annotateur, document par document

**État actuel (annotations soumises) :**

| Documents | Nombre | Phrases |
|---|---:|---:|
| ≥ 2 annotateurs soumis | **4** (Airbnb, Academia, 9gag, Atlas) | 783 |
| 1 seul annotateur soumis | 27 | 5 942 |
| Aucune annotation soumise | 19 (dont **14 jamais ouverts**) | 2 689 |

**Les 10 brouillons de `fatima.ouali` — le gisement caché :**

| Document | Phrases | Validées | Divergence LLM | Autres annotateurs (soumis) | Effet si soumis |
|---|---:|---:|---:|---|---|
| Academia | 193 | 192 (99,5 %) | 102 | zahra, elazhar | → **triple** |
| 9gag | 139 | 139 (100 %) | 77 | zahra, elazhar | → **triple** |
| Atlas | 60 | 60 (100 %) | 21 | zahra, elazhar | → **triple** |
| Google | 93 | 93 (100 %) | 43 | zahra | → double |
| Netflix | 86 | 86 (100 %) | 55 | zahra | → double |
| Endomondo | 59/498 | 59 (100 %) | 17 | zahra | → double **partiel** |
| Vivino | 125 | 125 (100 %) | 51 | — | reste simple |
| WhatsApp | 98 | 98 (100 %) | 46 | — | reste simple |
| TrueCaller | 98 | 98 (100 %) | 47 | — | reste simple |
| Twitter | 80 | 80 (100 %) | 32 | — | reste simple |

**Ce sont de vraies annotations, pas des pré-remplissages laissés en l'état** : 99,9 % de clauses
explicitement validées, et un taux de divergence avec le meilleur juge LLM (47,6 %) du même ordre
que celui de l'annotatrice principale (50,3 %).

**Après soumission :** 7 documents multi-annotés (dont **3 en triple**), **3 paires**
d'annotateurs au lieu d'une, ~1 000 phrases multi-annotées. C'est le minimum syndical pour
parler de fiabilité inter-annotateurs.

**Les 4 brouillons d'`elazhar.jebbari`** sont d'un autre ordre : Amazon 102/132 validées (77 %),
mais Betterpoints_UK 7/113 (6 %), Booking 0/128, Crowdtangle 0/78 — **non commencés**. Seul
Amazon est récupérable à court terme.

---

## 4. Les mesures de fiabilité disponibles

### 4.1 Accord inter-annotateurs

| | Soumis (4 docs, 4 paires) | Brouillons inclus (11 docs, 17 paires) |
|---|---:|---:|
| κ de Cohen (thème primaire, par phrase) | **0,769** | 0,650 |
| **α de Krippendorff–MASI** (multi-label) | **0,635** | 0,503 |
| α nominal (mono-label, même matériau) | — | **0,701** |
| κ « frontières » tel que calculé aujourd'hui | 1,000 ⚠️ | 0,941 ⚠️ |
| Jaccard des frontières **reconstruites** | **0,39 – 0,63** | — |

⚠️ Le κ de frontières vaut 1,0 **par construction** (chaque phrase porte une ancre). L'indicateur
publié par la plateforme est trompeur et doit être corrigé avant toute citation — le vrai accord
de segmentation est **0,39–0,63**, et c'est un résultat en soi (la frontière est bien plus dure
que le thème).

**Par thème** (annotations soumises) : `PRIVACY_DATA` 0,89 · `FEES_PAYMENT` 0,84 ·
`ARBITRATION_DISPUTES` 0,83 · `THIRD_PARTY_SERVICES` 0,82 · `WARRANTY_DISCLAIMER` 0,79 …
`MISC_BOILERPLATE` 0,57 · **`META` 0,42** (support 9).

### 4.2 Accord humain ↔ LLM (sur clauses validées)

| Annotateur | fable | claude | codex | mistral |
|---|---:|---:|---:|---:|
| elazhar.jebbari | 53,0 % | **59,5 %** | 33,0 % | 42,8 % |
| fatima.ouali | 50,6 % | **50,8 %** | 31,6 % | 38,7 % |
| zahra.boulaich | 43,1 % | **48,3 %** | 34,9 % | 29,6 % |

### 4.3 Accord entre juges LLM (référence, 9 414 phrases)

```
claude ↔ fable    81,5 %      claude ↔ mistral  57,2 %      codex ↔ fable    48,6 %
fable  ↔ mistral  55,9 %      claude ↔ codex    47,5 %      codex ↔ mistral  34,0 %
```

**Lecture cumulée de 4.1–4.3 — le cœur scientifique du papier :**
- Humain ↔ humain : κ 0,769, soit **~80 % d'accord brut**.
- Humain ↔ meilleur LLM : **48–60 %**.
- LLM ↔ LLM : **34–81 %** (et Claude/Fable sont quasi redondants entre eux).

→ **Le « mur du κ » n'est pas une limite de la tâche, c'est une limite des LLM.** Des humains
formés font nettement mieux, sur exactement le même matériau et le même vocabulaire. C'est le
résultat que le programme cherchait, et il est déjà là.

---

## 5. Ce qui n'est PAS publiable en l'état

| Élément promis par le dossier initial | Réalité |
|---|---|
| « unité = **clause** (frontières) » comme delta vs CLAUDETTE | ❌ L'unité est la **phrase** ; la clause est dérivée |
| « **certitude 0–3** par clause » | ❌ `certainty` = **0 partout** (6 697 clauses), valeur par défaut du pivot, aucune variance |
| « **rationale** + span d'évidence » humains | ❌ 6 696 valeurs, mais **recopiées du LLM** par le seed (« titre du document ») |
| « **3 annotateurs × 50 ToS** » | ❌ 4 docs à ≥2 annotateurs soumis ; 1 seule paire mesurée |
| « 8 catégories + **3 niveaux de sévérité** » CLAUDETTE | ❌ Les 1 137 labels sont **tous de niveau 1** (source binaire — à revérifier à l'EUI) |
| Publication **soft labels / votes bruts** | ❌ `GoldSentence.tally` est en base mais absent de `gold_records()` |
| `legal_nature` (nature déontique) | ✅ **0/9 148** — le point est confirmé, la couche déontique reste bien une prédiction |

---

## 6. Ce qui est acquis et solide

- **α-MASI implémenté et testé** (`projects/masi.py`), avec son contrôle de cohérence
  « mono ⇒ α nominal ». Pas à écrire, juste à exploiter.
- **Cascade de résolution déployée** (`gold_scoring.py` + app `gold/`) : accord strict → auto,
  majorité ≥2/3 → auto, divergence → arbitrage humain tracé, gold figé une fois finalisé. Le
  **protocole de gold est une contribution méthodologique réelle** — et il est outillé.
- **Quatre juges LLM sur les 50 documents**, en référence stricte (jamais parties au conflit).
  Comparateur gratuit et complet.
- **`ReferenceLabel` CLAUDETTE sur 50/50 documents** — cible d'évaluation externe disponible.
- **Distribution thématique exploitable** : de `PREAMBLE_SCOPE` (12,7 %) à `FEEDBACK` (0,34 %) —
  une longue traîne réaliste, propice à l'analyse micro/macro.
- **Traces d'activité** : `clause.added` 4 411, `clause.updated` 3 606, `clause.deleted` 452 —
  matériau de comportement d'annotateur (partiel, l'audit ne couvre pas toute l'historique).

---

## 7. Le trou de traçabilité à combler d'urgence

**Le juge ayant servi de pré-remplissage n'est pas persisté.** Le front connaît
`seededFrom: "preannotation:<judge>"` et `prefilledJudge`, mais aucun champ `Clause` /
`Annotation` ne l'enregistre côté serveur (seul `pivot.ts:146` le fait transiter à l'export).

**Pourquoi c'est bloquant :** sans cette information, on ne peut pas distinguer
« l'annotateur est d'accord avec Claude » de « l'annotateur est parti de Claude et n'a pas tout
changé ». Or c'est exactement ce qu'un relecteur JURIX demandera — le **biais d'ancrage**
(*automation bias*) est la menace de validité n°1 d'un corpus post-édité.

**Bonne nouvelle :** les taux d'accord humain↔LLM (43–60 %) sont **très loin** des ~95 % qu'on
observerait si les annotateurs ratifiaient le pré-remplissage. L'ancrage total est donc exclu.
Mais pour l'écrire proprement, il faut le champ. Voir [`03_PLAN_OPERATIONNEL.md`](03_PLAN_OPERATIONNEL.md) §V1.
