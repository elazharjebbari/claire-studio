"""Exécution des jobs de classification : file FIFO, un job à la fois, sous-processus isolé.

Même principe que `claire/lab/runners/local.py` : le package ML est invoqué en SOUS-PROCESSUS
(`research/.venv/bin/python -m pactiva_lab predict`), jamais importé dans Django. Le texte est
écrit dans `var/demo/jobs/<id>/in.json` (permissions 600) et supprimé à la fin du job.

`settings.DEMO_RUN_INLINE` (vrai en test) exécute le job en SYNCHRONE dans la requête ;
`settings.DEMO_PREDICT_COMMAND` remplace la commande réelle (liste d'arguments, les jetons
`{model}`, `{input}`, `{out}` sont substitués) — les tests y branchent un faux `predict`.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
from collections import deque
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from claire.lab.runners.local import research_python, research_root

from .models import DemoJob, DemoJobStatus

_lock = threading.Lock()
_queue: deque = deque()
_worker: threading.Thread | None = None


def jobs_root() -> Path:
    configured = getattr(settings, "DEMO_JOBS_DIR", None)
    root = Path(configured) if configured else Path(settings.BASE_DIR).parent / "var" / "demo" / "jobs"
    root.mkdir(parents=True, exist_ok=True)
    return root


def queue_length() -> int:
    with _lock:
        return len(_queue)


def queue_full() -> bool:
    return queue_length() >= int(getattr(settings, "DEMO_QUEUE_MAX", 3))


def _command(model_dir: str, input_path: Path, out_path: Path) -> list[str]:
    override = getattr(settings, "DEMO_PREDICT_COMMAND", None)
    if override:
        return [str(a).format(model=model_dir, input=str(input_path), out=str(out_path)) for a in override]
    return [research_python(), "-m", "pactiva_lab", "predict",
            "--model", model_dir, "--input", str(input_path), "--out", str(out_path)]


def write_input(job: DemoJob, sentences: list[str] | None = None, text: str | None = None) -> Path:
    folder = jobs_root() / str(job.id)
    folder.mkdir(parents=True, exist_ok=True)
    payload = {"document": job.document or job.title or "input"}
    if sentences is not None:
        payload["sentences"] = sentences
    else:
        payload["text"] = text or ""
    path = folder / "in.json"
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    os.chmod(path, 0o600)
    return path


def _cleanup(job_id) -> None:
    shutil.rmtree(jobs_root() / str(job_id), ignore_errors=True)


def execute(job_id) -> None:
    """Exécute UN job (appelé par le fil de travail ou en synchrone)."""
    from django.db import close_old_connections

    close_old_connections()
    job = DemoJob.objects.get(pk=job_id)
    folder = jobs_root() / str(job.id)
    input_path, out_path = folder / "in.json", folder / "out.json"
    job.status = DemoJobStatus.RUNNING
    job.started_at = timezone.now()
    job.save(update_fields=["status", "started_at"])
    model_dir = str(getattr(settings, "DEMO_MODEL_DIR", "") or "")
    try:
        if not getattr(settings, "DEMO_PREDICT_COMMAND", None) and not Path(model_dir, "model_config.json").exists():
            raise RuntimeError("model_unavailable")
        env = os.environ.copy()
        root = research_root()
        env["PYTHONPATH"] = os.pathsep.join([p for p in (str(root), env.get("PYTHONPATH", "")) if p])
        env.setdefault("HF_HOME", str(folder / ".hf"))
        env.setdefault("HF_HUB_OFFLINE", "1")
        env.setdefault("OMP_NUM_THREADS", str(getattr(settings, "DEMO_THREADS", 3)))
        env.setdefault("TOKENIZERS_PARALLELISM", "false")
        completed = subprocess.run(
            _command(model_dir, input_path, out_path), cwd=str(root), env=env,
            capture_output=True, text=True, timeout=int(getattr(settings, "DEMO_JOB_TIMEOUT", 120)),
        )
        if completed.returncode != 0 or not out_path.exists():
            raise RuntimeError("internal")
        result = json.loads(out_path.read_text(encoding="utf-8"))
        max_sentences = int(getattr(settings, "DEMO_MAX_SENTENCES", 400))
        sentences = result.get("sentences") or []
        truncated = len(sentences) > max_sentences
        result["sentences"] = sentences[:max_sentences]
        result["truncated"] = bool(truncated or result.get("truncated"))
        result.pop("document", None)
        job.result = result
        job.n_sentences = len(result["sentences"])
        job.truncated = result["truncated"]
        job.status = DemoJobStatus.DONE
    except subprocess.TimeoutExpired:
        job.status = DemoJobStatus.FAILED
        job.error = {"code": "timeout", "detail": "The classification took too long and was stopped."}
    except Exception as exc:  # noqa: BLE001 - l'échec est un état du job, jamais une trace
        code = str(exc) if str(exc) in ("model_unavailable", "internal") else "internal"
        job.status = DemoJobStatus.FAILED
        job.error = {"code": code, "detail": "The classification could not be completed."}
    finally:
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "result", "error", "n_sentences", "truncated", "finished_at"])
        _cleanup(job.id)
        close_old_connections()


def _drain() -> None:
    global _worker
    while True:
        with _lock:
            if not _queue:
                _worker = None
                return
            job_id = _queue.popleft()
        try:
            execute(job_id)
        except Exception:  # pragma: no cover - le fil ne doit jamais mourir sur un job
            pass


def enqueue(job: DemoJob) -> int:
    """Ajoute le job à la file ; retourne sa position (0 = démarre tout de suite)."""
    global _worker
    if getattr(settings, "DEMO_RUN_INLINE", False):
        execute(job.id)
        return 0
    with _lock:
        _queue.append(job.id)
        position = len(_queue) - 1
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=_drain, name="demo-runner", daemon=True)
            _worker.start()
    return position


def purge_old_jobs(hours: int = 24) -> int:
    cutoff = timezone.now() - timedelta(hours=hours)
    old = DemoJob.objects.filter(created_at__lt=cutoff)
    ids = list(old.values_list("id", flat=True))
    count, _ = old.delete()
    for job_id in ids:
        _cleanup(job_id)
    return count
