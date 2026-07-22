"""M9 hardening tests (security.md §8, threat_model.md §5).

Covers: login rate limiting, project AuthZ isolation, JWT refresh rotation +
blacklist, PII log scrubbing, translation path-safety, security headers, and an
N+1 guard on the annotations list endpoint.
"""

import logging

import pytest
from django.core.cache import cache

from claire.projects.models import ProjectMembership

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _clear_throttle_cache():
    # DRF throttles use the cache; isolate the budget between tests.
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user_with_password(db):
    from tests.conftest import UserFactory

    user = UserFactory(username="bob", role="annotator")
    user.set_password("Sup3r-Str0ng-Pass!")
    user.save()
    return user


# --------------------------------------------------------------- 1. throttling
def test_ratelimit_login(api_client, user_with_password, monkeypatch):
    """After N login attempts the dedicated scope returns 429 + Retry-After."""
    # Quota login déterministe (indépendant du défaut settings : dev = 60/min).
    # `THROTTLE_RATES` est un attribut de CLASSE lié à l'import → on le patche
    # directement (ce que lit `get_rate`), garant d'un 5/min effectif ici.
    from rest_framework.throttling import SimpleRateThrottle

    monkeypatch.setattr(
        SimpleRateThrottle,
        "THROTTLE_RATES",
        {**SimpleRateThrottle.THROTTLE_RATES, "login": "5/min"},
    )
    cache.clear()
    payload = {"username": "bob", "password": "wrong"}
    statuses = []
    for _ in range(7):  # rate is 5/min -> 6th call should trip
        resp = api_client.post("/api/v1/auth/login", payload, format="json")
        statuses.append(resp.status_code)
    assert 429 in statuses, statuses
    # The throttled response carries Retry-After.
    last = api_client.post("/api/v1/auth/login", payload, format="json")
    assert last.status_code == 429
    assert "Retry-After" in last.headers

    # A valid credential is also throttled once the budget is spent (anti
    # brute-force is IP-scoped, not credential-scoped).
    good = api_client.post(
        "/api/v1/auth/login",
        {"username": "bob", "password": "Sup3r-Str0ng-Pass!"},
        format="json",
    )
    assert good.status_code == 429


# ---------------------------------------------------------- 2. authz isolation
def test_authz_isolation(auth, annotation, scheme_with_themes):
    """An annotator outside the project cannot read/edit its annotations."""
    from tests.conftest import UserFactory

    outsider = UserFactory(username="eve", role="annotator")
    client = auth(outsider)

    # Cross-project read is denied (deny-by-default -> 404, not disclosed).
    detail = client.get(f"/api/v1/annotations/{annotation.id}")
    assert detail.status_code in (403, 404)

    # The list never leaks the foreign annotation.
    listed = client.get("/api/v1/annotations")
    assert listed.status_code == 200
    ids = [row["id"] for row in listed.json()["results"]]
    assert annotation.id not in ids

    # Cross-project write is denied.
    patch = client.patch(
        f"/api/v1/annotations/{annotation.id}",
        {"global_certainty": 1}, format="json",
    )
    assert patch.status_code in (403, 404)

    # Indépendance des sessions (ADR-001, INV-ISO) : MÊME devenu membre du projet,
    # un annotateur ne peut PAS lire le CONTENU de la session d'un PAIR (cela
    # biaiserait son annotation et contaminerait l'IAA). La collaboration passe par
    # les commentaires / la comparaison humain↔LLM, jamais par la lecture du brouillon
    # d'autrui. Seuls admin/reviewer (rôle qualité transverse) supervisent.
    ProjectMembership.objects.create(
        project=annotation.project, user=outsider, role="annotator"
    )
    cache.clear()
    peer_read = auth(outsider).get(f"/api/v1/annotations/{annotation.id}")
    assert peer_read.status_code in (403, 404)

    # En revanche, un ADMIN supervise : il peut LIRE (pas éditer) la session d'autrui.
    from tests.conftest import UserFactory

    supervisor = UserFactory(username="supervisor", role="admin", is_superuser=True)
    cache.clear()
    admin_read = auth(supervisor).get(f"/api/v1/annotations/{annotation.id}")
    assert admin_read.status_code == 200


# ------------------------------------------------------------- 3. jwt rotation
def test_jwt_rotation(api_client, user_with_password):
    """A consumed refresh token is blacklisted and rejected on reuse."""
    login = api_client.post(
        "/api/v1/auth/login",
        {"username": "bob", "password": "Sup3r-Str0ng-Pass!"},
        format="json",
    )
    assert login.status_code == 200, login.content
    refresh = login.json()["refresh"]

    # First use rotates the refresh (new one returned).
    first = api_client.post(
        "/api/v1/auth/refresh", {"refresh": refresh}, format="json"
    )
    assert first.status_code == 200, first.content
    assert "access" in first.json()
    assert first.json().get("refresh") != refresh  # rotated

    # Reusing the consumed refresh is rejected (blacklist, anti-replay).
    replay = api_client.post(
        "/api/v1/auth/refresh", {"refresh": refresh}, format="json"
    )
    assert replay.status_code == 401, replay.content


# --------------------------------------------------------------- 4. pii scrub
def test_logging_pii(caplog):
    """An email/token/password logged comes out masked."""
    from claire.common.logging import PIIScrubber, scrub

    # Pure-function check.
    assert "alice@example.com" not in scrub("user alice@example.com logged in")
    assert "example.com" in scrub("user alice@example.com logged in")
    assert scrub("password=hunter2 done").startswith("password=***")
    assert "hunter2" not in scrub("password=hunter2 done")

    # Filter applied to a real LogRecord (as wired in LOGGING).
    record = logging.LogRecord(
        name="claire.test", level=logging.INFO, pathname=__file__, lineno=1,
        msg="login email=%s token=%s",
        args=("alice@example.com", "abc.def.ghi"), exc_info=None,
    )
    assert PIIScrubber().filter(record) is True
    # After scrubbing the record carries a plain, masked message.
    rendered = record.getMessage()
    assert "alice@example.com" not in rendered
    assert "abc.def.ghi" not in rendered
    assert "***" in rendered


# ----------------------------------------------------------- 5. path-safety
def test_translation_pathsafety(auth, admin_user, tmp_path, settings):
    """Declaring a TranslationSet with a traversal/absolute path is refused."""
    from claire.common.pathsafety import UnsafePathError, safe_join
    from tests.conftest import CorpusFactory

    settings.TRANSLATIONS_ROOT = tmp_path

    # Unit-level: traversal and outside-root absolute paths are rejected.
    with pytest.raises(UnsafePathError):
        safe_join(tmp_path, "../../etc/passwd")
    with pytest.raises(UnsafePathError):
        safe_join(tmp_path, "/etc/passwd")
    # A legitimate subfolder is accepted.
    assert safe_join(tmp_path, "fr").parent == tmp_path.resolve()

    corpus = CorpusFactory()
    client = auth(admin_user)

    # Write payload uses the frontend CONTRACT shape (camelCase): corpus(slug),
    # targetLanguage, folderPath, mappingStrategy.
    bad = client.post(
        "/api/v1/translations/sets",
        {
            "corpus": corpus.slug, "name": "fr", "targetLanguage": "fr",
            "folderPath": "../../../etc", "mappingStrategy": "document",
        },
        format="json",
    )
    assert bad.status_code == 400
    assert "folderPath" in bad.json()

    ok = client.post(
        "/api/v1/translations/sets",
        {
            "corpus": corpus.slug, "name": "fr", "targetLanguage": "fr",
            "folderPath": "fr", "mappingStrategy": "document",
        },
        format="json",
    )
    assert ok.status_code == 201, ok.content


# ------------------------------------------------------------ 6. sec headers
def test_security_headers(auth, annotator):
    resp = auth(annotator).get("/api/v1/me")
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "DENY"
    assert resp.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"


def test_security_headers_hsts_in_prod(settings, monkeypatch):
    """Prod settings enable HSTS and SSL hardening (security.md §7)."""
    # prod.py is the source of truth; assert its hardening knobs are present.
    import importlib

    # La production doit refuser de démarrer sans secret ; le test en fournit un
    # explicitement au lieu de dépendre du shell ou d'un .env local.
    monkeypatch.setenv("DJANGO_SECRET_KEY", "test-only-production-secret-key-32-bytes")
    prod = importlib.import_module("config.settings.prod")
    assert prod.SECURE_HSTS_SECONDS >= 31536000
    assert prod.SESSION_COOKIE_SECURE is True
    assert prod.CSRF_COOKIE_SECURE is True
    assert prod.X_FRAME_OPTIONS == "DENY"


# ----------------------------------------------------------------- 7. N+1
def test_no_nplus1_annotations(
    auth, project, document_with_sentences, scheme_with_themes,
    django_assert_max_num_queries,
):
    """Listing annotations must not scale queries with the number of rows."""
    from claire.annotations.models import Annotation, Clause
    from tests.conftest import UserFactory

    # Create several member-owned annotations, each with a couple of clauses.
    sentences = list(document_with_sentences.sentences.all())
    theme = scheme_with_themes.themes_map["META"]
    for i in range(6):
        u = UserFactory(username=f"ann{i}", role="annotator")
        ProjectMembership.objects.create(project=project, user=u, role="annotator")
        ann = Annotation.objects.create(
            project=project, document=document_with_sentences, annotator=u
        )
        Clause.objects.create(
            annotation=ann, anchor_sentence=sentences[0], theme=theme, order=0
        )

    admin = UserFactory(username="zadmin", role="admin", is_superuser=True)
    client = auth(admin)

    # Bounded query budget independent of row count (select_related + annotate).
    with django_assert_max_num_queries(12):
        resp = client.get(f"/api/v1/annotations?project={project.id}")
    assert resp.status_code == 200
    assert len(resp.json()["results"]) == 6
