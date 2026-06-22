"""Batterie multi-annotation — invariants d'intégrité (cf. dossier-tests-multi-annotation).

Vérifie l'étanchéité des sessions, l'absence de perte/corruption, le versioning, la
FSM, et l'exactitude des analytics, sous des opérations agressives de 3 annotateurs.
"""

from types import SimpleNamespace

import pytest
from rest_framework.test import APIClient

from claire.annotations.models import Annotation, AnnotationStatus, Clause
from claire.corpora.models import Sentence
from claire.projects.models import Assignment, MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, DocumentFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db
API = "/api/v1"
THEMES = ["META", "PREAMBLE_SCOPE", "TERMINATION", "MISC_BOILERPLATE"]


@pytest.fixture
def campaign(db, scheme_with_themes):
    """Campagne : 3 annotateurs membres, 3 documents (6 phrases), tout assigné."""
    corpus = CorpusFactory()
    docs = []
    for k in range(3):
        d = DocumentFactory(corpus=corpus, external_id=f"Doc{k}", title=f"Doc {k}", n_sentences=6)
        for i in range(6):
            Sentence.objects.create(document=d, index=i, raw_text=f"phrase {i} du doc {k}")
        docs.append(d)
    project = ProjectFactory(corpus=corpus, scheme=scheme_with_themes)
    annotators = [UserFactory(username=u, role="annotator") for u in ("ann_a", "ann_b", "ann_c")]
    for u in annotators:
        ProjectMembership.objects.create(project=project, user=u, role=MembershipRole.ANNOTATOR)
        for d in docs:
            Assignment.objects.create(project=project, document=d, assignee=u)
    return SimpleNamespace(project=project, docs=docs, annotators=annotators, scheme=scheme_with_themes)


def _client(user):
    """Client API DISTINCT par utilisateur (sessions étanches) — ne PAS partager un
    seul APIClient entre annotateurs (force_authenticate écraserait l'identité)."""
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _open(client, slug, doc_ext):
    r = client.post(f"{API}/annotations", {"project": slug, "document": doc_ext}, format="json")
    assert r.status_code in (200, 201), r.content
    return r.json()["id"]


def _add(client, ann_id, anchor, theme, op=None):
    body = {"anchorIndex": anchor, "theme": theme}
    if op:
        body["clientOpId"] = op
    return client.post(f"{API}/annotations/{ann_id}/clauses", body, format="json")


def _clauses(client, ann_id):
    return client.get(f"{API}/annotations/{ann_id}").json()["clauses"]


# ── INV-4 / idempotence d'ouverture ─────────────────────────────────────────────
def test_open_session_idempotent(auth, campaign):
    a = campaign.annotators[0]
    c = _client(a)
    id1 = _open(c, campaign.project.slug, "Doc0")
    id2 = _open(c, campaign.project.slug, "Doc0")
    assert id1 == id2
    assert Annotation.objects.filter(
        project=campaign.project, document=campaign.docs[0], annotator=a
    ).count() == 1


# ── INV-OWN : écriture cross-session refusée ────────────────────────────────────
def test_cross_session_write_denied(auth, campaign):
    a, b = campaign.annotators[0], campaign.annotators[1]
    ca = _client(a)
    ann_a = _open(ca, campaign.project.slug, "Doc0")
    cl = _add(ca, ann_a, 0, "META").json()["id"]
    cb = _client(b)
    # B tente d'ajouter une clause à la session de A.
    assert _add(cb, ann_a, 1, "TERMINATION").status_code in (403, 404)
    # B tente d'éditer/supprimer la clause de A.
    assert cb.patch(f"{API}/clauses/{cl}", {"theme": "TERMINATION"}, format="json").status_code in (403, 404)
    assert cb.delete(f"{API}/clauses/{cl}").status_code in (403, 404)
    # B tente de soumettre la session de A.
    assert cb.post(f"{API}/annotations/{ann_a}/submit").status_code in (403, 404)
    # La clause de A est INTACTE.
    assert [c["theme"] for c in _clauses(ca, ann_a)] == ["META"]


# ── INV-READ : étanchéité de lecture ────────────────────────────────────────────
def test_cross_session_read_isolation(auth, campaign):
    a, b = campaign.annotators[0], campaign.annotators[1]
    ca = _client(a)
    ann_a = _open(ca, campaign.project.slug, "Doc0")
    cl = _add(ca, ann_a, 0, "META").json()["id"]
    cb = _client(b)
    # B ne voit PAS la session de A dans la liste filtrée par projet.
    listed = cb.get(f"{API}/annotations?project={campaign.project.slug}").json()["results"]
    assert all(row["id"] != ann_a for row in listed)
    # B ne peut PAS lire la session de A ni sa clause.
    assert cb.get(f"{API}/annotations/{ann_a}").status_code in (403, 404)
    assert cb.get(f"{API}/clauses/{cl}").status_code in (403, 404)


# ── INV-IDEM : retry dupliqué ────────────────────────────────────────────────────
def test_idempotent_clause_retry(auth, campaign):
    c = _client(campaign.annotators[0])
    ann = _open(c, campaign.project.slug, "Doc0")
    r1 = _add(c, ann, 0, "META", op="op-1")
    r2 = _add(c, ann, 0, "META", op="op-1")  # même op → pas de doublon
    assert r1.status_code == 201 and r2.status_code == 200
    assert len(_clauses(c, ann)) == 1


# ── INV-2 : une clause-début par phrase ─────────────────────────────────────────
def test_duplicate_anchor_conflict(auth, campaign):
    c = _client(campaign.annotators[0])
    ann = _open(c, campaign.project.slug, "Doc0")
    assert _add(c, ann, 0, "META").status_code == 201
    assert _add(c, ann, 0, "TERMINATION").status_code == 409  # même ancre


# ── INV-COLLAB : la collaboration ne corrompt pas les clauses ───────────────────
def test_comment_does_not_corrupt_clauses(auth, campaign, reviewer):
    a = campaign.annotators[0]
    ca = _client(a)
    ann = _open(ca, campaign.project.slug, "Doc0")
    _add(ca, ann, 0, "META")
    _add(ca, ann, 2, "TERMINATION")
    before = [(c["anchorIndex"], c["theme"]) for c in _clauses(ca, ann)]
    # Un reviewer commente la session (collaboration) — ne doit RIEN changer aux clauses.
    rc = _client(reviewer)
    assert rc.post(
        f"{API}/annotations/{ann}/comments", {"body": "à revoir", "scope": "document"}, format="json"
    ).status_code == 201
    after = [(c["anchorIndex"], c["theme"]) for c in _clauses(ca, ann)]
    assert before == after  # clauses intactes
    assert Clause.objects.filter(annotation_id=ann).count() == 2


# ── INV-DOC-UNIQUE + sessions matrix ────────────────────────────────────────────
def test_documents_dedup_and_admin_matrix(auth, campaign, admin_user):
    # Chaque annotateur ouvre une session sur Doc0.
    for u in campaign.annotators:
        _add(_client(u), _open(_client(u), campaign.project.slug, "Doc0"), 0, "META")
    body = _client(admin_user).get(f"{API}/projects/{campaign.project.slug}/documents").json()
    assert body["count"] == 3  # 3 docs distincts, jamais l'union des sessions
    row0 = next(r for r in body["results"] if r["document"]["externalId"] == "Doc0")
    assert len(row0["sessions"]) == 3  # matrice admin : 3 annotateurs


# ── INV-VER / INV-FSM : versioning + transitions ────────────────────────────────
def test_submit_creates_version_and_fsm(auth, campaign):
    c = _client(campaign.annotators[0])
    ann = _open(c, campaign.project.slug, "Doc0")
    _add(c, ann, 0, "META")
    assert c.post(f"{API}/annotations/{ann}/submit").status_code == 200
    versions = c.get(f"{API}/annotations/{ann}/versions").json()["results"]
    assert len(versions) >= 1
    obj = Annotation.objects.get(pk=ann)
    assert obj.status == AnnotationStatus.SUBMITTED


# ── INV-IAA + INV-STATS : analytics multi-annotateur ────────────────────────────
def test_iaa_and_stats_multi_annotator(auth, campaign, admin_user):
    s = campaign.project.slug
    # 3 annotateurs annotent Doc0 ; A et B identiques, C diffère → κ calculable.
    plans = {
        campaign.annotators[0]: [(0, "META"), (3, "TERMINATION")],
        campaign.annotators[1]: [(0, "META"), (3, "TERMINATION")],
        campaign.annotators[2]: [(0, "META"), (3, "MISC_BOILERPLATE")],
    }
    for u, clauses in plans.items():
        c = _client(u)
        ann = _open(c, s, "Doc0")
        for anchor, theme in clauses:
            assert _add(c, ann, anchor, theme).status_code == 201
        assert c.post(f"{API}/annotations/{ann}/submit").status_code == 200

    iaa = _client(admin_user).get(f"{API}/projects/{s}/iaa").json()
    # 3 annotateurs soumis sur 1 doc → C(3,2)=3 paires.
    assert len(iaa["pairs"]) == 3
    assert iaa["meanKappa"] is not None and 0.0 <= iaa["meanKappa"] <= 1.0

    prog = _client(admin_user).get(f"{API}/projects/{s}/annotators-progress").json()["results"]
    by = {r["username"]: r for r in prog}
    for u in campaign.annotators:
        assert by[u.username]["submitted"] == 1  # chacun a soumis 1 doc
        assert by[u.username]["assigned"] == 3  # 3 docs assignés

    overall = _client(admin_user).get(f"{API}/projects/{s}/progress").json()
    assert overall["submittedDocuments"] == 1  # 1 doc distinct soumis (Doc0)


# ── INV-LOSS : relecture fidèle de tous les champs ──────────────────────────────
def test_no_data_loss_full_fidelity(auth, campaign):
    c = _client(campaign.annotators[0])
    ann = _open(c, campaign.project.slug, "Doc0")
    add = _add(c, ann, 1, "TERMINATION").json()
    cid = add["id"]
    # Édite tous les champs.
    patched = c.patch(
        f"{API}/clauses/{cid}",
        {"legalNature": "OBLIGATION", "evidenceSpan": "may terminate", "rationale": "clause de résiliation", "certainty": 3, "validated": True},
        format="json",
    )
    assert patched.status_code == 200
    # Relecture indépendante → champs identiques (zéro perte).
    cl = next(x for x in _clauses(c, ann) if x["anchorIndex"] == 1)
    assert cl["theme"] == "TERMINATION"
    assert cl["legalNature"] == "OBLIGATION"
    assert cl["evidenceSpan"] == "may terminate"
    assert cl["rationale"] == "clause de résiliation"
    assert cl["certainty"] == 3
    assert cl["validated"] is True
