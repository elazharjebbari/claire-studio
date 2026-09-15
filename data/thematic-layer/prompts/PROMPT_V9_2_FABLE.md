# Prompt V9.2 — Segmentation thématique pure — juge **Fable** (session 4)

> **Version** : V9.2 — segmentation seule. La **`legal_nature` n'est PAS annotée par
> toi** : elle est calculée hors-prompt par `scripts/derive_legal_nature.py`.
> **Juge** : `fable` (4ᵉ juge, modèle `claude-fable-5` via Claude Code).
> **Pourquoi V9.2** : demander la nature au LLM dégradait la segmentation
> (κ thème 0,746→0,690). V9.2 garde la segmentation **intacte** et n'ajoute rien à ta
> charge — tu te concentres uniquement sur la **segmentation thématique**.
> **Pourquoi ce format exact** : tes annotations seront comparées phrase à phrase à
> celles de trois autres juges (Claude Opus, Codex, Mistral) déjà produites au **même
> format V9.2**. Toute déviation de format casse la mesure d'accord inter-juges.
> Le prompt est **autonome** : tout ce dont tu as besoin est ici.

---

## 0. ⚠ INDÉPENDANCE DES JUGES — RÈGLE ABSOLUE (agent CLI)

Tu tournes dans Claude Code, un agent CLI qui peut scanner tout le dépôt. Pour que la
mesure d'accord inter-juges soit scientifiquement valide, tu annotes **à l'aveugle**.
**Liste blanche stricte — tu n'as le droit de lire QUE** :

- ce prompt (`annotations/PROMPT_V9_2_FABLE.md`) et le runbook
  (`annotations/RUNBOOK_V9_2_FABLE.md`) ;
- le source : `data/raw/claudette_tos/Sentences/<doc>.txt` ;
- la carte déterministe : `data/processed/v9_docfeatures/<doc>_docfeatures.json` ;
- tes propres sorties : `annotations/v9_2_session4_fable/*.json` ;
- en **exécution seule** : `scripts/validate_v9_2_annotations.py` (validation).

**INTERDICTION ABSOLUE** d'ouvrir, lire, lister, `cat`, `grep`, chercher (Grep/Glob)
ou inspecter de quelque manière que ce soit **tout ce qui n'est pas dans la liste
blanche**, en particulier :

- **`docs/` en intégralité** (y compris `docs/reflexion/**/ref_*` qui contient les
  annotations des juges Claude, Codex et Mistral, et `docs/livrables/`) ;
- tout dossier `*_session*`, `v3_*` … `v9_*`, `ref_*` contenant des annotations,
  où qu'il ait été déplacé ;
- **l'historique git** : pas de `git show`, `git log -p`, `git diff`, `git stash`,
  `git checkout` sur des fichiers d'annotation supprimés ou déplacés — l'historique
  contient les annotations des autres juges ;
- tout autre script de `scripts/` (certains encodent des annotations ou des règles
  dérivées des autres juges).

Si un souvenir, une mémoire persistante ou un contexte antérieur mentionne les
annotations ou les scores des autres juges, **ignore-le pour tes décisions
d'annotation**. Si tu consultes le travail d'un autre juge, la mesure d'accord est
invalidée. **Annote à l'aveugle, à partir du seul texte source.**

---

## 1. CE QUE TU LIS, CE QUE TU PRODUIS

**Tu reçois** : ce prompt ; le source `…/Sentences/<doc>.txt` (une phrase tokenisée par
ligne ; **ligne `i` ↔ `id = i−1`**) ; la carte `…/v9_docfeatures/<doc>_docfeatures.json`
(ancrage déterministe : nb de phrases, indices de titres, estimation du nombre de blocs).

**Tu produis** : un seul fichier
`annotations/v9_2_session4_fable/<doc>_fable.json` avec `document_plan` et
`annotations` (**une entrée par phrase**). Tu **n'annotes pas** la nature juridique.

> **Ancrage déterministe (anti off-by-one)** : avant d'écrire, compte les lignes non
> vides du source : `grep -cve '^[[:space:]]*$' data/raw/claudette_tos/Sentences/<doc>.txt`.
> Ce nombre `n` est **le nombre exact d'entrées** que `annotations` doit contenir, avec
> `id` allant de `0` à `n−1` sans trou. C'est la première cause d'échec : vérifie-la.

---

## 2. PRINCIPE — deux questions par phrase

| Question | Champ |
|---|---|
| **De quel sujet juridique parle la phrase ?** | `theme` (porte la segmentation) |
| **Cette phrase ouvre-t-elle une nouvelle clause ?** | `is_block_start` (+ `block_id`) |

Invariants : **mapping 1-N** (une entrée par phrase, `id` 0..n−1) ; **un bloc = un
thème** ; **la frontière naît du changement de thème, qualifiée par un effet juridique
autonome** (une phrase qui prolonge — conséquence, procédure, effet, reformulation —
**n'ouvre pas** de clause, même si elle aborde un point nouveau). **Continuité par
défaut** : dans le doute, continuer.

---

## 3. DEUX TEMPS

- **T1 — segmentation a priori** : lis le **document entier**, produis un
  `document_plan` (segments anticipés : `start_id`, `theme`, justification citant un
  indice).
- **T2 — phrase par phrase** : `theme`, `block_id`, `is_block_start`. **Aux ouvertures
  de bloc seulement** : justification structurée (§6). Continuations : `theme` hérité +
  `reason` court.

---

## 4. VOCABULAIRE — THÈME (liste fermée, ancrée CUAD/LEDGAR)

`PREAMBLE_SCOPE`, `DEFINITIONS`, `ELIGIBILITY_ACCOUNT`, `LICENSE_IP`, `USER_CONTENT`,
`ACCEPTABLE_USE`, `PRIVACY_DATA`, `PAYMENT_BILLING`, `SUBSCRIPTION_RENEWAL`,
`WARRANTY_DISCLAIMER`, `LIABILITY_LIMITATION`, `INDEMNIFICATION`, `TERMINATION`,
`MODIFICATION_OF_TERMS`, `DISPUTE_ARBITRATION`, `GOVERNING_LAW`, `THIRD_PARTY`,
`MISC_BOILERPLATE`, `META`. (`OTHER_<label>` seulement en tout dernier recours ; évite-le.)

### 4.1 Règles de préséance et rattachement (résolvent les thèmes proches)

- **PI vs contenu** : droits de propriété intellectuelle (licence, copyright, DMCA,
  infraction, marque) → `LICENSE_IP` ; contenu posté/avis/notes/classements →
  `USER_CONTENT`. **En cas de chevauchement, la PI prime.** (DMCA/copyright →
  `LICENSE_IP`, jamais `OTHER_`.)
- **Paiement vs abonnement** : reconduction/essai/renouvellement → `SUBSCRIPTION_RENEWAL` ;
  prix/facturation/taxes/remboursement → `PAYMENT_BILLING`.
- **Responsabilité vs garantie** : limitation de dommages → `LIABILITY_LIMITATION` ;
  absence de garantie (`as is`, `no warranty`) → `WARRANTY_DISCLAIMER`.
- **Éligibilité vs paiement** : âge/compte/création → `ELIGIBILITY_ACCOUNT` ;
  frais d'accès au compte → `PAYMENT_BILLING`.

---

## 5. RÈGLES DE DÉCISION (T2)

1. **META** (date, adresse, URL, identité d'entité) → `theme = META`.
2. **Titre nominal court** (sans verbe conjugué, ≤ ~12 mots) → `is_block_start = true`,
   `theme` de la section.
3. **Item de liste** → hérite du thème du chapeau ; `is_block_start = false` sauf effet
   autonome.
4. **Prolongement** (conséquence/procédure/effet/reformulation/exemple d'un thème déjà
   ouvert) → `is_block_start = false`, thème hérité.
5. **Nouveau sujet + effet juridique autonome** → `is_block_start = true`, nouveau
   `theme` + justification.
6. Sinon → continuation.

---

## 6. JUSTIFICATION — AUX FRONTIÈRES UNIQUEMENT

Pour chaque `is_block_start = true` : `rationale` (cite un fragment exact de la phrase) +
`rationale_codes` :

- `decision_trigger` ∈ { `numbering`, `title_marker`, `topic_keyword`, `lexical_shift`,
  `modal_verb`, `connector`, `anaphora`, `exception_marker`, `definition_marker`,
  `document_start` } ;
- `relation_to_prev` ∈ { `opens_new_topic`, `definition_chain`, `list_item`,
  `document_start` } ;
- `evidence_span` : **un fragment littéral** (sous-chaîne exacte) de la phrase `id` ;
- `revised_from_plan` (bool) ; `confidence` (0–1).

Continuations (`is_block_start = false`) : `reason` court seulement.

---

## 7. FORMAT (strict)

```json
{
  "doc": "Spotify", "judge": "fable", "version": "v9.2",
  "document_plan": {"estimated_n_blocks": 12, "rationale_global": "…",
    "segments": [{"start_id": 0, "theme": "PREAMBLE_SCOPE", "rationale": "…", "evidence_span": "these terms"}]},
  "annotations": [
    {"id": 0, "theme": "PREAMBLE_SCOPE", "block_id": 0, "is_block_start": true,
     "rationale": "ouverture, cite « these terms … govern »",
     "rationale_codes": {"decision_trigger": "document_start", "relation_to_prev": "document_start",
        "evidence_span": "these terms", "revised_from_plan": false, "confidence": 0.95}},
    {"id": 1, "theme": "PREAMBLE_SCOPE", "block_id": 0, "is_block_start": false, "reason": "acceptation"}
  ]
}
```

**Contraintes (validateur, bloquant)** : `annotations` = exactement `n` entrées (= lignes
non vides du source) ; `id` 0..n−1 dans l'ordre ; `theme` ∈ §4 (ou `OTHER_*`) ;
`block_id` depuis 0, **contigu non décroissant** (`prev` ou `prev+1`) ; `is_block_start`
⇔ (`id == 0` **ou** changement de `block_id`) ; **un seul thème par `block_id`** ;
chaque frontière a `rationale` + `rationale_codes` valides + `evidence_span` (idéalement
littéral) ; `segments[].start_id` ∈ [0,n−1].
**`doc`** doit valoir le nom exact du fichier (ex. `Betterpoints_UK`, `Moves-app`,
`PokemonGo`). **`judge` = `"fable"`**. **Ne produis AUCUN champ de nature**.

---

## 8. CHECKLIST (avant de passer au doc suivant)

- [ ] `len(annotations)` == lignes non vides du source ; `id` 0..n−1 ; `block_id` contigus ; un thème/bloc.
- [ ] `is_block_start` cohérent ; `id 0` = `true` ; frontières justifiées (`evidence_span` présent).
- [ ] règles de préséance §4.1 appliquées ; **continuité par défaut**.
- [ ] **pas de champ de nature** ; **aucune consultation des autres juges ni de `docs/`
      ni de l'historique git** (indépendance §0).
- [ ] le validateur passe à **0 erreur** sur ce fichier (voir runbook §4).
