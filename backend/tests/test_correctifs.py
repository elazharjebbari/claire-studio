"""Correctifs C2/C4 — commande d'import des pré-annotations + IAA par phrase."""

import json

import pytest
from django.core.management import call_command

pytestmark = pytest.mark.django_db


# ── C2 — commande import_preannotations (idempotente) ───────────────────────────
def test_import_preannotations_command(tmp_path, project, document_with_sentences):
    from claire.imports.models import PreAnnotation

    raw = {
        "doc": document_with_sentences.external_id,
        "judge": "claude",
        "version": "v9.2",
        "document_plan": {
            "segments": [
                {"start_id": 0, "theme": "META", "rationale": "r", "evidence_span": "e"},
                {"start_id": 2, "theme": "TERMINATION", "rationale": "", "evidence_span": ""},
            ]
        },
    }
    cdir = tmp_path / "claude"
    cdir.mkdir()
    (cdir / f"{document_with_sentences.external_id}_claude.json").write_text(
        json.dumps(raw), encoding="utf-8"
    )

    call_command(
        "import_preannotations", "--project", project.slug, "--dir", str(tmp_path)
    )
    pre = PreAnnotation.objects.filter(
        project=project, document=document_with_sentences, judge="claude"
    )
    assert pre.count() == 1
    assert pre.first().preclauses.count() == 2

    # Idempotent : ré-exécution → pas de doublon.
    call_command(
        "import_preannotations", "--project", project.slug, "--dir", str(tmp_path)
    )
    assert (
        PreAnnotation.objects.filter(project=project, judge="claude").count() == 1
    )


def test_import_preannotations_supports_mistral(tmp_path, project, document_with_sentences):
    """Mistral est un juge de 1er rang : la commande l'importe comme claude/codex."""
    from claire.imports.models import PreAnnotation

    raw = {
        "doc": document_with_sentences.external_id,
        "judge": "mistral",
        "version": "v9.2",
        "document_plan": {
            "segments": [{"start_id": 0, "theme": "META", "rationale": "", "evidence_span": ""}]
        },
    }
    mdir = tmp_path / "mistral"
    mdir.mkdir()
    (mdir / f"{document_with_sentences.external_id}_mistral.json").write_text(
        json.dumps(raw), encoding="utf-8"
    )
    call_command(
        "import_preannotations",
        "--project", project.slug, "--dir", str(tmp_path), "--judges", "mistral",
    )
    assert PreAnnotation.objects.filter(project=project, judge="mistral").count() == 1


def test_preclause_serializer_normalizes_theme(project, document_with_sentences):
    """Le pré-remplissage lit les PreClause via l'API : les codes LEGACY doivent être
    normalisés vers le schéma (sinon 400 « Theme not in scheme » au pré-remplissage)."""
    from claire.imports.serializers import PreAnnotationSerializer
    from claire.imports.services import ingest_preannotation

    raw = {
        "doc": document_with_sentences.external_id,
        "judge": "claude",
        "version": "v9.2",
        "document_plan": {
            "segments": [
                {"start_id": 0, "theme": "THIRD_PARTY", "rationale": "", "evidence_span": ""},
                {"start_id": 1, "theme": "LIABILITY_LIMITATION", "rationale": "", "evidence_span": ""},
            ]
        },
    }
    pre = ingest_preannotation(
        project=project, document=document_with_sentences, judge="claude", raw=raw
    )
    codes = [c["theme_code"] for c in PreAnnotationSerializer(pre).data["clauses"]]
    assert "THIRD_PARTY_SERVICES" in codes  # THIRD_PARTY → canonique
    assert "LIMITATION_LIABILITY" in codes  # LIABILITY_LIMITATION → canonique
    assert "THIRD_PARTY" not in codes and "LIABILITY_LIMITATION" not in codes


# ── C4 — IAA par phrase (pas de forward-fill) ───────────────────────────────────
def test_theme_vector_is_per_sentence(
    project, document_with_sentences, scheme_with_themes, annotator
):
    """Une clause en phrase 0 n'étiquette QUE la phrase 0 ; le reste = None."""
    from claire.annotations.models import Annotation
    from claire.projects.iaa import _theme_vector

    document_with_sentences.n_sentences = 5
    document_with_sentences.save()
    ann = Annotation.objects.create(
        project=project, document=document_with_sentences, annotator=annotator
    )
    s0 = document_with_sentences.sentences.get(index=0)
    from claire.annotations.models import Clause

    Clause.objects.create(
        annotation=ann, anchor_sentence=s0, theme=scheme_with_themes.themes_map["META"]
    )
    vec = _theme_vector(ann, 5)
    assert vec == ["META", None, None, None, None]


def test_iaa_per_sentence_penalises_gap_disagreement(
    project, document_with_sentences, scheme_with_themes
):
    """Deux annotateurs d'accord en phrase 0 mais l'un étiquette une phrase de plus :
    l'IAA par phrase n'est plus parfaite (le forward-fill l'aurait masqué)."""
    from claire.annotations.models import Annotation, AnnotationStatus, Clause
    from claire.projects.iaa import project_iaa
    from tests.conftest import UserFactory

    document_with_sentences.n_sentences = 5
    document_with_sentences.save()
    meta = scheme_with_themes.themes_map["META"]
    term = scheme_with_themes.themes_map["TERMINATION"]
    s = {i: document_with_sentences.sentences.get(index=i) for i in range(5)}
    u1, u2 = UserFactory(), UserFactory()

    a1 = Annotation.objects.create(
        project=project, document=document_with_sentences, annotator=u1,
        status=AnnotationStatus.SUBMITTED,
    )
    a2 = Annotation.objects.create(
        project=project, document=document_with_sentences, annotator=u2,
        status=AnnotationStatus.SUBMITTED,
    )
    # a1 : META@0, TERM@2 → [META, None, TERM, None, None]
    Clause.objects.create(annotation=a1, anchor_sentence=s[0], theme=meta)
    Clause.objects.create(annotation=a1, anchor_sentence=s[2], theme=term)
    # a2 : META@0 seulement → [META, None, None, None, None]
    Clause.objects.create(annotation=a2, anchor_sentence=s[0], theme=meta)

    result = project_iaa(project)
    # Désaccord réel en phrase 2 (TERM vs None) → κ < 1 (et non masqué par fill).
    assert result["mean_kappa"] is not None
    assert result["mean_kappa"] < 1.0
