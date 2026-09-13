"""E1 — coût du multi-label sur le corpus complet, + sous schéma T11."""
import json, sys
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, "/Users/elazhar/PycharmProjects/claire-studio/research")
sys.path.insert(0, "/Users/elazhar/PycharmProjects/claire-studio/docs/pactiva-fusion-classes/scripts")
from pactiva_lab.evaluation.agreement import alpha_masi_vs_nominal, alpha_set_ci, masi_distance
from schemes import SCHEMES, remap, remap_set

BASE = Path(sys.argv[1])
votes = [json.loads(l) for l in (BASE / "votes.jsonl").read_text().splitlines() if l.strip()]
by = defaultdict(list)
for v in votes:
    by[(v["document"], v["index"])].append((v["primary"], frozenset([v["primary"], *v["secondaries"]])))

out = {}
for name, mapping in SCHEMES.items():
    masi, nominal = defaultdict(list), defaultdict(list)
    for (doc, idx), items in sorted(by.items()):
        if len(items) < 2:
            continue
        masi[doc].append([remap_set(s, mapping) for _, s in items])
        nominal[doc].append([frozenset([remap(p, mapping)]) for p, _ in items])
    r = alpha_masi_vs_nominal(masi, nominal, n_resamples=1000, seed=42)
    out[name] = r
    print(f"{name:24s} α-MASI={r['alphaMasi']:.4f}  α nominal={r['alphaNominal']:.4f}  "
          f"Δ={r['diff']:.4f} [{r['diffLow']:.4f};{r['diffHigh']:.4f}]  "
          f"stabilité du signe={1-r['pDirection']:.3f}  docs={r['nDocuments']}")
json.dump(out, open(BASE.parent / "e1_results.json", "w"), indent=1)
