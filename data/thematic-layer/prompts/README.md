# Prompts given to the four LLM judges (protocol v9.2)

These are the instruction files the judges received, one per session, as promised in the paper.
Only protocol **v9.2** was used for the published judges; the earlier prompt versions of the campaign
(V3 to V9.1) were development iterations and none of their outputs enters the resource.

| File | Contents |
|---|---|
| `PROTOCOL.md` | How each judge was run: inputs it could see, isolation, one document per run, blocking validation, pilot then scale; models, harnesses and dates; the fixed mapping from the prompt vocabulary to the 20 released themes. |
| `PROMPT_V9_2_claude_codex.md` | Prompt of the judges `claude` (Claude Opus 4.7) and `codex` (GPT-5.5). |
| `PROMPT_V9_2_MISTRAL.md` | Prompt of the judge `mistral` (Mistral Medium 3.5). |
| `PROMPT_V9_2_FABLE.md` | Prompt of the judge `fable` (Claude Fable 5). |

The prompts are in French, the working language of the campaign. They are published as given to the
judges, with two edits made for readability: the internal file paths of the campaign are replaced by
neutral placeholders (`<doc>.txt`, `<doc>_docfeatures.json`, `<doc>_<judge>.json`), and the isolation
rule lists no longer name the internal folders and commands that were forbidden, only the rule itself.
The theme vocabulary, the precedence rules, the decision rules, the justification scheme and the output
format are untouched. The unedited files, as run, have SHA-256 (first 16 hex digits)
`PROMPT_V9_2_claude_codex.md` d6844ce5f88b8c91 · `PROMPT_V9_2_MISTRAL.md` 419700a888cc6f13 ·
`PROMPT_V9_2_FABLE.md` 35ca02cbc9ad424f, and are kept in the project archive.

Provenance of the model names (verified 15 September 2026): `codex` from the Codex CLI session logs
(`turn_context.model = gpt-5.5`); `mistral` from the Vibe CLI configuration and session messages;
`fable` from the Claude Code transcript (`claude-fable-5`) and the session instructions; `claude`
declared in the campaign instructions ("Claude Opus 4.7"), the transcripts of May 2026 being no
longer available for an independent check.
