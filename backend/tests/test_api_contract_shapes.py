"""API output shapes MUST match the frontend CONTRACT exactly (TASK 2/3).

The frontend (frontend/src/types/contract.ts + mocks/fixtures.ts) consumes
camelCase JSON and does NOT transform responses. This suite authenticates via
JWT, calls each key GET endpoint, and asserts the JSON keys/structure match the
TypeScript interfaces — including nested fields (clause.anchorIndex,
document.referenceLabels[].sentenceIndex, etc.). This is the test that
guarantees the visualization renders.

Skipped cleanly if the real corpus is not present.
"""

from pathlib import Path

import pytest
from django.conf import settings
from django.core.management import call_command
from rest_framework.test import APIClient

from claire.annotations.models import Annotation
from claire.corpora.models import Document
from claire.imports.models import PreAnnotation
from claire.projects.models import Project

pytestmark = pytest.mark.django_db

_HAS_DATA = (Path(settings.CLAUDETTE_DIR) / "Sentences").is_dir()
requires_data = pytest.mark.skipif(
    not _HAS_DATA, reason="real CLAUDETTE data not present under settings.CLAUDETTE_DIR"
)


def _assert_keys(obj, expected, *, where, exact=True):
    """Assert dict keys. expected = set of required keys (exact => no extras)."""
    keys = set(obj.keys())
    missing = set(expected) - keys
    assert not missing, f"{where}: missing keys {missing} (got {sorted(keys)})"
    if exact:
        extra = keys - set(expected)
        assert not extra, f"{where}: unexpected keys {extra}"


@pytest.fixture
def fed_db(db):
    """Feed the real data for ONE test (function scope → rolled back automatically).

    Function scope keeps each test fully isolated (no committed data leaking into
    other modules / count-based tests). feed_db --max-docs 1 is fast enough and
    still exercises the real loaders + camelCase serializers end-to-end.
    """
    # --seed-human : ces tests vérifient les shapes d'annotations/versions/
    # comments/reviews, qui n'existent qu'avec le pré-remplissage humain (§7).
    call_command("feed_db", "--max-docs", "1", "--seed-human", verbosity=0)


@pytest.fixture
def admin_token(fed_db):
    """Issue a real JWT access token for the seeded admin.

    Minted via SimpleJWT directly (rather than the rate-limited /auth/login,
    covered by the M9 security suite).
    """
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.tokens import RefreshToken

    admin = get_user_model().objects.get(username="admin")
    return str(RefreshToken.for_user(admin).access_token)


@pytest.fixture
def admin_client(admin_token):
    """A JWT-authenticated client for the seeded admin (broad read access)."""
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    return client


# --------------------------------------------------------------------- me
@requires_data
def test_me_shape(admin_client):
    data = admin_client.get("/api/v1/me").json()
    _assert_keys(
        data,
        {"id", "username", "email", "role", "displayName", "locale", "isEmailVerified"},
        where="User",
    )


# ------------------------------------------------------------------ projects
@requires_data
def test_projects_list_shape(admin_client):
    body = admin_client.get("/api/v1/projects").json()
    _assert_keys(
        body, {"count", "next", "previous", "results"}, where="Paginated"
    )
    proj = body["results"][0]
    _assert_keys(
        proj,
        {"id", "slug", "name", "corpusSlug", "schemeSlug", "guidelines",
         "status", "visibility", "settings", "myRole",
         "locked", "lockedAt", "lockedBy"},
        where="Project",
    )
    assert proj["corpusSlug"] == "claudette-tos"
    assert proj["schemeSlug"] == "claire-themes-v1"


@requires_data
def test_project_detail_and_progress_shape(admin_client):
    proj = admin_client.get("/api/v1/projects/claudette-gold-v1").json()
    assert proj["slug"] == "claudette-gold-v1"

    prog = admin_client.get(
        "/api/v1/projects/claudette-gold-v1/progress"
    ).json()
    _assert_keys(
        prog,
        {"totalDocuments", "annotatedDocuments", "submittedDocuments",
         "approvedDocuments", "myAssigned", "myDone", "iaa", "iaaDetail",
         "concordance"},
        where="ProjectProgress",
    )
    assert isinstance(prog["totalDocuments"], int)
    if prog["iaaDetail"] is not None:
        _assert_keys(
            prog["iaaDetail"],
            {"globalKappa", "annotatorPairs", "boundaryKappa", "alphaMasi", "perTheme"},
            where="IaaDetail",
        )
        if prog["iaaDetail"]["perTheme"]:
            _assert_keys(
                prog["iaaDetail"]["perTheme"][0],
                {"code", "label", "kappa", "support"},
                where="IaaThemeAgreement",
            )


@requires_data
def test_assignments_shape(admin_client):
    body = admin_client.get(
        "/api/v1/projects/claudette-gold-v1/assignments"
    ).json()
    # The frontend consumes this as Paginated<Assignment> ({results}); a bare
    # list crashes the home page (assignments.results.map).
    _assert_keys(
        body, {"count", "next", "previous", "results"}, where="Assignments paginated"
    )
    items = body["results"]
    assert isinstance(items, list)
    if items:
        a = items[0]
        _assert_keys(
            a,
            {"id", "projectSlug", "document", "assigneeId", "status",
             "annotationId", "dueAt"},
            where="Assignment",
        )
        _assert_keys(
            a["document"],
            {"id", "corpusId", "externalId", "title", "language",
             "nSentences", "checksum", "hasTranslation"},
            where="Assignment.document (DocumentSummary)",
        )


# --------------------------------------------------------- preannotation richness
@requires_data
def test_preannotation_is_rich(admin_client):
    """Les pré-annotations v9.2 portent rationale par clause + rationaleGlobal."""
    pre = PreAnnotation.objects.first()
    body = admin_client.get(
        f"/api/v1/preannotations?project=claudette-gold-v1"
        f"&document={pre.document.external_id}"
    ).json()
    item = body["results"][0]
    assert "rationaleGlobal" in item and "estimatedNBlocks" in item
    # Schéma riche → au moins une clause a un rationale non vide.
    assert any(c.get("rationale") for c in item["clauses"]), "aucun rationale (schéma pauvre ?)"


# ------------------------------------------------------------- doc translations
@requires_data
def test_document_translations_shape(admin_client):
    # feed_db sync's a 'claudette_fr' set → at least one doc has FR translations.
    doc = Document.objects.first()
    body = admin_client.get(
        f"/api/v1/documents/{doc.id}/translations?lang=fr"
    ).json()
    _assert_keys(
        body, {"language", "count", "results"}, where="DocumentTranslations"
    )
    assert body["language"] == "fr"
    if body["results"]:
        _assert_keys(
            body["results"][0], {"sentenceIndex", "text"}, where="Translation row"
        )
        assert isinstance(body["results"][0]["sentenceIndex"], int)
    # Unknown language → empty, not an error.
    empty = admin_client.get(
        f"/api/v1/documents/{doc.id}/translations?lang=zz"
    ).json()
    assert empty["results"] == []


# ------------------------------------------------------------------ documents
@requires_data
def test_document_detail_shape(admin_client):
    doc = Document.objects.first()
    data = admin_client.get(f"/api/v1/documents/{doc.id}").json()
    _assert_keys(
        data,
        {"id", "corpusId", "externalId", "title", "language", "nSentences",
         "checksum", "sentences", "referenceLabels", "sourceMeta"},
        where="DocumentDetail",
    )
    assert isinstance(data["sentences"], list) and data["sentences"]
    _assert_keys(
        data["sentences"][0],
        {"id", "documentId", "index", "rawText", "cleanText", "charStart",
         "charEnd"},
        where="Sentence",
    )
    # referenceLabels live at the document level, each with sentenceIndex.
    if data["referenceLabels"]:
        _assert_keys(
            data["referenceLabels"][0],
            {"id", "sentenceId", "sentenceIndex", "category", "level", "source"},
            where="ReferenceLabel",
        )
        assert isinstance(data["referenceLabels"][0]["sentenceIndex"], int)


@requires_data
def test_document_sentences_shape(admin_client):
    doc = Document.objects.first()
    body = admin_client.get(f"/api/v1/documents/{doc.id}/sentences").json()
    results = body["results"] if isinstance(body, dict) else body
    _assert_keys(
        results[0],
        {"id", "documentId", "index", "rawText", "cleanText", "charStart",
         "charEnd"},
        where="Sentence (list)",
    )


# ------------------------------------------------------------------ schemes
@requires_data
def test_scheme_detail_shape(admin_client):
    s = admin_client.get("/api/v1/schemes/claire-themes-v1").json()
    _assert_keys(
        s,
        {"id", "slug", "name", "version", "isActive", "definition",
         "themes", "legalNatures"},
        where="LabelScheme",
        exact=False,  # definition is an extra allowed by backend
    )
    _assert_keys(
        s["themes"][0],
        {"id", "schemeId", "code", "label", "color", "definition",
         "examples", "order"},
        where="Theme",
    )
    if s["legalNatures"]:
        _assert_keys(
            s["legalNatures"][0],
            {"id", "schemeId", "code", "label", "definition", "order"},
            where="LegalNature",
        )


# ------------------------------------------------------------------ annotations
@requires_data
def test_annotations_list_and_detail_shape(admin_client):
    project = Project.objects.get(slug="claudette-gold-v1")
    body = admin_client.get(
        f"/api/v1/annotations?project={project.slug}"
    ).json()
    _assert_keys(
        body, {"count", "next", "previous", "results"}, where="Paginated"
    )
    row = body["results"][0]
    # List rows carry the core annotation fields (+ nClauses helper).
    for k in ("id", "projectSlug", "documentId", "annotatorId", "status",
              "globalCertainty", "source", "createdAt", "updatedAt"):
        assert k in row, f"Annotation list missing {k}: {sorted(row)}"
    assert row["projectSlug"] == "claudette-gold-v1"

    detail = admin_client.get(f"/api/v1/annotations/{row['id']}").json()
    assert "clauses" in detail and detail["clauses"]
    clause = detail["clauses"][0]
    _assert_keys(
        clause,
        {"id", "annotationId", "anchorIndex", "theme", "themes", "boundary",
         "triageLevel", "legalNature", "evidenceSpan", "rationale", "certainty",
         "order", "validated"},
        where="Clause",
    )
    assert isinstance(clause["anchorIndex"], int)
    assert isinstance(clause["theme"], str)
    assert "evidenceSpan" in clause
    # Multi-label additif : themes[] non vide avec exactement un primaire ; boundary typé.
    assert isinstance(clause["themes"], list) and clause["themes"]
    assert sum(1 for t in clause["themes"] if t["role"] == "primary") == 1
    assert clause["boundary"]["type"] in ("hard", "soft")


@requires_data
def test_versions_comments_reviews_shape(admin_client):
    ann = Annotation.objects.filter(versions__isnull=False).first()
    aid = ann.id

    versions = admin_client.get(f"/api/v1/annotations/{aid}/versions").json()["results"]
    assert versions
    _assert_keys(
        versions[0],
        {"id", "annotationId", "number", "label", "authorId", "createdAt",
         "snapshot"},
        where="AnnotationVersion",
    )
    # Snapshot is the pivot document (snake_case INSIDE the JSON value).
    snap = versions[0]["snapshot"]
    assert "clauses" in snap and "doc" in snap

    comments = admin_client.get(f"/api/v1/annotations/{aid}/comments").json()["results"]
    if comments:
        _assert_keys(
            comments[0],
            {"id", "annotationId", "clauseId", "sentenceIndex", "authorId",
             "body", "threadRoot", "resolved", "createdAt", "scope"},
            where="Comment",
        )

    reviews = admin_client.get(f"/api/v1/annotations/{aid}/reviews").json()["results"]
    if reviews:
        _assert_keys(
            reviews[0],
            {"id", "annotationId", "reviewerId", "score", "decision",
             "rubric", "body", "createdAt"},
            where="Review",
        )


# ------------------------------------------------------------------ preannotations
@requires_data
def test_preannotations_shape(admin_client):
    pre = PreAnnotation.objects.first()
    body = admin_client.get(
        f"/api/v1/preannotations?project=claudette-gold-v1"
        f"&document={pre.document.external_id}"
    ).json()
    results = body["results"] if isinstance(body, dict) else body
    item = results[0]
    _assert_keys(
        item,
        {"id", "projectSlug", "documentId", "judge", "schemaVersion",
         "mapped", "importedAt", "clauses",
         "rationaleGlobal", "estimatedNBlocks"},
        where="PreAnnotation",
    )
    if item["clauses"]:
        _assert_keys(
            item["clauses"][0],
            {"anchorIndex", "themeCode", "evidenceSpan", "rationale", "legalNature"},
            where="PreClause",
        )


# ------------------------------------------------------------------ activity
@requires_data
def test_activity_shape(admin_client):
    body = admin_client.get("/api/v1/activity").json()
    results = body["results"] if isinstance(body, dict) else body
    if results:
        _assert_keys(
            results[0],
            {"id", "actorId", "actorName", "verb", "targetType", "targetId",
             "payload", "createdAt"},
            where="ActivityEvent",
        )


# ------------------------------------------------------------------ translations
@requires_data
def test_translations_shape(admin_client):
    body = admin_client.get("/api/v1/translations/sets").json()
    results = body["results"] if isinstance(body, dict) else body
    if results:
        _assert_keys(
            results[0],
            {"id", "corpusSlug", "name", "targetLanguage", "folderPath",
             "mappingStrategy", "status", "mappedDocuments", "createdAt"},
            where="TranslationSet",
        )

    proj_ts = admin_client.get(
        "/api/v1/projects/claudette-gold-v1/translations"
    ).json()
    # Paginated envelope (frontend consumes .results).
    _assert_keys(
        proj_ts, {"count", "next", "previous", "results"}, where="Project translations paginated"
    )
    assert isinstance(proj_ts["results"], list)
