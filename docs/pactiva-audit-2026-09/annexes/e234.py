"""E2 (matrice annotateurs × juges), E3 (frontières reconstruites), E4 (divergence au seed)."""
import json, sys
from collections import Counter, defaultdict
from pathlib import Path
sys.path.insert(0, "/Users/elazhar/PycharmProjects/claire-studio/research")
from pactiva_lab.evaluation.metrics import cohen_kappa

BASE = Path(sys.argv[1])
load = lambda n: [json.loads(l) for l in (BASE / n).read_text().splitlines() if l.strip()]
votes, judges = load("votes.jsonl"), load("judges.jsonl")

by_sent = defaultdict(dict)      # (doc,idx) -> annot -> (primary, set)
for v in votes:
    by_sent[(v["document"], v["index"])][v["annotator"]] = (
        v["primary"], frozenset([v["primary"], *v["secondaries"]]))
jud = defaultdict(dict)
for j in judges:
    jud[(j["document"], j["index"])][j["judge"]] = j["theme"]

annotators = sorted({v["annotator"] for v in votes})
judge_names = sorted({j["judge"] for j in judges})
actors = annotators + judge_names

def primary(key, actor):
    if actor in annotators:
        got = by_sent.get(key, {}).get(actor)
        return got[0] if got else None
    return jud.get(key, {}).get(actor)

print("== E2 — MATRICE κ (accord brut) À VOCABULAIRE CONSTANT ==")
print(f"{'':22s}" + "".join(f"{a[:10]:>12s}" for a in actors))
matrix = {}
for a in actors:
    line = f"{a[:20]:22s}"
    for b in actors:
        if a == b:
            line += f"{'—':>12s}"; continue
        pairs = [(primary(k, a), primary(k, b)) for k in by_sent]
        pairs = [(x, y) for x, y in pairs if x and y]
        if not pairs:
            line += f"{'n/a':>12s}"; continue
        k = cohen_kappa([x for x, _ in pairs], [y for _, y in pairs])
        raw = sum(1 for x, y in pairs if x == y) / len(pairs)
        matrix[(a, b)] = {"kappa": round(k, 4), "raw": round(raw, 4), "n": len(pairs)}
        line += f"{k:>7.3f}/{raw:.2f}"
    print(line)

print("\n== E3 — FRONTIÈRES RECONSTRUITES (Jaccard entre annotateurs) ==")
def boundaries(actor):
    out = defaultdict(set)
    prev = {}
    for (doc, idx) in sorted(by_sent):
        got = by_sent[(doc, idx)].get(actor)
        if not got: continue
        cur = got[1]
        if doc in prev and prev[doc] != cur:
            out[doc].add(idx)
        prev[doc] = cur
    return out
B = {a: boundaries(a) for a in annotators}
jac = {}
for i, a in enumerate(annotators):
    for b in annotators[i+1:]:
        inter = tot = 0
        for doc in set(B[a]) | set(B[b]):
            x, y = B[a].get(doc, set()), B[b].get(doc, set())
            inter += len(x & y); tot += len(x | y)
        jac[f"{a} | {b}"] = round(inter / tot, 4) if tot else None
        print(f"  {a:18s} | {b:18s} Jaccard = {jac[f'{a} | {b}']}  "
              f"(frontières: {sum(len(v) for v in B[a].values())} vs {sum(len(v) for v in B[b].values())})")

print("\n== E4 — DIVERGENCE AU JUGE LE PLUS PROCHE (borne basse de l'édition) ==")
div = {}
for a in annotators:
    per_judge = {}
    for j in judge_names:
        tot = diff = 0
        for k in by_sent:
            pa, pj = primary(k, a), primary(k, j)
            if pa and pj:
                tot += 1
                diff += (pa != pj)
        per_judge[j] = round(diff / tot, 4) if tot else None
    closest = min(per_judge, key=lambda j: per_judge[j])
    div[a] = {"per_judge": per_judge, "closest": closest, "min": per_judge[closest]}
    print(f"  {a:20s} min={per_judge[closest]:.3f} (juge {closest})  détail={per_judge}")

json.dump({"kappa_matrix": {f"{a}|{b}": v for (a, b), v in matrix.items()},
           "boundary_jaccard": jac, "seed_divergence": div},
          open(BASE.parent / "e234_results.json", "w"), ensure_ascii=False, indent=1)
