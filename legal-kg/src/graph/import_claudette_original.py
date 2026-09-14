#!/usr/bin/env python3
"""Réimporte depuis les documents CLAUDETTE originaux tagués (data/claudette_tos/OriginalTaggedDocuments/*.xml)
ce que l'export Lab a perdu : la SÉVÉRITÉ (1/2/3) de chaque label et les SECTIONS (« * Titre »).

Méthode :
  * les sections sont les phrases de l'export dont le texte commence par « * » (titres conservés comme phrases) ;
  * la sévérité est récupérée par alignement séquentiel des phrases de l'export sur le texte nettoyé du XML
    (normalisation alphanumérique, recherche par préfixe croissant), puis par recouvrement des spans tagués
    <ltd2>…</ltd2> avec les spans de phrases ; une phrase non alignée garde level = null (jamais deviné) ;
  * contrôle : les fichiers Labels_<CAT>/<doc>.txt (une ligne par phrase, 1/-1) doivent coïncider avec
    reference.jsonl — l'écart est rapporté, pas corrigé.

Sorties : data/annotations/claudette_severity.jsonl, data/annotations/sections.jsonl, data/annotations/IMPORT_REPORT.json
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ORIG = ROOT.parent / "data" / "claudette_tos"
TAG_RE = re.compile(r"<(/?)([a-z]+)([0-9])?>")
CATS = {"ltd": "LTD", "ter": "TER", "ch": "CH", "cr": "CR", "use": "USE", "law": "LAW", "j": "J", "a": "A"}


def norm(t: str) -> str:
    return re.sub(r"[^a-z0-9]", "", t.lower())


def parse_tagged(raw: str):
    """Texte nettoyé + liste de spans (start, end, cat, level) en coordonnées du texte nettoyé."""
    clean, spans, open_tags, pos = [], [], {}, 0
    for m in TAG_RE.finditer(raw):
        clean.append(raw[pos:m.start()])
        cur = sum(len(x) for x in clean)
        closing, name, level = m.group(1) == "/", m.group(2), m.group(3)
        if not closing:
            open_tags.setdefault(name, []).append((cur, int(level) if level else None))
        elif open_tags.get(name):
            start, lvl = open_tags[name].pop()
            spans.append((start, cur, CATS.get(name, name.upper()), lvl))
        pos = m.end()
    clean.append(raw[pos:])
    return "".join(clean), spans


def align(sentences: list[dict], clean: str):
    """Alignement séquentiel : pour chaque phrase, position dans le texte nettoyé normalisé.
    On travaille sur la version normalisée avec une table de correspondance vers les offsets bruts."""
    keep = [i for i, ch in enumerate(clean) if ch.isalnum()]
    cn = "".join(clean[i].lower() for i in keep)
    ptr, out = 0, []
    for s in sentences:
        ns = norm(s.get("text_detok") or s["text"])
        found = None
        for k in (len(ns), 60, 40, 25):
            if k <= 0 or k > len(ns):
                continue
            idx = cn.find(ns[:k], ptr)
            if idx >= 0 and idx - ptr < 4000:      # pas de saut aberrant
                found = (idx, idx + len(ns) if k == len(ns) else idx + k)
                break
        if found:
            a, b = found
            out.append((keep[a], keep[min(b, len(keep)) - 1] + 1))
            ptr = b
        else:
            out.append(None)
    return out


def main():
    dp = ROOT / "data" / "processed"
    out_dir = ROOT / "data" / "annotations"
    out_dir.mkdir(parents=True, exist_ok=True)
    sentences = [json.loads(l) for l in (dp / "sentences.jsonl").open(encoding="utf-8") if l.strip()]
    reference = [json.loads(l) for l in (dp / "reference.jsonl").open(encoding="utf-8") if l.strip()]
    ref_set = {(r["document"], r["index"], r["category"]) for r in reference}
    by_doc = defaultdict(list)
    for s in sentences:
        by_doc[s["document"]].append(s)

    sev_rows, sec_rows, report = [], [], {"documents": 0, "aligned": 0, "unaligned": 0, "labels_with_severity": 0,
                                          "labels_in_reference": len(ref_set), "severity_by_category": defaultdict(Counter),
                                          "mismatch_reference_vs_labelfiles": 0, "sections_total": 0, "docs_missing_xml": []}
    for doc, ss in sorted(by_doc.items()):
        ss.sort(key=lambda s: s["index"])
        xml = ORIG / "OriginalTaggedDocuments" / f"{doc}.xml"
        if not xml.exists():
            report["docs_missing_xml"].append(doc)
            continue
        report["documents"] += 1
        clean, spans = parse_tagged(xml.read_text(encoding="utf-8", errors="replace"))
        pos = align(ss, clean)
        # sections : lignes « * Titre » du XML original ; chaque phrase alignée est rattachée au dernier titre
        # qui la précède ; les phrases non alignées héritent de la section de la phrase alignée précédente.
        titles = [(m.start(), m.group(1).strip()) for m in re.finditer(r"^\* ?(.+)$", clean, flags=re.M)]
        assign, current = [], -1
        for s, p in zip(ss, pos):
            if p:
                while current + 1 < len(titles) and titles[current + 1][0] <= p[0]:
                    current += 1
            assign.append(current)
        for k, (_, title) in enumerate(titles):
            idxs = [s["index"] for s, a in zip(ss, assign) if a == k]
            if idxs:
                sec_rows.append({"document": doc, "order": k, "title": title, "start_index": min(idxs), "end_index": max(idxs)})
        report["sections_total"] += len(titles)
        report["aligned"] += sum(1 for p in pos if p)
        report["unaligned"] += sum(1 for p in pos if not p)
        for s, p in zip(ss, pos):
            if not p:
                continue
            a, b = p
            for (x, y, cat, lvl) in spans:
                if x < b and y > a and lvl is not None:              # recouvrement
                    key = (doc, s["index"], cat)
                    sev_rows.append({"document": doc, "index": s["index"], "category": cat, "level": lvl,
                                     "in_reference": key in ref_set, "source": "OriginalTaggedDocuments"})
        # contrôle avec Labels_<CAT>/<doc>.txt
        for short, cat in CATS.items():
            f = ORIG / f"Labels_{cat}" / f"{doc}.txt"
            if f.exists():
                vals = [v.strip() for v in f.read_text().splitlines() if v.strip()]
                if len(vals) == len(ss):
                    for s, v in zip(ss, vals):
                        if (v == "1") != ((doc, s["index"], cat) in ref_set):
                            report["mismatch_reference_vs_labelfiles"] += 1
    # dédup (une phrase peut recouvrir deux spans du même tag) : garder le niveau max
    best = {}
    for r in sev_rows:
        k = (r["document"], r["index"], r["category"])
        if k not in best or r["level"] > best[k]["level"]:
            best[k] = r
    sev_rows = list(best.values())
    for r in sev_rows:
        report["severity_by_category"][r["category"]][r["level"]] += 1
    report["labels_with_severity"] = sum(1 for r in sev_rows if r["in_reference"])
    report["coverage_of_reference"] = round(report["labels_with_severity"] / len(ref_set), 4)
    report["severity_by_category"] = {c: dict(v) for c, v in report["severity_by_category"].items()}
    with (out_dir / "claudette_severity.jsonl").open("w", encoding="utf-8") as fh:
        for r in sorted(sev_rows, key=lambda r: (r["document"], r["index"], r["category"])):
            fh.write(json.dumps(r) + "\n")
    with (out_dir / "sections.jsonl").open("w", encoding="utf-8") as fh:
        for r in sec_rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    (out_dir / "IMPORT_REPORT.json").write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "severity_by_category"}, ensure_ascii=False))
    print(json.dumps(report["severity_by_category"]))


if __name__ == "__main__":
    main()
