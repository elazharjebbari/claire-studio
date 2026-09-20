# Prompt V9.2 — Segmentation thématique pure (la nature est dérivée par script)

> **Version** : V9.2 — segmentation seule. La **`legal_nature` n'est PAS annotée par
> toi** : elle est calculée hors-prompt par `scripts/derive_legal_nature.py`.
> **Pourquoi** : la phase test V9.1 a montré que demander la nature au LLM **dégrade
> la segmentation** (effet de bord, κ thème 0,746→0,690). V9.2 garde la segmentation
> de V9 **intacte** et n'ajoute **rien** à ta charge — au contraire, tu te concentres
> uniquement sur la segmentation thématique.
> **Statut** : phases B (validati (on stratifiée) puis C (50 docs). 2 juges.
> Le prompt est **autonome**.

---

## 0. CE QUE TU LIS, CE QUE TU PRODUIS

**Tu reçois** : ce prompt ; le source `…/Sentences/<doc>.txt` (une phrase tokenisée
par ligne ; ligne `i` ↔ `id = i−1`) ; optionnellement
`…/v9_docfeatures/<doc>_docfeatures.json` (carte déterministe — ancrage).

**Tu produis** : `annotations/v9_2_session<N>_<judge>/<doc>_<judge>.json` avec
`document_plan` et `annotations` (**une entrée par phrase**). Tu **n'annotes pas** la
nature juridique.

---

## 1. PRINCIPE — deux questions par phrase

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

## 2. DEUX TEMPS

- **T1 — segmentation a priori** : lis le **document entier**, produis un
  `document_plan` (segments anticipés : `start_id`, `theme`, justification citant un
  indice).
- **T2 — phrase par phrase** : `theme`, `block_id`, `is_block_start`. **Aux ouvertures
  de bloc seulement** : justification structurée (§5). Continuations : `theme` hérité +
  `reason` court.

---

## 3. VOCABULAIRE — THÈME (liste fermée, ancrée CUAD/LEDGAR)

`PREAMBLE_SCOPE`, `DEFINITIONS`, `ELIGIBILITY_ACCOUNT`, `LICENSE_IP`, `USER_CONTENT`,
`ACCEPTABLE_USE`, `PRIVACY_DATA`, `PAYMENT_BILLING`, `SUBSCRIPTION_RENEWAL`,
`WARRANTY_DISCLAIMER`, `LIABILITY_LIMITATION`, `INDEMNIFICATION`, `TERMINATION`,
`MODIFICATION_OF_TERMS`, `DISPUTE_ARBITRATION`, `GOVERNING_LAW`, `THIRD_PARTY`,
`MISC_BOILERPLATE`, `META`. (`OTHER_<label>` seulement en dernier recours.)

### 3.1 Règles de préséance et rattachement (résolvent les thèmes proches)

- **PI vs contenu** : droits de propriété intellectuelle (licence, copyright, DMCA,
  infraction, marque) → `LICENSE_IP` ; contenu posté/avis/notes/classements →
  `USER_CONTENT`. **En cas de chevauchement, la PI prime.** (DMCA/copyright →
  `LICENSE_IP`, jamais `OTHER_`.)
- **Paiement vs abonnement** : reconduction/essai/renouvellement → `SUBSCRIPTION_RENEWAL` ;
  prix/facturation/taxes/remboursement → `PAYMENT_BILLING`.
- **Responsabilité vs garantie** : limitation de dommages → `LIABILITY_LIMITATION` ;
  absence de garantie (`as is`, `no warranty`) → `WARRANTY_DISCLAIMER`.

---

## 4. RÈGLES DE DÉCISION (T2)

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

## 5. JUSTIFICATION — AUX FRONTIÈRES UNIQUEMENT

Pour chaque `is_block_start = true` : `rationale` (cite un fragment exact) +
`rationale_codes` : `decision_trigger` ∈ { numbering, title_marker, topic_keyword,
lexical_shift, modal_verb, connector, anaphora, exception_marker, definition_marker,
document_start } ; `relation_to_prev` ∈ { opens_new_topic, definition_chain, list_item,
document_start } ; `evidence_span` ; `revised_from_plan` ; `confidence` (0–1).
Continuations : `reason` court seulement.

---

## 6. FORMAT (strict)

```json
{
  "doc": "Atlas", "judge": "claude", "version": "v9.2",
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

**Contraintes** (validateur) : `annotations` = `n` entrées, `id` 0..n−1 ; `theme` ∈ §3
ou `OTHER_*` ; `block_id` depuis 0, contigu non décroissant ; `is_block_start` ⇔ (id 0
ou changement de `block_id`) ; un thème par bloc ; frontières avec `rationale` +
`rationale_codes` + `evidence_span` présent ; `segments[].start_id` ∈ [0,n−1].
**Ne produis AUCUN champ de nature** (il sera ajouté par script).

---

## 7. CHECKLIST

- [ ] `len(annotations)` == lignes non vides ; `id` 0..n−1 ; `block_id` contigus ; un thème/bloc.
- [ ] `is_block_start` cohérent ; id 0 = true ; frontières justifiées (`evidence_span` présent).
- [ ] règles de préséance §3.1 appliquées ; continuité par défaut.
- [ ] **pas de champ de nature** ; aucune consultation d'autres annotations (indépendance).
