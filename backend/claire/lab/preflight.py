"""Rapport de préfiguration — « qu'obtiendrais-je avec ces critères ? » SANS rien créer.

Point d'ergonomie central du Lab : on ne construit pas un jeu de données à l'aveugle pour
découvrir ensuite qu'il a perdu douze documents. Le rapport répond avant l'engagement :
combien de documents, combien de phrases, quelle distribution de thèmes, **lesquels sont
écartés et pourquoi**, et combien de plis sont possibles.

Ce module est la seule couche du Lot 0 qui touche à l'ORM. Toute la logique de décision
vit dans `selectors.py` (pur) ; ici on se contente de lire la base et de mettre en forme.
La séparation est délibérée : elle permet de tester les règles sans base de données, et
de rejouer le même calcul sur un export hors ligne.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter

from django.db.models import Count, Q

from claire.annotations.models import Annotation, ClauseTheme
from claire.corpora.models import Document

from .selectors import (
    coverage_by_document,
    select_annotations,
    summarize_exclusions,
)

# En deçà de ce support, un thème ne permet ni d'entraîner ni d'évaluer sérieusement :
# on le signale plutôt que de laisser l'utilisateur le découvrir dans un macro-F1 effondré.
RARE_THEME_THRESHOLD = 50

# Un GroupKFold a besoin d'au moins autant de documents que de plis.
DEFAULT_K = 5


def _candidate_rows(project) -> list[dict]:
    """Lignes candidates : une par annotation, avec ses compteurs de complétude.

    Les comptages sont faits par la base (`annotate`) et non en Python : sur 50
    annotations et 9 148 clauses, une boucle avec accès aux relations produirait des
    centaines de requêtes.
    """
    finalized_docs = set(
        project.gold_resolutions.exclude(finalized_at=None).values_list(
            "document_id", flat=True
        )
    ) if hasattr(project, "gold_resolutions") else set()

    rows: list[dict] = []
    qs = (
        Annotation.objects.filter(project=project)
        .select_related("annotator", "document")
        .annotate(
            n_clauses_agg=Count("clauses", distinct=True),
            n_validated_agg=Count("clauses", filter=Q(clauses__validated=True), distinct=True),
        )
    )
    for annotation in qs:
        rows.append(
            {
                "document": annotation.document.external_id,
                "document_id": annotation.document_id,
                "annotator": annotation.annotator.username,
                "annotator_id": annotation.annotator_id,
                "status": annotation.status,
                "n_sentences": annotation.document.n_sentences,
                "n_clauses": annotation.n_clauses_agg,
                "n_validated": annotation.n_validated_agg,
                "has_finalized_gold": annotation.document_id in finalized_docs,
            }
        )
    return rows


def _label_distribution(project, annotation_keys: set[tuple[int, int]]) -> dict[str, dict]:
    """Support par thème, restreint aux annotations RETENUES.

    Compter sur tout le projet donnerait une distribution qui ne correspond pas au jeu
    de données construit — et donc des avertissements « thème rare » à côté de la plaque.
    """
    if not annotation_keys:
        return {}
    doc_ids = {doc_id for doc_id, _ in annotation_keys}
    user_ids = {user_id for _, user_id in annotation_keys}
    tags = (
        ClauseTheme.objects.filter(
            clause__annotation__project=project,
            clause__annotation__document_id__in=doc_ids,
            clause__annotation__annotator_id__in=user_ids,
        )
        .values_list(
            "clause__annotation__document_id",
            "clause__annotation__annotator_id",
            "theme__code",
            "role",
        )
    )
    primary: Counter = Counter()
    secondary: Counter = Counter()
    for doc_id, user_id, code, role in tags:
        # Le filtre SQL croise doc_ids × user_ids : on rejette ici les couples qui ne
        # font pas partie des annotations réellement retenues.
        if (doc_id, user_id) not in annotation_keys:
            continue
        (primary if role == "primary" else secondary)[code] += 1

    codes = sorted(set(primary) | set(secondary))
    return {
        code: {
            "primary": primary.get(code, 0),
            "secondary": secondary.get(code, 0),
            "total": primary.get(code, 0) + secondary.get(code, 0),
        }
        for code in codes
    }


def _fingerprint(criteria: dict, kept: list[dict]) -> str:
    """Empreinte prévisionnelle de (critères + contenu retenu).

    Permet de détecter AVANT construction qu'un jeu de données identique existe déjà.
    Le contenu est réduit aux couples (document, annotateur, nb de clauses validées) :
    deux campagnes au même périmètre mais dont une annotation a bougé donnent bien deux
    empreintes différentes.
    """
    payload = {
        "criteria": criteria,
        "rows": sorted(
            (r["document"], r["annotator"], r["n_validated"]) for r in kept
        ),
    }
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def preflight(project, *, maturity: str = "complete", scope: dict | None = None,
              k: int = DEFAULT_K) -> dict:
    """Simule la construction d'un jeu de données sans rien persister.

    Le rapport est volontairement bavard sur ce qui est ÉCARTÉ : c'est l'information que
    l'utilisateur ne peut obtenir nulle part ailleurs, et celle qui invalide un article
    quand elle manque.
    """
    scope = scope or {}
    rows = _candidate_rows(project)
    kept, excluded = select_annotations(rows, maturity=maturity, scope=scope)

    coverage = coverage_by_document(kept)
    per_document_counts = Counter(len(v) for v in coverage.values())
    # Annotations récupérées grâce à un seuil de complétude assoupli : à afficher
    # explicitement, car c'est une tolérance qui doit rester visible dans le manifeste.
    near_complete = [
        {
            "document": r["document"],
            "annotator": r["annotator"],
            "completeness": round(r.get("completeness", 1.0), 4),
        }
        for r in kept
        if r.get("completeness", 1.0) < 1.0
    ]
    annotation_keys = {(r["document_id"], r["annotator_id"]) for r in kept}

    distribution = _label_distribution(project, annotation_keys)
    rare = sorted(
        code for code, stats in distribution.items() if stats["total"] < RARE_THEME_THRESHOLD
    )

    n_documents = len(coverage)
    n_sentences = sum(
        Document.objects.filter(
            external_id__in=coverage.keys(), corpus=project.corpus
        ).values_list("n_sentences", flat=True)
    ) if n_documents else 0

    warnings: list[dict] = []
    if n_documents < k:
        warnings.append(
            {
                "code": "dataset_too_small",
                "message": f"{n_documents} document(s) retenu(s) : GroupKFold({k}) impossible.",
            }
        )
    if rare:
        warnings.append(
            {
                "code": "rare_themes_below_threshold",
                "message": (
                    f"{len(rare)} thème(s) sous {RARE_THEME_THRESHOLD} occurrences "
                    f"({', '.join(rare)}) : macro-F1 peu fiable sur ces classes."
                ),
            }
        )
    multi = sum(count for size, count in per_document_counts.items() if size >= 2)
    if multi == 0:
        warnings.append(
            {
                "code": "no_multi_annotated_document",
                "message": (
                    "Aucun document à ≥2 annotateurs : ni accord inter-annotateurs "
                    "ni plafond humain ne seront calculables."
                ),
            }
        )
    if near_complete:
        warnings.append(
            {
                "code": "near_complete_accepted",
                "message": (
                    f"{len(near_complete)} annotation(s) retenue(s) sous 100 % de "
                    "validation grâce au seuil assoupli — tolérance à documenter."
                ),
            }
        )

    criteria = {"maturity": maturity, "scope": scope, "k": k}
    return {
        "criteria": criteria,
        "n_annotations": len(kept),
        "n_documents": n_documents,
        "n_sentences": n_sentences,
        "documents_by_annotator_count": dict(sorted(per_document_counts.items())),
        "n_multi_annotated": multi,
        "n_triple_annotated": sum(
            count for size, count in per_document_counts.items() if size >= 3
        ),
        "coverage": coverage,
        "near_complete": near_complete,
        "label_distribution": distribution,
        "rare_themes": rare,
        "excluded": excluded,
        "excluded_summary": summarize_exclusions(excluded),
        "warnings": warnings,
        "splits_preview": {
            "scheme": "group_kfold_document",
            "k": k,
            "feasible": n_documents >= k,
        },
        "would_fingerprint": _fingerprint(criteria, kept),
    }
