"""Backend « codex_exec » de l'extraction : un modèle OpenAI (vérifié le 15 sept. 2026 : `gpt-6-astra`, effort medium)
piloté par la CLI Codex (`codex exec`), sur les MÊMES lots que le backend inline. Codex est le harnais, pas le modèle :
le nom du modèle servi est résolu et enregistré à chaque appel.

POURQUOI. LLM_EXTRACTION §5 exige de comparer au moins deux modèles candidats sur le pilote avant de retenir
l'extracteur. Sans clé API, Claude Opus 5 a tourné en sous-agents Claude Code ; ce script fait tourner le
modèle OpenAI configuré dans la CLI Codex (compte ChatGPT), dans des conditions volontairement symétriques : mêmes lots
rendus depuis le prompt versionné, même absence de décodage contraint, même rejeu par les étapes 2–5.

Étanchéité. Chaque appel s'exécute dans un répertoire temporaire VIDE hors du dépôt (aucun AGENTS.md, aucun
fichier de règles lisible par défaut), en bac à sable `read-only`, sans session persistée (`--ephemeral`) ;
le lot est passé sur l'entrée standard et la réponse récupérée par `--output-last-message`. Les consignes
interdisent toute commande : le modèle n'a besoin d'aucun outil.

Sorties : `responses/r<repeat>_batch_XX.jsonl` (dernier message), `logs/r<repeat>_batch_XX.events.jsonl`
(événements `--json`, provenance), `USAGE.json` (tokens agrégés quand les événements les exposent).
Rejouer ensuite : `inline_backend.py replay --backend codex_exec --model <modèle> --repeat N`.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

INSTRUCTIONS = """You are running a structured information extraction task. Do not run any shell command, do not read
or write any file, do not browse: everything you need is in the text below. Apply the instructions of the
batch to every clause independently. Your final message must contain ONLY the JSON Lines output: exactly one
JSON object per clause, in the order of the batch, one per line, with no markdown fence, no comment and no
blank line. Each object has `clause_id` (copied verbatim), `norms` (array) and `no_norm_reason` (null when
`norms` is non-empty). `action` must be one code of the action inventory given for that clause; `evidence`
indices refer to the clause's sentence numbers (from 0).

"""


def resolve_model(model: str | None, effort: str | None) -> dict:
    """Modèle et effort réellement demandés : argument explicite, sinon `$CODEX_HOME/config.toml`.

    `codex exec --json` n'émet pas le nom du modèle dans ses événements ; sans cette résolution, le journal
    ne dirait que « défaut de configuration », ce qui n'est pas une provenance."""
    try:
        import tomllib
    except ModuleNotFoundError:  # pragma: no cover - Python < 3.11
        tomllib = None
    cfg = {}
    path = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")) / "config.toml"
    if tomllib and path.exists():
        try:
            cfg = tomllib.loads(path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            cfg = {}
    return {"model": model or cfg.get("model", "unknown"), "provider": cfg.get("model_provider", "openai"),
            "effort": effort or cfg.get("model_reasoning_effort", "unknown"),
            "model_source": "argument" if model else ("config.toml" if cfg.get("model") else "unknown")}


def usage_from_events(events_path: Path) -> dict:
    """Somme des tokens déclarés dans les événements `codex exec --json` (formats tolérés : clés imbriquées)."""
    totals = {"input_tokens": 0, "output_tokens": 0, "reasoning_output_tokens": 0, "cached_input_tokens": 0}
    last_total = None
    if not events_path.exists():
        return {}
    for line in events_path.read_text(encoding="utf-8").splitlines():
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        stack = [ev]
        while stack:
            node = stack.pop()
            if isinstance(node, dict):
                if "total_token_usage" in node and isinstance(node["total_token_usage"], dict):
                    last_total = node["total_token_usage"]
                if node.get("type") in ("turn.completed", "turn_completed") and isinstance(node.get("usage"), dict):
                    last_total = node["usage"]
                stack.extend(node.values())
            elif isinstance(node, list):
                stack.extend(node)
    if last_total:
        for key in totals:
            if isinstance(last_total.get(key), int):
                totals[key] = last_total[key]
    return totals if any(totals.values()) else {}


def run_one(codex: str, model: str | None, effort: str | None, batch_file: Path, out_file: Path, log_file: Path,
            timeout_s: int) -> dict:
    workdir = Path(tempfile.mkdtemp(prefix="codex-extract-"))
    cmd = [codex, "exec", "--skip-git-repo-check", "--ephemeral", "--sandbox", "read-only", "--json",
           "-C", str(workdir), "-o", str(out_file), "-"]
    if model:
        cmd[2:2] = ["-m", model]
    if effort:
        cmd[2:2] = ["-c", f'model_reasoning_effort="{effort}"']
    prompt = INSTRUCTIONS + batch_file.read_text(encoding="utf-8")
    started = time.time()
    try:
        with log_file.open("w", encoding="utf-8") as log:
            proc = subprocess.run(cmd, input=prompt, stdout=log, stderr=subprocess.PIPE, text=True, timeout=timeout_s)
        status = "ok" if proc.returncode == 0 and out_file.exists() and out_file.stat().st_size > 0 else "failed"
        err = proc.stderr[-600:] if status != "ok" else ""
        code = proc.returncode
    except subprocess.TimeoutExpired:
        status, err, code = "timeout", f"timeout {timeout_s}s", None
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    return {"batch": batch_file.name, "out": out_file.name, "status": status, "returncode": code,
            "seconds": round(time.time() - started, 1), "stderr_tail": err, "usage": usage_from_events(log_file)}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Extraction du pilote par un modèle OpenAI piloté par la CLI Codex (codex exec).")
    ap.add_argument("--run-dir", type=Path, required=True, help="dossier exporté par inline_backend.py export")
    ap.add_argument("--repeats", default="0", help="passes à produire, ex. 0,1,2")
    ap.add_argument("--batches", default="", help="sous-ensemble de lots, ex. 01,02 (défaut : tous)")
    ap.add_argument("--model", default=None, help="modèle Codex (défaut : celui de ~/.codex/config.toml)")
    ap.add_argument("--effort", default=None, help="model_reasoning_effort (défaut : configuration)")
    ap.add_argument("--parallel", type=int, default=4)
    ap.add_argument("--timeout", type=int, default=1800)
    ap.add_argument("--codex", default=shutil.which("codex") or "codex")
    ap.add_argument("--force", action="store_true", help="réécrire des réponses existantes")
    args = ap.parse_args(argv)

    run_dir = args.run_dir
    (run_dir / "responses").mkdir(parents=True, exist_ok=True)
    (run_dir / "logs").mkdir(parents=True, exist_ok=True)
    batches = sorted((run_dir / "batches").glob("batch_*.md"))
    if args.batches:
        wanted = {f"batch_{b.strip()}.md" for b in args.batches.split(",")}
        batches = [b for b in batches if b.name in wanted]
    repeats = [int(r) for r in args.repeats.split(",")]
    jobs = []
    for r in repeats:
        for b in batches:
            out = run_dir / "responses" / f"r{r}_{b.stem}.jsonl"
            if out.exists() and not args.force:
                continue
            jobs.append((b, out, run_dir / "logs" / f"r{r}_{b.stem}.events.jsonl"))

    version = subprocess.run([args.codex, "--version"], capture_output=True, text=True).stdout.strip()
    resolved = resolve_model(args.model, args.effort)
    results = []
    with ThreadPoolExecutor(max_workers=args.parallel) as pool:
        futures = [pool.submit(run_one, args.codex, args.model, args.effort, b, o, l, args.timeout) for b, o, l in jobs]
        for fut in as_completed(futures):
            res = fut.result()
            results.append(res)
            print(json.dumps(res, ensure_ascii=False), flush=True)

    usage_total: dict[str, int] = {}
    for log in (run_dir / "logs").glob("*.events.jsonl"):
        for k, v in usage_from_events(log).items():
            usage_total[k] = usage_total.get(k, 0) + v
    calls_path = run_dir / "CODEX_CALLS.jsonl"
    with calls_path.open("a", encoding="utf-8") as fh:
        for res in results:
            fh.write(json.dumps({**res, "codex_version": version, **resolved,
                                 "at": datetime.now(timezone.utc).isoformat(timespec="seconds")}, ensure_ascii=False) + "\n")
    if usage_total:
        (run_dir / "USAGE.json").write_text(json.dumps(usage_total, indent=1), encoding="utf-8")
    failed = [r for r in results if r["status"] != "ok"]
    print(json.dumps({"jobs": len(jobs), "ok": len(results) - len(failed), "failed": len(failed),
                      "codex_version": version, **resolved, "usage": usage_total}, ensure_ascii=False))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
