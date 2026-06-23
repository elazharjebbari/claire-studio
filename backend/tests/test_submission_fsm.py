"""Machine à états de soumission EXHAUSTIVE + audit & versioning (INV-5).

Garantie « campagne-ready » côté FSM : une annotation réelle ne peut JAMAIS
transiter vers un état illégal, et CHAQUE transition légale laisse une trace
auditable (ActivityEvent) ainsi que, le cas échéant, un snapshot immuable
(AnnotationVersion). Aucune perte de donnée : on vérifie le statut en base, le
nombre exact de versions, les labels `auto:<status>` et la cohérence du
`snapshot['status']`.

Complémentaire de test_submission_persistence.py (fidélité des champs / snapshot)
et test_versioning.py (format pivot & diff) : ici on couvre la TOPOLOGIE complète
de la machine — chemins légaux, transitions interdites (409), no-op, et la règle
exacte de snapshotting (submitted/approved/rejected oui ; in_review/draft non).

On traverse la FSM par DEUX chemins :
  - via l'API (POST /submit, PATCH /annotations) pour les transitions accessibles
    au propriétaire (alice) ;
  - via le service `transition_status(...)` directement (acteur admin_user) pour
    les transitions de revue (in_review/approved/rejected), qui ne sont pas
    pilotables par l'annotateur seul.
"""

import pytest

from claire.annotations.models import (
    AnnotationStatus,
    AnnotationVersion,
)
from claire.annotations.services import ALLOWED_TRANSITIONS, transition_status
from claire.audit.models import ActivityEvent
from claire.common.exceptions import Conflict

pytestmark = pytest.mark.django_db

API = "/api/v1"


# --------------------------------------------------------------------- helpers
def _versions(annotation):
    return AnnotationVersion.objects.filter(annotation=annotation).order_by("number")


def _n_versions(annotation):
    return AnnotationVersion.objects.filter(annotation=annotation).count()


def _events(annotation, verb):
    return ActivityEvent.objects.filter(
        verb=verb,
        target_type="annotations.annotation",
        target_id=str(annotation.pk),
    )


def _set_status(annotation, status):
    """Force directement un statut en base (bypass FSM) pour POSER un état de départ.

    N'émet AUCUN événement / version : sert uniquement à construire le point de
    départ d'un test de transition illégale ou de no-op, sans polluer l'audit.
    """
    annotation.status = status
    annotation.save(update_fields=["status", "updated_at"])
    annotation.refresh_from_db()


def _seed_clause(client, annotation, anchor=0, theme="META"):
    """Pose UNE clause (la soumission exige ≥1 clause — garde-fou serveur anti-vide).

    Les transitions de statut ne dépendent pas du contenu, mais l'API /submit refuse
    désormais une annotation vide (409). On amorce donc une clause pour tester le FSM.
    """
    r = client.post(
        f"{API}/annotations/{annotation.id}/clauses",
        {"anchorIndex": anchor, "theme": theme, "validated": True},
        format="json",
    )
    assert r.status_code == 201, r.content


# ─── 1. Chemin nominal complet : draft → submitted → in_review → approved ───────
def test_full_happy_path_draft_submitted_in_review_approved(
    auth, annotation, annotator, admin_user
):
    assert annotation.status == AnnotationStatus.DRAFT
    c = auth(annotator)
    _seed_clause(c, annotation)  # ≥1 clause pour pouvoir soumettre

    # draft → submitted (via l'API /submit, propriétaire).
    r = c.post(f"{API}/annotations/{annotation.id}/submit")
    assert r.status_code == 200, r.content
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.SUBMITTED
    assert _events(annotation, "annotation.submitted").count() == 1

    # submitted → in_review (transition de revue → service, acteur admin).
    transition_status(annotation, AnnotationStatus.IN_REVIEW, admin_user)
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.IN_REVIEW
    assert _events(annotation, "annotation.in_review").count() == 1

    # in_review → approved.
    transition_status(annotation, AnnotationStatus.APPROVED, admin_user)
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.APPROVED
    assert _events(annotation, "annotation.approved").count() == 1

    # Audit : un événement par transition, payload from/to cohérent.
    sub = _events(annotation, "annotation.submitted").get()
    assert sub.payload == {"from": "draft", "to": "submitted"}
    rev = _events(annotation, "annotation.in_review").get()
    assert rev.payload == {"from": "submitted", "to": "in_review"}
    app = _events(annotation, "annotation.approved").get()
    assert app.payload == {"from": "in_review", "to": "approved"}


# ─── 2. Réouverture : submitted → draft puis re-submit (légal) ──────────────────
def test_reopen_submitted_to_draft_then_resubmit(auth, annotation, annotator):
    c = auth(annotator)
    _seed_clause(c, annotation)  # ≥1 clause pour pouvoir soumettre

    # draft → submitted.
    assert c.post(f"{API}/annotations/{annotation.id}/submit").status_code == 200
    annotation.refresh_from_db()
    n_after_submit = _n_versions(annotation)
    assert n_after_submit == 1  # snapshot de soumission

    # submitted → draft (réouverture, via PATCH propriétaire). PAS de snapshot.
    r = c.patch(
        f"{API}/annotations/{annotation.id}", {"status": "draft"}, format="json"
    )
    assert r.status_code == 200, r.content
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.DRAFT
    assert _events(annotation, "annotation.draft").count() == 1
    assert _n_versions(annotation) == n_after_submit  # draft ne snapshot pas

    # re-submit (draft → submitted de nouveau) : légal, nouvelle version.
    assert c.post(f"{API}/annotations/{annotation.id}/submit").status_code == 200
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.SUBMITTED
    assert _events(annotation, "annotation.submitted").count() == 2
    assert _n_versions(annotation) == n_after_submit + 1
    # Numéros de version strictement croissants et contigus.
    assert list(_versions(annotation).values_list("number", flat=True)) == [1, 2]


# ─── 3. Rejet puis réouverture : in_review → rejected → draft ───────────────────
def test_in_review_rejected_then_reopened_to_draft(annotation, admin_user):
    # Amène l'annotation jusqu'à in_review par la FSM (états de départ propres).
    transition_status(annotation, AnnotationStatus.SUBMITTED, admin_user)
    transition_status(annotation, AnnotationStatus.IN_REVIEW, admin_user)
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.IN_REVIEW
    n_before_reject = _n_versions(annotation)  # submitted a snapshoté → 1

    # in_review → rejected (snapshot).
    transition_status(annotation, AnnotationStatus.REJECTED, admin_user)
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.REJECTED
    assert _events(annotation, "annotation.rejected").count() == 1
    assert _n_versions(annotation) == n_before_reject + 1

    # rejected → draft (réouverture, PAS de snapshot).
    n_before_reopen = _n_versions(annotation)
    transition_status(annotation, AnnotationStatus.DRAFT, admin_user)
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.DRAFT
    assert _events(annotation, "annotation.draft").count() == 1
    assert _n_versions(annotation) == n_before_reopen  # draft ne snapshot pas


# ─── 4. Transitions ILLÉGALES via le service → Conflict (409), état intact ──────
@pytest.mark.parametrize(
    "start, target",
    [
        # depuis draft : seuls submitted/archived sont permis.
        (AnnotationStatus.DRAFT, AnnotationStatus.APPROVED),
        (AnnotationStatus.DRAFT, AnnotationStatus.IN_REVIEW),
        (AnnotationStatus.DRAFT, AnnotationStatus.REJECTED),
        # depuis submitted : pas de saut direct vers approved/rejected.
        (AnnotationStatus.SUBMITTED, AnnotationStatus.APPROVED),
        (AnnotationStatus.SUBMITTED, AnnotationStatus.REJECTED),
        # approved est quasi-terminal : seul archived.
        (AnnotationStatus.APPROVED, AnnotationStatus.SUBMITTED),
        (AnnotationStatus.APPROVED, AnnotationStatus.DRAFT),
        (AnnotationStatus.APPROVED, AnnotationStatus.IN_REVIEW),
        (AnnotationStatus.APPROVED, AnnotationStatus.REJECTED),
        # in_review : pas de retour direct vers submitted.
        (AnnotationStatus.IN_REVIEW, AnnotationStatus.SUBMITTED),
        # rejected : pas de saut vers approved/in_review/submitted.
        (AnnotationStatus.REJECTED, AnnotationStatus.APPROVED),
        (AnnotationStatus.REJECTED, AnnotationStatus.IN_REVIEW),
        (AnnotationStatus.REJECTED, AnnotationStatus.SUBMITTED),
        # archived est PUITS : aucune sortie.
        (AnnotationStatus.ARCHIVED, AnnotationStatus.DRAFT),
        (AnnotationStatus.ARCHIVED, AnnotationStatus.SUBMITTED),
        (AnnotationStatus.ARCHIVED, AnnotationStatus.IN_REVIEW),
        (AnnotationStatus.ARCHIVED, AnnotationStatus.APPROVED),
        (AnnotationStatus.ARCHIVED, AnnotationStatus.REJECTED),
    ],
)
def test_illegal_transition_raises_conflict_and_leaves_state(
    annotation, admin_user, start, target
):
    _set_status(annotation, start)
    events_before = ActivityEvent.objects.count()
    versions_before = _n_versions(annotation)

    with pytest.raises(Conflict):
        transition_status(annotation, target, admin_user)

    # Effet de bord NUL : statut, audit et versions inchangés.
    annotation.refresh_from_db()
    assert annotation.status == start
    assert ActivityEvent.objects.count() == events_before
    assert _n_versions(annotation) == versions_before


# ─── 5. Les illégales sont COHÉRENTES avec la table ALLOWED_TRANSITIONS ─────────
def test_illegal_set_is_exactly_the_complement_of_allowed(annotation, admin_user):
    """Property : pour chaque état, toute cible HORS ALLOWED (et ≠ état courant)
    lève Conflict ; toute cible DANS ALLOWED ne lève pas. Pare-feu anti-régression
    si la table d'autorisation change."""
    all_states = set(AnnotationStatus.values)
    for start in all_states:
        allowed = ALLOWED_TRANSITIONS.get(start, set())
        illegal = all_states - allowed - {start}
        for target in illegal:
            _set_status(annotation, start)
            with pytest.raises(Conflict):
                transition_status(annotation, target, admin_user)
        # Vérifie l'autre face : chaque transition autorisée passe sans erreur.
        for target in allowed:
            _set_status(annotation, start)
            transition_status(annotation, target, admin_user)
            annotation.refresh_from_db()
            assert annotation.status == target


# ─── 5bis. Pare-feu anti-régression RÉEL : la table figée par un ORACLE LITTÉRAL ─
# La property ci-dessus re-dérive son oracle depuis ALLOWED_TRANSITIONS → elle ne
# peut PAS détecter une corruption de la table (tautologie). Ce littéral écrit à la
# main est un oracle INDÉPENDANT : ajouter draft→approved OU retirer in_review→draft
# fait échouer ce test (régression silencieuse autrement).
EXPECTED_TRANSITIONS = {
    "draft": {"submitted", "archived"},
    "submitted": {"in_review", "draft", "archived"},
    "in_review": {"approved", "rejected", "draft"},
    "approved": {"archived"},
    "rejected": {"draft", "archived"},
    "archived": set(),
}


def test_allowed_transitions_table_is_frozen_by_literal_oracle():
    actual = {str(k): {str(v) for v in vs} for k, vs in ALLOWED_TRANSITIONS.items()}
    assert actual == EXPECTED_TRANSITIONS


# ─── 3bis. Réouverture depuis in_review : in_review → draft (LÉGALE, pas de snapshot)
def test_in_review_reopened_to_draft_is_legal(annotation, admin_user):
    """Un relecteur peut renvoyer une annotation en brouillon depuis in_review
    (correction demandée). Arête légale explicitement couverte : sa suppression de
    ALLOWED_TRANSITIONS doit faire échouer un test (gap signalé par la revue)."""
    transition_status(annotation, AnnotationStatus.SUBMITTED, admin_user)
    transition_status(annotation, AnnotationStatus.IN_REVIEW, admin_user)
    annotation.refresh_from_db()
    n_versions = _n_versions(annotation)

    transition_status(annotation, AnnotationStatus.DRAFT, admin_user)
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.DRAFT
    assert _events(annotation, "annotation.draft").count() == 1
    assert _n_versions(annotation) == n_versions  # draft ne snapshot pas


# ─── 6. Transition illégale via l'API PATCH → 409 (pas seulement le service) ────
def test_illegal_transition_via_api_patch_returns_409(auth, annotation, annotator):
    """draft → in_review n'est pas légal : la PATCH propriétaire doit répondre 409
    et NE PAS muter l'état en base (intégrité de la campagne)."""
    c = auth(annotator)
    assert annotation.status == AnnotationStatus.DRAFT
    r = c.patch(
        f"{API}/annotations/{annotation.id}", {"status": "in_review"}, format="json"
    )
    assert r.status_code == 409, r.content
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.DRAFT
    assert _events(annotation, "annotation.in_review").count() == 0


def test_illegal_transition_via_api_submit_from_approved_returns_409(
    auth, annotation, annotator, admin_user
):
    """approved → submitted est interdit : POST /submit sur une annotation approuvée
    répond 409 et laisse l'état approved (terminal hors archivage)."""
    # Amorce une clause (sinon le 409 viendrait de la garde anti-vide, pas de la
    # transition illégale qu'on veut tester).
    _seed_clause(auth(annotator), annotation)
    # Mène à approved par la FSM légale.
    transition_status(annotation, AnnotationStatus.SUBMITTED, admin_user)
    transition_status(annotation, AnnotationStatus.IN_REVIEW, admin_user)
    transition_status(annotation, AnnotationStatus.APPROVED, admin_user)
    annotation.refresh_from_db()
    n_versions = _n_versions(annotation)

    c = auth(annotator)
    r = c.post(f"{API}/annotations/{annotation.id}/submit")
    assert r.status_code == 409, r.content
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.APPROVED
    assert _n_versions(annotation) == n_versions  # aucun nouveau snapshot


# ─── 7. Re-soumission MÊME état (submitted → submitted) = NO-OP ─────────────────
def test_resubmit_same_state_is_noop_no_second_version(auth, annotation, annotator):
    """POST /submit sur une annotation DÉJÀ submitted : new_status == current →
    NO-OP 200, sans 2e version ni 2e événement (sinon doublons d'audit/versions)."""
    c = auth(annotator)
    _seed_clause(c, annotation)  # ≥1 clause pour pouvoir soumettre
    assert c.post(f"{API}/annotations/{annotation.id}/submit").status_code == 200
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.SUBMITTED
    assert _n_versions(annotation) == 1
    assert _events(annotation, "annotation.submitted").count() == 1

    # Re-soumission immédiate : statut inchangé, AUCUNE nouvelle version/événement.
    r = c.post(f"{API}/annotations/{annotation.id}/submit")
    assert r.status_code == 200, r.content
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.SUBMITTED
    assert _n_versions(annotation) == 1  # toujours une seule version
    assert _events(annotation, "annotation.submitted").count() == 1


def test_noop_transition_via_service_emits_nothing(annotation, admin_user):
    """transition_status(x → x) est un NO-OP silencieux : ni événement, ni version,
    quel que soit l'état (même un état snapshottant comme submitted)."""
    _set_status(annotation, AnnotationStatus.SUBMITTED)
    events_before = ActivityEvent.objects.count()
    versions_before = _n_versions(annotation)

    out = transition_status(annotation, AnnotationStatus.SUBMITTED, admin_user)
    assert out.status == AnnotationStatus.SUBMITTED
    assert ActivityEvent.objects.count() == events_before
    assert _n_versions(annotation) == versions_before


# ─── 8. Snapshotting : QUELLES transitions créent une version ───────────────────
def test_snapshotting_transitions_each_create_exactly_one_version(
    annotation, admin_user
):
    """submitted / approved / rejected créent CHACUNE exactement une version ;
    in_review et draft (réouverture) n'en créent AUCUNE. On compte le delta exact
    à chaque pas pour verrouiller SNAPSHOTTING_TRANSITIONS."""
    assert _n_versions(annotation) == 0

    # draft → submitted : +1 (snapshot).
    transition_status(annotation, AnnotationStatus.SUBMITTED, admin_user)
    assert _n_versions(annotation) == 1

    # submitted → in_review : +0 (PAS de snapshot).
    transition_status(annotation, AnnotationStatus.IN_REVIEW, admin_user)
    assert _n_versions(annotation) == 1

    # in_review → rejected : +1.
    transition_status(annotation, AnnotationStatus.REJECTED, admin_user)
    assert _n_versions(annotation) == 2

    # rejected → draft : +0.
    transition_status(annotation, AnnotationStatus.DRAFT, admin_user)
    assert _n_versions(annotation) == 2

    # draft → submitted : +1.
    transition_status(annotation, AnnotationStatus.SUBMITTED, admin_user)
    assert _n_versions(annotation) == 3

    # submitted → in_review → approved : +0 puis +1.
    transition_status(annotation, AnnotationStatus.IN_REVIEW, admin_user)
    assert _n_versions(annotation) == 3
    transition_status(annotation, AnnotationStatus.APPROVED, admin_user)
    assert _n_versions(annotation) == 4

    # Numéros contigus 1..4, append-only.
    assert list(_versions(annotation).values_list("number", flat=True)) == [1, 2, 3, 4]


@pytest.mark.parametrize(
    "non_snapshotting",
    [AnnotationStatus.IN_REVIEW, AnnotationStatus.DRAFT, AnnotationStatus.ARCHIVED],
)
def test_non_snapshotting_transitions_create_no_version(
    annotation, admin_user, non_snapshotting
):
    """in_review / draft / archived ne déclenchent JAMAIS de snapshot (l'événement
    d'audit, lui, est bien émis — la transition reste tracée)."""
    # Construit un état de départ d'où la cible est légale, par la FSM.
    if non_snapshotting == AnnotationStatus.IN_REVIEW:
        transition_status(annotation, AnnotationStatus.SUBMITTED, admin_user)
        # submitted a snapshoté → 1 version ; on mesure le DELTA de la cible.
    elif non_snapshotting == AnnotationStatus.DRAFT:
        transition_status(annotation, AnnotationStatus.SUBMITTED, admin_user)
        # submitted → draft est légal.
    elif non_snapshotting == AnnotationStatus.ARCHIVED:
        pass  # draft → archived est légal directement.

    annotation.refresh_from_db()
    n_before = _n_versions(annotation)
    transition_status(annotation, non_snapshotting, admin_user)
    annotation.refresh_from_db()
    assert annotation.status == non_snapshotting
    assert _n_versions(annotation) == n_before  # aucun snapshot
    # L'audit reste émis même sans snapshot.
    assert _events(annotation, f"annotation.{non_snapshotting}").count() == 1


# ─── 9. Chaque version porte label `auto:<status>` + snapshot['status'] cohérent ─
def test_each_version_has_auto_label_and_consistent_snapshot_status(
    annotation, admin_user
):
    """Pour chaque transition snapshottante, la version créée porte label
    'auto:<status>' ET snapshot['status'] == ce même statut (pas l'état précédent).
    Garantit qu'une version est auto-descriptive et auditable hors-ligne."""
    expected = []

    transition_status(annotation, AnnotationStatus.SUBMITTED, admin_user)
    expected.append(AnnotationStatus.SUBMITTED)
    transition_status(annotation, AnnotationStatus.IN_REVIEW, admin_user)  # no snap
    transition_status(annotation, AnnotationStatus.REJECTED, admin_user)
    expected.append(AnnotationStatus.REJECTED)
    transition_status(annotation, AnnotationStatus.DRAFT, admin_user)  # no snap
    transition_status(annotation, AnnotationStatus.SUBMITTED, admin_user)
    expected.append(AnnotationStatus.SUBMITTED)
    transition_status(annotation, AnnotationStatus.IN_REVIEW, admin_user)  # no snap
    transition_status(annotation, AnnotationStatus.APPROVED, admin_user)
    expected.append(AnnotationStatus.APPROVED)

    versions = list(_versions(annotation))
    assert len(versions) == len(expected)
    for v, status in zip(versions, expected):
        assert v.label == f"auto:{status}", (v.number, v.label)
        assert v.snapshot["status"] == status, (v.number, v.snapshot["status"])
        # Auteur de la version = acteur de la transition (audit).
        assert v.author_id == admin_user.id

    # Chaque snapshot snapshottant émet aussi un événement de versioning.
    assert _events(annotation, "annotation.versioned").count() == len(expected)


# ─── 10. Archivage depuis chaque source légale → puits sans sortie ──────────────
@pytest.mark.parametrize(
    "start", [AnnotationStatus.DRAFT, AnnotationStatus.SUBMITTED,
              AnnotationStatus.APPROVED, AnnotationStatus.REJECTED]
)
def test_archive_is_terminal_sink(annotation, admin_user, start):
    """draft/submitted/approved/rejected → archived est légal ; archived est ensuite
    un puits : toute sortie lève Conflict. (in_review ne peut PAS archiver
    directement — vérifié dans le test des transitions illégales.) Archived ne
    snapshote pas."""
    _set_status(annotation, start)
    n_before = _n_versions(annotation)

    transition_status(annotation, AnnotationStatus.ARCHIVED, admin_user)
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.ARCHIVED
    assert _events(annotation, "annotation.archived").count() == 1
    assert _n_versions(annotation) == n_before  # archived hors SNAPSHOTTING

    # Puits : aucune sortie.
    for target in (AnnotationStatus.DRAFT, AnnotationStatus.SUBMITTED,
                   AnnotationStatus.APPROVED):
        with pytest.raises(Conflict):
            transition_status(annotation, target, admin_user)
        annotation.refresh_from_db()
        assert annotation.status == AnnotationStatus.ARCHIVED


def test_in_review_cannot_archive_directly(annotation, admin_user):
    """Garde-fou explicite : in_review n'a PAS archived dans ses transitions
    autorisées (il faut d'abord approuver/rejeter). Documenté ici pour décision."""
    transition_status(annotation, AnnotationStatus.SUBMITTED, admin_user)
    transition_status(annotation, AnnotationStatus.IN_REVIEW, admin_user)
    annotation.refresh_from_db()
    with pytest.raises(Conflict):
        transition_status(annotation, AnnotationStatus.ARCHIVED, admin_user)
    annotation.refresh_from_db()
    assert annotation.status == AnnotationStatus.IN_REVIEW
