"""Construction du jeu de données — écrit le contrat de fichiers consommé par le runner.

Le contrat (cf. `docs/pactiva-lab/02_ARCHITECTURE.md` §4) est délibérément un DOSSIER DE
FICHIERS et non un appel de fonction : c'est ce qui lui permet de traverser une frontière
réseau, un ordonnanceur OAR et un système de fichiers partagé — et d'être publié tel quel
en annexe de l'article.

    manifest.json     critères, comptages, documents écartés AVEC motif, empreinte
    sentences.jsonl   une ligne par phrase (cible d'entraînement)
    splits.json       plis figés — deux modèles ne sont comparables que sur les mêmes
    labels.json       les thèmes, avec leur support
    judges.jsonl      prédictions des 4 juges LLM (baseline figée, déjà en base)
    reference.jsonl   labels d'abusivité CLAUDETTE alignés
    votes.jsonl       votes BRUTS par annotateur (matière des mesures d'accord M1)
    gold.jsonl        état de la cascade gold par phrase (matière de M2), si résolutions
    README.md         généré : comment relire ce dataset
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path

from django.db.models import Count, Prefetch, Q

from claire.annotations.models import Annotation, ClauseTheme
from claire.corpora.models import Document, ReferenceLabel
from claire.gold.models import GoldSentence
from claire.imports.models import Judge, PreAnnotation

from .aggregation import aggregate_sentence
from .selectors import select_annotations, summarize_exclusions
from .splits import TooFewGroups, split_manifest, validate_folds

CONTRACT_VERSION = 1


def _detokenize(text: str) -> str:
    """Restaure une ponctuation naturelle sur du texte pré-tokenisé.

    Le corpus CLAUDETTE est tokenisé (« terms and conditions of use . », « you ' re »),
    alors que les tokenizers de transformers modernes sont entraînés sur du texte
    naturel. C'est probablement le prétraitement le plus rentable du plan — d'où sa
    présence dès la construction, en COLONNE SUPPLÉMENTAIRE : le texte brut est conservé
    pour que le choix reste au runner, jamais imposé par le dataset.
    """
    import re

    out = text
    out = re.sub(r"\s+([,.;:!?%)\]}])", r"\1", out)
    out = re.sub(r"([(\[{$])\s+", r"\1", out)
    out = re.sub(r"\s+'\s*(s|t|re|ve|ll|d|m)\b", r"'\1", out)
    out = re.sub(r"\bn\s+'\s*t\b", "n't", out)
    out = re.sub(r'\s+"\s*', '" ', out)
    out = re.sub(r"\s{2,}", " ", out).strip()
    return out[:1].upper() + out[1:] if out else out


def _annotation_rows(project) -> list[dict]:
    """Candidats, avec leurs compteurs de complétude (comptés en SQL, pas en Python)."""
    finalized = set(
        project.gold_resolutions.exclude(finalized_at=None).values_list("document_id", flat=True)
    )
    rows = []
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
                "annotation_id": annotation.id,
                "status": annotation.status,
                "n_sentences": annotation.document.n_sentences,
                "n_clauses": annotation.n_clauses_agg,
                "n_validated": annotation.n_validated_agg,
                "has_finalized_gold": annotation.document_id in finalized,
            }
        )
    return rows


def _theme_sets(annotation) -> dict[int, tuple[str, tuple[str, ...]]]:
    """Index phrase → (primaire, secondaires), projeté par bloc depuis les ancres."""
    anchors: dict[int, tuple[str, tuple[str, ...]]] = {}
    for clause in annotation.clauses.all():
        tags = list(clause.theme_tags.all())
        secondaries = tuple(
            sorted(t.theme.code for t in tags if t.role == "secondary")
        )
        anchors[clause.anchor_sentence.index] = (clause.theme.code, secondaries)

    n = annotation.document.n_sentences
    out: dict[int, tuple[str, tuple[str, ...]]] = {}
    current: tuple[str, tuple[str, ...]] | None = None
    for index in range(n):
        current = anchors.get(index, current)
        if current is not None:
            out[index] = current
    return out


def build_dataset_files(
    project,
    *,
    maturity: str = "complete",
    aggregation: str = "consensus",
    scope: dict | None = None,
    k: int = 5,
    seed: int = 42,
    single_annotator: str | None = None,
    out_dir: Path | None = None,
) -> dict:
    """Construit le dossier de dataset et renvoie son manifeste.

    `out_dir=None` fait un « à blanc » : tout est calculé, rien n'est écrit. Utile pour
    tester la construction sans toucher au disque.
    """
    scope = scope or {}
    candidates = _annotation_rows(project)
    kept, excluded = select_annotations(candidates, maturity=maturity, scope=scope)

    if not kept:
        raise ValueError(
            "dataset_empty : aucune annotation ne satisfait les critères "
            f"(maturité={maturity}, {len(excluded)} écartée(s))."
        )

    annotation_ids = [row["annotation_id"] for row in kept]
    annotations = (
        Annotation.objects.filter(id__in=annotation_ids)
        .select_related("annotator", "document")
        .prefetch_related(
            Prefetch(
                "clauses__theme_tags",
                queryset=ClauseTheme.objects.select_related("theme").order_by("order"),
            ),
            "clauses__anchor_sentence",
            "clauses__theme",
        )
    )

    # votes[(document, index)] = [(annotateur, primaire, secondaires), …]
    votes: dict[tuple[str, int], list[tuple[str, str, tuple[str, ...]]]] = defaultdict(list)
    documents: dict[str, Document] = {}
    for annotation in annotations:
        document = annotation.document
        documents[document.external_id] = document
        for index, (primary, secondaries) in _theme_sets(annotation).items():
            votes[(document.external_id, index)].append(
                (annotation.annotator.username, primary, secondaries)
            )

    document_sizes = {ext: doc.n_sentences for ext, doc in documents.items()}
    try:
        splits = split_manifest(document_sizes, k=k, seed=seed)
    except TooFewGroups as exc:
        raise ValueError(f"dataset_too_small : {exc}") from exc
    validate_folds(splits["folds"], set(document_sizes))

    # Textes et frontières
    sentences_by_document: dict[str, list] = {}
    for ext, document in documents.items():
        sentences_by_document[ext] = list(document.sentences.order_by("index"))

    unfair: dict[tuple[int, int], list[str]] = defaultdict(list)
    for label in ReferenceLabel.objects.filter(
        sentence__document__in=documents.values()
    ).select_related("sentence"):
        unfair[(label.sentence.document_id, label.sentence.index)].append(label.category)

    rows: list[dict] = []
    label_support_primary: dict[str, int] = defaultdict(int)
    label_support_secondary: dict[str, int] = defaultdict(int)
    n_multi = 0

    for ext in sorted(documents):
        document = documents[ext]
        sentences = sentences_by_document[ext]
        previous: tuple[str, tuple[str, ...]] | None = None
        for sentence in sentences:
            key = (ext, sentence.index)
            if key not in votes:
                continue
            label = aggregate_sentence(
                votes[key], policy=aggregation, single_annotator=single_annotator
            )
            if label is None or not label.get("primary"):
                continue
            themes = [label["primary"], *label["secondaries"]]
            label_support_primary[label["primary"]] += 1
            for code in label["secondaries"]:
                label_support_secondary[code] += 1
            if len(themes) > 1:
                n_multi += 1

            # Frontière : la phrase ouvre un segment si son jeu de thèmes change.
            current = (label["primary"], tuple(label["secondaries"]))
            boundary = current != previous
            previous = current

            row = {
                "document": ext,
                "index": sentence.index,
                "text": sentence.raw_text,
                "text_detok": _detokenize(sentence.raw_text),
                "doc_position": (
                    round(sentence.index / max(1, document.n_sentences - 1), 6)
                    if document.n_sentences > 1 else 0.0
                ),
                "n_sentences": document.n_sentences,
                "primary": label["primary"],
                "themes": themes,
                "boundary": boundary,
                "annotators": label["annotators"],
                "n_annotators": label["nAnnotators"],
                "agreement": label["agreement"],
                "confidence": label["confidence"],
                "unfair": sorted(unfair.get((document.id, sentence.index), [])),
                "source_maturity": maturity,
            }
            if "soft" in label:
                row["soft"] = label["soft"]
                row["soft_secondary"] = label["softSecondary"]
                row["vote_entropy"] = label["voteEntropy"]
            rows.append(row)

    # Baseline LLM : lue en base, jamais relancée.
    judge_rows: list[dict] = []
    for pre in (
        PreAnnotation.objects.filter(project=project, document__in=documents.values())
        .select_related("document")
        .prefetch_related("preclauses")
    ):
        preclauses = sorted(pre.preclauses.all(), key=lambda c: c.anchor_index)
        n = pre.document.n_sentences
        for position, preclause in enumerate(preclauses):
            end = (
                preclauses[position + 1].anchor_index
                if position + 1 < len(preclauses)
                else n
            )
            for index in range(preclause.anchor_index, min(end, n)):
                judge_rows.append(
                    {
                        "document": pre.document.external_id,
                        "index": index,
                        "judge": pre.judge,
                        "theme": preclause.theme_code,
                        "is_segment_start": index == preclause.anchor_index,
                    }
                )

    reference_rows = [
        {
            "document": document.external_id,
            "index": index,
            "category": category,
            "level": 1,
        }
        for (document_id, index), categories in sorted(unfair.items())
        for category in sorted(categories)
        for document in [next(d for d in documents.values() if d.id == document_id)]
    ]

    # Votes BRUTS par annotateur — la matière des mesures d'accord (M1). Indépendants de
    # la politique d'agrégation : c'est ce qui rend l'IAA reproductible sur export daté
    # (règle des dossiers de papiers : aucun chiffre issu d'une requête ad hoc).
    vote_rows = [
        {
            "document": document_ext,
            "index": index,
            "annotator": annotator,
            "primary": primary,
            "secondaries": list(secondaries),
        }
        for (document_ext, index) in sorted(votes)
        for annotator, primary, secondaries in sorted(votes[(document_ext, index)])
    ]

    # État de la cascade gold par phrase (matière de M2) — exporté tel quel, y compris
    # non finalisé : l'aperçu doit MONTRER « 0 résolution finalisée », pas le masquer.
    gold_rows: list[dict] = []
    n_gold_finalized_docs = 0
    gold_sentences = (
        GoldSentence.objects.filter(
            resolution__project=project, resolution__document__in=documents.values()
        )
        .select_related("resolution", "resolution__document", "primary_theme")
        .order_by("resolution__document__external_id", "index")
    )
    finalized_docs: set[int] = set()
    for sentence in gold_sentences:
        finalized = sentence.resolution.finalized_at is not None
        if finalized:
            finalized_docs.add(sentence.resolution.document_id)
        gold_rows.append(
            {
                "document": sentence.resolution.document.external_id,
                "index": sentence.index,
                "agreement_class": sentence.agreement_class,
                "auto_level": sentence.auto_level,
                "risk_band": sentence.risk_band,
                "proposed_primary": sentence.proposed_primary,
                "proposed_secondaries": list(sentence.proposed_secondaries or []),
                "decided": sentence.decided,
                "auto_resolved": sentence.auto_resolved,
                "decided_primary": (
                    sentence.primary_theme.code if sentence.primary_theme_id else ""
                ),
                "decided_secondaries": list(sentence.secondaries or []),
                "tally": sentence.tally or {},
                "confidence": sentence.confidence,
                "finalized": finalized,
            }
        )
    n_gold_finalized_docs = len(finalized_docs)

    coverage: dict[str, list[str]] = defaultdict(list)
    for row in kept:
        coverage[row["document"]].append(row["annotator"])

    labels = sorted(set(label_support_primary) | set(label_support_secondary))
    manifest = {
        "contractVersion": CONTRACT_VERSION,
        "project": project.slug,
        "criteria": {
            "maturity": maturity,
            "aggregation": aggregation,
            "scope": scope,
            "k": k,
            "seed": seed,
            "singleAnnotator": single_annotator,
        },
        "nAnnotations": len(kept),
        "nDocuments": len(documents),
        "nSentences": len(rows),
        "nLabels": len(labels),
        "multiLabelRate": round(n_multi / len(rows), 6) if rows else 0.0,
        "labelDistribution": {
            code: {
                "primary": label_support_primary.get(code, 0),
                "secondary": label_support_secondary.get(code, 0),
            }
            for code in labels
        },
        "coverage": {doc: sorted(names) for doc, names in sorted(coverage.items())},
        # JAMAIS silencieux : un dataset qui perd des documents sans le dire produit
        # un article faux.
        "excluded": excluded,
        "excludedSummary": summarize_exclusions(excluded),
        "judges": sorted(Judge.import_judges()),
        "nUnfairSentences": len(unfair),
        "nVotes": len(vote_rows),
        "nGoldSentences": len(gold_rows),
        "nGoldFinalizedDocuments": n_gold_finalized_docs,
    }
    manifest["fingerprint"] = _fingerprint(manifest, rows, vote_rows, gold_rows)

    if out_dir is not None:
        _write(Path(out_dir), manifest, rows, splits, labels, judge_rows, reference_rows,
               vote_rows, gold_rows, label_support_primary, label_support_secondary)

    return {"manifest": manifest, "splits": splits, "rows": rows, "judges": judge_rows}


def _fingerprint(
    manifest: dict, rows: list[dict], vote_rows: list[dict], gold_rows: list[dict]
) -> str:
    """Empreinte de (critères + contenu). Deux constructions identiques la partagent.

    Les votes et l'état gold FONT PARTIE de l'identité : une décision d'arbitrage prise
    entre deux constructions produit un export différent — donc une empreinte différente —
    même si les phrases agrégées n'ont pas bougé. Sans cela, la déduplication rendrait
    un M2 irrejouable sur l'état réellement mesuré.
    """
    payload = {
        "criteria": manifest["criteria"],
        "rows": [
            (r["document"], r["index"], r["primary"], tuple(r["themes"])) for r in rows
        ],
        "votes": [
            (v["document"], v["index"], v["annotator"], v["primary"],
             tuple(v["secondaries"]))
            for v in vote_rows
        ],
        "gold": [
            (g["document"], g["index"], g["auto_level"], g["decided"],
             g["decided_primary"], tuple(g["decided_secondaries"]), g["finalized"])
            for g in gold_rows
        ],
    }
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"),
                      default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _write(out_dir, manifest, rows, splits, labels, judge_rows, reference_rows,
           vote_rows, gold_rows, support_primary, support_secondary) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    def jsonl(name: str, items: list[dict]) -> None:
        with (out_dir / name).open("w", encoding="utf-8") as handle:
            for item in items:
                handle.write(json.dumps(item, ensure_ascii=False) + "\n")

    jsonl("sentences.jsonl", rows)
    jsonl("judges.jsonl", judge_rows)
    jsonl("reference.jsonl", reference_rows)
    jsonl("votes.jsonl", vote_rows)
    jsonl("gold.jsonl", gold_rows)
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (out_dir / "splits.json").write_text(
        json.dumps(splits, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (out_dir / "labels.json").write_text(
        json.dumps(
            [
                {
                    "code": code,
                    "support_primary": support_primary.get(code, 0),
                    "support_secondary": support_secondary.get(code, 0),
                }
                for code in labels
            ],
            indent=2, ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (out_dir / "README.md").write_text(_readme(manifest, splits), encoding="utf-8")


def _readme(manifest: dict, splits: dict) -> str:
    """README généré — un dataset publié doit être relisible sans le code qui l'a produit."""
    excluded = manifest["excludedSummary"]
    excluded_lines = (
        "\n".join(f"- `{reason}` : {count}" for reason, count in sorted(excluded.items()))
        or "- aucun"
    )
    return f"""# Jeu de données Pactiva Lab

**Empreinte** : `{manifest['fingerprint']}`
**Contrat** : v{manifest['contractVersion']} · **Projet** : {manifest['project']}

## Critères de sélection

| | |
|---|---|
| Maturité | `{manifest['criteria']['maturity']}` |
| Agrégation | `{manifest['criteria']['aggregation']}` |
| Graine | {manifest['criteria']['seed']} |

## Contenu

| | |
|---|---|
| Annotations retenues | {manifest['nAnnotations']} |
| Documents | {manifest['nDocuments']} |
| Phrases étiquetées | {manifest['nSentences']} |
| Thèmes | {manifest['nLabels']} |
| Taux multi-label | {manifest['multiLabelRate']:.1%} |
| Phrases abusives (CLAUDETTE) | {manifest['nUnfairSentences']} |
| Votes bruts (annotateur × phrase) | {manifest['nVotes']} |
| Phrases gold (cascade) | {manifest['nGoldSentences']} (documents finalisés : {manifest['nGoldFinalizedDocuments']}) |

## Documents écartés

{excluded_lines}

Le détail figure dans `manifest.json` (clé `excluded`), avec le motif de chaque exclusion.

## Découpage

`{splits['scheme']}` — {splits['k']} plis, tailles {splits['foldSizes']}.

> **Le groupe est le document.** Un découpage par phrase ferait fuir des phrases du même
> contrat entre entraînement et test : les scores seraient gonflés et le résultat non
> publiable. Les plis sont figés ici — deux modèles ne sont comparables que s'ils ont été
> évalués sur les mêmes.

## Fichiers

| Fichier | Contenu |
|---|---|
| `sentences.jsonl` | une ligne par phrase étiquetée (cible d'entraînement) |
| `judges.jsonl` | prédictions des juges LLM ({', '.join(manifest['judges'])}) — baseline figée |
| `reference.jsonl` | labels d'abusivité CLAUDETTE alignés |
| `votes.jsonl` | votes bruts par annotateur (matière des mesures d'accord) |
| `gold.jsonl` | état de la cascade gold par phrase (y compris non finalisé) |
| `splits.json` | les plis, figés |
| `labels.json` | les thèmes et leur support |
| `manifest.json` | ce qui précède, en machine-lisible |

⚠️ `reference.jsonl` ne porte que le **niveau 1** : la source CLAUDETTE importée est
binaire, les trois niveaux de sévérité n'y figurent pas. Ne pas écrire « 3 niveaux ».
"""
