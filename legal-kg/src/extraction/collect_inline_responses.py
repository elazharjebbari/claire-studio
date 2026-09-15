"""Collecte les réponses des sous-agents (transcriptions JSONL de Claude Code) vers `responses/r<repeat>_batch_XX.jsonl`.

Entrée : un mapping `agent_id → (repeat, batch_no)` (JSON), le dossier des transcriptions, le dossier du run.
Pour chaque transcription : concatène les blocs `text` des messages `assistant`, garde les lignes qui sont des objets
JSON portant `clause_id` (les clôtures de code éventuelles sont ignorées), écrit le fichier de réponses et journalise le
modèle réellement utilisé (`message.model`) et les jetons dans `AGENTS.json` (provenance, exigée par REPRODUCIBILITY.md).
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def extract(transcript: Path) -> tuple[list[str], dict]:
    texts, models, usage = [], set(), {"input_tokens": 0, "output_tokens": 0}
    for line in transcript.read_text(encoding="utf-8").splitlines():
        try:
            o = json.loads(line)
        except json.JSONDecodeError:
            continue
        if o.get("type") != "assistant" or not isinstance(o.get("message"), dict):
            continue
        m = o["message"]; models.add(m.get("model"))
        u = m.get("usage") or {}
        usage["input_tokens"] += int(u.get("input_tokens") or 0); usage["output_tokens"] += int(u.get("output_tokens") or 0)
        for block in m.get("content") or []:
            if isinstance(block, dict) and block.get("type") == "text":
                texts.append(block["text"])
            # sous-agent qui a écrit lui-même le fichier : le contenu est dans l'appel Write de la transcription
            if isinstance(block, dict) and block.get("type") == "tool_use" and block.get("name") == "Write":
                content = (block.get("input") or {}).get("content")
                if content:
                    texts.append(content)
    lines = []
    for t in texts:
        for l in t.splitlines():
            s = l.strip()
            if not s or s.startswith("```"):
                continue
            try:
                obj = json.loads(s)
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict) and obj.get("clause_id"):
                lines.append(json.dumps(obj, ensure_ascii=False))
    return lines, {"models": sorted(x for x in models if x), **usage}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mapping", type=Path, required=True, help='JSON {"<agent_id>": [repeat, batch_no], ...}')
    ap.add_argument("--tasks-dir", type=Path, required=True)
    ap.add_argument("--run-dir", type=Path, required=True)
    ap.add_argument("--expected", type=int, default=25, help="clauses attendues par lot (dernier lot : moins)")
    a = ap.parse_args(argv)
    mapping = json.loads(a.mapping.read_text(encoding="utf-8"))
    manifest = json.loads((a.run_dir / "MANIFEST.json").read_text(encoding="utf-8"))
    expected_by_batch = {i + 1: len(b["clause_ids"]) for i, b in enumerate(manifest["batches"])}
    agents_log = json.loads((a.run_dir / "AGENTS.json").read_text(encoding="utf-8")) if (a.run_dir / "AGENTS.json").exists() else {}
    report = {}
    for agent_id, (repeat, batch_no) in mapping.items():
        transcript = a.tasks_dir / f"{agent_id}.output"
        if not transcript.exists():
            report[agent_id] = "transcription absente"; continue
        lines, meta = extract(transcript)
        out = a.run_dir / "responses" / f"r{repeat}_batch_{batch_no:02d}.jsonl"
        if not lines:
            # ne jamais écraser un fichier existant par du vide (agent encore en cours ou écriture directe)
            report[agent_id] = {"file": out.name, "lines": 0, "expected": expected_by_batch[batch_no], "missing": [], "extra": [], "note": "aucune ligne extraite : fichier laissé intact", **meta}
            continue
        out.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
        ids = {json.loads(l)["clause_id"] for l in lines}
        expected_ids = set(manifest["batches"][batch_no - 1]["clause_ids"])
        report[agent_id] = {"file": out.name, "lines": len(lines), "expected": expected_by_batch[batch_no], "missing": sorted(expected_ids - ids), "extra": sorted(ids - expected_ids), **meta}
        agents_log[out.name] = {"agent_id": agent_id, "collected_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "agent_type": "general-purpose (Claude Code subagent, fresh context, Read on the batch file only)", **meta}
    (a.run_dir / "AGENTS.json").write_text(json.dumps(agents_log, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=1, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
