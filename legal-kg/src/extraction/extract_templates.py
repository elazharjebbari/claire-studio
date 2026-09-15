#!/usr/bin/env python3
"""Extraction de templates de clause (couche L3) par LLM — pipeline à portes (LLM_EXTRACTION.md §3, ADR-004).

Étapes par clause :
  1. extraction schema-guided (Claude, sortie structurée Pydantic, température 0) ;
  2. validation structurale (schéma, énumérations, evidence ⊆ clause) ;
  3. validation sémantique (contraintes d'ontologie) ;
  4. vérification d'ancrage lexicale (heuristique ; le vérificateur LLM d'une autre famille est optionnel) ;
  5. correction : champ non ancré → not_stated + flag ; (6) validation humaine = hors script ; (7) insertion = ingest_norms.
Chaque étape écrit results/extraction/<run_id>/step_k.jsonl ; le run est enregistré (REPRODUCIBILITY.md §1).

Étanchéité : le prompt ne contient ni catégorie CLAUDETTE ni item de l'annexe (tests/test_rule_isolation.py).

Usage :
  python src/extraction/extract_templates.py --clauses data/annotations/pilot_100/clauses.jsonl --repeat 3
  python src/extraction/extract_templates.py --clauses ... --dry-run          # pipeline sans appel API (stub)
Authentification : ANTHROPIC_API_KEY ou profil `ant auth login` (le SDK résout seul les identifiants).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
PROMPT_PATH = ROOT / "llm" / "prompts" / "clause_template_extraction.md"
SCHEMA_PATH = ROOT / "llm" / "schemas" / "clause_template.schema.json"
DEFAULT_MODEL = "claude-opus-5"

Actor = Literal["provider", "user", "third_party"]
Modality = Literal["obligation", "permission", "prohibition", "power"]
Condition = Literal["for_cause", "specified_reason", "discretion", "none_stated"]
Notice = Literal["duration", "reasonable", "none", "not_stated"]
Remedy = Literal["refund", "right_to_cancel", "compensation", "none", "not_stated"]


class Norm(BaseModel):
    actor: Actor
    counterparty: Optional[Actor] = None
    modality: Modality
    action: str
    object: Optional[str] = Field(default=None, max_length=120)
    condition: Condition
    notice: Notice
    notice_duration_days: Optional[int] = Field(default=None, ge=0)
    remedy: Remedy
    amount_ratio: Optional[float] = Field(default=None, ge=0)
    opt_out_deadline_days: Optional[int] = Field(default=None, ge=0)
    evidence: List[int] = Field(min_length=1)
    confidence: float = Field(ge=0, le=1)


class ClauseTemplateExtraction(BaseModel):
    clause_id: str
    norms: List[Norm] = Field(max_length=6)
    no_norm_reason: Optional[Literal["definitional", "informational", "cross_reference_only", "not_applicable"]] = None


# ------------------------------------------------------------------ prompt ---------------------------------------

def load_prompt() -> tuple[str, str, str]:
    """Retourne (system, user_template, prompt_hash) à partir du fichier versionné."""
    text = PROMPT_PATH.read_text(encoding="utf-8")
    system = text.split("## System", 1)[1].split("## User", 1)[0].strip()
    user = text.split("## User", 1)[1].split("---", 1)[0].strip()
    few = text.split("## Few-shot", 1)[1].strip() if "## Few-shot" in text else ""
    prompt_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return system, user + ("\n\n**Examples**\n" + few if few else ""), prompt_hash


def render_user(template: str, clause: dict) -> str:
    sentences = "\n".join(f"[{i}] {s['text']}" for i, s in enumerate(clause["sentences"]))
    out = template.replace("{{theme_T11}}", clause["theme_T11"]).replace("{{action_inventory}}", ", ".join(clause["action_inventory"]))
    out = re.sub(r"```\n\{\{#each sentences\}\}.*?\{\{/each\}\}\n```", "```\n" + sentences + "\n```", out, flags=re.S)
    return out


# ------------------------------------------------------------------ contrôles -------------------------------------

LEXICAL_TRIGGERS = {
    "condition": {"discretion": ["sole discretion", "any reason", "at any time", "for any reason", "without cause", "our discretion", "no reason"],
                  "for_cause": ["breach", "violat", "if you", "cause", "in the event"],
                  # v0.2 (15 sept. 2026) : la forme conditionnelle « if / where / upon … » est la façon normale de nommer une
                  # raison en anglais contractuel ; sans ces marqueurs, 69 normes du pilote étaient rétrogradées vers
                  # none_stated, ce qui FAVORISAIT Q-g/Q-j (docs/PILOT_EXTRACTION_FINDINGS.md § 3).
                  "specified_reason": ["reason", "because", "due to", "in order to", "if ", "where ", "upon ", "in the event",
                                       "suspect", "fraud", "security", "legal", "necessary"]},
    "notice": {"none": ["without notice", "without prior notice", "no notice", "without notifying", "immediately"],
               "duration": ["days", "day", "months", "hours", "weeks", "30", "14", "60", "90"],
               "reasonable": ["reasonable notice", "advance notice", "prior notice", "notify you", "notice"]},
    "remedy": {"refund": ["refund"], "right_to_cancel": ["terminate", "cancel", "close your account", "stop using", "discontinue"],
               "compensation": ["compensat", "damages", "reimburs"], "none": ["no refund", "non-refundable", "not be entitled", "sole remedy", "without refund", "no liability", "not liable", "without any refund"]},   # v0.2
}


def structural_check(parsed: ClauseTemplateExtraction, clause: dict) -> list[str]:
    errs = []
    n = len(clause["sentences"])
    for k, norm in enumerate(parsed.norms):
        if any(i < 0 or i >= n for i in norm.evidence):
            errs.append(f"norm[{k}].evidence hors de la clause")
        if norm.action not in clause["action_inventory"]:
            errs.append(f"norm[{k}].action '{norm.action}' hors inventaire")
    if not parsed.norms and not parsed.no_norm_reason:
        errs.append("norms vide sans no_norm_reason")
    if parsed.norms and parsed.no_norm_reason:
        errs.append("no_norm_reason renseigné avec des norms")
    return errs


def semantic_check(parsed: ClauseTemplateExtraction) -> list[str]:
    errs = []
    for k, norm in enumerate(parsed.norms):
        if norm.modality == "prohibition" and norm.remedy not in ("none", "not_stated"):
            errs.append(f"norm[{k}] remedy sur une prohibition")
        if norm.notice == "duration" and norm.notice_duration_days is None:
            errs.append(f"norm[{k}] notice=duration sans notice_duration_days")
        if norm.notice != "duration" and norm.notice_duration_days is not None:
            errs.append(f"norm[{k}] notice_duration_days sans notice=duration")
        if norm.counterparty == norm.actor:
            errs.append(f"norm[{k}] counterparty = actor")
    return errs


def anchoring_check(parsed: ClauseTemplateExtraction, clause: dict) -> list[dict]:
    """Pour chaque champ décisif non-« not_stated/none_stated », cherche un déclencheur lexical dans l'evidence.
    Retourne la liste des champs NON ancrés (candidats hallucination) ; heuristique déclarée, pas une vérité."""
    flags = []
    for k, norm in enumerate(parsed.norms):
        ev = " ".join(clause["sentences"][i]["text"].lower() for i in norm.evidence if 0 <= i < len(clause["sentences"]))
        for field in ("condition", "notice", "remedy"):
            val = getattr(norm, field)
            if val in ("not_stated", "none_stated"):
                continue
            triggers = LEXICAL_TRIGGERS[field].get(val, [])
            if triggers and not any(t in ev for t in triggers):
                flags.append({"norm": k, "field": field, "value": val})
    return flags


def apply_corrections(parsed: ClauseTemplateExtraction, flags: list[dict]) -> ClauseTemplateExtraction:
    data = parsed.model_dump()
    for f in flags:
        norm = data["norms"][f["norm"]]
        norm[f["field"]] = "none_stated" if f["field"] == "condition" else "not_stated"
        if f["field"] == "notice":
            norm["notice_duration_days"] = None
        norm.setdefault("flags", [])
    return ClauseTemplateExtraction(**{k: v for k, v in data.items()})


# ------------------------------------------------------------------ appel modèle -----------------------------------

def call_model(client, model: str, system: str, user: str, effort: str, timeout_s: float = 300.0):
    """Sortie structurée (Pydantic) ; adaptive thinking par défaut sur Opus 5 (omettre `thinking`)."""
    t0 = time.time()
    resp = client.with_options(timeout=timeout_s).messages.parse(
        model=model,
        max_tokens=4000,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_format=ClauseTemplateExtraction,
        output_config={"effort": effort},
    )
    if getattr(resp, "stop_reason", None) == "refusal":
        return None, resp.usage, time.time() - t0, "refusal"
    return resp.parsed_output, resp.usage, time.time() - t0, resp.stop_reason


def stub_model(clause: dict) -> ClauseTemplateExtraction:
    """Stub déterministe pour --dry-run : ne fabrique aucune norme (pipeline testable sans API)."""
    return ClauseTemplateExtraction(clause_id=clause["clause_id"], norms=[], no_norm_reason="not_applicable")


# ------------------------------------------------------------------ main -------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clauses", required=True)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--effort", default="high", choices=["low", "medium", "high", "xhigh", "max"])
    ap.add_argument("--repeat", type=int, default=1, help="exécutions indépendantes (reproductibilité)")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    clauses = [json.loads(l) for l in Path(args.clauses).open(encoding="utf-8") if l.strip()]
    if args.limit:
        clauses = clauses[: args.limit]
    system, user_tpl, prompt_hash = load_prompt()
    schema_hash = hashlib.sha256(SCHEMA_PATH.read_bytes()).hexdigest()
    run_id = str(uuid.uuid4())
    out = Path(args.out) if args.out else ROOT / "results" / "extraction" / run_id
    out.mkdir(parents=True, exist_ok=True)
    try:
        code_version = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:  # noqa: BLE001
        code_version = "unknown"

    client = None
    if not args.dry_run:
        import anthropic  # import tardif : le dry-run ne l'exige pas
        client = anthropic.Anthropic()

    record = {"run_id": run_id, "kind": "extraction", "model": None if args.dry_run else args.model, "effort": args.effort,
              "prompt": str(PROMPT_PATH.relative_to(ROOT)), "prompt_hash": prompt_hash, "schema_hash": schema_hash,
              "temperature": 0.0, "repeat": args.repeat, "clauses": str(Path(args.clauses)), "n_clauses": len(clauses),
              "code_version": code_version, "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
              "dry_run": args.dry_run, "tokens_in": 0, "tokens_out": 0, "refusals": 0}
    (out / "prompt.md").write_text(PROMPT_PATH.read_text(encoding="utf-8"), encoding="utf-8")

    files = {k: (out / f"step_{k}.jsonl").open("w", encoding="utf-8") for k in ("1_raw", "2_structural", "3_semantic", "4_anchoring", "5_corrected")}
    stats = {"schema_ok": 0, "structural_ok": 0, "semantic_ok": 0, "anchoring_flags": 0, "norms": 0, "empty": 0, "identical_across_repeats": 0}
    per_clause_outputs: dict[str, list[str]] = {}

    for c in clauses:
        for r in range(args.repeat):
            if args.dry_run:
                parsed, usage, dt, stop = stub_model(c), None, 0.0, "end_turn"
            else:
                parsed, usage, dt, stop = call_model(client, args.model, system, render_user(user_tpl, c), args.effort)
                record["tokens_in"] += getattr(usage, "input_tokens", 0) or 0
                record["tokens_out"] += getattr(usage, "output_tokens", 0) or 0
            base = {"clause_id": c["clause_id"], "repeat": r, "stop_reason": stop, "latency_s": round(dt, 2)}
            if parsed is None:
                record["refusals"] += 1
                files["1_raw"].write(json.dumps({**base, "output": None}) + "\n")
                continue
            parsed.clause_id = c["clause_id"]
            raw = parsed.model_dump()
            files["1_raw"].write(json.dumps({**base, "output": raw}, ensure_ascii=False) + "\n")
            stats["schema_ok"] += 1
            per_clause_outputs.setdefault(c["clause_id"], []).append(json.dumps(raw, sort_keys=True))
            e2 = structural_check(parsed, c)
            files["2_structural"].write(json.dumps({**base, "errors": e2}, ensure_ascii=False) + "\n")
            if not e2:
                stats["structural_ok"] += 1
            e3 = semantic_check(parsed)
            files["3_semantic"].write(json.dumps({**base, "errors": e3}, ensure_ascii=False) + "\n")
            if not e3:
                stats["semantic_ok"] += 1
            flags = anchoring_check(parsed, c)
            stats["anchoring_flags"] += len(flags)
            files["4_anchoring"].write(json.dumps({**base, "flags": flags}, ensure_ascii=False) + "\n")
            corrected = apply_corrections(parsed, flags) if flags else parsed
            stats["norms"] += len(corrected.norms)
            stats["empty"] += int(not corrected.norms)
            files["5_corrected"].write(json.dumps({**base, "status": "proposed", "output": corrected.model_dump(),
                                                   "structural_errors": e2, "semantic_errors": e3, "anchoring_flags": flags}, ensure_ascii=False) + "\n")
    for fh in files.values():
        fh.close()

    if args.repeat > 1:
        stats["identical_across_repeats"] = sum(1 for outs in per_clause_outputs.values() if len(set(outs)) == 1 and len(outs) == args.repeat)
    n_calls = len(clauses) * args.repeat
    record.update({"ended_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "n_calls": n_calls,
                   "metrics": {"schema_compliance": round(stats["schema_ok"] / n_calls, 4) if n_calls else None,
                               "structural_pass": round(stats["structural_ok"] / max(stats["schema_ok"], 1), 4),
                               "semantic_pass": round(stats["semantic_ok"] / max(stats["schema_ok"], 1), 4),
                               "anchoring_flags_per_norm": round(stats["anchoring_flags"] / max(stats["norms"], 1), 4),
                               "norms_per_clause": round(stats["norms"] / max(stats["schema_ok"], 1), 3),
                               "empty_share": round(stats["empty"] / max(stats["schema_ok"], 1), 4),
                               "reproducibility_identical": round(stats["identical_across_repeats"] / len(clauses), 4) if args.repeat > 1 else None}})
    (out / "run.json").write_text(json.dumps(record, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"run_id": run_id, "out": str(out), **record["metrics"], "tokens_in": record["tokens_in"], "tokens_out": record["tokens_out"]}, ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())
