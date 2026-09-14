#!/usr/bin/env python3
"""Construit les CSV d'ingestion Memgraph des couches L1 (documentaire), L2 (thématique) et
L4-référence (LABELED) du modèle D, depuis data/processed/ (export Lab 7116e627…).

Sortie : graph/export/<fingerprint8>/<run_id>/*.csv + run.csv, lisibles par graph/cypher/01_ingest.cypher.
Aucune dépendance hors bibliothèque standard. Idempotent (les identifiants sont déterministes).

Couches produites : Document, Sentence, NEXT, Clause(consensus + par annotateur + gold), CONTAINS,
Theme (T20 + projections T14/T11/T10 si la spécification est disponible), HAS_THEME (consensus, votes,
juges, gold), Annotation, GoldDecision, LABELED, Run. L3 (Norm) est produite par src/extraction après
validation, jamais ici.

Usage : python src/graph/build_document_graph.py [--root legal-kg] [--taxonomy-spec path]
"""
from __future__ import annotations

import argparse
import csv
import json
import subprocess
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


def read_jsonl(p: Path) -> list[dict]:
    with p.open(encoding="utf-8") as fh:
        return [json.loads(l) for l in fh if l.strip()]


def write_csv(p: Path, rows: list[dict], fields: list[str]) -> int:
    with p.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})
    return len(rows)


def git_sha(root: Path) -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    except Exception:  # noqa: BLE001
        return "unknown"


def clauses_from_sequence(document: str, seq: list[tuple[int, tuple]], source: str) -> list[dict]:
    """Plages maximales d'indices consécutifs partageant la même signature de thèmes."""
    out, start, prev = [], None, None
    for idx, sig in seq:
        if sig != prev:
            if prev is not None:
                out.append((start, idx - 1, prev))
            start, prev = idx, sig
    if prev is not None:
        out.append((start, seq[-1][0], prev))
    return [{"id": f"clause:{document}:{source}:{s:04d}", "document": document, "document_id": f"document:{document}",
             "source": source, "start": s, "end": e, "n_sentences": e - s + 1,
             "themes_signature": "+".join(sig), "taxonomy": "T20"} for s, e, sig in out]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=str(Path(__file__).resolve().parents[2]))
    ap.add_argument("--taxonomy-spec", default=None)
    args = ap.parse_args()
    root = Path(args.root)
    dp = root / "data" / "processed"
    manifest = json.loads((dp / "manifest.json").read_text(encoding="utf-8"))
    fp = (manifest.get("fingerprint") or "unknown")[:8]
    run_id = str(uuid.uuid4())
    out = root / "graph" / "export" / fp / run_id
    out.mkdir(parents=True, exist_ok=True)

    sentences = read_jsonl(dp / "sentences.jsonl")
    reference = read_jsonl(dp / "reference.jsonl")
    votes = read_jsonl(dp / "votes.jsonl")
    judges = read_jsonl(dp / "judges.jsonl")
    gold = read_jsonl(dp / "gold.jsonl")
    labels = json.loads((dp / "labels.json").read_text(encoding="utf-8"))

    spec_path = Path(args.taxonomy_spec) if args.taxonomy_spec else root.parent / "frontend/src/lib/taxonomy/taxonomies.json"
    spec = json.loads(spec_path.read_text(encoding="utf-8")) if spec_path.exists() else {}
    populations = {d: p for p, v in spec.get("populations", {}).items() for d in v.get("documents", [])}
    spec_version = spec.get("specVersion", "unknown")

    counts = {}
    sid = lambda d, i: f"sentence:{d}:{i}"

    # ---- Documents ---------------------------------------------------------------------------
    docs = sorted({s["document"] for s in sentences})
    n_by_doc = defaultdict(int)
    for s in sentences:
        n_by_doc[s["document"]] += 1
    counts["documents"] = write_csv(out / "documents.csv", [
        {"id": f"document:{d}", "name": d, "population": populations.get(d, ""), "n_sentences": n_by_doc[d],
         "source_corpus": "CLAUDETTE", "agreement_alpha": ""} for d in docs],
        ["id", "name", "population", "n_sentences", "source_corpus", "agreement_alpha"])

    # ---- Sentences + NEXT -----------------------------------------------------------------------
    sentences.sort(key=lambda s: (s["document"], s["index"]))
    counts["sentences"] = write_csv(out / "sentences.csv", [
        {"id": sid(s["document"], s["index"]), "document": s["document"], "document_id": f"document:{s['document']}",
         "index": s["index"], "text": s["text"], "text_detok": s.get("text_detok", ""),
         "n_tokens": len(s["text"].split()), "doc_position": s.get("doc_position", "")} for s in sentences],
        ["id", "document", "document_id", "index", "text", "text_detok", "n_tokens", "doc_position"])
    nxt = []
    for a, b in zip(sentences, sentences[1:]):
        if a["document"] == b["document"]:
            nxt.append({"from_id": sid(a["document"], a["index"]), "to_id": sid(b["document"], b["index"])})
    counts["sentence_next"] = write_csv(out / "sentence_next.csv", nxt, ["from_id", "to_id"])

    # ---- Themes (T20 + projections) ---------------------------------------------------------------
    # Spécification : liste de taxonomies {id, label, categories: [{code, label, description, members: [codes T20]}]}
    taxos = spec.get("taxonomies") or []
    if isinstance(taxos, dict):  # tolérance à une forme dictionnaire
        taxos = [{"id": k, **v} for k, v in taxos.items()]
    t20_labels = {}
    for tdef in taxos:
        if tdef.get("id") == "T20":
            t20_labels = {c["code"]: c.get("label", c["code"]) for c in tdef.get("categories", [])}
    theme_rows = [{"key": f"{l['code']}@T20", "code": l["code"], "taxonomy": "T20",
                   "label": t20_labels.get(l["code"], l["code"]), "stratum": ""} for l in labels]
    proj_rows = []
    for tdef in taxos:
        tax = tdef.get("id")
        if not tax or tax == "T20":
            continue
        for cat in tdef.get("categories", []):
            theme_rows.append({"key": f"{cat['code']}@{tax}", "code": cat["code"], "taxonomy": tax,
                               "label": cat.get("label", cat["code"]), "stratum": ""})
            for member in cat.get("members", []):
                proj_rows.append({"from_key": f"{member}@T20", "to_key": f"{cat['code']}@{tax}", "spec_version": spec_version})
    counts["themes"] = write_csv(out / "themes.csv", theme_rows, ["key", "code", "taxonomy", "label", "stratum"])
    counts["theme_projections"] = write_csv(out / "theme_projections.csv", proj_rows, ["from_key", "to_key", "spec_version"])

    # ---- HAS_THEME (consensus) + clauses consensus ---------------------------------------------------
    st = []
    seq_by_doc: dict[str, list[tuple[int, tuple]]] = defaultdict(list)
    for s in sentences:
        themes = s.get("themes") or [s["primary"]]
        st.append({"sentence_id": sid(s["document"], s["index"]), "theme_key": f"{s['primary']}@T20", "source": "consensus",
                   "role": "primary", "confidence": s.get("confidence", ""), "run_id": run_id})
        for t in themes:
            if t != s["primary"]:
                st.append({"sentence_id": sid(s["document"], s["index"]), "theme_key": f"{t}@T20", "source": "consensus",
                           "role": "secondary", "confidence": s.get("confidence", ""), "run_id": run_id})
        seq_by_doc[s["document"]].append((s["index"], tuple(sorted(themes))))
    clause_rows, cs_rows = [], []
    for d, seq in seq_by_doc.items():
        for c in clauses_from_sequence(d, seq, "consensus"):
            clause_rows.append(c)
            cs_rows += [{"clause_id": c["id"], "sentence_id": sid(d, i)} for i in range(c["start"], c["end"] + 1)]

    # ---- Votes → Annotation + HAS_THEME(human) + clauses par annotateur ------------------------------
    ann_rows = []
    seq_by_doc_ann: dict[tuple, list[tuple[int, tuple]]] = defaultdict(list)
    for v in votes:
        aid = f"annotation:{v['document']}:{v['index']}:{v['annotator']}"
        ann_rows.append({"id": aid, "sentence_id": sid(v["document"], v["index"]), "annotator": v["annotator"], "source": "human",
                         "primary": v["primary"], "secondaries": "|".join(v.get("secondaries", [])), "model": "", "version": "",
                         "is_segment_start": ""})
        st.append({"sentence_id": sid(v["document"], v["index"]), "theme_key": f"{v['primary']}@T20", "source": v["annotator"],
                   "role": "primary", "confidence": 1.0, "run_id": run_id})
        for t in v.get("secondaries", []):
            st.append({"sentence_id": sid(v["document"], v["index"]), "theme_key": f"{t}@T20", "source": v["annotator"],
                       "role": "secondary", "confidence": 1.0, "run_id": run_id})
        seq_by_doc_ann[(v["document"], v["annotator"])].append((v["index"], tuple(sorted({v["primary"], *v.get("secondaries", [])}))))
    for (d, a), seq in seq_by_doc_ann.items():
        seq.sort()
        for c in clauses_from_sequence(d, seq, a.split(".")[0]):
            clause_rows.append(c)
            cs_rows += [{"clause_id": c["id"], "sentence_id": sid(d, i)} for i in range(c["start"], c["end"] + 1)]

    # ---- Judges → Annotation(llm) + HAS_THEME(llm) ---------------------------------------------------
    for j in judges:
        aid = f"annotation:{j['document']}:{j['index']}:{j['judge']}"
        ann_rows.append({"id": aid, "sentence_id": sid(j["document"], j["index"]), "annotator": j["judge"], "source": "llm",
                         "primary": j["theme"], "secondaries": "", "model": j["judge"], "version": "v9.2",
                         "is_segment_start": str(bool(j.get("is_segment_start"))).lower()})
        st.append({"sentence_id": sid(j["document"], j["index"]), "theme_key": f"{j['theme']}@T20", "source": j["judge"],
                   "role": "primary", "confidence": "", "run_id": run_id})

    # ---- Gold → GoldDecision + HAS_THEME(gold) --------------------------------------------------------
    gold_rows = []
    for g in gold:
        gid = f"gold:{g['document']}:{g['index']}"
        gold_rows.append({"id": gid, "sentence_id": sid(g["document"], g["index"]), "agreement_class": g["agreement_class"],
                          "auto_level": g["auto_level"], "risk_band": g.get("risk_band", ""), "confidence": g.get("confidence", ""),
                          "decided_primary": g.get("decided_primary", ""), "finalized": str(bool(g.get("finalized"))).lower(),
                          "tally": json.dumps(g.get("tally", {}), ensure_ascii=False)})
        if g.get("decided_primary"):
            st.append({"sentence_id": sid(g["document"], g["index"]), "theme_key": f"{g['decided_primary']}@T20", "source": "gold",
                       "role": "primary", "confidence": g.get("confidence", ""), "run_id": run_id})

    counts["clauses"] = write_csv(out / "clauses.csv", clause_rows,
                                  ["id", "document", "document_id", "source", "start", "end", "n_sentences", "themes_signature", "taxonomy"])
    counts["clause_sentences"] = write_csv(out / "clause_sentences.csv", cs_rows, ["clause_id", "sentence_id"])
    counts["sentence_themes"] = write_csv(out / "sentence_themes.csv", st, ["sentence_id", "theme_key", "source", "role", "confidence", "run_id"])
    counts["annotations"] = write_csv(out / "annotations.csv", ann_rows,
                                      ["id", "sentence_id", "annotator", "source", "primary", "secondaries", "model", "version", "is_segment_start"])
    counts["gold"] = write_csv(out / "gold.csv", gold_rows,
                               ["id", "sentence_id", "agreement_class", "auto_level", "risk_band", "confidence", "decided_primary", "finalized", "tally"])

    # ---- LABELED (référence CLAUDETTE) + sévérité réimportée des XML originaux si disponible ----------------
    sev_path = root / "data" / "annotations" / "claudette_severity.jsonl"
    severity = {}
    if sev_path.exists():
        for r in read_jsonl(sev_path):
            severity[(r["document"], r["index"], r["category"])] = r["level"]
    counts["labels"] = write_csv(out / "labels.csv", [
        {"sentence_id": sid(r["document"], r["index"]), "category": r["category"],
         "severity": severity.get((r["document"], r["index"], r["category"]), "")} for r in reference],
        ["sentence_id", "category", "severity"])
    counts["labels_with_severity"] = sum(1 for r in reference if (r["document"], r["index"], r["category"]) in severity)

    # ---- Sections (XML originaux) ---------------------------------------------------------------------
    sec_path = root / "data" / "annotations" / "sections.jsonl"
    sec_rows, sec_sent = [], []
    if sec_path.exists():
        for r in read_jsonl(sec_path):
            sec_id = f"section:{r['document']}:{r['order']:03d}"
            sec_rows.append({"id": sec_id, "document": r["document"], "document_id": f"document:{r['document']}",
                             "order": r["order"], "title": r["title"], "start": r["start_index"], "end": r["end_index"]})
            sec_sent += [{"section_id": sec_id, "sentence_id": sid(r["document"], i)} for i in range(r["start_index"], r["end_index"] + 1)]
    counts["sections"] = write_csv(out / "sections.csv", sec_rows, ["id", "document", "document_id", "order", "title", "start", "end"])
    counts["section_sentences"] = write_csv(out / "section_sentences.csv", sec_sent, ["section_id", "sentence_id"])

    # ---- Run -------------------------------------------------------------------------------------
    write_csv(out / "run.csv", [{"id": run_id, "kind": "graph_build", "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                 "code_version": git_sha(root), "dataset": manifest.get("fingerprint", "")}],
              ["id", "kind", "started_at", "code_version", "dataset"])
    (out / "BUILD.json").write_text(json.dumps({"run_id": run_id, "dataset": manifest.get("fingerprint"), "counts": counts,
                                                "spec_version": spec_version, "layers": ["L1 (+sections)", "L2", "L4-reference (+severity)"]}, indent=1), encoding="utf-8")
    latest = root / "graph" / "export" / fp / "LATEST"
    latest.write_text(run_id, encoding="utf-8")
    print(json.dumps({"ok": True, "out": str(out), "counts": counts}))


if __name__ == "__main__":
    main()
