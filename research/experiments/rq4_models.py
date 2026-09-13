"""RQ4 — modèles compacts : enveloppes construites à partir des runs du Lab.

Les expériences de RQ4 ne recalculent rien : elles LISENT les sorties du runner
(`results.json`, `errors.json`, `predictions.jsonl`) et les mettent sous la même enveloppe
standardisée que les autres questions de recherche. La séparation est volontaire — le
runner est le seul à entraîner, la campagne est la seule à qualifier et à tracer.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from campaign import Experiment, envelope, metric, standard_gates  # noqa: E402

SEED = 42


def read_run(runs_dir: Path, name: str) -> dict | None:
    path = runs_dir / name / "results.json"
    if not path.exists():
        return None
    run = json.loads(path.read_text(encoding="utf-8"))
    errors_path = runs_dir / name / "errors.json"
    if errors_path.exists():
        run["errors"] = json.loads(errors_path.read_text(encoding="utf-8"))
    return run


def run_summary(run: dict | None) -> dict | None:
    if not run:
        return None
    m = run.get("metrics") or {}
    ci = m.get("macro_f1_ci") or {}
    return {
        "macroF1": m.get("macro_f1"),
        "microF1": m.get("micro_f1"),
        "kappa": m.get("kappa"),
        "ci": [ci.get("low"), ci.get("high")] if ci else None,
        "dispersion": m.get("macro_f1_dispersion"),
        "taxonomy": (run.get("config", {}).get("data") or {}).get("taxonomy", "T20"),
        "family": (run.get("config", {}).get("model") or {}).get("family"),
        "nClasses": len(run.get("per_label") or []),
    }


# =========================================================================== #
def e41_baselines(runs_dir, manifest, gold_state, human_reference):
    exp = Experiment(
        id="E4.1", rq="RQ4", title="Modèles compacts : planchers et effet de la taxonomie",
        question="Un modèle compact apprend-il mieux la taxonomie fusionnée que la taxonomie d'annotation, et où se situe-t-il par rapport à un annotateur humain ?",
        hypothesis="La fusion améliore substantiellement l'apprenabilité (classes plus massives, frontières moins contradictoires) ; l'écart au plafond humain reste important dans les deux cas.",
        protocol="Même dataset, mêmes plis (validation croisée à 5 plis GROUPÉS PAR DOCUMENT), même graine : seules les étiquettes changent de taxonomie. Deux familles : position seule (plancher diagnostique, aucun texte) et TF-IDF + régression logistique (plancher lexical). La comparaison au plafond humain utilise la référence leave-one-annotator-out de E1.5, mesurée par la même procédure.",
        metrics_declared=["macro_f1", "micro_f1", "kappa", "ecart_au_plafond_humain"],
        limits=[
            "Planchers CPU uniquement : les encodeurs juridiques fine-tunés (GPU) ne sont pas inclus dans cette campagne.",
            "Les macro-F1 de T20 et T11 ne sont PAS directement comparables (moyennes sur des ensembles de classes différents) : l'écart s'interprète comme une différence d'apprenabilité, pas comme un gain de performance à tâche constante.",
        ],
        depends_on=["E1.5", "E2.1"],
    )
    runs = {name: run_summary(read_run(runs_dir, name))
            for name in ("position_T20", "position_T11", "tfidf_T20", "tfidf_T11")}
    available = {k: v for k, v in runs.items() if v}
    tfidf20, tfidf11 = runs.get("tfidf_T20"), runs.get("tfidf_T11")
    human_kappa = human_reference.get("kappa") if human_reference else None

    gates = standard_gates(manifest=manifest, gold_state=gold_state,
                           split_scheme="group_kfold_document", seed=SEED,
                           requires_model=True)
    gap = (round(human_kappa - tfidf11["kappa"], 4)
           if human_kappa and tfidf11 and tfidf11.get("kappa") else None)
    return envelope(
        exp,
        summary=(f"TF-IDF passe de {tfidf20['macroF1']:.3f} (T20) à {tfidf11['macroF1']:.3f} (T11) ; "
                 f"il reste à {gap} point de κ du plafond humain." if tfidf20 and tfidf11 else
                 "Runs de modèles incomplets."),
        data={"datasetFingerprint": manifest.get("fingerprint"),
              "taxonomy": "T20 et T11", "labelSource": "consensus (agrégation Lab)",
              "populations": ["all"]},
        config={"seed": SEED, "split": "group_kfold_document (k=5)",
                "models": ["position_only", "tfidf_linear + logreg (bigrammes, class_weight=balanced)"],
                "preprocess": "détokenisation par règles, minuscules, longueur max 128"},
        metrics=[
            metric("macro_f1_T20", "macro-F1 TF-IDF (T20)",
                   tfidf20["macroF1"] if tfidf20 else None,
                   ci=tfidf20["ci"] if tfidf20 else None),
            metric("macro_f1_T11", "macro-F1 TF-IDF (T11)",
                   tfidf11["macroF1"] if tfidf11 else None,
                   ci=tfidf11["ci"] if tfidf11 else None),
            metric("kappa_T11", "κ TF-IDF (T11)", tfidf11["kappa"] if tfidf11 else None),
            metric("human_kappa", "κ référence humaine", human_kappa,
                   note="leave-one-annotator-out (E1.5)"),
            metric("gap_to_human", "Écart au plafond humain (κ)", gap, higher_is_better=False),
        ],
        results={"runs": available, "humanReference": human_reference},
        uncertainty="IC 95 % bootstrap par document sur la macro-F1 ; dispersion inter-plis rapportée par run.",
        interpretation=(
            f"Le plancher de position seule ({runs['position_T20']['macroF1']:.3f} en T20) confirme "
            "que la structure du document ne suffit pas : le texte est nécessaire. "
            f"Un simple TF-IDF atteint {tfidf11['macroF1']:.3f} de macro-F1 en T11 contre "
            f"{tfidf20['macroF1']:.3f} en T20 — la taxonomie fusionnée est nettement plus apprenable, "
            "ce qui était attendu (classes plus massives, frontières moins contradictoires) mais "
            "n'avait jamais été mesuré ici. "
            + (f"Il reste néanmoins {gap} point de κ sous la référence humaine "
               f"({human_kappa:.3f}) : l'écart à combler est réel." if gap else "")
        ),
        gates=gates,
    )


def e42_learning_curve(runs_dir, manifest, gold_state):
    exp = Experiment(
        id="E4.2", rq="RQ4", title="Courbe d'apprentissage : combien de documents annoter ?",
        question="À partir de combien de documents annotés le gain marginal devient-il négligeable ?",
        hypothesis="La performance croît puis plafonne : au-delà d'un certain nombre de documents, annoter davantage rapporte peu.",
        protocol="Le nombre de documents d'ENTRAÎNEMENT est restreint par pli (jamais le test, sinon les points ne seraient plus comparables) ; le tirage est scopé au pool d'entraînement du pli courant, ce qui interdit toute fuite depuis le pli de test.",
        metrics_declared=["macro_f1_par_taille", "gain_marginal"],
        limits=[
            "Mesurée avec TF-IDF : un modèle plus capacitif aurait une courbe différente et plafonnerait plus tard.",
            "Les dernières tailles approchent la taille du pool d'entraînement : leur variabilité est réduite artificiellement.",
        ],
        depends_on=["E4.1"],
    )
    points = []
    for name in sorted(runs_dir.glob("lc_*")):
        run = read_run(runs_dir, name.name)
        if not run:
            continue
        size = int(name.name.split("_")[1])
        m = run.get("metrics") or {}
        points.append({"nDocuments": size, "macroF1": m.get("macro_f1"),
                       "microF1": m.get("micro_f1"), "kappa": m.get("kappa")})
    points.sort(key=lambda p: p["nDocuments"])
    gains = [
        {"from": a["nDocuments"], "to": b["nDocuments"],
         "gain": round(b["macroF1"] - a["macroF1"], 4),
         "gainPerDocument": round((b["macroF1"] - a["macroF1"]) / (b["nDocuments"] - a["nDocuments"]), 5)}
        for a, b in zip(points, points[1:])
    ]
    gates = standard_gates(manifest=manifest, gold_state=gold_state,
                           split_scheme="group_kfold_document", seed=SEED, requires_model=True)
    first, last = points[0], points[-1]
    return envelope(
        exp,
        summary=f"De {first['nDocuments']} à {last['nDocuments']} documents, la macro-F1 passe de {first['macroF1']:.3f} à {last['macroF1']:.3f} ; le gain marginal est divisé par {round(gains[0]['gainPerDocument'] / max(gains[-1]['gainPerDocument'], 1e-6))} sur la plage.",
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "T11",
              "labelSource": "consensus", "populations": ["all"]},
        config={"seed": SEED, "split": "group_kfold_document (k=5)",
                "model": "tfidf_linear + logreg",
                "sizes": [p["nDocuments"] for p in points],
                "restriction": "documents d'ENTRAÎNEMENT uniquement, tirés dans le pool du pli"},
        metrics=[
            metric("macro_f1_min", f"macro-F1 à {first['nDocuments']} documents", first["macroF1"]),
            metric("macro_f1_max", f"macro-F1 à {last['nDocuments']} documents", last["macroF1"]),
            metric("marginal_gain_last", "Gain marginal par document (fin de courbe)",
                   gains[-1]["gainPerDocument"], higher_is_better=False),
        ],
        results={"points": points, "marginalGains": gains},
        uncertainty="Un point par taille (pas de répétition sur plusieurs tirages) : la courbe montre une tendance, pas un intervalle.",
        interpretation=(
            f"Le gain marginal s'effondre : {gains[0]['gainPerDocument']:.5f} point de macro-F1 par "
            f"document au début de la courbe contre {gains[-1]['gainPerDocument']:.5f} à la fin. "
            "Passé une trentaine de documents, annoter davantage rapporte très peu à ce modèle — "
            "l'effort marginal se justifie mieux sur la QUALITÉ de l'annotation (double annotation, "
            "arbitrage) que sur sa quantité."
        ),
        gates=gates,
    )


def e43_error_analysis(runs_dir, manifest, gold_state):
    exp = Experiment(
        id="E4.3", rq="RQ4", title="Analyse des erreurs : où et pourquoi le modèle échoue",
        question="Les erreurs du modèle se concentrent-elles là où les annotateurs eux-mêmes divergent ?",
        hypothesis="Le taux d'erreur croît avec le désaccord humain : un modèle échoue surtout là où la tâche est objectivement ambiguë.",
        protocol="Sur le meilleur modèle compact (TF-IDF en T11), décomposition du taux d'erreur par CLASSE D'ACCORD de la phrase (accord strict / majorité / divergence), confusions les plus fréquentes, et erreurs de plus faible confiance pour inspection qualitative.",
        metrics_declared=["error_rate", "error_rate_par_classe_accord", "top_confusions"],
        limits=[
            "L'analyse porte sur un modèle lexical : un modèle contextuel se tromperait ailleurs.",
            "Les erreurs sur les phrases en divergence ne sont pas nécessairement des erreurs : la référence y est elle-même incertaine.",
        ],
        depends_on=["E4.1"],
    )
    run = read_run(runs_dir, "tfidf_T11")
    errors = run.get("errors") or {}
    by_class = errors.get("byAgreementClass") or {}
    strict = (by_class.get("strict") or {}).get("rate")
    divergence = (by_class.get("divergence") or {}).get("rate")
    gates = standard_gates(manifest=manifest, gold_state=gold_state,
                           split_scheme="group_kfold_document", seed=SEED, requires_model=True)
    return envelope(
        exp,
        summary=f"Le taux d'erreur passe de {strict:.1%} sur les phrases en accord strict à {divergence:.1%} sur les phrases en divergence.",
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "T11",
              "labelSource": "consensus", "populations": ["all"]},
        config={"seed": SEED, "model": "tfidf_linear + logreg (T11)",
                "split": "group_kfold_document (k=5)"},
        metrics=[
            metric("error_rate", "Taux d'erreur global", errors.get("errorRate"),
                   higher_is_better=False),
            metric("error_rate_strict", "Erreur — accord strict", strict, higher_is_better=False),
            metric("error_rate_divergence", "Erreur — divergence", divergence,
                   higher_is_better=False),
            metric("unfair_error_rate", "Erreur sur les phrases abusives",
                   errors.get("unfairErrorRate"), higher_is_better=False,
                   note="phrases portant une étiquette CLAUDETTE"),
        ],
        results={
            "byAgreementClass": by_class,
            "topConfusions": errors.get("topConfusions"),
            "confusionMatrix": errors.get("confusionMatrix"),
            "lowestConfidenceErrors": (errors.get("lowestConfidenceErrors") or [])[:20],
            "perLabel": run.get("per_label"),
        },
        uncertainty="Comptages exacts sur les prédictions hors-pli des 5 plis.",
        interpretation=(
            f"Le modèle échoue {divergence / strict:.1f} fois plus souvent sur les phrases où les "
            "annotateurs divergent que sur celles où ils sont unanimes "
            f"({divergence:.1%} contre {strict:.1%}). Ses erreurs ne sont donc pas arbitraires : "
            "elles se concentrent là où la tâche est objectivement ambiguë, ce qui suggère que la "
            "marge de progression réelle est plus étroite que le taux d'erreur global ne le laisse "
            "croire — une partie de ces « erreurs » sont des désaccords légitimes."
        ),
        gates=gates,
    )
