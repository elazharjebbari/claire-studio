#!/usr/bin/env python3
"""Construit les jeux de clauses pour l'extraction de templates (phase 5).

Sorties (data/annotations/) :
  clauses_all.jsonl        — 2 450 clauses consensus (T20 → thème T11 majoritaire, inventaire d'actions,
                             phrases, population, découpe ≤ MAX_LEN phrases → sous-clauses `a`, `b`, …)
  pilot_100/clauses.jsonl  — pilote : 100 clauses de CONCEPTION, stratifiées par thème T11 (proportionnel,
                             minimum 3 par thème présent), 20 % de clauses longues (≥ 5 phrases), graine 42
  holdout/clauses.jsonl    — toutes les clauses des 17 documents de validation (thèmes cibles d'abord)

Le thème T11 vient de la projection figée (taxonomies.json) ; l'inventaire d'actions du schéma YAML.
Aucune information d'abusivité n'est écrite dans ces fichiers (étanchéité : l'extracteur ne doit rien en voir).
"""
from __future__ import annotations

import json
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAX_LEN = 8
SEED = 42
TARGET_T11 = ["TERMINATION", "MODIFICATION_OF_TERMS", "LIMITATION_LIABILITY", "DISPUTES_LAW", "FEES_PAYMENT",
              "FRAMEWORK", "CONTENT_IP", "WARRANTY_DISCLAIMER", "ACCOUNT_USE", "THIRD_PARTY_SERVICES", "PRIVACY_DATA"]


def read_jsonl(p):
    return [json.loads(l) for l in p.open(encoding="utf-8") if l.strip()]


def load_action_inventory():
    """Lit vocabularies.action_by_theme_T11 du schéma sans dépendre de PyYAML (parsing minimal)."""
    inv, inside = {}, False
    for line in (ROOT / "ontology" / "legal_kg_schema.yaml").read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("action_by_theme_T11:"):
            inside = True
            continue
        if inside:
            if not line.startswith("    ") or not line.strip():
                if line.strip() and not line.startswith("    "):
                    break
                continue
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            stripped = stripped.split("#", 1)[0].strip()          # commentaire en fin de ligne ignoré
            key, _, val = stripped.partition(":")
            inv[key] = [a.strip() for a in val.strip().strip("[]").split(",") if a.strip()]
    return inv


def main():
    dp = ROOT / "data" / "processed"
    out = ROOT / "data" / "annotations"
    (out / "pilot_100").mkdir(parents=True, exist_ok=True)
    (out / "holdout").mkdir(parents=True, exist_ok=True)
    sentences = read_jsonl(dp / "sentences.jsonl")
    spec = json.loads((ROOT.parent / "frontend/src/lib/taxonomy/taxonomies.json").read_text(encoding="utf-8"))
    t11 = next(t for t in spec["taxonomies"] if t["id"] == "T11")
    to_t11 = {m: c["code"] for c in t11["categories"] for m in c.get("members", [])}
    populations = {d: p for p, v in spec["populations"].items() for d in v["documents"]}
    inventory = load_action_inventory()

    by_doc = defaultdict(list)
    for s in sentences:
        by_doc[s["document"]].append(s)
    clauses = []
    for d, ss in by_doc.items():
        ss.sort(key=lambda s: s["index"])
        runs, cur, prev = [], [], None
        for s in ss:
            sig = tuple(sorted(s.get("themes") or [s["primary"]]))
            if sig != prev and cur:
                runs.append(cur); cur = []
            cur.append(s); prev = sig
        if cur:
            runs.append(cur)
        for k, run in enumerate(runs):
            # découpe des clauses longues en sous-clauses de ≤ MAX_LEN phrases
            chunks = [run[i:i + MAX_LEN] for i in range(0, len(run), MAX_LEN)]
            for j, chunk in enumerate(chunks):
                suffix = "" if len(chunks) == 1 else chr(ord("a") + j)
                themes20 = sorted({t for s in chunk for t in (s.get("themes") or [s["primary"]])})
                prim20 = Counter(s["primary"] for s in chunk).most_common(1)[0][0]
                theme11 = to_t11.get(prim20, prim20)
                clauses.append({
                    "clause_id": f"clause:{d}:consensus:{chunk[0]['index']:04d}{suffix}",
                    "document": d, "population": populations.get(d, ""),
                    "start": chunk[0]["index"], "end": chunk[-1]["index"], "n_sentences": len(chunk),
                    "theme_T20_primary": prim20, "themes_T20": themes20, "theme_T11": theme11,
                    "themes_T11": sorted({to_t11.get(t, t) for t in themes20}),
                    "action_inventory": inventory.get(theme11, []) + ["other"],
                    "sentences": [{"index": s["index"], "text": s.get("text_detok") or s["text"]} for s in chunk],
                    "split_of_long_clause": len(chunks) > 1,
                })
    with (out / "clauses_all.jsonl").open("w", encoding="utf-8") as fh:
        for c in clauses:
            fh.write(json.dumps(c, ensure_ascii=False) + "\n")

    # ---- pilote : 100 clauses de conception, stratifiées par thème T11, 20 % longues ---------------
    rng = random.Random(SEED)
    design = [c for c in clauses if c["population"] == "designSet" and c["theme_T11"] in TARGET_T11]
    by_theme = defaultdict(list)
    for c in design:
        by_theme[c["theme_T11"]].append(c)
    total = len(design)
    # Quotas : proportionnels au corpus de conception, avec un PLANCHER de 8 pour les cinq thèmes qui portent
    # les items structurels de l'annexe (g, j/k/l, a/b, q, d/e/h) — sinon le pilote ne teste presque pas les
    # champs décisifs (condition, préavis, recours) — et 3 pour les autres thèmes présents.
    FLOOR8 = {"TERMINATION", "MODIFICATION_OF_TERMS", "LIMITATION_LIABILITY", "DISPUTES_LAW", "FEES_PAYMENT"}
    quota = {t: max(8 if t in FLOOR8 else 3, round(100 * len(v) / total)) for t, v in by_theme.items()}
    # ajuster à 100
    while sum(quota.values()) > 100:
        t = max((k for k in quota if quota[k] > (8 if k in FLOOR8 else 3)), key=quota.get); quota[t] -= 1
    while sum(quota.values()) < 100:
        t = max(by_theme, key=lambda k: len(by_theme[k]) / quota[k]); quota[t] += 1
    pilot = []
    for t, q in quota.items():
        pool = by_theme[t][:]
        rng.shuffle(pool)
        longs = [c for c in pool if c["n_sentences"] >= 5]
        shorts = [c for c in pool if c["n_sentences"] < 5]
        n_long = min(len(longs), max(1, round(0.2 * q)))
        pick = longs[:n_long] + shorts[:q - n_long]
        if len(pick) < q:
            pick += [c for c in pool if c not in pick][:q - len(pick)]
        pilot += pick
    rng.shuffle(pilot)
    with (out / "pilot_100" / "clauses.jsonl").open("w", encoding="utf-8") as fh:
        for c in pilot:
            fh.write(json.dumps(c, ensure_ascii=False) + "\n")

    # ---- hold-out : toutes les clauses des 17 documents, cibles d'abord --------------------------------
    hold = sorted([c for c in clauses if c["population"] == "holdout"],
                  key=lambda c: (c["theme_T11"] not in TARGET_T11, c["document"], c["start"]))
    with (out / "holdout" / "clauses.jsonl").open("w", encoding="utf-8") as fh:
        for c in hold:
            fh.write(json.dumps(c, ensure_ascii=False) + "\n")

    summary = {"clauses_all": len(clauses), "split_long": sum(c["split_of_long_clause"] for c in clauses),
               "pilot": len(pilot), "pilot_by_theme": dict(Counter(c["theme_T11"] for c in pilot)),
               "pilot_long_share": round(sum(c["n_sentences"] >= 5 for c in pilot) / len(pilot), 2),
               "holdout": len(hold), "holdout_target": sum(c["theme_T11"] in TARGET_T11 for c in hold)}
    (out / "SUMMARY.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
