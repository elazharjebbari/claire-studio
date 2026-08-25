"""Δ appariés d'α-MASI entre schémas — mêmes tirages bootstrap de documents."""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "research"))

from pactiva_lab.evaluation.agreement import _AlphaPool, _rng_ints, masi_distance  # noqa: E402

BASE = Path(sys.argv[1])  # dossier d'export du Lab (manifest.json, votes.jsonl, ...)
votes = [json.loads(l) for l in (BASE / "votes.jsonl").read_text().splitlines() if l.strip()]

from schemes import SCHEMES, remap_set  # noqa: E402

by_sentence = defaultdict(list)
for r in votes:
    by_sentence[(r["document"], r["index"])].append(
        frozenset([r["primary"], *r["secondaries"]])
    )

pools = {}
for name, mapping in SCHEMES.items():
    units_by_doc = defaultdict(list)
    for (doc, idx), sets in sorted(by_sentence.items()):
        if len(sets) < 2:
            continue
        units_by_doc[doc].append([remap_set(s, mapping) for s in sets])
    pools[name] = _AlphaPool(units_by_doc, masi_distance)

ref = "T20-statuquo"
docs = pools[ref].documents
out = {}
for name in SCHEMES:
    if name == ref:
        continue
    deltas = []
    sign_flips = 0
    for draw in _rng_ints(42, "fusion-paired", len(docs), 1000):
        sample = [docs[i] for i in draw]
        a = pools[name].alpha(sample)
        b = pools[ref].alpha(sample)
        if a is None or b is None:
            continue
        d = a - b
        deltas.append(d)
        if d <= 0:
            sign_flips += 1
    deltas.sort()
    point = pools[name].alpha(docs) - pools[ref].alpha(docs)
    out[name] = {
        "delta_point": round(point, 4),
        "low": round(deltas[int(0.025 * len(deltas))], 4),
        "high": round(deltas[min(len(deltas) - 1, int(0.975 * len(deltas)))], 4),
        "sign_stability": round(1 - sign_flips / len(deltas), 4),
        "n_resamples": len(deltas),
    }
    print(name, out[name])

(Path(__file__).parent / "resultats" / "paired_results.json").write_text(json.dumps(out, indent=1))
