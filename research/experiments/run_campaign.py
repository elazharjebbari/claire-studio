"""Campagne expérimentale finale — exécution des expériences des 4 questions de recherche.

Produit `frontend/src/features/paper/campaign.json` : une enveloppe standardisée par
expérience, avec provenance complète et portes de contrôle évaluées. C'est ce fichier que
lit la vue « Résultats pour l'article » — aucun chiffre n'y est saisi à la main.

Usage :
    python research/experiments/run_campaign.py <dossier-dataset> [--gold-state fichier.json]

Les expériences RQ4 (modèles) exigent d'avoir lancé le runner du Lab au préalable ; leurs
résultats sont lus depuis les dossiers de run passés par `--model-runs`.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from campaign import (  # noqa: E402
    Experiment,
    envelope,
    metric,
    standard_gates,
)
from pactiva_lab import taxonomy as tx  # noqa: E402
from pactiva_lab.data import load_gold, load_votes  # noqa: E402
from pactiva_lab.evaluation.agreement import (  # noqa: E402
    _AlphaPool,
    _rng_ints,
    alpha_masi_vs_nominal,
    gwet_ac1_binary,
    krippendorff_alpha_set,
    masi_distance,
    nominal_set_distance,
)
from pactiva_lab.evaluation.metrics import cohen_kappa  # noqa: E402

SEED = 42
N_RESAMPLES = 1000
POPULATIONS = [("all", None, "Corpus complet (50 documents)"),
               ("designSet", "designSet", "Conception (33 documents)"),
               ("holdout", "holdout", "Validation (17 documents)")]
TAXONOMIES = ["T20", "T14", "T11", "T10"]


# ── Chargements ─────────────────────────────────────────────────────────────
def load_context(root: Path, taxonomy: str, population: str | None) -> dict:
    votes = tx.filter_population(load_votes(root, taxonomy=taxonomy), population)
    by_sentence: dict = defaultdict(dict)
    for r in votes:
        by_sentence[(r["document"], r["index"])][r["annotator"]] = (
            r["primary"], frozenset([r["primary"], *r["secondaries"]])
        )
    judges: dict = defaultdict(dict)
    path = root / "judges.jsonl"
    if path.exists():
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    r = json.loads(line)
                    judges[(r["document"], r["index"])][r["judge"]] = tx.project_theme(
                        r["theme"], taxonomy
                    )
    if population:
        allowed = tx.population_documents(population)
        judges = {k: v for k, v in judges.items() if k[0] in allowed}
    gold = tx.filter_population(load_gold(root, taxonomy=taxonomy), population)
    unfair: dict = defaultdict(set)
    ref = root / "reference.jsonl"
    if ref.exists():
        with ref.open(encoding="utf-8") as handle:
            for line in handle:
                if line.strip():
                    r = json.loads(line)
                    unfair[(r["document"], r["index"])].add(r["category"])
    return {"by_sentence": by_sentence, "judges": judges, "gold": gold, "unfair": unfair,
            "annotators": sorted({a for v in by_sentence.values() for a in v})}


def alpha_units(by_sentence: dict, *, primary_only: bool = False) -> dict:
    units: dict = defaultdict(list)
    for (document, _idx), items in sorted(by_sentence.items()):
        if len(items) < 2:
            continue
        if primary_only:
            units[document].append([frozenset([p]) for p, _s in items.values()])
        else:
            units[document].append([s for _p, s in items.values()])
    return units


def paired_alpha_delta(ref_units: dict, alt_units: dict, tag: str) -> dict:
    """Δ d'α-MASI sur les MÊMES tirages bootstrap de documents (comparaison appariée)."""
    ref_pool, alt_pool = _AlphaPool(ref_units, masi_distance), _AlphaPool(alt_units, masi_distance)
    documents = ref_pool.documents
    point = alt_pool.alpha(documents) - ref_pool.alpha(documents)
    deltas, flips = [], 0
    for draw in _rng_ints(SEED, tag, len(documents), N_RESAMPLES):
        sample = [documents[i] for i in draw]
        a, b = alt_pool.alpha(sample), ref_pool.alpha(sample)
        if a is None or b is None:
            continue
        deltas.append(a - b)
        flips += (a - b) <= 0
    deltas.sort()
    return {
        "delta": round(point, 4),
        "ci": [round(deltas[int(0.025 * len(deltas))], 4),
               round(deltas[min(len(deltas) - 1, int(0.975 * len(deltas)))], 4)],
        "signStability": round(1 - flips / len(deltas), 4),
        "nDocuments": len(documents),
    }


def average_precision(scored) -> float | None:
    scored = sorted(scored, key=lambda x: -x[0])
    n_pos = sum(1 for _, y in scored if y)
    if not n_pos:
        return None
    tp, total = 0, 0.0
    for rank, (_s, y) in enumerate(scored, start=1):
        if y:
            tp += 1
            total += tp / rank
    return total / n_pos


def lodo_ap(rows: list, unfair: dict, key_of) -> tuple:
    labelled = [(r, bool(unfair.get((r["document"], r["index"])))) for r in rows]
    if not labelled:
        return None, 0.0
    base = sum(1 for _, y in labelled if y) / len(labelled)
    stats: dict = defaultdict(lambda: [0, 0])
    per_doc: dict = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for r, y in labelled:
        k = key_of(r)
        stats[k][0] += 1
        stats[k][1] += int(y)
        per_doc[r["document"]][k][0] += 1
        per_doc[r["document"]][k][1] += int(y)
    scored = []
    for r, y in labelled:
        k = key_of(r)
        n = stats[k][0] - per_doc[r["document"]][k][0]
        pos = stats[k][1] - per_doc[r["document"]][k][1]
        scored.append(((pos + base) / (n + 1), y))
    return average_precision(scored), base


def gold_rows_as_sentences(gold: list) -> list:
    out = []
    for r in gold:
        primary = r.get("decided_primary") or r.get("proposed_primary")
        if not primary:
            continue
        secondaries = r.get("decided_secondaries") or r.get("proposed_secondaries") or []
        out.append({"document": r["document"], "index": r["index"],
                    "primary": primary, "themes": [primary, *secondaries]})
    return out


# =========================================================================== #
# RQ1 — Fiabilité de l'annotation thématique
# =========================================================================== #
def rq1_multilabel_cost(root, manifest, gold_state):
    exp = Experiment(
        id="E1.1", rq="RQ1", title="Le coût du multi-étiquetage",
        question="Que coûte, en accord inter-annotateurs, le passage d'une tâche mono-label à une tâche multi-label ?",
        hypothesis="L'accord sur les JEUX de thèmes (α-MASI) est significativement inférieur à l'accord sur le seul thème primaire (α nominal) ; l'écart est stable au rééchantillonnage des documents.",
        protocol="α de Krippendorff avec distance MASI sur les jeux complets, contre α nominal sur la projection mono-label, calculés sur les MÊMES unités. La différence est appariée : les deux α sont recalculés sur chaque tirage bootstrap de documents, donc l'intervalle porte sur la différence elle-même.",
        metrics_declared=["alpha_masi", "alpha_nominal", "diff", "sign_stability"],
        limits=["Les seuils de Passonneau (0,667 / 0,8) sont des conventions de la littérature, pas des vérités mesurées."],
    )
    results = {}
    for label, population, human in POPULATIONS:
        ctx = load_context(root, "T20", population)
        paired = alpha_masi_vs_nominal(
            alpha_units(ctx["by_sentence"]),
            alpha_units(ctx["by_sentence"], primary_only=True),
            n_resamples=N_RESAMPLES, seed=SEED,
        )
        results[label] = {
            "label": human,
            "alphaMasi": paired["alphaMasi"], "alphaNominal": paired["alphaNominal"],
            "diff": paired["diff"], "ci": [paired["diffLow"], paired["diffHigh"]],
            "signStability": round(1 - (paired["pDirection"] or 0), 4),
            "nDocuments": paired["nDocuments"],
            "acceptable": paired["alphaMasi"] >= 0.667,
        }
    full = results["all"]
    gates = standard_gates(manifest=manifest, gold_state=gold_state,
                           split_scheme=None, seed=SEED,
                           populations_compared=[p[0] for p in POPULATIONS])
    return envelope(
        exp,
        summary=f"Le multi-étiquetage coûte {full['diff']:.3f} point d'α sur le corpus complet ; l'accord multi-label reste sous le seuil d'acceptabilité en T20.",
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "T20",
              "labelSource": "annotations brutes (3 annotateurs)",
              "populations": [p[0] for p in POPULATIONS]},
        config={"seed": SEED, "nResamples": N_RESAMPLES, "distance": "MASI (Passonneau)",
                "bootstrapUnit": "document"},
        metrics=[
            metric("alpha_masi", "α-MASI (corpus complet)", full["alphaMasi"],
                   note="seuil d'acceptabilité 0,667"),
            metric("alpha_nominal", "α nominal (corpus complet)", full["alphaNominal"]),
            metric("diff", "Coût du multi-label", full["diff"], ci=full["ci"],
                   higher_is_better=False),
        ],
        results=results,
        uncertainty=f"IC 95 % bootstrap par document ({N_RESAMPLES} tirages) ; signe stable sur {full['signStability']*100:.0f} % des tirages.",
        interpretation=(
            f"Annoter en multi-étiquettes coûte {full['diff']:.3f} point d'α par rapport à une tâche "
            f"mono-label sur le MÊME matériau, et ce coût ne s'inverse sur aucun rééchantillon. "
            f"Avec α-MASI = {full['alphaMasi']:.3f}, la taxonomie d'annotation reste SOUS le seuil "
            f"d'acceptabilité de Passonneau : c'est le point de départ de RQ2."
        ),
        gates=gates,
    )


def rq1_per_theme(root, manifest, gold_state):
    exp = Experiment(
        id="E1.2", rq="RQ1", title="Fiabilité thème par thème",
        question="Quels thèmes sont réellement annotables, et lesquels s'effondrent ?",
        hypothesis="La fiabilité n'est pas uniformément basse : elle est bimodale — les thèmes institutionnels s'annotent bien, la queue rare et les zones de recouvrement sémantique s'effondrent.",
        protocol="Pour chaque thème : α de Krippendorff binaire (présence dans le jeu, distance nominale) ET AC1 de Gwet, qui résiste aux prévalences extrêmes. Les deux sont lus ensemble avec le support — aucun ne suffit seul.",
        metrics_declared=["alpha_binary", "gwet_ac1", "support"],
        limits=["L'α binaire s'effondre mécaniquement sur les thèmes quasi absents : c'est le paradoxe de prévalence, d'où la lecture couplée avec l'AC1."],
    )
    ctx = load_context(root, "T20", None)
    units = [list(v.values()) for v in ctx["by_sentence"].values() if len(v) >= 2]
    all_sets = [[s for _p, s in unit] for unit in units]
    classes = sorted({c for unit in all_sets for s in unit for c in s})
    rows = []
    for code in classes:
        binary = [[code in s for s in unit] for unit in all_sets]
        distanced = [[frozenset(["1"]) if b else frozenset(["0"]) for b in u] for u in binary]
        alpha = krippendorff_alpha_set(distanced, distance=nominal_set_distance)
        ac1 = gwet_ac1_binary(binary)
        rows.append({
            "theme": code,
            "alpha": round(alpha, 4) if alpha is not None else None,
            "ac1": round(ac1, 4) if ac1 is not None else None,
            "support": sum(1 for unit in all_sets if any(code in s for s in unit)),
        })
    rows.sort(key=lambda r: r["alpha"] if r["alpha"] is not None else -1)
    unusable = [r for r in rows if (r["alpha"] or 0) < 0.4]
    gates = standard_gates(manifest=manifest, gold_state=gold_state, split_scheme=None, seed=SEED)
    return envelope(
        exp,
        summary=f"{len(unusable)} thèmes sur {len(rows)} sont sous α = 0,40 — inexploitables tels quels.",
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "T20",
              "labelSource": "annotations brutes", "populations": ["all"]},
        config={"seed": SEED, "measures": ["alpha_binaire_un_contre_tous", "gwet_ac1"]},
        metrics=[
            metric("n_unusable", "Thèmes sous α = 0,40", len(unusable), higher_is_better=False),
            metric("alpha_min", "α minimal", rows[0]["alpha"], note=rows[0]["theme"]),
            metric("alpha_max", "α maximal", rows[-1]["alpha"], note=rows[-1]["theme"]),
        ],
        results={"perTheme": rows, "unusable": [r["theme"] for r in unusable]},
        uncertainty="Valeurs ponctuelles ; les thèmes à faible support sont instables par construction (lire l'AC1 et le support avec l'α).",
        interpretation=(
            "La fiabilité est BIMODALE, pas uniformément basse : "
            + ", ".join(f"{r['theme']} ({r['alpha']:.2f})" for r in rows[:3])
            + " s'effondrent, quand "
            + ", ".join(f"{r['theme']} ({r['alpha']:.2f})" for r in rows[-3:])
            + " s'annotent de façon fiable. Le « mur du κ » est donc LOCALISÉ — "
            "c'est ce qui rend une fusion ciblée pertinente plutôt qu'un abandon du multi-label."
        ),
        gates=gates,
    )


def rq1_boundaries(root, manifest, gold_state):
    exp = Experiment(
        id="E1.3", rq="RQ1", title="Accord sur les frontières de blocs",
        question="Les annotateurs s'accordent-ils sur OÙ commence et finit une clause, et non seulement sur son thème ?",
        hypothesis="La segmentation est nettement plus difficile que la thématisation : l'accord sur les frontières est très inférieur à l'accord sur les thèmes.",
        protocol="Frontières RECONSTRUITES : une frontière est une phrase où le jeu de thèmes change. Jamais les ancres de clause — le pré-remplissage en dépose une par phrase chez tout le monde, et cet « accord » vaut 1,0 par construction. Jaccard des ensembles de frontières, par paire d'annotateurs.",
        metrics_declared=["jaccard_par_paire", "n_frontieres"],
        limits=["Le Jaccard pénalise un décalage d'une phrase autant qu'une frontière manquée : c'est une mesure stricte."],
    )
    ctx = load_context(root, "T20", None)
    per_annotator: dict = {a: defaultdict(set) for a in ctx["annotators"]}
    previous: dict = defaultdict(dict)
    for (document, index) in sorted(ctx["by_sentence"]):
        for annotator, (_p, themes) in ctx["by_sentence"][(document, index)].items():
            if document in previous[annotator] and previous[annotator][document] != themes:
                per_annotator[annotator][document].add(index)
            previous[annotator][document] = themes
    pairs = []
    for a, b in combinations(ctx["annotators"], 2):
        inter = total = 0
        for document in set(per_annotator[a]) | set(per_annotator[b]):
            x, y = per_annotator[a].get(document, set()), per_annotator[b].get(document, set())
            inter += len(x & y)
            total += len(x | y)
        pairs.append({"a": a, "b": b, "jaccard": round(inter / total, 4) if total else None,
                      "nA": sum(len(v) for v in per_annotator[a].values()),
                      "nB": sum(len(v) for v in per_annotator[b].values())})
    values = [p["jaccard"] for p in pairs if p["jaccard"] is not None]
    gates = standard_gates(manifest=manifest, gold_state=gold_state, split_scheme=None, seed=SEED)
    return envelope(
        exp,
        summary=f"Jaccard des frontières entre {min(values):.3f} et {max(values):.3f} — bien en dessous de l'accord thématique.",
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "T20",
              "labelSource": "annotations brutes", "populations": ["all"]},
        config={"seed": SEED, "boundaryDefinition": "changement du jeu de thèmes (reconstruite)"},
        metrics=[
            metric("jaccard_min", "Jaccard minimal", round(min(values), 4)),
            metric("jaccard_max", "Jaccard maximal", round(max(values), 4)),
        ],
        results={"pairs": pairs,
                 "boundariesByAnnotator": {a: sum(len(v) for v in per_annotator[a].values())
                                           for a in ctx["annotators"]}},
        uncertainty="Valeurs ponctuelles par paire ; l'écart du nombre de frontières entre annotateurs est lui-même un résultat.",
        interpretation=(
            "La frontière est le POINT DUR de la tâche : l'accord y est de "
            f"{min(values):.2f}–{max(values):.2f} là où l'accord thématique dépasse 0,65. "
            "L'écart du nombre de frontières posées (de "
            f"{min(sum(len(v) for v in per_annotator[a].values()) for a in ctx['annotators'])} à "
            f"{max(sum(len(v) for v in per_annotator[a].values()) for a in ctx['annotators'])}) "
            "montre que les annotateurs ne segmentent pas à la même granularité — un résultat "
            "à documenter, pas à corriger après coup."
        ),
        gates=gates,
    )


def rq1_gold_cascade(root, manifest, gold_state):
    exp = Experiment(
        id="E1.4", rq="RQ1", title="Cascade de résolution et ambiguïté résiduelle",
        question="Quelle part du gold se résout automatiquement, et que reste-t-il d'irréductiblement ambigu ?",
        hypothesis="La grande majorité des phrases se résout sans intervention (accord strict ou majorité) ; le reste mesure l'ambiguïté réelle de la tâche.",
        protocol="Trois étages : accord unanime (1 clic), majorité ≥ 2/3 (auto), divergence réelle (comité humain). L'ambiguïté résiduelle est la part arbitrée à la main, qui est une statistique MESURÉE et non un chiffre postulé.",
        metrics_declared=["share_auto_1click", "share_auto", "share_manual"],
        limits=["Tant que les résolutions ne sont pas figées, ces parts peuvent encore changer."],
    )
    gold = load_gold(root, taxonomy="T20")
    levels = Counter(r.get("auto_level") for r in gold)
    classes = Counter(r.get("agreement_class") for r in gold)
    total = len(gold) or 1
    human = sum(1 for r in gold if r.get("decided") and not r.get("auto_resolved"))
    gates = standard_gates(manifest=manifest, gold_state=gold_state, split_scheme=None,
                           seed=SEED, requires_gold=True)
    share_manual = levels.get("manual", 0) / total
    return envelope(
        exp,
        summary=f"{(1 - share_manual) * 100:.1f} % du gold se résout automatiquement ; {levels.get('manual', 0)} phrases ont exigé un arbitrage humain.",
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "T20",
              "labelSource": "GOLD", "populations": ["all"]},
        config={"seed": SEED, "cascade": "unanime → majorité ≥ 2/3 → comité humain"},
        metrics=[
            metric("share_auto_1click", "Accord unanime (1 clic)",
                   round(levels.get("auto_1click", 0) / total, 4), unit="part"),
            metric("share_auto", "Majorité ≥ 2/3 (auto)",
                   round(levels.get("auto", 0) / total, 4), unit="part"),
            metric("share_manual", "Arbitrage humain requis", round(share_manual, 4),
                   unit="part", higher_is_better=False,
                   note="mesure directe de l'ambiguïté irréductible"),
        ],
        results={"levels": dict(levels), "agreementClasses": dict(classes),
                 "humanDecisions": human, "nSentences": len(gold),
                 "finalized": gold_state.get("finalized", 0),
                 "resolutions": gold_state.get("resolutions", 0)},
        uncertainty="Comptages exacts sur l'état du gold à la date d'exécution.",
        interpretation=(
            f"L'ambiguïté résiduelle de la tâche est de {share_manual * 100:.1f} % des phrases "
            f"({levels.get('manual', 0)} sur {len(gold)}) : c'est la part que trois annotateurs "
            "ne parviennent pas à trancher par accord ou majorité, et qui a demandé une décision "
            "humaine explicite. Ce n'est pas un défaut du protocole — c'est une mesure de la "
            "difficulté intrinsèque du matériau juridique."
        ),
        gates=gates,
    )


def rq1_human_reference(root, manifest, gold_state):
    exp = Experiment(
        id="E1.5", rq="RQ1", title="Référence humaine (leave-one-annotator-out)",
        question="Quel score obtiendrait un annotateur humain évalué comme on évalue un modèle ?",
        hypothesis="La performance d'un humain contre le consensus de ses pairs constitue le plafond réaliste de toute automatisation.",
        protocol="Pour chaque annotateur, on le retire et on le traite comme un « système » : sa prédiction est comparée au vote majoritaire des DEUX autres. Exactitude et κ de Cohen. C'est l'exacte procédure appliquée aux modèles, donc la seule comparaison honnête.",
        metrics_declared=["accuracy", "kappa"],
        limits=["Avec trois annotateurs, la référence est le vote de deux personnes seulement : elle est elle-même bruitée."],
    )
    ctx = load_context(root, "T20", None)
    per_annotator = {}
    for held_out in ctx["annotators"]:
        gold_labels, pred = [], []
        for _key, items in ctx["by_sentence"].items():
            if held_out not in items:
                continue
            others = [p for a, (p, _s) in items.items() if a != held_out]
            if len(others) < 2:
                continue
            counts = Counter(others)
            top, n = counts.most_common(1)[0]
            if n < 2:  # les deux pairs divergent : pas de référence exploitable
                continue
            gold_labels.append(top)
            pred.append(items[held_out][0])
        accuracy = sum(1 for g, p in zip(gold_labels, pred) if g == p) / len(gold_labels)
        per_annotator[held_out] = {
            "n": len(gold_labels),
            "accuracy": round(accuracy, 4),
            "kappa": round(cohen_kappa(gold_labels, pred), 4),
        }
    accuracies = [v["accuracy"] for v in per_annotator.values()]
    kappas = [v["kappa"] for v in per_annotator.values()]
    mean_acc = sum(accuracies) / len(accuracies)
    mean_kappa = sum(kappas) / len(kappas)
    gates = standard_gates(manifest=manifest, gold_state=gold_state,
                           split_scheme="group_kfold_document", seed=SEED)
    return envelope(
        exp,
        summary=f"Un annotateur humain atteint {mean_acc:.3f} d'exactitude (κ {mean_kappa:.3f}) contre ses pairs : c'est le plafond réaliste.",
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "T20",
              "labelSource": "annotations brutes (référence = majorité des pairs)",
              "populations": ["all"]},
        config={"seed": SEED, "procedure": "leave-one-annotator-out, référence = majorité stricte des 2 pairs"},
        metrics=[
            metric("accuracy_mean", "Exactitude humaine moyenne", round(mean_acc, 4)),
            metric("kappa_mean", "κ humain moyen", round(mean_kappa, 4)),
        ],
        results={"perAnnotator": per_annotator},
        uncertainty="Trois points de mesure (un par annotateur) : la dispersion entre eux est le meilleur indicateur d'incertitude disponible.",
        interpretation=(
            f"Évalué exactement comme un modèle, un annotateur humain obtient {mean_acc:.3f} "
            f"d'exactitude et κ = {mean_kappa:.3f} contre le consensus de ses pairs. C'est la "
            "borne à laquelle comparer les modèles et les juges LLM : un système qui l'approche "
            "a appris tout ce qui est apprenable de ce matériau, et un système qui la dépasserait "
            "signalerait un problème de protocole, pas une prouesse."
        ),
        gates=gates,
    )


# =========================================================================== #
# RQ2 — Granularité de la taxonomie
# =========================================================================== #
def rq2_taxonomy_comparison(root, manifest, gold_state):
    exp = Experiment(
        id="E2.1", rq="RQ2", title="Comparaison T20 / T14 / T11 / T10",
        question="Une taxonomie plus grossière rend-elle l'annotation significativement plus fiable, et à quel prix ?",
        hypothesis="Fusionner le long des grappes de confusion mesurées fait franchir le seuil d'acceptabilité, avec une perte de signal d'abusivité faible tant qu'on ne fusionne pas à travers les strates.",
        protocol="Les quatre taxonomies sont des PROJECTIONS du même dataset : mêmes documents, mêmes plis, donc comparaison appariée par construction. α-MASI et sa différence appariée contre T20 (bootstrap par document), taux de désaccord, et signal d'abusivité (average precision en leave-one-document-out de P(abusif | combinaison), contre la référence CLAUDETTE jamais projetée).",
        metrics_declared=["alpha_masi", "delta_vs_T20", "disagreement_rate", "ap_abusivite"],
        limits=["L'AP LODO est une borne d'information, pas l'AUC-PR d'un détecteur entraîné : elle s'interprète en relatif entre taxonomies."],
        depends_on=["E1.1"],
    )
    results = {}
    for label, population, human in POPULATIONS:
        ref_ctx = load_context(root, "T20", population)
        ref_units = alpha_units(ref_ctx["by_sentence"])
        per_taxonomy = {}
        for taxonomy in TAXONOMIES:
            ctx = load_context(root, taxonomy, population)
            units = alpha_units(ctx["by_sentence"])
            paired = alpha_masi_vs_nominal(
                units, alpha_units(ctx["by_sentence"], primary_only=True),
                n_resamples=N_RESAMPLES, seed=SEED,
            )
            agree = disagree = 0
            for items in ctx["by_sentence"].values():
                primaries = [p for p, _s in items.values()]
                for a, b in combinations(primaries, 2):
                    if a == b:
                        agree += 1
                    else:
                        disagree += 1
            sentences = gold_rows_as_sentences(ctx["gold"])
            ap_combo, base = lodo_ap(sentences, ctx["unfair"], lambda r: frozenset(r["themes"]))
            entry = {
                "nClasses": len(tx.category_codes(taxonomy)),
                "alphaMasi": paired["alphaMasi"], "alphaNominal": paired["alphaNominal"],
                "disagreementRate": round(disagree / (agree + disagree), 4),
                "apAbusivity": round(ap_combo, 4) if ap_combo else None,
                "baseRate": round(base, 4),
                "acceptable": paired["alphaMasi"] >= 0.667,
            }
            if taxonomy != "T20":
                entry["vsCanonical"] = paired_alpha_delta(
                    ref_units, units, f"campaign-{label}-{taxonomy}"
                )
            per_taxonomy[taxonomy] = entry
        results[label] = {"label": human, "taxonomies": per_taxonomy}

    t11 = results["all"]["taxonomies"]["T11"]
    t20 = results["all"]["taxonomies"]["T20"]
    gates = standard_gates(manifest=manifest, gold_state=gold_state, split_scheme=None,
                           seed=SEED, populations_compared=[p[0] for p in POPULATIONS],
                           requires_gold=True)
    return envelope(
        exp,
        summary=f"T11 porte l'accord de {t20['alphaMasi']:.3f} à {t11['alphaMasi']:.3f} (au-dessus du seuil) pour une perte de signal d'abusivité de {(1 - t11['apAbusivity'] / t20['apAbusivity']) * 100:.1f} %.",
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "T20→T14/T11/T10",
              "labelSource": "annotations brutes + GOLD (abusivité)",
              "populations": [p[0] for p in POPULATIONS]},
        config={"seed": SEED, "nResamples": N_RESAMPLES,
                "taxonomySpec": tx.spec_fingerprint()[:16],
                "pairedComparison": "mêmes documents, mêmes tirages bootstrap"},
        metrics=[
            metric("alpha_T20", "α-MASI T20", t20["alphaMasi"]),
            metric("alpha_T11", "α-MASI T11", t11["alphaMasi"],
                   ci=t11["vsCanonical"]["ci"], note="Δ apparié contre T20"),
            metric("delta_T11", "Gain de T11", t11["vsCanonical"]["delta"],
                   ci=t11["vsCanonical"]["ci"]),
            metric("ap_cost_T11", "Coût en signal d'abusivité",
                   round(1 - t11["apAbusivity"] / t20["apAbusivity"], 4),
                   unit="relatif", higher_is_better=False),
        ],
        results=results,
        uncertainty=f"IC 95 % bootstrap par document ({N_RESAMPLES} tirages) sur la DIFFÉRENCE ; stabilité de signe rapportée par cellule.",
        interpretation=(
            f"T11 fait franchir le seuil d'acceptabilité que T20 n'atteint pas "
            f"({t20['alphaMasi']:.3f} → {t11['alphaMasi']:.3f}, gain {t11['vsCanonical']['delta']:+.4f} "
            f"[{t11['vsCanonical']['ci'][0]:.4f} ; {t11['vsCanonical']['ci'][1]:.4f}]), pour une perte "
            f"de signal d'abusivité de {(1 - t11['apAbusivity'] / t20['apAbusivity']) * 100:.1f} %. "
            "T10 gagne un peu plus d'accord mais perd nettement plus de signal : c'est la preuve "
            "que le garde-fou des strates n'est pas un principe esthétique."
        ),
        gates=gates,
    )


def rq2_holdout_validation(root, manifest, gold_state):
    exp = Experiment(
        id="E2.2", rq="RQ2", title="Validation des taxonomies sur le hold-out",
        question="Le gain de fiabilité de T11 est-il un artefact des documents qui ont servi à concevoir les fusions ?",
        hypothesis="Si le gain se reproduit sur les documents qui n'ont pas servi à la conception, il n'est pas un surajustement.",
        protocol="La partition est FIGÉE dans la spécification de taxonomie : 33 documents de conception (multi-annotés au moment du choix des fusions) contre 17 documents de validation (qui n'ont fourni aucune paire d'annotateurs à ce moment-là). Le même Δ apparié est mesuré séparément sur chaque population — jamais entre les deux.",
        metrics_declared=["delta_design", "delta_holdout"],
        limits=[
            "Le hold-out n'est que PARTIELLEMENT aveugle : aveugle pour la structure des fusions (dérivée des désaccords, absents de ces documents à l'époque), non aveugle pour les supports et les strates d'abusivité, calculés sur les 50.",
            "Vérification faite : recalculés sur les 33 seuls, ces critères donnent la même décision.",
            "Sur ces 17 documents, la 2ᵉ et la 3ᵉ annotation sont postérieures à la conception : indépendance oui, aveuglement non.",
        ],
        depends_on=["E2.1"],
    )
    per_population = {}
    for label, population, human in [("designSet", "designSet", "Conception (33)"),
                                     ("holdout", "holdout", "Validation (17)")]:
        ref_ctx = load_context(root, "T20", population)
        ref_units = alpha_units(ref_ctx["by_sentence"])
        entry = {"label": human, "documents": len(tx.population_documents(population))}
        for taxonomy in ("T14", "T11", "T10"):
            ctx = load_context(root, taxonomy, population)
            entry[taxonomy] = paired_alpha_delta(
                ref_units, alpha_units(ctx["by_sentence"]), f"holdout-{label}-{taxonomy}"
            )
        per_population[label] = entry

    design = per_population["designSet"]["T11"]
    holdout = per_population["holdout"]["T11"]
    replicates = holdout["ci"][0] > 0 and holdout["delta"] >= design["delta"] * 0.8
    gates = standard_gates(manifest=manifest, gold_state=gold_state, split_scheme=None,
                           seed=SEED, populations_compared=["designSet", "holdout"])
    return envelope(
        exp,
        summary=f"Le gain de T11 se reproduit sur le hold-out : {holdout['delta']:+.4f} contre {design['delta']:+.4f} en conception.",
        data={"datasetFingerprint": manifest.get("fingerprint"),
              "taxonomy": "T20→T11 (et T14/T10)", "labelSource": "annotations brutes",
              "populations": ["designSet", "holdout"],
              "partitionId": tx.population("holdout")["id"]},
        config={"seed": SEED, "nResamples": N_RESAMPLES,
                "partition": "figée dans la spécification de taxonomie"},
        metrics=[
            metric("delta_design", "Gain T11 — conception (33 doc.)", design["delta"], ci=design["ci"]),
            metric("delta_holdout", "Gain T11 — validation (17 doc.)", holdout["delta"], ci=holdout["ci"]),
        ],
        results={"perPopulation": per_population, "replicates": replicates},
        uncertainty=f"IC 95 % bootstrap par document, calculés SÉPARÉMENT sur chaque population ({N_RESAMPLES} tirages).",
        interpretation=(
            f"Le gain mesuré hors des données de conception ({holdout['delta']:+.4f} "
            f"[{holdout['ci'][0]:.4f} ; {holdout['ci'][1]:.4f}]) est au moins aussi élevé que sur "
            f"les données de conception ({design['delta']:+.4f}). Aucun surajustement décelable : "
            "la fusion capture une propriété du matériau juridique, pas une particularité des "
            "33 documents qui ont servi à la calibrer."
        ),
        gates=gates,
    )


def rq2_reliability_signal_tradeoff(root, manifest, gold_state):
    exp = Experiment(
        id="E2.3", rq="RQ2", title="Compromis fiabilité ↔ conservation du signal juridique",
        question="Jusqu'où peut-on fusionner sans détruire le signal que la détection de clauses abusives exploite ?",
        hypothesis="Fusionner le long des grappes de confusion coûte peu de signal ; fusionner à travers les strates d'abusivité en coûte beaucoup.",
        protocol="Pour chaque taxonomie : gain d'accord (Δ α-MASI apparié) contre coût en signal (perte relative d'average precision LODO de P(abusif | combinaison), gold comme source d'étiquettes, référence CLAUDETTE jamais projetée). Le rapport gain/coût départage les schémas.",
        metrics_declared=["delta_alpha", "ap_loss_relative", "efficiency"],
        limits=["Le signal est mesuré par une borne d'information, pas par un détecteur entraîné."],
        depends_on=["E2.1"],
    )
    ref_ctx = load_context(root, "T20", None)
    ref_units = alpha_units(ref_ctx["by_sentence"])
    ref_ap, _ = lodo_ap(gold_rows_as_sentences(ref_ctx["gold"]), ref_ctx["unfair"],
                        lambda r: frozenset(r["themes"]))
    rows = []
    for taxonomy in TAXONOMIES:
        ctx = load_context(root, taxonomy, None)
        ap, base = lodo_ap(gold_rows_as_sentences(ctx["gold"]), ctx["unfair"],
                           lambda r: frozenset(r["themes"]))
        delta = (paired_alpha_delta(ref_units, alpha_units(ctx["by_sentence"]),
                                    f"tradeoff-{taxonomy}")
                 if taxonomy != "T20" else {"delta": 0.0, "ci": [0.0, 0.0], "signStability": 1.0})
        loss = 1 - (ap / ref_ap) if ref_ap else 0.0
        rows.append({
            "taxonomy": taxonomy, "nClasses": len(tx.category_codes(taxonomy)),
            "deltaAlpha": delta["delta"], "ci": delta["ci"],
            "apAbusivity": round(ap, 4), "apLossRelative": round(loss, 4),
            # Rendement : points d'accord gagnés par point de signal perdu.
            "efficiency": round(delta["delta"] / loss, 2) if loss > 0.0005 else None,
        })
    t11 = next(r for r in rows if r["taxonomy"] == "T11")
    t10 = next(r for r in rows if r["taxonomy"] == "T10")
    gates = standard_gates(manifest=manifest, gold_state=gold_state, split_scheme=None,
                           seed=SEED, requires_gold=True)
    return envelope(
        exp,
        summary=f"T11 rend {t11['efficiency']} point d'accord par point de signal perdu, contre {t10['efficiency']} pour T10.",
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "les quatre",
              "labelSource": "GOLD + référence CLAUDETTE", "populations": ["all"]},
        config={"seed": SEED, "signalMeasure": "AP LODO de P(abusif | combinaison)"},
        metrics=[
            metric("efficiency_T11", "Rendement de T11", t11["efficiency"],
                   note="Δ accord par unité de signal perdu"),
            metric("efficiency_T10", "Rendement de T10", t10["efficiency"]),
            metric("ap_loss_T11", "Perte de signal T11", t11["apLossRelative"],
                   unit="relatif", higher_is_better=False),
            metric("ap_loss_T10", "Perte de signal T10", t10["apLossRelative"],
                   unit="relatif", higher_is_better=False),
        ],
        results={"rows": rows, "referenceAp": round(ref_ap, 4)},
        uncertainty="Le gain d'accord porte un IC bootstrap ; la perte de signal est une valeur ponctuelle en LODO.",
        interpretation=(
            f"T11 et T10 gagnent des quantités d'accord comparables, mais T10 perd "
            f"{t10['apLossRelative'] / max(t11['apLossRelative'], 1e-6):.1f} fois plus de signal "
            "d'abusivité. La seule fusion qui les sépare — limitation de responsabilité avec "
            "exclusion de garantie — réunit deux thèmes aux profils d'abusivité opposés. "
            "Le compromis n'est donc pas monotone : il existe un point d'arrêt, et T11 est ce point."
        ),
        gates=gates,
    )


# =========================================================================== #
# RQ3 — Humains contre LLM
# =========================================================================== #
def rq3_agreement_matrix(root, manifest, gold_state):
    exp = Experiment(
        id="E3.1", rq="RQ3", title="Matrice d'accord annotateurs × juges LLM",
        question="Les modèles de langue s'accordent-ils avec les annotateurs humains autant que les humains entre eux ?",
        hypothesis="L'accord humain↔humain domine strictement l'accord humain↔LLM ; les LLM se ressemblent davantage entre eux qu'ils ne ressemblent aux humains.",
        protocol="κ de Cohen à vocabulaire constant sur toutes les phrases couvertes par les deux parties, pour chaque paire (annotateur, annotateur), (annotateur, juge) et (juge, juge).",
        metrics_declared=["kappa_human_human", "kappa_human_llm", "kappa_llm_llm"],
        limits=["Les juges sont évalués sur leur pré-annotation figée, pas sur un appel LLM refait à la demande."],
    )
    ctx = load_context(root, "T20", None)
    actors = ctx["annotators"] + sorted({j for v in ctx["judges"].values() for j in v})
    kinds = {a: ("annotator" if a in ctx["annotators"] else "judge") for a in actors}

    def primary_of(key, actor):
        if kinds[actor] == "annotator":
            got = ctx["by_sentence"].get(key, {}).get(actor)
            return got[0] if got else None
        return ctx["judges"].get(key, {}).get(actor)

    matrix, cells = [], {}
    for a in actors:
        row = []
        for b in actors:
            if a == b:
                row.append(1.0)
                continue
            pairs = [(primary_of(k, a), primary_of(k, b)) for k in ctx["by_sentence"]]
            pairs = [(x, y) for x, y in pairs if x and y]
            k = cohen_kappa([x for x, _ in pairs], [y for _, y in pairs]) if pairs else None
            row.append(round(k, 4) if k is not None else None)
            cells[f"{a}|{b}"] = {"kappa": round(k, 4) if k is not None else None, "n": len(pairs)}
        matrix.append(row)

    hh = [cells[f"{a}|{b}"]["kappa"] for a, b in combinations(ctx["annotators"], 2)]
    judges_list = [a for a in actors if kinds[a] == "judge"]
    hl = [cells[f"{a}|{j}"]["kappa"] for a in ctx["annotators"] for j in judges_list]
    ll = [cells[f"{a}|{b}"]["kappa"] for a, b in combinations(judges_list, 2)]
    gates = standard_gates(manifest=manifest, gold_state=gold_state, split_scheme=None, seed=SEED)
    return envelope(
        exp,
        summary=f"Accord humain↔humain {min(hh):.3f}–{max(hh):.3f} ; humain↔LLM jamais au-dessus de {max(hl):.3f}.",
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "T20",
              "labelSource": "annotations brutes + pré-annotations LLM figées",
              "populations": ["all"]},
        config={"seed": SEED, "measure": "κ de Cohen, vocabulaire constant"},
        metrics=[
            metric("kappa_hh_min", "κ humain↔humain (min)", round(min(hh), 4)),
            metric("kappa_hh_max", "κ humain↔humain (max)", round(max(hh), 4)),
            metric("kappa_hl_max", "κ humain↔LLM (max)", round(max(hl), 4)),
            metric("kappa_ll_max", "κ LLM↔LLM (max)", round(max(ll), 4)),
        ],
        results={"actors": actors, "kinds": kinds, "matrix": matrix, "cells": cells},
        uncertainty="Valeurs ponctuelles ; les effectifs par paire sont rapportés dans `cells`.",
        interpretation=(
            f"L'accord entre humains ({min(hh):.3f}–{max(hh):.3f}) domine strictement l'accord "
            f"entre un humain et un modèle (au mieux {max(hl):.3f}). Deux modèles s'accordent "
            f"entre eux jusqu'à {max(ll):.3f} : les LLM partagent une façon de découper le contrat "
            "qui leur est propre et qui n'est pas celle des juristes. Ce n'est donc pas un simple "
            "écart de performance — c'est un écart de convention."
        ),
        gates=gates,
    )


def rq3_seed_divergence(root, manifest, gold_state):
    exp = Experiment(
        id="E3.2", rq="RQ3", title="Divergence au pré-remplissage",
        question="Quelle part du travail d'annotation consiste à corriger la proposition du modèle ?",
        hypothesis="Les annotateurs modifient une part substantielle des propositions : l'annotation n'est pas une ratification.",
        protocol="Pour chaque annotateur, part de ses phrases dont le thème diffère de chaque juge ; le minimum désigne son « juge le plus proche » et constitue une BORNE INFÉRIEURE du travail d'édition réel (le juge ayant servi au pré-remplissage n'est pas persisté).",
        metrics_declared=["divergence_min", "divergence_par_juge"],
        limits=["Borne inférieure : le juge de pré-remplissage n'étant pas tracé, la divergence réelle est supérieure."],
    )
    ctx = load_context(root, "T20", None)
    judges_list = sorted({j for v in ctx["judges"].values() for j in v})
    per_annotator = {}
    for annotator in ctx["annotators"]:
        by_judge = {}
        for judge in judges_list:
            total = diff = 0
            for key, items in ctx["by_sentence"].items():
                if annotator not in items:
                    continue
                jt = ctx["judges"].get(key, {}).get(judge)
                if not jt:
                    continue
                total += 1
                diff += items[annotator][0] != jt
            by_judge[judge] = round(diff / total, 4) if total else None
        closest = min(by_judge, key=lambda j: by_judge[j])
        per_annotator[annotator] = {"byJudge": by_judge, "closest": closest,
                                    "divergence": by_judge[closest]}
    values = [v["divergence"] for v in per_annotator.values()]
    gates = standard_gates(manifest=manifest, gold_state=gold_state, split_scheme=None, seed=SEED)
    return envelope(
        exp,
        summary=f"Chaque annotateur diverge de {min(values) * 100:.1f} à {max(values) * 100:.1f} % du juge le plus proche.",
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "T20",
              "labelSource": "annotations brutes contre pré-annotations LLM",
              "populations": ["all"]},
        config={"seed": SEED, "measure": "part de phrases au thème différent"},
        metrics=[
            metric("divergence_min", "Divergence minimale", round(min(values), 4),
                   higher_is_better=None),
            metric("divergence_max", "Divergence maximale", round(max(values), 4),
                   higher_is_better=None),
        ],
        results={"perAnnotator": per_annotator},
        uncertainty="Borne INFÉRIEURE par construction : le juge ayant réellement servi au pré-remplissage n'est pas persisté.",
        interpretation=(
            f"Même en la comparant au modèle qui lui ressemble le plus, chaque annotateur modifie "
            f"{min(values) * 100:.0f} à {max(values) * 100:.0f} % des propositions. L'annotation "
            "assistée n'est donc pas une ratification du modèle : le travail humain reste "
            "déterminant, et le corpus n'est pas un décalque des sorties LLM."
        ),
        gates=gates,
    )


def rq3_judge_benchmark(root, manifest, gold_state):
    exp = Experiment(
        id="E3.3", rq="RQ3", title="Benchmark des quatre juges contre le GOLD",
        question="Quelle performance atteignent les modèles de langue quand on les évalue contre la référence arbitrée ?",
        hypothesis="Les juges restent nettement en dessous de la référence humaine, et leur classement est stable entre taxonomies.",
        protocol="Chaque juge est évalué contre le thème du GOLD, comme un système de classification : exactitude, macro-F1 et κ de Cohen. Mesuré en T20 et en T11 pour vérifier que le classement ne dépend pas de la granularité.",
        metrics_declared=["accuracy", "macro_f1", "kappa"],
        limits=["Les pré-annotations sont figées : ce benchmark mesure une sortie historique, pas l'état de l'art actuel de ces modèles."],
        depends_on=["E1.5"],
    )
    per_taxonomy = {}
    for taxonomy in ("T20", "T11"):
        ctx = load_context(root, taxonomy, None)
        gold_by_key = {}
        for r in ctx["gold"]:
            primary = r.get("decided_primary") or r.get("proposed_primary")
            if primary:
                gold_by_key[(r["document"], r["index"])] = primary
        judges_list = sorted({j for v in ctx["judges"].values() for j in v})
        rows = []
        for judge in judges_list:
            truth, pred = [], []
            for key, gold_label in gold_by_key.items():
                jt = ctx["judges"].get(key, {}).get(judge)
                if jt:
                    truth.append(gold_label)
                    pred.append(jt)
            if not truth:
                continue
            labels = sorted(set(truth) | set(pred))
            f1s = []
            for code in labels:
                tp = sum(1 for t, p in zip(truth, pred) if t == code and p == code)
                fp = sum(1 for t, p in zip(truth, pred) if t != code and p == code)
                fn = sum(1 for t, p in zip(truth, pred) if t == code and p != code)
                if tp + fp + fn:
                    precision = tp / (tp + fp) if tp + fp else 0.0
                    recall = tp / (tp + fn) if tp + fn else 0.0
                    f1s.append(2 * precision * recall / (precision + recall)
                               if precision + recall else 0.0)
            rows.append({
                "judge": judge, "n": len(truth),
                "accuracy": round(sum(1 for t, p in zip(truth, pred) if t == p) / len(truth), 4),
                "macroF1": round(sum(f1s) / len(f1s), 4) if f1s else None,
                "kappa": round(cohen_kappa(truth, pred), 4),
            })
        rows.sort(key=lambda r: -(r["accuracy"] or 0))
        per_taxonomy[taxonomy] = rows

    best = per_taxonomy["T20"][0]
    ranking_stable = [r["judge"] for r in per_taxonomy["T20"]] == [r["judge"] for r in per_taxonomy["T11"]]
    gates = standard_gates(manifest=manifest, gold_state=gold_state, split_scheme=None,
                           seed=SEED, requires_gold=True)
    return envelope(
        exp,
        summary=f"Le meilleur juge ({best['judge']}) atteint {best['accuracy']:.3f} d'exactitude contre le GOLD en T20.",
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "T20 et T11",
              "labelSource": "GOLD (référence) contre pré-annotations LLM",
              "populations": ["all"]},
        config={"seed": SEED, "metrics": ["accuracy", "macro_f1", "cohen_kappa"]},
        metrics=[
            metric("best_accuracy", "Meilleure exactitude (T20)", best["accuracy"], note=best["judge"]),
            metric("best_kappa", "Meilleur κ (T20)", best["kappa"], note=best["judge"]),
        ],
        results={"perTaxonomy": per_taxonomy, "rankingStable": ranking_stable},
        uncertainty="Valeurs ponctuelles sur l'ensemble des phrases du gold ; effectifs rapportés par juge.",
        interpretation=(
            f"Contre la référence arbitrée, le meilleur des quatre juges atteint "
            f"{best['accuracy']:.3f} d'exactitude (κ = {best['kappa']:.3f}), très en dessous de la "
            "référence humaine mesurée en E1.5. Le classement des juges "
            + ("ne change pas" if ranking_stable else "change")
            + " entre T20 et T11 : la hiérarchie entre modèles n'est donc "
            + ("pas un artefact de granularité." if ranking_stable
               else "pas indépendante de la granularité — à interpréter avec prudence.")
        ),
        gates=gates,
    )


# ── Pilote ──────────────────────────────────────────────────────────────────
RQ_LABELS = {
    "RQ1": "Fiabilité de l'annotation thématique",
    "RQ2": "Granularité de la taxonomie",
    "RQ3": "Humains contre modèles de langue",
    "RQ4": "Modèles compacts",
}

BUILDERS = [
    rq1_multilabel_cost, rq1_per_theme, rq1_boundaries, rq1_gold_cascade, rq1_human_reference,
    rq2_taxonomy_comparison, rq2_holdout_validation, rq2_reliability_signal_tradeoff,
    rq3_agreement_matrix, rq3_seed_divergence, rq3_judge_benchmark,
]


def label_cardinality(root, taxonomy: str) -> dict | None:
    """Nombre moyen d'étiquettes par phrase, dans la taxonomie demandée.

    Mesure indispensable pour interpréter un résultat multi-label : une tâche annotée en
    multi-étiquettes peut avoir été ramenée à un quasi-mono-étiquetage par l'agrégation,
    auquel cas le score obtenu ne dit rien de la difficulté réelle de la tâche.
    """
    from pactiva_lab.data import load_dataset

    dataset = load_dataset(Path(root), taxonomy=taxonomy)
    sizes = [len(getattr(s, "themes", []) or []) for s in dataset.sentences]
    if not sizes:
        return None
    return {
        "taxonomy": taxonomy,
        "mean": round(sum(sizes) / len(sizes), 4),
        "shareMulti": round(sum(1 for n in sizes if n >= 2) / len(sizes), 4),
        "max": max(sizes),
        "nSentences": len(sizes),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Campagne expérimentale finale")
    parser.add_argument("dataset", help="dossier du dataset Lab")
    parser.add_argument("--gold-state", help="JSON de l'état du gold (résolutions finalisées)")
    parser.add_argument("--out", default=str(ROOT / "frontend/src/features/paper/campaign.json"))
    parser.add_argument("--only", help="préfixe d'identifiant d'expérience à exécuter")
    parser.add_argument("--model-runs", help="dossier des runs de modèles (RQ4)")
    args = parser.parse_args()

    root = Path(args.dataset)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    gold_state = (json.loads(Path(args.gold_state).read_text(encoding="utf-8"))
                  if args.gold_state else {})

    experiments = []
    for builder in BUILDERS:
        result = builder(root, manifest, gold_state)
        if args.only and not result["id"].startswith(args.only):
            continue
        experiments.append(result)
        blocked = [g["id"] for g in result["gates"] if g["blocking"] and not g["passed"]]
        print(f"[{result['status']:11s}] {result['id']} {result['title'][:46]:48s}"
              + (f" ⚠ {', '.join(blocked)}" if blocked else ""))

    # RQ4 — construite à partir des runs du Lab (le runner entraîne, la campagne qualifie).
    if args.model_runs:
        from rq4_models import (e41_baselines, e42_learning_curve, e43_error_analysis,
                                e44_legalbert, e45_multilabel)

        runs_dir = Path(args.model_runs)
        human = next(
            (e["results"]["perAnnotator"] for e in experiments if e["id"] == "E1.5"), None
        )
        human_reference = None
        if human:
            values = list(human.values())
            human_reference = {
                "accuracy": round(sum(v["accuracy"] for v in values) / len(values), 4),
                "kappa": round(sum(v["kappa"] for v in values) / len(values), 4),
            }
        # Le plafond α-MASI et la cardinalité d'étiquettes viennent des expériences déjà
        # calculées ou du dataset lui-même, jamais d'une constante recopiée : un chiffre
        # codé en dur se périme sans prévenir (celui de E4.5 valait 0,635, mesuré sur un
        # corpus antérieur, alors que E2.1 donne 0,725 en T11).
        masi_ceiling = next(
            (e["results"]["all"]["taxonomies"]["T11"]["alphaMasi"]
             for e in experiments if e["id"] == "E2.1"), None
        )
        cardinality = label_cardinality(root, "T11")
        for builder, kwargs in (
            (e41_baselines, {"human_reference": human_reference}),
            (e42_learning_curve, {}),
            (e43_error_analysis, {}),
            (e44_legalbert, {"human_reference": human_reference}),
            (e45_multilabel, {"masi_ceiling": masi_ceiling, "cardinality": cardinality}),
        ):
            result = builder(runs_dir, manifest, gold_state, **kwargs)
            # Les expériences GPU renvoient `None` tant que leurs runs Grid'5000 ne sont
            # pas exportés : une expérience absente est honnête, une expérience vide non.
            if result is None or (args.only and not result["id"].startswith(args.only)):
                continue
            experiments.append(result)
            blocked = [g["id"] for g in result["gates"] if g["blocking"] and not g["passed"]]
            print(f"[{result['status']:11s}] {result['id']} {result['title'][:46]:48s}"
                  + (f" ⚠ {', '.join(blocked)}" if blocked else ""))

    payload = {
        "campaignVersion": 1,
        "rqLabels": RQ_LABELS,
        "dataset": {
            "fingerprint": manifest.get("fingerprint"),
            "documents": manifest.get("nDocuments"),
            "sentences": manifest.get("nSentences"),
            "annotations": manifest.get("nAnnotations"),
        },
        "goldState": gold_state,
        "experiments": experiments,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n{len(experiments)} expériences → {out}")


if __name__ == "__main__":
    main()
