# Plan opérationnel — 25 jours (11 août → 5 septembre 2026)

> Trois vagues. **V0 est gratuite et débloque tout le reste** ; V1 conditionne l'exactitude des
> chiffres ; V2 conditionne le passage en *long*. Deadline JURIX **à revérifier à la source**.

---

## V0 — Débloquer la redondance (J0–J2, coût d'annotation nul)

**Action unique : faire soumettre les 10 brouillons de `fatima.ouali`.**

Ce sont des annotations abouties (1 030/1 031 clauses validées, 47,6 % de divergence avec le
meilleur LLM) qui restent en `draft` — donc **invisibles pour tous les calculs d'IAA**, qui ne
retiennent que `submitted / in_review / approved`.

| Avant | Après |
|---|---|
| 4 documents multi-annotés | **7** (dont Endomondo partiel) |
| 0 document en triple annotation | **3** (Academia, 9gag, Atlas) |
| **1** paire d'annotateurs mesurée | **3** paires |
| ~783 phrases multi-annotées | ~1 000 |

**À vérifier avec elle avant de soumettre :** Endomondo est à **59 phrases sur 498** — soit
elle le termine, soit on l'exclut des calculs (ne jamais faire entrer une annotation partielle
dans un IAA). Les 9 autres sont complets.

**Second geste, optionnel :** `elazhar.jebbari` termine **Amazon** (102/132 déjà validées) →
8ᵉ document multi-annoté. Betterpoints_UK, Booking et Crowdtangle ne sont pas commencés (0–6 %
validés) : les laisser.

> ⛔ **Rien d'autre ne doit commencer avant V0.** Tous les chiffres du papier sont à recalculer
> après, et il serait absurde de les produire deux fois.

---

## V1 — Correctifs plateforme qui conditionnent l'exactitude (J2–J7)

Quatre correctifs, par ordre de criticité. Aucun n'est gros ; tous sont bloquants pour au moins
une expérience.

### V1.1 — 🔴 `boundaryKappa` mesure un artefact *(bloque E3)*
`project_iaa_detail` calcule l'accord de frontières sur les **ancres de clause**, or chaque
phrase en porte une → κ = 1,000 par construction. **Publier ce chiffre serait une erreur
factuelle.**
→ Recalculer sur les **frontières reconstruites** (début de plage de thèmes identiques). Valeur
attendue : Jaccard 0,39–0,63. *Fichier : `backend/claire/projects/iaa.py`.*

### V1.2 — 🔴 Persister le juge de pré-remplissage *(bloque E4, et le papier 2027)*
Le front connaît `seededFrom: "preannotation:<judge>"` ; le serveur ne l'enregistre pas. Sans
ce champ, « l'annotateur est d'accord avec Claude » et « l'annotateur est parti de Claude » sont
indiscernables.
→ Ajouter `Clause.seeded_from` (ou `Annotation.prefill_judge`), l'écrire à la soumission, et
**backfiller ce qui est inférable**. Pour les annotations existantes, la valeur restera inconnue :
c'est une limite à déclarer, pas à masquer.
*Effet de bord utile : c'est aussi ce qui rend possible le papier « ancrage » de 2027.*

### V1.3 — 🟠 Exporter la couche « soft labels » *(bloque la contribution 4 et E5)*
`GoldSentence.tally` (masse de poids par thème) est en base mais absent de `gold_records()`.
C'est **la** réponse à Braun 2023 — le désaccord préservé — et elle n'est pas livrable.
→ Ajouter `tally` + votes par annotateur à l'export.
*Fichier : `backend/claire/gold/export.py`.*

### V1.4 — 🟡 Revérifier la sévérité CLAUDETTE à la source
Les 1 137 `ReferenceLabel` sont **tous de niveau 1**, alors que le loader sait lire `1/2/3`.
→ Vérifier `ToS.zip` (EUI). Si les niveaux existent, ré-importer ; sinon, ne jamais écrire
« 3 niveaux de sévérité » dans le papier.

**Hors périmètre 2026** (utile mais non bloquant) : export d'hypergraphe, tableau de bord
« prêt pour la science », décision sur `certainty`. Ils appartiennent au papier B et à 2027.

---

## V2 — Sur-annotation ciblée (J7–J17) — conditionne le passage en *long*

**Objectif :** passer de 7 à **≥ 12 documents multi-annotés, dont ≥ 5 triples**.

**Principe de sélection — stratifié, pas opportuniste.** Choisir les documents à doubler selon
trois critères simultanés :
1. **Courts** (60–150 phrases) : maximiser le nombre de documents, pas de phrases — l'IC
   bootstrap se calcule *au niveau document*.
2. **Riches en thèmes rares** : c'est là que la fiabilité s'effondre (`META` κ 0,42,
   `FEEDBACK` 0,34 % du corpus) et donc là que la mesure a de la valeur.
3. **Déjà annotés une fois** : doubler coûte moins que partir de zéro.

**Candidats naturels** (déjà 1 annotateur soumis, courts) : Moves-app (75), Crowdtangle (78),
Uber (118), Dropbox (121), Facebook (146), Deliveroo (143), Duolingo (140).
**À compléter en triple** : Google (93) et Netflix (86), qui seront à 2 après V0.

**Ordre de priorité :** compléter en **triple** d'abord (Google, Netflix), puis élargir en
double. Trois documents triples de plus valent mieux que six doubles de plus.

**Budget réaliste :** ~100 phrases/document × 5 documents × 2 annotateurs ≈ 1 000 phrases
d'annotation. Au rythme observé (zahra : 6 725 phrases soumises entre le 23 juin et le 9 août),
c'est **atteignable en 10 jours** — à condition que ce soit la seule chose demandée sur la
période.

**En parallèle : finaliser ≥ 3 résolutions gold** (3 existent, aucune finalisée) pour débloquer
E5 et la contribution « protocole ».

---

## Calendrier et points de décision

| Jour | Ce qui se passe | Point de décision |
|---|---|---|
| **J0–J2** | **V0** : soumission des brouillons de fatima ; statut d'Endomondo tranché | — |
| **J2–J7** | **V1.1–V1.4** ; recalcul **complet** de toutes les mesures sur la nouvelle base | — |
| **J7** | Les chiffres définitifs de E1/E2/E4 sont connus | 🔶 **R1 et R2 tiennent-ils avec 3 paires ?** Si α-MASI reste < α nominal et si l'écart humain/LLM se confirme → on écrit. Sinon, on réoriente. |
| **J7–J17** | **V2** : sur-annotation ciblée + finalisation gold ; rédaction du *short* en parallèle | — |
| **J10** | Décompte : documents multi-annotés, triples, gold finalisés | 🔶 **Short ou long ?** ≥12 docs / ≥5 triples / ≥3 gold → *long*. Sinon *short*, sans regret. |
| **J17–J23** | Rédaction, figures, relecture ; script de reproductibilité gelé | — |
| **J23–J25** | Marge de sécurité (soumission, format, quotas) | — |

---

## Discipline de reproductibilité — à tenir dès J0

1. **Un export daté** de la base sert de source unique à tous les chiffres. Aucun résultat ne
   provient d'une requête ad hoc non versionnée.
2. **Un dépôt d'analyse** (scripts + notebook) versionné avec le papier ; chaque tableau du
   papier est produit par une cellule identifiable.
3. **Les mesures sont recalculées intégralement après V0 et après V2** — les chiffres de
   [`01_MATERIAU.md`](01_MATERIAU.md) sont un instantané du 11 août, pas des résultats.
4. **Chaque limite de §5 de [`02_STRATEGIE.md`](02_STRATEGIE.md) apparaît dans le papier.** Un
   relecteur qui trouve lui-même une limite non déclarée rejette ; un relecteur qui la trouve
   déclarée et traitée accepte.

---

## Le risque principal, nommé

**Ce n'est pas le manque de données — c'est de continuer à préparer le papier de 2027 avec les
25 jours de 2026.** Le dossier initial vise une ressource complète ; le matériau dit qu'elle
n'existera pas avant plusieurs mois. Le seul scénario perdant est celui où l'on passe trois
semaines à essayer d'y arriver et où l'on ne soumet rien — alors que trois résultats mesurés
attendent d'être écrits.
