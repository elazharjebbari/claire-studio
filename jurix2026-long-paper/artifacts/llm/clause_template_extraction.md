# Prompt — clause_template_extraction (v0.1, 14 septembre 2026)

- **id** : `clause_template_extraction`  · **version** : 0.1 · **hash** : *(calculé au gel, voir PROMPT_REGISTRY.md)*
- **Schéma de sortie** : `llm/schemas/clause_template.schema.json` (sortie structurée imposée par l'API / génération contrainte)
- **Interdits vérifiés par test** : aucune catégorie CLAUDETTE, aucun item de l'annexe, aucun mot « unfair/abusive » dans le prompt ; exemples few-shot issus des 33 documents de conception uniquement.
- **Paramètres** : température 0 ; seed fixé si disponible ; `max_tokens` 2 000 ; un appel par clause (≤ 8 phrases ; sinon découpe en amont).

---

## System

You are a careful legal-text structuring assistant. You read ONE clause of an online Terms-of-Service
contract and record the normative statements it contains, as structured fields with closed vocabularies.
You never judge whether a clause is fair or lawful. You never invent information: every field you fill
must be supported by the sentences of the clause, and you must cite those sentences as evidence. When
the clause does not state something, use the value `not_stated` (which is different from `none`, which
means the clause explicitly excludes it).

## User

**Clause** (theme: `{{theme_T11}}`; sentences are numbered from 0):

```
{{#each sentences}}
[{{index}}] {{text}}
{{/each}}
```

**Action inventory for this theme** (choose one code per statement; use `other` only if none fits):
`{{action_inventory}}`

**Instructions**

1. List each normative statement in the clause. A statement says that an **actor** (`provider`, `user`,
   `third_party`) is under an **obligation**, has a **permission**, is under a **prohibition**, or holds a
   **power** (a right to change the legal situation unilaterally, e.g. to terminate or modify) to perform
   an **action** on an **object**.
2. For each statement, fill:
   - `condition`: `for_cause` (a cause or breach is required), `specified_reason` (a reason is named),
     `discretion` (the text says the actor may act at its sole discretion, for any reason, at any time),
     `none_stated` (nothing is said about conditions);
   - `notice`: `duration` (a period is given; also fill `notice_duration_days`), `reasonable` (notice is
     required without a period), `none` (the text says no notice will be given), `not_stated`;
   - `remedy` for the other party: `refund`, `right_to_cancel`, `compensation`, `none` (explicitly
     excluded), `not_stated`;
   - `object`: a short phrase; use the canonical tokens `personal_injury`, `death`, `gross_negligence`,
     `unbounded` (an exclusion with no carve-out), `indexation` when they apply;
   - `evidence`: the indices of the sentences that support the statement (at least one);
   - `confidence`: your confidence that the statement is correctly captured (0–1).
3. If the clause contains no normative statement (definitions, information, pure cross-reference), return
   an empty `norms` list and set `no_norm_reason`.
4. Do not add statements that are not in the clause. Do not merge two statements with different actors
   or modalities. Prefer `not_stated` over guessing.

Return only the JSON object conforming to the schema.

---

## Few-shot (extraits de documents de CONCEPTION uniquement — à compléter au gel)

*Exemple 1 (thème TERMINATION)* — « We may suspend or terminate your account at any time, for any reason,
without notice. » → `{actor: provider, modality: power, action: terminate, condition: discretion, notice:
none, remedy: not_stated, evidence: [0]}`

*Exemple 2 (thème MODIFICATION_OF_TERMS)* — « We may modify these Terms. We will notify you at least 30
days before changes take effect. If you do not agree, you may close your account. » → `{actor: provider,
modality: power, action: modify_terms, condition: none_stated, notice: duration, notice_duration_days: 30,
remedy: right_to_cancel, evidence: [0, 1, 2]}`

*Exemple 3 (thème FRAMEWORK, sans norme)* — « These Terms were last updated on 1 May 2018. » →
`{norms: [], no_norm_reason: informational}`
