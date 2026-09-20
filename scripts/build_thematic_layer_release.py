#!/usr/bin/env python3
"""Publication de la couche thématique pour la page reviewer (pactiva.legal).

1. Pseudonymise les annotateurs (A1, A2, A3 — ordre alphabétique des identifiants, stable) dans
   `data/thematic-layer/votes.jsonl` et `manifest.json` (réécrits en place, versionnés).
2. Génère `frontend/public/downloads/thematic-layer-<empreinte16>/` (fichiers) et l'archive zip.
3. Écrit `frontend/public/downloads/RELEASE.json` : empreinte, tailles, SHA-256, chiffres clés lus dans
   les artefacts figés (jamais retapés), carte du modèle servi.
4. Refuse d'écrire si un identifiant réel subsiste ou si un champ `text` apparaît dans un fichier publié.

Usage : python3 scripts/build_thematic_layer_release.py [--check] [--model-results PATH]
`--check` : vérifie sans écrire (sortie 0 = conforme). Aucune dépendance hors bibliothèque standard.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAYER = ROOT / "data" / "thematic-layer"
DOWNLOADS = ROOT / "frontend" / "public" / "downloads"
TAXONOMY_MATRIX = ROOT / "docs" / "pactiva-taxonomies" / "resultats" / "taxonomy_matrix.json"
CAMPAIGN = ROOT / "frontend" / "src" / "features" / "paper" / "campaign.json"
RUN_T20 = ROOT / "research" / "runs" / "legalbert_T20" / "results.json"
RUN_T11 = ROOT / "research" / "runs" / "legalbert_T11" / "results.json"
DEFAULT_DEMO_RESULTS = ROOT / "research" / "runs" / "demo_legalbert_T11_holdout" / "results" / "results.json"

PUBLISHED_FILES = ["votes.jsonl", "gold.jsonl", "judges.jsonl", "labels.json", "splits.json",
                   "taxonomies.json", "manifest.json", "README.md"]
JUDGE_MODELS = {"fable": "Claude Fable 5", "claude": "Claude Opus 4.7",
                "mistral": "Mistral Medium 3.5", "codex": "GPT-5.5"}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")


# --------------------------------------------------------------------------- #
# Pseudonymisation
# --------------------------------------------------------------------------- #

def is_pseudonym(value: str) -> bool:
    return len(value) >= 2 and value[0] == "A" and value[1:].isdigit()


def pseudonym_map(identifiers: set[str]) -> dict[str, str]:
    """Identifiants réels → A1, A2, … (ordre alphabétique, stable). Les pseudonymes déjà présents
    sont conservés tels quels (idempotence)."""
    real = sorted(i for i in identifiers if not is_pseudonym(i))
    mapping = {i: f"A{k}" for k, i in enumerate(real, start=1)}
    mapping.update({i: i for i in identifiers if is_pseudonym(i)})
    return mapping


def pseudonymise_layer(check_only: bool) -> tuple[dict[str, str], bool]:
    """Réécrit votes.jsonl et manifest.json. Retourne (mapping, modifié)."""
    votes = read_jsonl(LAYER / "votes.jsonl")
    manifest = json.loads((LAYER / "manifest.json").read_text(encoding="utf-8"))
    identifiers = {v["annotator"] for v in votes}
    for names in (manifest.get("coverage") or {}).values():
        identifiers.update(names)
    identifiers.update(((manifest.get("criteria") or {}).get("scope") or {}).get("annotators") or [])
    mapping = pseudonym_map(identifiers)
    changed = any(k != v for k, v in mapping.items())
    if changed and not check_only:
        for v in votes:
            v["annotator"] = mapping[v["annotator"]]
        write_jsonl(LAYER / "votes.jsonl", votes)
        if manifest.get("coverage"):
            manifest["coverage"] = {doc: sorted(mapping[n] for n in names)
                                    for doc, names in manifest["coverage"].items()}
        scope = (manifest.get("criteria") or {}).get("scope") or {}
        if scope.get("annotators"):
            scope["annotators"] = sorted(mapping[n] for n in scope["annotators"])
        manifest["annotatorsPseudonymised"] = True
        (LAYER / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                                             encoding="utf-8")
    return mapping, changed


def real_identifiers(mapping: dict[str, str]) -> set[str]:
    return {k for k, v in mapping.items() if k != v}


# --------------------------------------------------------------------------- #
# Vérifications de publication
# --------------------------------------------------------------------------- #

def scan_forbidden(paths: list[Path], forbidden: set[str]) -> list[str]:
    """Aucun identifiant réel, aucun champ `text` dans les fichiers de données publiés."""
    problems = []
    for p in paths:
        data = p.read_text(encoding="utf-8", errors="replace")
        for ident in forbidden:
            if ident and ident in data:
                problems.append(f"{p.name}: identifiant réel présent")
                break
        if p.suffix == ".jsonl":
            first = data.splitlines()[0] if data.strip() else "{}"
            if "text" in json.loads(first):
                problems.append(f"{p.name}: champ `text` publié")
    return problems


# --------------------------------------------------------------------------- #
# Chiffres clés (lus, jamais retapés)
# --------------------------------------------------------------------------- #

def _cell(matrix: dict, taxonomy: str) -> dict:
    for c in matrix["cells"]:
        if c["population"] == "all" and c["taxonomy"] == taxonomy:
            return c
    raise KeyError(taxonomy)


def _campaign_experiment(campaign: dict, exp_id: str) -> dict:
    for e in campaign["experiments"]:
        if e.get("id") == exp_id:
            return e
    raise KeyError(exp_id)


def key_figures(demo_results: Path | None) -> tuple[list[dict], dict | None]:
    matrix = json.loads(TAXONOMY_MATRIX.read_text(encoding="utf-8"))
    campaign = json.loads(CAMPAIGN.read_text(encoding="utf-8"))
    t20, t11 = _cell(matrix, "T20"), _cell(matrix, "T11")
    ceiling = _campaign_experiment(campaign, "E1.5")
    judges = _campaign_experiment(campaign, "E3.3")
    r20 = json.loads(RUN_T20.read_text(encoding="utf-8"))["metrics"]
    r11 = json.loads(RUN_T11.read_text(encoding="utf-8"))["metrics"]

    def metric(exp: dict, key: str):
        return next((m["value"] for m in exp.get("metrics", []) if m.get("key") == key), None)

    def judge_row(taxonomy: str, judge: str):
        return next(r for r in judges["results"]["perTaxonomy"][taxonomy] if r["judge"] == judge)

    figures = [
        {"key": "alpha_masi", "label": "Krippendorff's α (MASI distance), three annotators",
         "t20": t20["raw"]["alpha_masi"], "t11": t11["raw"]["alpha_masi"],
         "source": "docs/pactiva-taxonomies/resultats/taxonomy_matrix.json (population all, raw)",
         "how": "α computed on the individual votes (votes.jsonl) with the MASI distance on the set {primary} ∪ secondaries; the 11-theme value is the same votes projected through taxonomies.json."},
        {"key": "alpha_nominal", "label": "Nominal α on primary themes",
         "t20": t20["raw"]["alpha_nominal"], "t11": t11["raw"]["alpha_nominal"],
         "source": "taxonomy_matrix.json (raw)",
         "how": "Same votes, primary theme only, nominal distance; the gap with α-MASI is the cost of the multi-label format."},
        {"key": "consolidation_gain", "label": "Gain from consolidating 20 → 11 themes (α-MASI)",
         "t20": None, "t11": round(t11["raw"]["alpha_masi"] - t20["raw"]["alpha_masi"], 3),
         "source": "taxonomy_matrix.json",
         "how": "Paired difference of α-MASI between the T20 votes and their T11 projection (bootstrap CI over documents in the paper)."},
        {"key": "human_ceiling_kappa", "label": "Human ceiling, κ (leave-one-annotator-out against the gold)",
         "t20": metric(ceiling, "kappa_mean"), "t11": None,
         "source": "frontend/src/features/paper/campaign.json (E1.5)",
         "how": "Each annotator scored against a gold rebuilt without her votes; mean Cohen's κ over the three annotators (accuracy " + f"{metric(ceiling, 'accuracy_mean')})."},
        {"key": "legalbert_kappa", "label": "Legal-BERT fine-tuned, κ (5-fold, grouped by document)",
         "t20": r20.get("kappa"), "t11": r11.get("kappa"),
         "ci_t20": r20.get("macro_f1_ci"), "ci_t11": r11.get("macro_f1_ci"),
         "source": "research/runs/legalbert_T20/results.json, research/runs/legalbert_T11/results.json",
         "how": "nlpaueb/legal-bert-base-uncased, 8 epochs, ±1 sentence of context, weighted cross-entropy, seed 42, 5-fold cross-validation grouped by document on Grid'5000; macro-F1 " + f"{r20.get('macro_f1')} / {r11.get('macro_f1')}."},
        {"key": "best_judge_kappa", "label": "Best LLM judge (Claude Fable 5), κ",
         "t20": judge_row("T20", "fable")["kappa"], "t11": judge_row("T11", "fable")["kappa"],
         "source": "campaign.json (E3.3)",
         "how": "judges.jsonl against the gold; the other judges: " + ", ".join(
             f"{JUDGE_MODELS[j]} {judge_row('T20', j)['kappa']} / {judge_row('T11', j)['kappa']}"
             for j in ("claude", "mistral", "codex")) + "."},
    ]
    model_card = None
    if demo_results and demo_results.exists():
        r = json.loads(demo_results.read_text(encoding="utf-8"))
        m = r["metrics"]
        model_card = {
            "checkpoint": r["config"]["model"]["checkpoint"],
            "taxonomy": (r["config"].get("data") or {}).get("taxonomy", "T11"),
            "trainedOn": {"documents": r["split"].get("n_train_documents"),
                          "population": "design set (33 contracts)"},
            "evaluatedOn": {"documents": r["split"].get("n_test_documents"),
                            "population": "held-out set (17 contracts, never seen in training)"},
            "metrics": {"macroF1": m.get("macro_f1"), "microF1": m.get("micro_f1"), "kappa": m.get("kappa"),
                        "macroF1Ci": m.get("macro_f1_ci")},
            "recipe": {"epochs": r["config"]["model"]["epochs"], "batchSize": r["config"]["model"]["batch_size"],
                       "learningRate": r["config"]["model"]["learning_rate"],
                       "maxLength": r["config"]["preprocess"]["max_length"],
                       "context": "±1 sentence", "seed": r["config"]["seed"], "loss": r["config"]["model"]["loss"]},
            "datasetFingerprint": r["dataset"]["fingerprint"],
            "source": str(demo_results.relative_to(ROOT)),
        }
        figures.append({"key": "served_model", "label": "Served model: 33 design → 17 held-out contracts, macro-F1 / κ",
                        "t20": None, "t11": m.get("macro_f1"), "extra": {"kappa": m.get("kappa")},
                        "source": str(demo_results.relative_to(ROOT)),
                        "how": "The exact weights behind “Try the classifier”: same recipe, trained once on the 33 design contracts, evaluated on the 17 held-out contracts (design_holdout split)."})
    return figures, model_card


# --------------------------------------------------------------------------- #
# Génération
# --------------------------------------------------------------------------- #

def build(check_only: bool, demo_results: Path | None) -> int:
    mapping, changed = pseudonymise_layer(check_only)
    forbidden = real_identifiers(mapping)
    if check_only and changed:
        print("identifiants réels présents dans data/thematic-layer : lancer sans --check", file=sys.stderr)
        return 1

    manifest = json.loads((LAYER / "manifest.json").read_text(encoding="utf-8"))
    fingerprint = manifest["fingerprint"]
    short = fingerprint[:8]
    target = DOWNLOADS / f"thematic-layer-{short}"
    zip_path = DOWNLOADS / f"thematic-layer-{short}.zip"

    sources = [LAYER / f for f in PUBLISHED_FILES] + sorted((LAYER / "prompts").glob("*.md"))
    problems = scan_forbidden([p for p in sources if p.suffix in (".jsonl", ".json", ".md")], forbidden)
    if problems:
        for p in problems:
            print("REFUS :", p, file=sys.stderr)
        return 2
    if check_only:
        print("conforme : aucun identifiant réel, aucun champ text ;", len(sources), "fichiers publiables")
        return 0

    if target.exists():
        shutil.rmtree(target)
    (target / "prompts").mkdir(parents=True)
    for p in sources:
        dest = target / ("prompts/" + p.name if p.parent.name == "prompts" else p.name)
        shutil.copy2(p, dest)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for p in sorted(target.rglob("*")):
            if p.is_file():
                z.write(p, f"thematic-layer-{short}/{p.relative_to(target)}")

    def record_count(name: str) -> int | None:
        p = target / name
        return sum(1 for l in p.read_text(encoding="utf-8").splitlines() if l.strip()) if p.suffix == ".jsonl" else None

    descriptions = {
        "votes.jsonl": "Individual annotator votes (A1–A3): one record per (document, sentence, annotator), primary theme and secondary themes.",
        "gold.jsonl": "Frozen gold standard and arbitration trail: agreement class, cascade tier, engine proposal, decided themes, vote tally, confidence.",
        "judges.jsonl": "The four LLM judges on the same sentences and vocabulary.",
        "labels.json": "Label inventory and supports.",
        "splits.json": "Document-level folds used for every model result.",
        "taxonomies.json": "Frozen taxonomy specification: T20 and the T14 / T11 / T10 projections, design / held-out partition.",
        "manifest.json": "Provenance: counts, fingerprint, build parameters.",
        "README.md": "How to read and join the files.",
    }
    downloads = []
    for p in sorted(target.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(target).as_posix()
        downloads.append({"name": rel, "path": f"/downloads/thematic-layer-{short}/{rel}",
                          "bytes": p.stat().st_size, "sha256": sha256(p),
                          "records": record_count(rel) if "/" not in rel else None,
                          "description": descriptions.get(rel, ("Session protocol of the judges" if rel.endswith("PROTOCOL.md") else "Judge prompt (protocol v9.2)") if rel.startswith("prompts/") else "")})
    figures, model_card = key_figures(demo_results)
    release = {
        "version": 1,
        "builtAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "datasetFingerprint": fingerprint,
        "counts": {"documents": manifest["nDocuments"], "sentences": manifest["nSentences"],
                   "votes": manifest["nVotes"], "goldSentences": manifest["nGoldSentences"],
                   "annotators": len(mapping), "judges": manifest["judges"],
                   "unfairSentences": manifest.get("nUnfairSentences")},
        "zip": {"path": f"/downloads/{zip_path.name}", "bytes": zip_path.stat().st_size, "sha256": sha256(zip_path)},
        "downloads": downloads,
        "judges": [{"id": j, "model": JUDGE_MODELS[j]} for j in ("fable", "claude", "mistral", "codex")],
        "figures": figures,
        "model": model_card,
        "limits": {"maxChars": 60000, "maxSentences": 400, "language": "en"},
    }
    (DOWNLOADS / "RELEASE.json").write_text(json.dumps(release, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"publié : {target.relative_to(ROOT)} ({len(downloads)} fichiers), {zip_path.name} "
          f"({zip_path.stat().st_size // 1024} ko), RELEASE.json ; pseudonymes : {len(mapping)} ; modèle : {'oui' if model_card else 'non'}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--check", action="store_true", help="vérifie sans écrire")
    ap.add_argument("--model-results", type=Path, default=DEFAULT_DEMO_RESULTS,
                    help="results.json de l'entraînement du modèle servi (carte du modèle)")
    a = ap.parse_args(argv)
    return build(a.check, a.model_results)


if __name__ == "__main__":
    raise SystemExit(main())
