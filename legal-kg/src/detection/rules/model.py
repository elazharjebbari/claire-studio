"""Enregistrements manipulés par le moteur : normes (templates) et clauses, indépendants de Memgraph."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ClauseRecord:
    clause_id: str
    document: str
    theme_T11: str
    sentence_indices: list[int]                 # indices absolus des phrases de la clause


@dataclass
class NormRecord:
    norm_id: str
    clause_id: str
    document: str
    theme_T11: str
    actor: str
    modality: str
    action: str
    condition: str
    notice: str
    remedy: str
    object: str | None = None
    counterparty: str | None = None
    status: str = "proposed"                    # proposed | validated
    evidence: list[int] = field(default_factory=list)   # indices absolus de phrases
    amount_ratio: float | None = None
    opt_out_deadline_days: int | None = None
    notice_duration_days: int | None = None
    related: list[tuple[str, str]] = field(default_factory=list)  # (relation, other_norm_id) : EXCEPTION_TO, CONDITIONAL_ON

    @property
    def sentence_ids(self) -> list[str]:
        return [f"sentence:{self.document}:{i}" for i in self.evidence]


def norm_id_for(clause_id: str, k: int) -> str:
    """`norm:<document>:<source>:c<local>:n<k>` (NAMING.md) à partir de `clause:<document>:<source>:<local>`."""
    parts = clause_id.split(":")
    if len(parts) == 4 and parts[0] == "clause":
        return f"norm:{parts[1]}:{parts[2]}:c{parts[3]}:n{k}"
    return f"norm:{clause_id}:n{k}"


def norms_from_extraction(step5_rows: list[dict], clauses: dict[str, dict]) -> list[NormRecord]:
    """Convertit les sorties `step_5_corrected.jsonl` (ou validées) en NormRecord ; les indices d'evidence
    (relatifs à la clause) deviennent absolus grâce à `clauses[clause_id]["sentences"]`."""
    out = []
    for row in step5_rows:
        if row.get("output") is None:
            continue
        cid = row["clause_id"]
        c = clauses[cid]
        abs_idx = [s["index"] for s in c["sentences"]]
        for k, n in enumerate(row["output"].get("norms", [])):
            ev = [abs_idx[i] for i in n.get("evidence", []) if 0 <= i < len(abs_idx)]
            out.append(NormRecord(
                norm_id=norm_id_for(cid, k), clause_id=cid, document=c["document"], theme_T11=c["theme_T11"],
                actor=n["actor"], modality=n["modality"], action=n["action"], condition=n["condition"],
                notice=n["notice"], remedy=n["remedy"], object=n.get("object"), counterparty=n.get("counterparty"),
                status=row.get("status", "proposed"), evidence=ev, amount_ratio=n.get("amount_ratio"),
                opt_out_deadline_days=n.get("opt_out_deadline_days"), notice_duration_days=n.get("notice_duration_days")))
    return out
