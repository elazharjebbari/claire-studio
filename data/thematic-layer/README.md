# A Thematic Layer for CLAUDETTE — annotation data

Companion data for the JURIX 2026 short paper *“A Thematic Layer for CLAUDETTE:
Separating the Cost of Multi-Label Annotation from the Effect of Taxonomy Granularity.”*

Every figure in the paper is computed from these files.
**Dataset fingerprint: `7116e627f528c557`** — 50 contracts, 9,414 sentences.

## What is here

| File | Contents |
|---|---|
| `votes.jsonl` | **Individual annotator votes**, never collapsed into a consensus. One record per (document, sentence, annotator): primary theme and secondary themes. |
| `gold.jsonl` | The **frozen gold standard**, one record per sentence: agreement class (`strict` / `majority` / `divergence`), cascade tier (`auto_1click` / `auto` / `manual`), engine proposal, decided theme and secondaries, vote tally and confidence. |
| `judges.jsonl` | The **four LLM judges** on the same sentences and the same vocabulary. |
| `taxonomies.json` | The **frozen taxonomy specification**: T20 (canonical, the one annotated) plus the T14 / T11 / T10 projections, with the design/validation document partition. |
| `labels.json` | Label inventory and supports. |
| `splits.json` | Document-level folds used for every model result. |
| `manifest.json` | Provenance: counts, fingerprint, build parameters. |

### A note on `finalized`

This snapshot was taken **before** the 50 resolutions were formally frozen, so
`gold.jsonl` carries `finalized: false` and `manifest.json` reports
`nGoldFinalizedDocuments: 0`. The **decisions are identical** to those later frozen: the
fingerprint of all 9,414 decisions (primary theme, secondaries, cascade tier) is unchanged
before and after freezing, `02d201d544119182e304d03a3df39a73`. Freezing sets an
immutability date; it decides nothing. The snapshot was kept as is so that its dataset
fingerprint keeps matching the one under which every published figure was computed.

## What is deliberately **not** here

**The source sentence text.** The contracts come from the CLAUDETTE / UNFAIR-ToS corpus,
which carries its own licence; we do not redistribute it. Records are keyed by
`(document, index)` so that they join directly onto the original corpus.

Unfairness labels likewise remain CLAUDETTE's: our layer never projects them.

## Joining onto CLAUDETTE

```python
import json
votes = [json.loads(l) for l in open("votes.jsonl")]
# key = (document, index) — the sentence index within the document, 0-based
```

## Taxonomy projections

T20 is the **only** taxonomy that was annotated and stored. T14, T11 and T10 are
deterministic projections applied at read time, never a second copy of the data:
`taxonomies.json` gives the complete member list of every merged category. Any change to
that file invalidates the published figures, which is why it carries a version and a
fingerprint.

## Citation

Please cite the JURIX 2026 paper. The annotation platform used to produce, arbitrate and
export this layer is in the same repository, and a running instance is at
<https://pactiva.legal>.
