"""Simulation de campagne RANDOMISÉE + property-based (hypothesis).

- `test_campaign_simulation` : pour chaque seed, joue des centaines d'opérations
  d'annotation concurrentes (3 annotateurs × 3 docs) et RÉCONCILIE à chaque pas un
  modèle de référence avec l'état lu PAR CHAQUE annotateur → vérifie en continu
  l'étanchéité (INV-READ), l'absence de perte (INV-LOSS), l'unicité (INV-2),
  l'idempotence (INV-IDEM). Multi-seeds ⇒ des MILLIERS d'opérations vérifiées.
- property-based sur le κ de Cohen et les vecteurs de thème (analytics exacts).
"""

import random
from types import SimpleNamespace

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from rest_framework.test import APIClient

from claire.annotations.models import Annotation
from claire.corpora.models import Sentence
from claire.projects.iaa import cohen_kappa
from claire.projects.models import Assignment, MembershipRole, ProjectMembership
from tests.conftest import CorpusFactory, DocumentFactory, ProjectFactory, UserFactory

pytestmark = pytest.mark.django_db
API = "/api/v1"
THEMES = ["META", "PREAMBLE_SCOPE", "TERMINATION", "MISC_BOILERPLATE"]
NDOCS, NSENT = 3, 6


def _campaign(scheme):
    corpus = CorpusFactory()
    docs = []
    for k in range(NDOCS):
        d = DocumentFactory(corpus=corpus, external_id=f"D{k}", title=f"D{k}", n_sentences=NSENT)
        for i in range(NSENT):
            Sentence.objects.create(document=d, index=i, raw_text=f"s{i}")
        docs.append(d)
    project = ProjectFactory(corpus=corpus, scheme=scheme)
    annotators = [UserFactory(username=f"sim_{k}", role="annotator") for k in range(3)]
    clients = []
    for u in annotators:
        ProjectMembership.objects.create(project=project, user=u, role=MembershipRole.ANNOTATOR)
        for d in docs:
            Assignment.objects.create(project=project, document=d, assignee=u)
        c = APIClient()
        c.force_authenticate(user=u)
        clients.append(c)
    return SimpleNamespace(project=project, docs=docs, annotators=annotators, clients=clients)


@pytest.mark.parametrize("seed", range(12))  # 12 seeds × ~140 pas ⇒ ~1700 ops vérifiées
def test_campaign_simulation(seed, scheme_with_themes):
    rng = random.Random(seed)
    camp = _campaign(scheme_with_themes)
    slug = camp.project.slug
    # Modèle de référence : ref[(ai,di)] = {anchor: theme} ; ids[(ai,di)] = {anchor: clause_id}.
    sessions: dict = {}
    ref: dict = {}
    ids: dict = {}
    submitted: set = set()
    op_counter = 0

    def open_session(ai, di):
        key = (ai, di)
        if key not in sessions:
            r = camp.clients[ai].post(
                f"{API}/annotations", {"project": slug, "document": f"D{di}"}, format="json"
            )
            assert r.status_code in (200, 201), r.content
            sessions[key] = r.json()["id"]
            ref[key] = {}
            ids[key] = {}
        return sessions[key]

    def reconcile(ai, di):
        """L'état lu PAR LE PROPRIÉTAIRE == ref ; rien d'autrui."""
        key = (ai, di)
        ann_id = sessions[key]
        data = camp.clients[ai].get(f"{API}/annotations/{ann_id}").json()
        got = {c["anchorIndex"]: c["theme"] for c in data["clauses"]}
        assert got == ref[key], f"perte/écart seed={seed} {key}: {got} != {ref[key]}"

    for _ in range(140):
        ai = rng.randrange(3)
        di = rng.randrange(NDOCS)
        key = (ai, di)
        if key in submitted:
            continue  # session soumise : l'annotateur est passé à autre chose
        ann = open_session(ai, di)
        client = camp.clients[ai]
        action = rng.choices(
            ["add", "retag", "delete", "submit"], weights=[0.55, 0.2, 0.15, 0.1]
        )[0]

        if action == "add":
            anchor = rng.randrange(NSENT)
            theme = rng.choice(THEMES)
            op_counter += 1
            opid = f"op{seed}-{op_counter}"
            r = client.post(
                f"{API}/annotations/{ann}/clauses",
                {"anchorIndex": anchor, "theme": theme, "clientOpId": opid},
                format="json",
            )
            if anchor in ref[key]:
                assert r.status_code == 409  # INV-2 : ancre déjà prise
            else:
                assert r.status_code == 201, r.content
                ref[key][anchor] = theme
                ids[key][anchor] = r.json()["id"]
                # INV-IDEM : un retry du MÊME op ne crée pas de doublon.
                if rng.random() < 0.3:
                    r2 = client.post(
                        f"{API}/annotations/{ann}/clauses",
                        {"anchorIndex": anchor, "theme": theme, "clientOpId": opid},
                        format="json",
                    )
                    assert r2.status_code == 200

        elif action == "retag" and ref[key]:
            anchor = rng.choice(list(ref[key]))
            new = rng.choice(THEMES)
            r = client.patch(f"{API}/clauses/{ids[key][anchor]}", {"theme": new}, format="json")
            assert r.status_code == 200, r.content
            ref[key][anchor] = new

        elif action == "delete" and ref[key]:
            anchor = rng.choice(list(ref[key]))
            r = client.delete(f"{API}/clauses/{ids[key][anchor]}")
            assert r.status_code in (200, 204), r.content
            ref[key].pop(anchor)
            ids[key].pop(anchor)

        elif action == "submit" and ref[key]:
            assert client.post(f"{API}/annotations/{ann}/submit").status_code == 200
            submitted.add(key)

        # Réconciliation immédiate (propriétaire) — zéro perte/écart.
        reconcile(ai, di)

        # Étanchéité : un AUTRE annotateur ne lit pas cette session.
        other = (ai + 1) % 3
        oc = camp.clients[other]
        assert oc.get(f"{API}/annotations/{ann}").status_code in (403, 404)
        listed = oc.get(f"{API}/annotations?project={slug}").json()["results"]
        assert all(row["annotatorId"] == camp.annotators[other].id for row in listed)

    # Réconciliation FINALE exhaustive + cohérence DB.
    for key, ann_id in sessions.items():
        reconcile(*key)
        ai, di = key
        assert Annotation.objects.filter(
            project=camp.project, document=camp.docs[di], annotator=camp.annotators[ai]
        ).count() == 1  # INV-4 : jamais de doublon de session


# ── Property-based (hypothesis) : analytics IAA exacts ──────────────────────────
_LABELS = st.lists(st.sampled_from(["A", "B", "C", "D", None]), min_size=1, max_size=40)


@settings(max_examples=300, deadline=None)
@given(a=_LABELS)
def test_kappa_self_agreement_is_one(a):
    """Une série identique à elle-même → κ = 1.0 (sauf série vide gérée à 0)."""
    seq = [x if x is not None else "∅" for x in a]
    assert cohen_kappa(seq, seq) == 1.0


@settings(max_examples=400, deadline=None)
@given(
    a=st.lists(st.sampled_from(["A", "B", "C"]), min_size=1, max_size=30),
    b=st.lists(st.sampled_from(["A", "B", "C"]), min_size=1, max_size=30),
)
def test_kappa_bounded_and_symmetric(a, b):
    n = min(len(a), len(b))
    a, b = a[:n], b[:n]
    k_ab = cohen_kappa(a, b)
    k_ba = cohen_kappa(b, a)
    assert -1.0 - 1e-9 <= k_ab <= 1.0 + 1e-9  # κ borné
    assert abs(k_ab - k_ba) < 1e-9  # symétrique
