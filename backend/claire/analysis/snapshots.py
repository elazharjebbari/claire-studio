"""Construction de snapshots analytiques immuables, y compris depuis des brouillons."""

from __future__ import annotations

import hashlib
import hmac
import json

from django.conf import settings
from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone

from claire.annotations.models import Annotation, AnnotationStatus, ClauseTheme
from claire.audit.services import record_event
from claire.gold.models import GoldSentence
from claire.imports.models import PreAnnotation

from .models import AnalysisSnapshot, SnapshotVisibility
from .policy import access_for

SNAPSHOT_SCHEMA_VERSION = 1


def _canonical(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _pseudonym(project_id: int, user_id: int) -> str:
    digest = hmac.new(
        settings.SECRET_KEY.encode(),
        f"analysis:{project_id}:{user_id}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"A-{digest[:8].upper()}"


def _annotation_payload(annotation, actor_key: str) -> dict:
    clauses = []
    for clause in annotation.clauses.all():
        tags = list(clause.theme_tags.all())
        secondary = [tag.theme.code for tag in tags if tag.role == "secondary"]
        clauses.append(
            {
                "id": clause.id,
                "anchorIndex": clause.anchor_sentence.index,
                "primaryTheme": clause.theme.code,
                "secondaryThemes": secondary,
                "certainty": clause.certainty,
                "validated": clause.validated,
                "boundaryType": clause.boundary_type,
                "triageLevel": clause.triage_level,
            }
        )
    clauses.sort(key=lambda row: (row["anchorIndex"], row["id"]))
    return {
        "id": annotation.id,
        "documentId": annotation.document_id,
        "actorKey": actor_key,
        "status": annotation.status,
        "source": annotation.source,
        "globalCertainty": annotation.global_certainty,
        "locked": annotation.locked,
        "updatedAt": annotation.updated_at.isoformat(),
        "clauses": clauses,
    }


@transaction.atomic
def create_snapshot(
    *, project, user, label: str = "", include_drafts: bool = True, scope: dict | None = None
) -> AnalysisSnapshot:
    """Fige l'état visible par ``user`` sans exiger de soumission préalable.

    Un annotateur ne fige que ses propres sessions (brouillons compris). Un reviewer
    ne reçoit les brouillons d'autrui ni dans le payload ni dans le manifeste.
    """

    access = access_for(user, project)
    scope = scope or {}
    visibility = SnapshotVisibility.PERSONAL if access.personal_only else SnapshotVisibility.PROJECT
    annotations = Annotation.objects.filter(project=project).select_related("annotator", "document")
    if access.personal_only:
        annotations = annotations.filter(annotator=user)
    elif not access.may_include_other_drafts:
        annotations = annotations.filter(Q(annotator=user) | ~Q(status=AnnotationStatus.DRAFT))
    if not include_drafts:
        annotations = annotations.exclude(status=AnnotationStatus.DRAFT)
    statuses = scope.get("statuses")
    if isinstance(statuses, list) and statuses:
        annotations = annotations.filter(status__in=statuses)
    document_ids = scope.get("document_ids", scope.get("documentIds"))
    if isinstance(document_ids, list) and document_ids:
        annotations = annotations.filter(document_id__in=document_ids)
    actor_keys = scope.get("actor_keys", scope.get("actorKeys"))
    if isinstance(actor_keys, list) and actor_keys and not access.personal_only:
        actor_ids = [key.split(":", 1)[1] for key in actor_keys if str(key).startswith("human:")]
        annotations = annotations.filter(annotator_id__in=actor_ids)
    annotations = annotations.prefetch_related(
        Prefetch(
            "clauses__theme_tags",
            queryset=ClauseTheme.objects.select_related("theme").order_by("order"),
        ),
        "clauses__anchor_sentence",
        "clauses__theme",
        "versions",
    ).order_by("id")

    actor_ids = set(annotations.values_list("annotator_id", flat=True))
    if access.personal_only:
        actor_ids.add(user.id)
    assignments = project.assignments.select_related("document", "assignee").order_by("id")
    if access.personal_only:
        assignments = assignments.filter(assignee=user)
    if isinstance(document_ids, list) and document_ids:
        assignments = assignments.filter(document_id__in=document_ids)
    if isinstance(actor_keys, list) and actor_keys and not access.personal_only:
        assignments = assignments.filter(assignee_id__in=actor_ids)
    actor_ids.update(assignments.values_list("assignee_id", flat=True))
    actors = {
        str(actor_id): {
            "key": f"human:{actor_id}",
            "type": "human",
            "pseudonym": _pseudonym(project.id, actor_id),
        }
        for actor_id in sorted(actor_ids)
    }

    documents_by_id = {}
    assignment_rows = []
    for assignment in assignments:
        document = assignment.document
        documents_by_id[document.id] = {
            "id": document.id,
            "nSentences": document.n_sentences,
            "checksum": document.checksum,
        }
        assignment_rows.append(
            {
                "id": assignment.id,
                "documentId": document.id,
                "actorKey": f"human:{assignment.assignee_id}",
                "status": assignment.status,
            }
        )

    annotation_rows = []
    version_rows = []
    annotation_ids = []
    for annotation in annotations:
        documents_by_id[annotation.document_id] = {
            "id": annotation.document_id,
            "nSentences": annotation.document.n_sentences,
            "checksum": annotation.document.checksum,
        }
        annotation_ids.append(annotation.id)
        annotation_rows.append(_annotation_payload(annotation, f"human:{annotation.annotator_id}"))
        for version in annotation.versions.all():
            clauses = []
            for clause in version.snapshot.get("clauses", []):
                tags = clause.get("themes", [])
                secondary = [tag.get("label") for tag in tags if tag.get("role") == "secondary"]
                clauses.append(
                    {
                        "anchorIndex": clause.get("anchor_index", 0),
                        "primaryTheme": clause.get("theme", ""),
                        "secondaryThemes": [code for code in secondary if code],
                    }
                )
            version_rows.append(
                {
                    "id": version.id,
                    "annotationId": annotation.id,
                    "documentId": annotation.document_id,
                    "actorKey": f"human:{annotation.annotator_id}",
                    "number": version.number,
                    "label": version.label,
                    "createdAt": version.created_at.isoformat(),
                    "clauses": clauses,
                }
            )

    visible_document_ids = sorted(documents_by_id)
    llm_rows = []
    preannotation_ids = []
    preannotations = (
        PreAnnotation.objects.filter(project=project, document_id__in=visible_document_ids)
        .prefetch_related("preclauses")
        .order_by("id")
    )
    for preannotation in preannotations:
        preannotation_ids.append(preannotation.id)
        llm_rows.append(
            {
                "id": preannotation.id,
                "documentId": preannotation.document_id,
                "actorKey": f"llm:{preannotation.judge}:{preannotation.schema_version}",
                "judge": preannotation.judge,
                "version": preannotation.schema_version,
                "clauses": [
                    {
                        "anchorIndex": clause.anchor_index,
                        "primaryTheme": clause.theme_code,
                    }
                    for clause in preannotation.preclauses.all()
                ],
            }
        )

    gold_rows = []
    gold_ids = []
    for sentence in (
        GoldSentence.objects.filter(
            resolution__project=project,
            resolution__document_id__in=visible_document_ids,
        )
        .select_related("resolution", "primary_theme")
        .order_by("id")
    ):
        gold_ids.append(sentence.id)
        gold_rows.append(
            {
                "id": sentence.id,
                "documentId": sentence.resolution.document_id,
                "index": sentence.index,
                "decided": sentence.decided,
                "primaryTheme": sentence.primary_theme.code if sentence.primary_theme else "",
                "secondaryThemes": sentence.secondaries,
                "agreementClass": sentence.agreement_class,
                "riskBand": sentence.risk_band,
                "autoLevel": sentence.auto_level,
                "confidence": sentence.confidence,
                "humanDissent": sentence.human_dissent,
                "decidedAt": sentence.decided_at.isoformat() if sentence.decided_at else None,
            }
        )

    captured_at = timezone.now()
    payload = {
        "schemaVersion": SNAPSHOT_SCHEMA_VERSION,
        "capturedAt": captured_at.isoformat(),
        "project": {
            "id": project.id,
            "slug": project.slug,
            "scheme": project.scheme.slug,
        },
        "actors": actors,
        "documents": [documents_by_id[key] for key in visible_document_ids],
        "assignments": assignment_rows,
        "annotations": annotation_rows,
        "annotationVersions": version_rows,
        "llmAnnotations": llm_rows,
        "goldSentences": gold_rows,
    }
    manifest = {
        "schemaVersion": SNAPSHOT_SCHEMA_VERSION,
        "annotationIds": annotation_ids,
        "annotationVersionIds": [row["id"] for row in version_rows],
        "preannotationIds": preannotation_ids,
        "goldSentenceIds": gold_ids,
        "documentIds": visible_document_ids,
        "includesDrafts": include_drafts,
        "visibility": visibility,
    }
    fingerprint_input = {**payload, "capturedAt": None}
    fingerprint = hashlib.sha256(_canonical(fingerprint_input).encode()).hexdigest()
    snapshot = AnalysisSnapshot.objects.create(
        project=project,
        created_by=user,
        label=label.strip()[:200],
        visibility=visibility,
        includes_drafts=include_drafts,
        scope={"personalOnly": access.personal_only, **scope},
        manifest=manifest,
        payload=payload,
        fingerprint=fingerprint,
        document_count=len(visible_document_ids),
        annotation_count=len(annotation_rows),
        draft_count=sum(row["status"] == AnnotationStatus.DRAFT for row in annotation_rows),
    )
    record_event(
        actor=user,
        verb="analysis.snapshot.created",
        target=snapshot,
        payload={
            "project": project.slug,
            "documents": snapshot.document_count,
            "annotations": snapshot.annotation_count,
            "drafts": snapshot.draft_count,
            "visibility": snapshot.visibility,
        },
    )
    return snapshot
