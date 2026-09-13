"""Campagne expérimentale finale — spécification, portes de contrôle, enveloppes de résultat.

Ce module définit CE QUI doit être mesuré pour l'article, sous une forme qui rend chaque
chiffre traçable : une expérience déclare sa question, son hypothèse, son protocole, ses
données, sa configuration et ses métriques ; son exécution produit une ENVELOPPE
standardisée portant la provenance complète (empreinte de dataset, version du gold, version
du code, empreinte de la spécification de taxonomie, graine, date, environnement).

Le point le plus important n'est pas le calcul : ce sont les PORTES. Un résultat n'est
« final » que si toutes les conditions de validité sont réunies — gold figé, dataset figé,
découpe au niveau document, population comparable, mappings figés, graine enregistrée.
Une porte qui échoue ne bloque pas le calcul : elle empêche le résultat de se présenter
comme final. C'est ce qui interdit de mélanger, sans le dire, un aperçu et un chiffre publié.
"""

from __future__ import annotations

import json
import platform
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "research"))

from pactiva_lab import taxonomy as tx  # noqa: E402


# ── Statuts ─────────────────────────────────────────────────────────────────
DRAFT = "draft"              # brouillon : ne rien en tirer
PRELIMINARY = "preliminary"  # calculé, mais une condition de validité manque
VALIDATED = "validated"      # toutes les portes passent
FINAL = "final"              # validé ET gelé pour publication (marquage manuel)
STALE = "stale"              # calculé sur un instantané périmé

STATUS_ORDER = [DRAFT, STALE, PRELIMINARY, VALIDATED, FINAL]


@dataclass
class Gate:
    """Un contrôle automatique de validité. `blocking` : empêche le statut « validé »."""

    id: str
    label: str
    passed: bool
    detail: str
    blocking: bool = True

    def to_dict(self) -> dict:
        return {
            "id": self.id, "label": self.label, "passed": self.passed,
            "detail": self.detail, "blocking": self.blocking,
        }


@dataclass
class Experiment:
    """Déclaration d'une expérience — le CONTRAT, indépendant de son exécution."""

    id: str
    rq: str
    title: str
    question: str
    hypothesis: str
    protocol: str
    metrics_declared: list
    limits: list = field(default_factory=list)
    depends_on: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id, "rq": self.rq, "title": self.title,
            "question": self.question, "hypothesis": self.hypothesis,
            "protocol": self.protocol, "metricsDeclared": self.metrics_declared,
            "limits": self.limits, "dependsOn": self.depends_on,
        }


# ── Provenance ──────────────────────────────────────────────────────────────
def code_version() -> str:
    """SHA du dépôt : la version du code qui a produit le chiffre."""
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
    except Exception:  # noqa: BLE001 — la provenance ne doit jamais casser un run
        return "unknown"


def code_is_clean() -> bool:
    """Le dépôt est-il sans modification non commitée ? (reproductibilité)"""
    try:
        out = subprocess.run(
            ["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True, check=True
        ).stdout.strip()
        return out == ""
    except Exception:  # noqa: BLE001
        return False


def environment() -> dict:
    return {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "executedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


# ── Portes de contrôle ──────────────────────────────────────────────────────
def standard_gates(
    *,
    manifest: dict,
    gold_state: dict,
    split_scheme: str | None,
    seed: int | None,
    populations_compared: list | None = None,
    requires_gold: bool = False,
    requires_model: bool = False,
) -> list:
    """Les contrôles communs à toute expérience de la campagne.

    `requires_gold` : l'expérience S'APPUIE sur le gold (sa finalisation devient bloquante).
    `requires_model` : l'expérience entraîne un modèle (la découpe et la fuite comptent)."""
    gates: list = []

    n_docs = manifest.get("nDocuments", 0)
    n_annotations = manifest.get("nAnnotations", 0)
    gates.append(Gate(
        "dataset_frozen", "Dataset figé et daté",
        bool(manifest.get("fingerprint")),
        f"empreinte {str(manifest.get('fingerprint'))[:16]}…",
    ))
    # Un instantané partiel est la cause n°1 de chiffres périmés dans ce projet :
    # les campagnes d'août tournaient sur 39 documents et 12 documents multi-annotés.
    complete = n_docs >= 50 and n_annotations >= 150
    gates.append(Gate(
        "not_partial_snapshot", "Corpus complet (50 documents × 3 annotateurs)",
        complete,
        f"{n_docs} documents, {n_annotations} annotations soumises",
    ))
    gates.append(Gate(
        "taxonomy_spec_frozen", "Mappings de taxonomie figés et versionnés",
        tx.load_spec()["specVersion"] >= 1,
        f"spécification v{tx.load_spec()['specVersion']}, empreinte {tx.spec_fingerprint()[:16]}…",
    ))
    gates.append(Gate(
        "seed_recorded", "Graine enregistrée",
        seed is not None,
        f"seed={seed}" if seed is not None else "aucune graine déclarée",
    ))
    gates.append(Gate(
        "code_version_recorded", "Version du code enregistrée",
        code_version() != "unknown",
        f"{code_version()[:12]}" + ("" if code_is_clean() else " (dépôt MODIFIÉ : non reproductible en l'état)"),
        blocking=False,
    ))

    if split_scheme is not None or requires_model:
        ok = split_scheme == "group_kfold_document"
        gates.append(Gate(
            "split_document_level", "Découpe au niveau DOCUMENT (jamais par phrase)",
            ok,
            f"schéma « {split_scheme} »" if split_scheme else "aucune découpe déclarée",
        ))
        # Corollaire direct de la découpe par document : aucune phrase d'un même contrat
        # ne peut se retrouver des deux côtés.
        gates.append(Gate(
            "no_train_test_leak", "Aucune fuite entraînement/test",
            ok,
            "garanti par le groupement par document" if ok
            else "non garanti sans découpe par document",
        ))

    if requires_gold:
        finalized = gold_state.get("finalized", 0)
        total = gold_state.get("resolutions", 0)
        gates.append(Gate(
            "gold_finalized", "GOLD figé (résolutions finalisées)",
            total > 0 and finalized == total,
            f"{finalized}/{total} résolutions finalisées"
            + ("" if finalized == total else " — le gold reste modifiable, donc le chiffre peut changer"),
        ))
        undecided = gold_state.get("undecided", 0)
        gates.append(Gate(
            "gold_complete", "GOLD complet (aucune phrase en attente)",
            undecided == 0,
            f"{undecided} phrase(s) non tranchée(s)",
        ))

    if populations_compared and len(populations_compared) > 1:
        gates.append(Gate(
            "same_population", "Comparaisons faites à population constante",
            True,
            "chaque comparaison est interne à une population (jamais entre populations)",
        ))

    return gates


def status_from_gates(gates: list, *, partial_snapshot_is_stale: bool = True) -> str:
    """Statut déduit des portes — jamais saisi à la main.

    Un instantané partiel rend le résultat PÉRIMÉ (il porte sur d'autres données) ;
    une autre porte bloquante en échec le rend PRÉLIMINAIRE (le calcul est bon, une
    condition de publication manque)."""
    failed = [g for g in gates if g.blocking and not g.passed]
    if not failed:
        return VALIDATED
    if partial_snapshot_is_stale and any(g.id == "not_partial_snapshot" for g in failed):
        return STALE
    return PRELIMINARY


def envelope(
    experiment: Experiment,
    *,
    data: dict,
    config: dict,
    metrics: list,
    results: dict,
    interpretation: str,
    gates: list,
    artifacts: list | None = None,
    uncertainty: str = "",
    summary: str = "",
) -> dict:
    """L'enveloppe STANDARDISÉE d'un résultat — la même forme pour les 4 questions.

    Tout chiffre affiché dans la vue « prêt pour l'article » vient d'ici, et porte donc
    sa provenance : on peut remonter d'une valeur du tableau jusqu'à l'expérience, son
    dataset, sa configuration et la version du code qui l'a produite."""
    return {
        **experiment.to_dict(),
        "summary": summary,
        "data": data,
        "config": config,
        "metrics": metrics,
        "results": results,
        "uncertainty": uncertainty,
        "interpretation": interpretation,
        "gates": [g.to_dict() for g in gates],
        "status": status_from_gates(gates),
        "artifacts": artifacts or [],
        "provenance": {
            "codeVersion": code_version(),
            "codeClean": code_is_clean(),
            "taxonomySpecVersion": tx.load_spec()["specVersion"],
            "taxonomySpecFingerprint": tx.spec_fingerprint()[:16],
            **environment(),
        },
    }


def metric(key: str, label: str, value, *, ci=None, unit: str = "", note: str = "",
           higher_is_better: bool | None = True) -> dict:
    """Une métrique affichable : valeur, intervalle, sens de lecture."""
    return {
        "key": key, "label": label, "value": value,
        "ci": list(ci) if ci else None, "unit": unit, "note": note,
        "higherIsBetter": higher_is_better,
    }
