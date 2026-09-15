"""Lanceur Codex : invocation isolée (répertoire vide, lecture seule, éphémère), reprise, décompte des tokens."""
from __future__ import annotations

import json
import os
import stat
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src" / "extraction"))

import codex_backend as cb  # noqa: E402

FAKE = """#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
if args == ["--version"]:
    print("codex-cli 0.0-test"); sys.exit(0)
out = args[args.index("-o") + 1]; cwd = args[args.index("-C") + 1]
prompt = sys.stdin.read()
record = {"argv": args, "cwd_listing": os.listdir(cwd), "prompt_head": prompt[:60]}
open(os.environ["FAKE_CODEX_TRACE"], "a").write(json.dumps(record) + "\\n")
print(json.dumps({"type": "turn.completed", "usage": {"input_tokens": 100, "output_tokens": 40}}))
open(out, "w").write('{"clause_id": "c1", "norms": [], "no_norm_reason": "informational"}\\n')
"""


def _fake(tmp_path):
    exe = tmp_path / "codex"
    exe.write_text(FAKE)
    exe.chmod(exe.stat().st_mode | stat.S_IEXEC)
    return exe


def test_invocation_isolee_et_reprise(tmp_path, monkeypatch):
    exe = _fake(tmp_path)
    trace = tmp_path / "trace.jsonl"
    monkeypatch.setenv("FAKE_CODEX_TRACE", str(trace))
    run = tmp_path / "run"
    (run / "batches").mkdir(parents=True)
    for k in (1, 2):
        (run / "batches" / f"batch_0{k}.md").write_text(f"# Extraction batch 0{k}\n")
    assert cb.main(["--run-dir", str(run), "--repeats", "0", "--codex", str(exe), "--parallel", "2"]) == 0
    calls = [json.loads(l) for l in trace.read_text().splitlines()]
    assert len(calls) == 2
    for c in calls:
        argv = c["argv"]
        assert argv[argv.index("--sandbox") + 1] == "read-only"
        assert "--ephemeral" in argv and "--skip-git-repo-check" in argv
        assert c["cwd_listing"] == [], "le répertoire de travail doit être vide (aucun fichier du dépôt lisible)"
        assert c["prompt_head"].startswith("You are running a structured information extraction task")
    assert sorted(p.name for p in (run / "responses").iterdir()) == ["r0_batch_01.jsonl", "r0_batch_02.jsonl"]
    assert json.loads((run / "USAGE.json").read_text())["input_tokens"] == 200
    # reprise : rien n'est relancé si les réponses existent
    assert cb.main(["--run-dir", str(run), "--repeats", "0", "--codex", str(exe)]) == 0
    assert len(trace.read_text().splitlines()) == 2


def test_consignes_etanches():
    import re
    assert not re.search(r"unfair|abusi|grey.?list|annex|93/13", cb.INSTRUCTIONS, re.I)
    assert not re.search(r"\b(LTD|TER|CH|CR|USE|LAW|LABELED)\b", cb.INSTRUCTIONS)   # codes : sensibles à la casse
