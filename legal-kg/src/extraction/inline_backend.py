"""Backend « inline » de l'extraction : sous-agents Claude Code à contexte vierge au lieu de l'API Anthropic.

POURQUOI. Le pilote de la Gate 5 était bloqué faute de clé API. Le modèle qui fait tourner Claude Code
(Claude Opus 5) peut produire les templates, MAIS pas dans la conversation principale : celle-ci a les
règles gelées en contexte, et une extraction faite en les connaissant biaiserait les champs vers ce qui
les déclenche (rupture de la pré-inscription). L'extraction est donc confiée à des sous-agents neufs qui
ne reçoivent QUE le prompt versionné, le schéma et les clauses.

Deux sous-commandes, pour que le rendu du prompt et les contrôles restent ceux de `extract_templates.py` :

  export  → lots de clauses rendus (system + user + few-shot + schéma) : `batches/batch_XX.md`
  replay  → réponses des sous-agents (`responses/r<repeat>_batch_XX.jsonl`) passées par les étapes 2–5
            (schéma Pydantic, contrôles structurels, sémantiques, ancrage lexical, correction) ; sortie au
            format exact du backend API (`step_*.jsonl`, `run.json`) → consommable par ingest_norms/run_rules.

Écarts au protocole déclarés dans `run.json` (`protocol_deviations`) : pas de température 0 ni de sortie
structurée contrainte (validation a posteriori), clauses traitées par lots et non une par appel, prompt
système de Claude Code en surcouche, pas de décompte de tokens. Ce backend sert le pilote (conception) et
le démarrage de la validation juriste ; il ne remplace pas la sélection de modèle de LLM_EXTRACTION §5.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_templates import (  # noqa: E402
    PROMPT_PATH,
    ROOT,
    SCHEMA_PATH,
    ClauseTemplateExtraction,
    anchoring_check,
    apply_corrections,
    load_prompt,
    render_user,
    semantic_check,
    structural_check,
)

BACKEND = "inline_subagent"
# Écarts au protocole (LLM_EXTRACTION §4) propres à chaque backend sans API directe.
DEVIATIONS_BY_BACKEND = {
    "inline_subagent": [
        "no_temperature_control",
        "no_constrained_decoding_schema_validated_after_generation",
        "clauses_batched_not_one_call_per_clause",
        "claude_code_system_prompt_wraps_extraction_prompt",
        "no_token_accounting",
    ],
    "codex_exec": [
        "no_temperature_control",
        "no_constrained_decoding_schema_validated_after_generation",
        "clauses_batched_not_one_call_per_clause",
        "codex_cli_system_prompt_wraps_extraction_prompt",
        "chatgpt_plan_not_api_billing",
    ],
}
DEVIATIONS = DEVIATIONS_BY_BACKEND[BACKEND]
STEP_KEYS = ("1_raw", "2_structural", "3_semantic", "4_anchoring", "5_corrected")


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def batches_of(clauses: list[dict], size: int) -> list[list[dict]]:
    return [clauses[i:i + size] for i in range(0, len(clauses), size)]


def render_batch(system: str, user_tpl: str, schema_text: str, batch: list[dict], batch_no: int) -> str:
    """Un lot = les instructions communes une fois, puis chaque clause rendue EXACTEMENT comme pour l'API."""
    parts = [
        f"# Extraction batch {batch_no:02d} — {len(batch)} clauses",
        "",
        "## Instructions (apply to every clause below, independently of the other clauses)",
        "",
        system,
        "",
        "## Output format",
        "",
        "Write ONE JSON object per line (JSON Lines), one line per clause, in the order below. Each object must",
        "conform to this JSON Schema (closed vocabularies; `no_norm_reason` is null when `norms` is non-empty;",
        "`clause_id` is copied verbatim from the clause header):",
        "",
        "```json",
        schema_text,
        "```",
        "",
    ]
    for clause in batch:
        parts += [
            "---",
            "",
            f"### clause_id: `{clause['clause_id']}`",
            "",
            render_user(user_tpl, clause),
            "",
        ]
    return "\n".join(parts)


def cmd_export(args: argparse.Namespace) -> int:
    clauses = read_jsonl(Path(args.clauses))
    if args.limit:
        clauses = clauses[: args.limit]
    system, user_tpl, prompt_hash = load_prompt()
    schema_text = SCHEMA_PATH.read_text(encoding="utf-8").strip()
    out = Path(args.out)
    (out / "batches").mkdir(parents=True, exist_ok=True)
    (out / "responses").mkdir(parents=True, exist_ok=True)
    manifest = {"clauses": str(args.clauses), "n_clauses": len(clauses), "batch_size": args.batch_size,
                "prompt_hash": prompt_hash, "schema_hash": hashlib.sha256(SCHEMA_PATH.read_bytes()).hexdigest(),
                "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "batches": []}
    for k, batch in enumerate(batches_of(clauses, args.batch_size), start=1):
        path = out / "batches" / f"batch_{k:02d}.md"
        path.write_text(render_batch(system, user_tpl, schema_text, batch, k), encoding="utf-8")
        manifest["batches"].append({"file": str(path.relative_to(out)), "clause_ids": [c["clause_id"] for c in batch]})
    (out / "MANIFEST.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"out": str(out), "n_batches": len(manifest["batches"]), "n_clauses": len(clauses),
                      "prompt_hash": prompt_hash[:12]}, ensure_ascii=False))
    return 0


def _parse_line(line: str) -> tuple[dict | None, str | None]:
    text = line.strip()
    if not text:
        return None, None
    if text.startswith("```"):
        return None, None
    try:
        return json.loads(text), None
    except json.JSONDecodeError as exc:
        return None, f"json_decode: {exc.msg}"


def load_responses(responses_dir: Path, repeats: list[int]) -> dict[tuple[str, int], dict]:
    """(clause_id, repeat) → {"output": dict | None, "error": str | None, "file": str}."""
    found: dict[tuple[str, int], dict] = {}
    for repeat in repeats:
        for path in sorted(responses_dir.glob(f"r{repeat}_batch_*.jsonl")):
            for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
                obj, err = _parse_line(line)
                if obj is None and err is None:
                    continue
                if obj is None:
                    found.setdefault((f"{path.name}:{lineno}", repeat), {"output": None, "error": err, "file": path.name})
                    continue
                cid = obj.get("clause_id")
                if not cid:
                    continue
                key = (cid, repeat)
                if key in found:
                    found[key]["error"] = "duplicate_clause_line"
                    continue
                found[key] = {"output": obj, "error": None, "file": path.name}
    return found


def cmd_replay(args: argparse.Namespace) -> int:
    run_dir = Path(args.run_dir)
    clauses = read_jsonl(Path(args.clauses))
    if args.limit:
        clauses = clauses[: args.limit]
    repeats = list(range(args.repeat))
    _, _, prompt_hash = load_prompt()
    manifest = json.loads((run_dir / "MANIFEST.json").read_text(encoding="utf-8"))
    if manifest["prompt_hash"] != prompt_hash:
        raise SystemExit("le prompt a changé depuis l'export des lots : réexporter avant de rejouer")
    responses = load_responses(run_dir / "responses", repeats)
    known = {c["clause_id"] for c in clauses}
    stray = sorted({cid for cid, _ in responses if cid not in known})

    try:
        code_version = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:  # noqa: BLE001
        code_version = "unknown"
    backend = args.backend
    record = {"run_id": args.run_id or str(uuid.uuid4()), "kind": "extraction", "backend": backend,
              "model": args.model, "effort": None, "prompt": str(PROMPT_PATH.relative_to(ROOT)),
              "prompt_hash": prompt_hash, "schema_hash": manifest["schema_hash"], "temperature": None,
              "repeat": args.repeat, "clauses": str(args.clauses), "n_clauses": len(clauses),
              "batch_size": manifest["batch_size"], "code_version": code_version,
              "started_at": manifest["exported_at"], "dry_run": False, "tokens_in": None, "tokens_out": None,
              "refusals": 0, "protocol_deviations": DEVIATIONS_BY_BACKEND[backend], "stray_clause_ids": stray,
              "agents": args.agents_note}

    files = {k: (run_dir / f"step_{k}.jsonl").open("w", encoding="utf-8") for k in STEP_KEYS}
    stats = {"schema_ok": 0, "missing": 0, "schema_errors": 0, "structural_ok": 0, "semantic_ok": 0,
             "anchoring_flags": 0, "norms": 0, "empty": 0, "identical_across_repeats": 0}
    per_clause: dict[str, list[str]] = {}
    for clause in clauses:
        for repeat in repeats:
            base = {"clause_id": clause["clause_id"], "repeat": repeat, "stop_reason": "end_turn", "latency_s": None,
                    "backend": backend}
            got = responses.get((clause["clause_id"], repeat))
            if got is None or got["output"] is None:
                stats["missing"] += 1
                files["1_raw"].write(json.dumps({**base, "output": None, "error": "missing" if got is None else got["error"]}) + "\n")
                continue
            try:
                parsed = ClauseTemplateExtraction.model_validate(got["output"])
            except ValidationError as exc:
                stats["schema_errors"] += 1
                files["1_raw"].write(json.dumps({**base, "output": None, "raw": got["output"],
                                                 "error": f"schema: {exc.error_count()} erreur(s)",
                                                 "schema_errors": [e["loc"] and ".".join(map(str, e["loc"])) for e in exc.errors()]},
                                                ensure_ascii=False, default=str) + "\n")
                continue
            parsed.clause_id = clause["clause_id"]
            raw = parsed.model_dump()
            files["1_raw"].write(json.dumps({**base, "output": raw}, ensure_ascii=False) + "\n")
            stats["schema_ok"] += 1
            per_clause.setdefault(clause["clause_id"], []).append(json.dumps(raw, sort_keys=True))
            e2 = structural_check(parsed, clause)
            files["2_structural"].write(json.dumps({**base, "errors": e2}, ensure_ascii=False) + "\n")
            stats["structural_ok"] += int(not e2)
            e3 = semantic_check(parsed)
            files["3_semantic"].write(json.dumps({**base, "errors": e3}, ensure_ascii=False) + "\n")
            stats["semantic_ok"] += int(not e3)
            flags = anchoring_check(parsed, clause)
            stats["anchoring_flags"] += len(flags)
            files["4_anchoring"].write(json.dumps({**base, "flags": flags}, ensure_ascii=False) + "\n")
            corrected = apply_corrections(parsed, flags) if flags else parsed
            stats["norms"] += len(corrected.norms)
            stats["empty"] += int(not corrected.norms)
            files["5_corrected"].write(json.dumps({**base, "status": "proposed", "output": corrected.model_dump(),
                                                   "structural_errors": e2, "semantic_errors": e3,
                                                   "anchoring_flags": flags}, ensure_ascii=False) + "\n")
    for fh in files.values():
        fh.close()

    if args.repeat > 1:
        stats["identical_across_repeats"] = sum(1 for outs in per_clause.values()
                                                if len(outs) == args.repeat and len(set(outs)) == 1)
    n_calls = len(clauses) * args.repeat
    ok = max(stats["schema_ok"], 1)
    record.update({
        "ended_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "n_calls": n_calls,
        "counts": {k: stats[k] for k in ("schema_ok", "missing", "schema_errors", "norms", "empty")},
        "metrics": {"schema_compliance": round(stats["schema_ok"] / n_calls, 4) if n_calls else None,
                    "missing_share": round(stats["missing"] / n_calls, 4) if n_calls else None,
                    "structural_pass": round(stats["structural_ok"] / ok, 4),
                    "semantic_pass": round(stats["semantic_ok"] / ok, 4),
                    "anchoring_flags_per_norm": round(stats["anchoring_flags"] / max(stats["norms"], 1), 4),
                    "norms_per_clause": round(stats["norms"] / ok, 3),
                    "empty_share": round(stats["empty"] / ok, 4),
                    "reproducibility_identical": round(stats["identical_across_repeats"] / len(clauses), 4)
                    if args.repeat > 1 and clauses else None}})
    usage_path = run_dir / "USAGE.json"
    if usage_path.exists():
        usage = json.loads(usage_path.read_text(encoding="utf-8"))
        record["tokens_in"], record["tokens_out"] = usage.get("input_tokens"), usage.get("output_tokens")
        record["usage"] = usage
    (run_dir / "run.json").write_text(json.dumps(record, indent=1, ensure_ascii=False), encoding="utf-8")
    (run_dir / "prompt.md").write_text(PROMPT_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    print(json.dumps({"run_id": record["run_id"], "out": str(run_dir), **record["metrics"], "stray": len(stray)},
                     ensure_ascii=False))
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    ex = sub.add_parser("export", help="rendre les lots de clauses pour les sous-agents")
    ex.add_argument("--clauses", required=True)
    ex.add_argument("--out", required=True)
    ex.add_argument("--batch-size", type=int, default=25)
    ex.add_argument("--limit", type=int, default=None)
    ex.set_defaults(func=cmd_export)
    rp = sub.add_parser("replay", help="valider les réponses des sous-agents (étapes 2–5)")
    rp.add_argument("--clauses", required=True)
    rp.add_argument("--run-dir", required=True)
    rp.add_argument("--repeat", type=int, default=1)
    rp.add_argument("--limit", type=int, default=None)
    rp.add_argument("--model", default="claude-opus-5")
    rp.add_argument("--run-id", default=None)
    rp.add_argument("--agents-note", default="", help="traçabilité des sous-agents (type, modèle, date)")
    rp.add_argument("--backend", default=BACKEND, choices=sorted(DEVIATIONS_BY_BACKEND))
    rp.set_defaults(func=cmd_replay)
    args = ap.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
