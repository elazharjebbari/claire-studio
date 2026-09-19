# Prompts given to the four LLM judges (protocol v9.2)

These are the exact instruction files the judges received, one per session, as promised in the paper. Only
protocol **v9.2** was used for the published judges; the earlier prompt versions of the campaign (V3 to V9.1)
were development iterations and none of their outputs enters the resource.

The judges performed the same task as the human annotators: segment each contract into thematic blocks and
assign one theme per block from the closed 20-theme vocabulary (T20) defined in the prompt (section 3).
The `legal_nature` field present in three of the four outputs was derived afterwards by a deterministic
script (`derive_legal_nature.py`, "nature-derived"), never by the model. Prompts and runbooks are in French,
the working language of the campaign.

| Judge label | Model actually served | Harness / access | Dates (2026) | Prompt file | Runbook |
|---|---|---|---|---|---|
| `claude` | Claude Opus 4.7 (Anthropic) | Claude Code (subscription), fresh session per document | 29–31 May | `PROMPT_V9_2_claude_codex.md` | `RUNBOOK_V9_2_claude_codex.md` |
| `codex` | GPT-5.5 (OpenAI) | Codex CLI 0.135.0, fresh session | 31 May – 2 June | `PROMPT_V9_2_claude_codex.md` | `RUNBOOK_V9_2_claude_codex.md` |
| `mistral` | Mistral Medium 3.5 (Mistral AI; `mistral-medium-3.5`, alias `mistral-vibe-cli-latest`) | Vibe CLI, temperature 1.0, thinking "high" | 21–22 June | `PROMPT_V9_2_MISTRAL.md` | `RUNBOOK_V9_2_MISTRAL.md` |
| `fable` | Claude Fable 5 (Anthropic; `claude-fable-5`) | Claude Code, sub-agents forced to `model: fable`, fresh context | 1–2 August | `PROMPT_V9_2_FABLE.md` | `RUNBOOK_V9_2_FABLE.md` |

Decoding settings other than those listed were the harness defaults; no sampling parameter was set by hand
for Claude Code or Codex CLI. Each judge labelled all 50 contracts once, in isolated sessions: no judge ever had
access to another judge's outputs, to earlier sessions or to any log of the campaign (the runbooks require the
other judges' folders to be moved out of reach before a session starts). Outputs were stored and never
regenerated (`judges.jsonl` in the parent folder).

Provenance and how it was verified (15 September 2026):

- `codex`: model read from the Codex CLI session logs of 31 May and 2 June (`turn_context.model = gpt-5.5`).
- `mistral`: model read from the Vibe CLI configuration and session messages of 21–22 June.
- `fable`: model read from the Claude Code transcript of 1–2 August (`claude-fable-5`) and declared in the runbook.
- `claude`: declared in the campaign README and runbook ("Claude Opus 4.7", "Opus only"); the Claude Code
  transcripts of May 2026 were no longer available for an independent check.

The three prompt files differ only in the judge name, the output folder and the isolation instructions
(section 0), which forbid the model from reading any other judge's output; the theme vocabulary and the
segmentation rules are identical. SHA-256 (first 16 hex digits): `PROMPT_V9_2_claude_codex.md`
d6844ce5f88b8c91 · `PROMPT_V9_2_MISTRAL.md` 419700a888cc6f13 · `PROMPT_V9_2_FABLE.md` 35ca02cbc9ad424f.
The runbooks contain a placeholder for an API key (`sk-…`), never a real one.
