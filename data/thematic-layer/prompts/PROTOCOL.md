# Session protocol for the four LLM judges (v9.2)

This is the procedure each judge was run under. It replaces the tool-specific runbooks of the
campaign, which contained only installation commands, folder names and launch snippets; nothing
in them changed the task. The task itself is defined in the prompt files next to this document.

## Task

Segment each of the 50 CLAUDETTE contracts into thematic clauses and assign **one theme per
clause** from the closed vocabulary of the prompt (section 3 or 4, depending on the file). For every
sentence the judge returns the theme, a block identifier and whether the sentence opens a new clause;
at every clause opening it returns a short structured justification citing a literal fragment of the
sentence. The legal nature of clauses was **not** asked of the judges: it was derived afterwards by a
deterministic script from the theme, never by a model.

## Inputs a judge could see

- the prompt file and this protocol;
- the contract, one tokenised sentence per line, exactly as in the CLAUDETTE distribution
  (`<doc>.txt`; line *i* is sentence `id = i − 1`);
- a deterministic map of the document (`<doc>_docfeatures.json`: number of sentences, indices of
  short title lines, an estimate of the number of blocks), computed by a script without any model;
- its own output files.

Nothing else: no annotation by a human or by another judge, no earlier session, no log of the
campaign, no version history. Each judge ran in a fresh, isolated session with the outputs of the other
judges moved out of reach before the session started.

## Procedure

1. **One document per run.** The judge reads the whole contract, writes a document plan (anticipated
   segments), then labels every sentence.
2. **Structural validation, blocking.** A validator checks every output file: exactly one entry per
   non-empty line of the contract, identifiers `0 … n−1` in order, theme in the vocabulary (or an
   `OTHER_<label>` last resort), contiguous non-decreasing block identifiers, one theme per block,
   `is_block_start` consistent with the block identifiers, a justification with a literal evidence
   span at every opening. A file with an error is regenerated in a new session until it passes.
3. **Pilot then scale.** Ten pilot contracts first; the remaining forty only after the pilot files
   passed validation. The same ten pilot contracts were used for every judge.
4. **Stored once.** Outputs were stored and never regenerated afterwards; `judges.jsonl` in the parent
   folder is built from these files.

## Judges, models, harnesses, dates (2026)

| Judge label | Model actually served | Harness | Dates | Prompt file |
|---|---|---|---|---|
| `claude` | Claude Opus 4.7 (Anthropic) | Claude Code, fresh session per document | 29–31 May | `PROMPT_V9_2_claude_codex.md` |
| `codex` | GPT-5.5 (OpenAI) | Codex CLI 0.135.0, fresh session | 31 May – 2 June | `PROMPT_V9_2_claude_codex.md` |
| `mistral` | Mistral Medium 3.5 (Mistral AI, `mistral-medium-3.5`) | Vibe CLI, temperature 1.0, thinking "high" | 21–22 June | `PROMPT_V9_2_MISTRAL.md` |
| `fable` | Claude Fable 5 (Anthropic, `claude-fable-5`) | Claude Code, sub-agents forced to that model, fresh context | 1–2 August | `PROMPT_V9_2_FABLE.md` |

Decoding settings other than those listed were the harness defaults; no sampling parameter was set by
hand for Claude Code or Codex CLI. The three prompt files differ only in the judge name, the output
file name and the wording of the isolation rule; the theme vocabulary, the precedence rules, the
decision rules, the justification scheme and the output format are identical.

## From the prompt vocabulary to the released layer

The prompts use a 19-code vocabulary written before the annotation taxonomy was frozen. Judge outputs
were mapped onto the 20 themes of the released layer (T20) by a fixed table, applied identically to
every judge:

| Prompt code | T20 theme |
|---|---|
| `PAYMENT_BILLING`, `SUBSCRIPTION_RENEWAL` | `FEES_PAYMENT` |
| `LIABILITY_LIMITATION`, `INDEMNIFICATION` | `LIMITATION_LIABILITY` |
| `DISPUTE_ARBITRATION` | `ARBITRATION_DISPUTES` |
| `THIRD_PARTY` | `THIRD_PARTY_SERVICES` |
| `DEFINITIONS` | `PREAMBLE_SCOPE` |
| any `OTHER_<label>` | `MISC_BOILERPLATE` |
| all other codes | the theme of the same name |

The T20 themes `COMMUNICATIONS`, `FEEDBACK`, `PROMOTIONS` and `DMCA` have no prompt code of their own
(the prompts fold DMCA into `LICENSE_IP`); this is one reason why the judges are evaluated as such,
and never enter the reference.
