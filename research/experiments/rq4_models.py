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
            "Planchers CPU uniquement : les encodeurs juridiques fine-tunés font l'objet d'une expérience distincte (E4.4), absente de la campagne tant que ses runs Grid'5000 ne sont pas exportés.",
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


# =========================================================================== #
def e44_legalbert(runs_dir, manifest, gold_state, human_reference=None):
    """Le résultat principal du papier long : un encodeur juridique fine-tuné.

    Renvoie `None` tant que les runs Grid'5000 ne sont pas exportés — une expérience
    absente est honnête, une expérience vide ne l'est pas.
    """
    t20 = run_summary(read_run(runs_dir, "legalbert_T20"))
    t11 = run_summary(read_run(runs_dir, "legalbert_T11"))
    if not (t20 and t11):
        return None

    exp = Experiment(
        id="E4.4", rq="RQ4", title="Legal-BERT fine-tuné : T20 contre T11",
        question="Un encodeur pré-entraîné sur du texte juridique confirme-t-il que la taxonomie fusionnée est plus apprenable, ou l'écart observé sur les planchers lexicaux n'était-il qu'un artefact de capacité du modèle ?",
        hypothesis="L'écart T20→T11 se réduit avec la capacité du modèle (un encodeur contextuel absorbe une part de l'ambiguïté que TF-IDF subit) mais ne disparaît pas : une partie du gain vient des étiquettes elles-mêmes, pas du modèle.",
        protocol="Fine-tuning de `nlpaueb/legal-bert-base-uncased` sur GPU Grid'5000 (V100), plis groupés PAR DOCUMENT (k=5), graine 42, contexte d'une phrase avant/après, perte pondérée par les effectifs de classe, arrêt précoce (patience 3). Seules les étiquettes changent entre les deux conditions : même dataset, mêmes plis, même graine.",
        metrics_declared=["macro_f1", "micro_f1", "kappa", "ecart_au_plafond_humain"],
        limits=[
            "Les macro-F1 de T20 et T11 ne sont PAS directement comparables (moyennes sur des ensembles de classes de tailles différentes) : l'écart se lit comme une différence d'apprenabilité, jamais comme un gain de performance à tâche constante.",
            "Un seul encodeur : la comparaison aux généralistes (RoBERTa, DeBERTa, ModernBERT) reste à faire.",
            "L'arrêt précoce utilise le pli de test faute de pli de validation interne : la performance rapportée est donc légèrement optimiste.",
        ],
        depends_on=["E4.1", "E2.1"],
    )
    human_kappa = (human_reference or {}).get("kappa")
    gap = round(human_kappa - t11["kappa"], 4) if human_kappa and t11.get("kappa") else None
    gates = standard_gates(manifest=manifest, gold_state=gold_state,
                           split_scheme="group_kfold_document", seed=SEED,
                           requires_model=True)
    return envelope(
        exp,
        summary=(f"Legal-BERT passe de {t20['macroF1']:.3f} de macro-F1 en T20 "
                 f"({t20['nClasses']} classes) à {t11['macroF1']:.3f} en T11 "
                 f"({t11['nClasses']} classes)."),
        data={"datasetFingerprint": manifest.get("fingerprint"),
              "taxonomy": "T20 et T11", "labelSource": "consensus (agrégation Lab)",
              "populations": ["all"]},
        config={"seed": SEED, "split": "group_kfold_document (k=5)",
                "checkpoint": "nlpaueb/legal-bert-base-uncased",
                "epochs": 8, "batchSize": 16, "learningRate": 2e-5,
                "loss": "weighted_ce", "earlyStoppingPatience": 3,
                "compute": "Grid'5000 — lyon, cluster gemini (V100 32 Go)"},
        metrics=[
            metric("macro_f1_T20", "macro-F1 (T20)", t20["macroF1"], ci=t20["ci"]),
            metric("macro_f1_T11", "macro-F1 (T11)", t11["macroF1"], ci=t11["ci"]),
            metric("kappa_T20", "κ (T20)", t20["kappa"]),
            metric("kappa_T11", "κ (T11)", t11["kappa"]),
            metric("human_kappa", "κ référence humaine", human_kappa,
                   note="leave-one-annotator-out (E1.5)"),
            metric("gap_to_human", "Écart au plafond humain (κ)", gap, higher_is_better=False),
        ],
        results={"runs": {"legalbert_T20": t20, "legalbert_T11": t11},
                 "humanReference": human_reference},
        uncertainty="IC 95 % bootstrap par document (1 000 rééchantillonnages) sur la macro-F1 ; dispersion inter-plis rapportée par run.",
        interpretation=(
            f"Sur l'encodeur juridique, la macro-F1 passe de {t20['macroF1']:.3f} (T20) à "
            f"{t11['macroF1']:.3f} (T11). "
            + ("La fusion reste donc favorable à un modèle capacitif : le gain n'est pas "
               "un simple artefact du plancher lexical. "
               if t11["macroF1"] > t20["macroF1"] else
               "L'écart s'inverse ou s'annule sur un modèle capacitif : le gain observé sur "
               "TF-IDF tenait pour une part à la faiblesse du modèle, pas aux étiquettes. ")
            + (f"Il reste {gap} point de κ sous la référence humaine ({human_kappa:.3f})."
               if gap else "")
        ),
        gates=gates,
    )


# =========================================================================== #
def e45_multilabel(runs_dir, manifest, gold_state, masi_ceiling=None,
                   cardinality=None):
    """La tâche multi-étiquette — et ce que l'agrégation en fait réellement."""
    run = read_run(runs_dir, "legalbert_multilabel_T11")
    if not run:
        return None
    m = run.get("metrics") or {}
    summary = run_summary(run)
    mono = run_summary(read_run(runs_dir, "legalbert_T11"))
    mean_labels = (cardinality or {}).get("mean")
    share_multi = (cardinality or {}).get("shareMulti")

    exp = Experiment(
        id="E4.5", rq="RQ4", title="Multi-label : ce que l'agrégation fait à la tâche",
        question="Un modèle apprend-il la tâche telle qu'elle a été annotée — plusieurs thèmes par phrase — et non sa réduction à un thème principal ?",
        hypothesis="ATTENDU : la performance multi-label devait être NETTEMENT INFÉRIEURE à la performance mono-label, la tâche étant plus dure. RÉSULTAT : hypothèse RÉFUTÉE, et la raison est instructive (voir interprétation).",
        protocol="Fine-tuning de `nlpaueb/legal-bert-base-uncased` en sortie sigmoïde (perte BCE), 10 époques, plis groupés PAR DOCUMENT (k=5), graine 42, sur le même dataset et les mêmes plis que la condition mono-label. La cardinalité d'étiquettes du dataset a été mesurée séparément pour interpréter l'écart.",
        metrics_declared=["macro_f1", "micro_f1", "subset_accuracy", "hamming_loss", "lrap"],
        limits=[
            "LIMITE PRINCIPALE : le dataset agrégé ne préserve PAS le multi-étiquetage des annotations individuelles. Ce run ne mesure donc pas la difficulté réelle de la tâche multi-label, mais celle d'une tâche redevenue quasi mono-étiquette par l'agrégation.",
            "La macro-F1 multi-label (moyenne one-vs-rest par étiquette) et la macro-F1 mono-label ne sont PAS la même quantité : les rapprocher indique une tendance, jamais un classement.",
            "Le plafond α-MASI est un coefficient d'accord CORRIGÉ DU HASARD, la F1 ne l'est pas : les afficher côte à côte situe un ordre de grandeur, ce n'est pas une comparaison stricte.",
            "Seuil de décision global, non calibré par classe : une calibration par thème relèverait la macro-F1 sur les classes rares.",
        ],
        depends_on=["E1.1", "E4.4"],
    )
    gates = standard_gates(manifest=manifest, gold_state=gold_state,
                           split_scheme="group_kfold_document", seed=SEED,
                           requires_model=True)
    metrics = [
        metric("macro_f1", "macro-F1 multi-label", summary["macroF1"], ci=summary["ci"]),
        metric("micro_f1", "micro-F1 multi-label", summary["microF1"]),
        metric("subset_accuracy", "Exactitude par sous-ensemble exact",
               m.get("subset_accuracy")),
        metric("hamming_loss", "Perte de Hamming", m.get("hamming_loss"),
               higher_is_better=False),
        metric("lrap", "LRAP (précision moyenne par rang d'étiquette)", m.get("lrap")),
    ]
    if mean_labels is not None:
        metrics.append(metric("label_cardinality", "Étiquettes par phrase (moyenne, T11)",
                              mean_labels,
                              note="mesurée sur le dataset agrégé de la campagne"))
        metrics.append(metric("share_multi_label", "Part des phrases à ≥ 2 étiquettes",
                              share_multi))
    if masi_ceiling is not None:
        metrics.append(metric("alpha_masi_ceiling", "Plafond α-MASI T11 (accord humain)",
                              masi_ceiling,
                              note="E2.1, corpus complet — échelle différente de la F1"))

    cardinality_phrase = (
        f"Or le dataset agrégé ne porte que {mean_labels:.2f} étiquette par phrase en "
        f"moyenne, et seules {share_multi:.1%} des phrases en ont au moins deux : "
        if mean_labels is not None and share_multi is not None else
        "Or le dataset agrégé ne préserve quasiment pas le multi-étiquetage : "
    )
    return envelope(
        exp,
        summary=(f"macro-F1 {summary['macroF1']:.3f} en multi-label — hypothèse réfutée : "
                 f"l'agrégation a ramené la tâche à un quasi-mono-étiquetage "
                 + (f"({mean_labels:.2f} étiquette par phrase)." if mean_labels else ".")),
        data={"datasetFingerprint": manifest.get("fingerprint"), "taxonomy": "T11",
              "labelSource": "consensus (agrégation Lab)", "populations": ["all"]},
        config={"seed": SEED, "split": "group_kfold_document (k=5)",
                "checkpoint": "nlpaueb/legal-bert-base-uncased", "epochs": 10,
                "loss": "bce", "task": "T2_multilabel",
                "compute": "Grid'5000 — lyon, cluster gemini (V100 32 Go)"},
        metrics=metrics,
        results={"run": summary, "monoLabelReference": mono,
                 "foldStats": m.get("fold_stats"), "cardinality": cardinality},
        uncertainty="IC 95 % bootstrap par document (1 000 rééchantillonnages) sur la macro-F1.",
        interpretation=(
            f"La performance multi-label ({summary['macroF1']:.3f}) n'est pas inférieure à "
            f"la performance mono-label"
            + (f" ({mono['macroF1']:.3f})" if mono else "")
            + " : l'hypothèse est réfutée. "
            + cardinality_phrase
            + "l'agrégation en consensus a largement effacé le multi-étiquetage pourtant "
            "présent dans les annotations individuelles. C'est cohérent avec E1.1, qui "
            "mesure précisément ce coût sur les VOTES (α-MASI inférieur à α nominal) là où "
            "le multi-étiquetage existe encore. "
            "CONSÉQUENCE MÉTHODOLOGIQUE : ce chiffre ne peut pas être présenté comme la "
            "performance sur la tâche réellement annotée. Le mesurer demande un dataset "
            "construit en agrégation souple (`aggregation='soft'`), qui conserve les "
            "étiquettes concurrentes au lieu de trancher. Tant que ce dataset n'existe pas, "
            "l'affirmation « le modèle apprend la tâche multi-label » n'est pas soutenable."
        ),
        gates=gates,
    )
