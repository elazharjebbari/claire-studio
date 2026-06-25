"""Orchestration GOLD — construire les votes par phrase, recalculer, décider.

Le calcul est PUR (`claire.projects.gold_scoring.score_sentence`) ; le recompute est
SYNCHRONE (pur CPU, pas d'I/O — cf. dossier 06). On réutilise le modèle EXACT humain
(clause ancrée en *i*, sans forward-fill) et le modèle de bloc LLM (forward-fill,
`concordance._judge_vectors_for_document`). La décision humaine (`decided_by`) n'est
jamais écrasée par un recompute.
"""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from claire.annotations.models import REFUGE_CODES, Annotation, ClauseRole
from claire.common.identity import display_name, user_color
from claire.projects.concordance import _judge_vectors_for_document
from claire.projects.gold_scoring import Vote, score_sentence
from claire.projects.models import MembershipRole
from claire.schemes.models import Theme

from .config import (
    annotation_statuses,
    auto_resolve_flags,
    build_engine_config,
    secondary_policy,
)
from .models import (
    ArbitrationEvent,
    ArbitrationVerb,
    GoldResolution,
    GoldSentence,
    ResolutionStatus,
)

AUTO_LEVELS = ("auto_1click", "auto")
LOCK_LEASE_SECONDS = 90  # bail du verrou d'arbitrage ; heartbeat conseillé toutes les 20 s


# ── Complétude des annotations : la résolution n'est possible que lorsque TOUS les
#    annotateurs attendus ont soumis (« on ne résout qu'une fois tout le monde fini ») ──
def document_annotators(project, document) -> set:
    """Annotateurs ATTENDUS pour ce document = membres de rôle ANNOTATEUR ASSIGNÉS
    (Assignment) ; à défaut d'assignation, ceux qui ont RÉELLEMENT une annotation sur ce
    document (et non tous les membres — sinon promouvoir un juge sur un autre document
    bloquerait celui-ci). Les leads ARBITRENT (pas attendus comme annotateurs)."""
    from claire.projects.models import Assignment

    member_ids = set(
        project.memberships.filter(role=MembershipRole.ANNOTATOR).values_list("user_id", flat=True)
    )
    assigned = set(
        Assignment.objects.filter(
            project=project, document=document, assignee_id__in=member_ids
        ).values_list("assignee_id", flat=True)
    )
    if assigned:
        return assigned
    return set(
        Annotation.objects.filter(
            project=project, document=document, annotator_id__in=member_ids
        ).values_list("annotator_id", flat=True)
    )


def resolution_readiness(project, document) -> dict:
    """Combien d'annotateurs attendus ont soumis ; la résolution est-elle possible ?"""
    statuses = annotation_statuses(project)
    expected = document_annotators(project, document)
    submitted = set(
        Annotation.objects.filter(
            project=project, document=document, annotator_id__in=expected, status__in=statuses
        ).values_list("annotator_id", flat=True)
    )
    expected_n = len(expected)
    submitted_n = len(submitted)
    return {
        "expected": expected_n,
        "submitted": submitted_n,
        "missing": expected_n - submitted_n,
        "ready": expected_n > 0 and submitted_n >= expected_n,
    }


def effective_status(resolution, readiness: dict, decided: int) -> str:
    """Statut affiché : resolved (finalisé, prioritaire) sinon awaiting (annotations
    incomplètes) → ready (possible, pas commencé) → in_progress (commencé)."""
    if resolution.finalized_at is not None:
        return "resolved"  # une résolution soumise reste « résolue » (priorité)
    if not readiness["ready"]:
        return "awaiting"
    if decided == 0:
        return "ready"
    return "in_progress"


# ── Construction des votes ───────────────────────────────────────────────────
def _annotation_sentence_map(ann: Annotation) -> dict:
    """index -> (primary_code, tuple(secondaries)) pour une annotation (EXACT)."""
    out: dict[int, tuple] = {}
    for c in ann.clauses.all():
        idx = c.anchor_sentence.index
        tags = list(c.theme_tags.all())
        if tags:
            primary = next(
                (t.theme.code for t in tags if t.role == ClauseRole.PRIMARY), None
            )
            secs = tuple(sorted(t.theme.code for t in tags if t.role == ClauseRole.SECONDARY))
            if primary is None:  # défensif (multi-label invalide) → miroir scalaire
                primary = c.theme.code
        else:  # mono-label legacy
            primary = c.theme.code
            secs = ()
        out[idx] = (primary, secs)
    return out


def build_document_data(project, document) -> dict:
    """Votes par phrase (annotateurs EXACT + LLM forward-fill) + détails d'affichage."""
    n = document.n_sentences or 0
    statuses = annotation_statuses(project)
    anns = list(
        Annotation.objects.filter(
            project=project, document=document, status__in=statuses
        )
        .select_related("annotator")
        .prefetch_related(
            "clauses__anchor_sentence", "clauses__theme_tags__theme", "clauses__theme"
        )
    )
    ann_maps = [(ann.annotator, _annotation_sentence_map(ann)) for ann in anns]
    judge_vecs = _judge_vectors_for_document(project, document, n)  # {judge: [code|None]}
    # Un juge PROMU annotateur (compte du même nom) ne compte plus comme référence LLM
    # (pas de double-comptage) : il vote désormais comme humain.
    annotator_usernames = {u.username for u, _ in ann_maps}
    judge_vecs = {j: v for j, v in judge_vecs.items() if j not in annotator_usernames}

    per_sentence = []
    for i in range(n):
        votes: list[Vote] = []
        human_details = []
        for user, smap in ann_maps:
            primary, secs = smap.get(i, (None, ()))
            votes.append(Vote(voter_id=user.username, primary=primary, secondaries=secs, is_llm=False))
            if primary is not None:
                human_details.append({
                    "voter_id": user.username,
                    "user_id": user.id,
                    "display_name": display_name(user),
                    "color": user_color(user.id),
                    "primary": primary,
                    "secondaries": list(secs),
                })
        llm_details = []
        for judge, vec in judge_vecs.items():
            code = vec[i] if i < len(vec) else None
            votes.append(Vote(voter_id=judge, primary=code, secondaries=(), is_llm=True))
            if code is not None:
                llm_details.append({"judge": judge, "primary": code})
        per_sentence.append({
            "index": i,
            "votes": votes,
            "human_details": human_details,
            "llm_details": llm_details,
        })
    return {"n": n, "per_sentence": per_sentence}


# ── Recompute (synchrone, idempotent ; ne touche jamais une décision humaine) ──
def get_or_create_resolution(project, document) -> GoldResolution:
    res, _ = GoldResolution.objects.get_or_create(project=project, document=document)
    return res


def _refresh_status(resolution: GoldResolution, decided_count: int, n: int) -> None:
    """Met à jour pct + statut STOCKÉ. « resolved » n'est posé QUE par finalize_resolution
    (soumission) : décider toutes les phrases ne suffit pas (sinon divergence avec le statut
    effectif). Une résolution finalisée n'est pas rétrogradée ici."""
    resolution.pct_resolved = round(decided_count / n, 4) if n else 0.0
    if resolution.finalized_at is not None:
        resolution.status = ResolutionStatus.RESOLVED
    elif decided_count > 0:
        resolution.status = ResolutionStatus.IN_PROGRESS
    else:
        resolution.status = ResolutionStatus.UNRESOLVED
    resolution.save(update_fields=["pct_resolved", "status", "updated_at"])


def recompute_document(
    resolution: GoldResolution, *, data: dict | None = None, require_holder=None
) -> dict:
    """Recalcule toutes les phrases : rafraîchit la proposition, applique l'auto-résolution
    sur les cas peu risqués, PRÉSERVE les décisions humaines. Idempotent : n'écrit que les
    lignes réellement modifiées (un GET sans changement de votes n'émet aucune écriture).
    Atomique, sous verrou de ligne. Si `require_holder` est fourni, exige (sous le verrou de
    ligne) que ce soit le détenteur du verrou d'arbitrage actif — sinon Conflict (409)."""
    project, document = resolution.project, resolution.document
    cfg = build_engine_config(project)
    flags = auto_resolve_flags(project)  # accord strict 1-clic / majorité ≥ 2/3 (configurables)
    allow_auto = {"auto_1click": flags["absolute_agreement"], "auto": flags["majority"]}
    promote_secondaries = secondary_policy(project) == "required"
    # Pas d'auto-résolution tant que TOUS les annotateurs n'ont pas soumis (calcul prématuré).
    if not resolution_readiness(project, document)["ready"]:
        allow_auto = {"auto_1click": False, "auto": False}
    data = data or build_document_data(project, document)
    n = data["n"]
    theme_by_code = {t.code: t for t in Theme.objects.filter(scheme=project.scheme)}
    existing = {gs.index: gs for gs in resolution.sentences.all()}
    now = timezone.now()

    # Champs comparés pour ne réécrire QUE les lignes modifiées.
    fields = [
        "agreement_class", "risk_band", "auto_level", "confidence", "human_dissent",
        "proposed_primary", "proposed_secondaries", "human_block", "llm_block", "tally",
        "decided", "auto_resolved", "primary_theme_id", "secondaries",
        "decided_by_id", "decided_at",
    ]
    decided_count = 0
    auto_count = 0
    with transaction.atomic():
        # Verrou de ligne : sérialise contre acquire/heartbeat/steal et tout autre
        # recompute/decide concurrent. Le contrôle d'exclusivité est fait SOUS ce verrou.
        locked_res = GoldResolution.objects.select_for_update().get(pk=resolution.pk)
        if require_holder is not None:
            _assert_holder(locked_res, require_holder)
        for s in data["per_sentence"]:
            i = s["index"]
            score = score_sentence(s["votes"], cfg)
            gs = existing.get(i)
            is_new = gs is None
            if is_new:
                gs = GoldSentence(resolution=resolution, index=i)
            before = {f: getattr(gs, f) for f in fields} if not is_new else None

            gs.agreement_class = score.agreement_class
            gs.risk_band = score.risk_band
            gs.auto_level = score.auto_level
            gs.confidence = score.confidence
            gs.human_dissent = score.human_dissent
            gs.proposed_primary = score.primary or ""
            gs.proposed_secondaries = list(score.secondaries)
            gs.human_block = score.human_block or ""
            gs.llm_block = score.llm_block or ""
            gs.tally = score.tally

            if gs.decided and not gs.auto_resolved and not is_new:
                pass  # décision humaine : sacrée
            else:
                primary_theme = theme_by_code.get(score.primary) if score.primary else None
                auto_ok = score.auto_level in AUTO_LEVELS and allow_auto.get(score.auto_level, True)
                if auto_ok and primary_theme is not None:
                    gs.decided = True
                    gs.auto_resolved = True
                    gs.primary_theme = primary_theme
                    # Secondaires promus d'office UNIQUEMENT si la politique = 'required'.
                    gs.secondaries = list(score.secondaries) if promote_secondaries else []
                    gs.decided_by = None
                    if gs.decided_at is None:
                        gs.decided_at = now
                else:
                    gs.decided = False
                    gs.auto_resolved = False
                    gs.primary_theme = None
                    gs.secondaries = []
                    gs.decided_at = None

            if gs.decided:
                decided_count += 1
                if gs.auto_resolved:
                    auto_count += 1
            if is_new or any(getattr(gs, f) != before[f] for f in fields):
                gs.save()

        # Phrases obsolètes (document rétréci) — SANS jamais effacer une décision humaine.
        (resolution.sentences.filter(index__gte=n)
         .exclude(decided=True, auto_resolved=False)
         .delete())
        _refresh_status(resolution, decided_count, n)
    return {"n": n, "decided": decided_count, "auto_resolved": auto_count}


def resolve_and_payload(project, document, user=None) -> dict:
    """Recompute + payload de l'atelier pour un document."""
    resolution = get_or_create_resolution(project, document)
    data = build_document_data(project, document)
    recompute_document(resolution, data=data)
    return document_payload(resolution, data=data, user=user)


def document_payload(resolution: GoldResolution, *, data: dict | None = None, user=None) -> dict:
    project, document = resolution.project, resolution.document
    data = data or build_document_data(project, document)
    text_by_index = {s.index: (s.clean_text or s.raw_text) for s in document.sentences.all()}
    gs_by_index = {gs.index: gs for gs in resolution.sentences.select_related("primary_theme", "decided_by")}

    rows = []
    for s in data["per_sentence"]:
        i = s["index"]
        gs = gs_by_index.get(i)
        rows.append({
            "index": i,
            "text": text_by_index.get(i, ""),
            "annotators": s["human_details"],
            "llms": s["llm_details"],
            "agreement_class": gs.agreement_class if gs else "empty",
            "risk_band": gs.risk_band if gs else "medium",
            "auto_level": gs.auto_level if gs else "manual",
            "confidence": gs.confidence if gs else 0.0,
            "human_dissent": gs.human_dissent if gs else False,
            "proposed_primary": gs.proposed_primary if gs else "",
            "proposed_secondaries": gs.proposed_secondaries if gs else [],
            "decided": gs.decided if gs else False,
            "auto_resolved": gs.auto_resolved if gs else False,
            "primary": gs.primary_theme.code if (gs and gs.primary_theme) else "",
            "secondaries": gs.secondaries if gs else [],
            "decided_by": gs.decided_by_id if gs else None,
            "decided_by_name": display_name(gs.decided_by) if (gs and gs.decided_by) else "",
            "comment": gs.comment if gs else "",
        })
    readiness = resolution_readiness(project, document)
    decided = sum(1 for r in rows if r["decided"])
    n = document.n_sentences or 0
    status = effective_status(resolution, readiness, decided)
    return {
        "document": {
            "id": document.id,
            "external_id": document.external_id,
            "title": document.title,
            "n_sentences": document.n_sentences,
        },
        "status": status,
        "pct_resolved": resolution.pct_resolved,
        "readiness": readiness,
        "finalized": resolution.finalized_at is not None,
        "can_finalize": readiness["ready"] and n > 0 and decided >= n and resolution.finalized_at is None,
        "lock": lock_state(resolution, user),
        "sentences": rows,
    }


# ── Décision & permissions ───────────────────────────────────────────────────
def is_arbiter(user, project, resolution: GoldResolution | None = None) -> bool:
    """Qui peut arbitrer :
    - admin et lead : TOUJOURS (gestionnaires de campagne) ;
    - si la config définit une liste d'arbitres NOMINATIVE → seuls ces usernames (allow-list,
      c'est ainsi qu'on inclut des annotateurs précis) ;
    - sinon (liste vide) → politique par défaut = reviewers ;
    - plus tout arbitre explicite sur la résolution du document.
    """
    from .config import config_arbiters

    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_admin_role", False):
        return True
    if project.memberships.filter(user=user, role=MembershipRole.LEAD).exists():
        return True

    arbiters = config_arbiters(project)
    if arbiters:
        if user.username in arbiters:
            return True
    elif project.memberships.filter(user=user, role=MembershipRole.REVIEWER).exists():
        return True

    if resolution is not None and resolution.arbiters.filter(pk=user.pk).exists():
        return True
    return False


def decide_sentence(resolution, index, primary_code, secondaries, comment, actor) -> GoldSentence:
    """Écrit une décision gold HUMAINE pour une phrase (override d'une éventuelle auto)."""
    scheme = resolution.project.scheme
    valid_codes = set(Theme.objects.filter(scheme=scheme).values_list("code", flat=True))
    if primary_code not in valid_codes:
        raise ValueError(f"thème inconnu dans le schéma : {primary_code!r}")
    theme = Theme.objects.get(scheme=scheme, code=primary_code)
    secs = sorted({s for s in (secondaries or []) if s and s != primary_code})
    for s in secs:
        if s not in valid_codes:
            raise ValueError(f"thème secondaire inconnu dans le schéma : {s!r}")
        if s in REFUGE_CODES:
            raise ValueError(f"un refuge ({s}) ne peut pas être secondaire.")

    # Contrôle d'exclusivité + écriture SOUS le verrou de ligne et dans la MÊME
    # transaction (pas de fenêtre TOCTOU avec un acquire/steal concurrent).
    with transaction.atomic():
        locked_res = GoldResolution.objects.select_for_update().get(pk=resolution.pk)
        _assert_holder(locked_res, actor)
        gs, _ = GoldSentence.objects.get_or_create(resolution=resolution, index=index)
        was_auto = gs.auto_resolved
        gs.decided = True
        gs.auto_resolved = False
        gs.primary_theme = theme
        gs.secondaries = secs
        gs.decided_by = actor
        gs.decided_at = timezone.now()
        gs.comment = comment or ""
        gs.save()

        ArbitrationEvent.objects.create(
            resolution=resolution, index=index, actor=actor,
            verb=ArbitrationVerb.OVERRIDE if was_auto else ArbitrationVerb.DECIDE,
            payload={"primary": primary_code, "secondaries": secs},
            note=comment or "",
        )
        n = resolution.document.n_sentences or 0
        decided = resolution.sentences.filter(decided=True).count()
        _refresh_status(resolution, decided, n)
    return gs


def assert_resolution_ready(project, document) -> None:
    """Lève Conflict (409) si tous les annotateurs attendus n'ont pas encore soumis."""
    from claire.common.exceptions import Conflict

    r = resolution_readiness(project, document)
    if not r["ready"]:
        raise Conflict(
            f"Résolution indisponible : {r['missing']} annotateur(s) sur {r['expected']} "
            "n'ont pas encore soumis leurs annotations."
        )


def finalize_resolution(resolution, actor) -> GoldResolution:
    """Soumet (finalise) la résolution : exige complétude + toutes les phrases décidées."""
    from claire.common.exceptions import Conflict

    project, document = resolution.project, resolution.document
    assert_resolution_ready(project, document)
    n = document.n_sentences or 0
    decided = resolution.sentences.filter(decided=True).count()
    if n == 0 or decided < n:
        raise Conflict("Toutes les phrases doivent être décidées avant de soumettre la résolution.")
    resolution.finalized_at = timezone.now()
    resolution.status = ResolutionStatus.RESOLVED
    resolution.save(update_fields=["finalized_at", "status", "updated_at"])
    ArbitrationEvent.objects.create(
        resolution=resolution, index=None, actor=actor,
        verb=ArbitrationVerb.FINALIZE, payload={"decided": decided},
    )
    return resolution


def reopen_resolution(resolution, actor) -> GoldResolution:
    """Rouvre une résolution finalisée (corrections)."""
    resolution.finalized_at = None
    resolution.save(update_fields=["finalized_at", "updated_at"])
    ArbitrationEvent.objects.create(
        resolution=resolution, index=None, actor=actor, verb=ArbitrationVerb.REOPEN, payload={},
    )
    return resolution


def auto_resolve_document(resolution, actor) -> dict:
    """Force l'auto-résolution (recompute, exclusivité exigée) + trace l'événement."""
    summary = recompute_document(resolution, require_holder=actor)
    ArbitrationEvent.objects.create(
        resolution=resolution, index=None, actor=actor,
        verb=ArbitrationVerb.AUTO, payload=summary,
    )
    return summary


# ── Verrou d'arbitrage exclusif (bail auto-expirant ; DB = source de vérité) ──
def _lock_active(resolution: GoldResolution, now) -> bool:
    return bool(
        resolution.locked
        and resolution.lock_expires_at is not None
        and resolution.lock_expires_at > now
    )


def lock_state(resolution: GoldResolution, user=None) -> dict:
    """État du verrou tel qu'exposé au front (un verrou expiré est considéré libre)."""
    now = timezone.now()
    active = _lock_active(resolution, now)
    holder = resolution.locked_by if active else None
    return {
        "locked": active,
        "locked_by": holder.username if holder else None,
        "locked_by_name": display_name(holder) if holder else "",
        "locked_by_id": holder.id if holder else None,
        "held_by_me": bool(active and user is not None and resolution.locked_by_id == user.id),
        "expires_at": resolution.lock_expires_at.isoformat() if active else None,
        "lease_seconds": LOCK_LEASE_SECONDS,
    }


def _save_lock(res: GoldResolution) -> None:
    res.save(update_fields=["locked", "locked_by", "locked_at", "lock_expires_at", "updated_at"])


def acquire_lock(resolution, user, lease: int = LOCK_LEASE_SECONDS) -> tuple[bool, GoldResolution]:
    """Prend le verrou si libre, expiré, ou déjà tenu par `user`. Sinon (False, détenteur)."""
    with transaction.atomic():
        res = GoldResolution.objects.select_for_update().get(pk=resolution.pk)
        now = timezone.now()
        if _lock_active(res, now) and res.locked_by_id != user.id:
            return False, res
        res.locked = True
        res.locked_by = user
        res.locked_at = now
        res.lock_expires_at = now + timedelta(seconds=lease)
        _save_lock(res)
        return True, res


def heartbeat_lock(resolution, user, lease: int = LOCK_LEASE_SECONDS) -> tuple[bool, GoldResolution]:
    """Prolonge le bail si l'appelant tient toujours un verrou actif. Sinon (False, …)."""
    with transaction.atomic():
        res = GoldResolution.objects.select_for_update().get(pk=resolution.pk)
        now = timezone.now()
        if not _lock_active(res, now) or res.locked_by_id != user.id:
            return False, res
        res.lock_expires_at = now + timedelta(seconds=lease)
        _save_lock(res)
        return True, res


def release_lock(resolution, user) -> tuple[bool, GoldResolution]:
    """Libère le verrou si l'appelant le tient (ou s'il est déjà libre/expiré). Idempotent."""
    with transaction.atomic():
        res = GoldResolution.objects.select_for_update().get(pk=resolution.pk)
        now = timezone.now()
        if _lock_active(res, now) and res.locked_by_id != user.id:
            return False, res
        res.locked = False
        res.locked_by = None
        res.locked_at = None
        res.lock_expires_at = None
        _save_lock(res)
        return True, res


def steal_lock(resolution, user, lease: int = LOCK_LEASE_SECONDS) -> GoldResolution:
    """Reprise inconditionnelle (lead/admin) — tracée. Le détenteur précédent perd son bail."""
    with transaction.atomic():
        res = GoldResolution.objects.select_for_update().get(pk=resolution.pk)
        prev = res.locked_by
        now = timezone.now()
        res.locked = True
        res.locked_by = user
        res.locked_at = now
        res.lock_expires_at = now + timedelta(seconds=lease)
        _save_lock(res)
        ArbitrationEvent.objects.create(
            resolution=res, index=None, actor=user, verb=ArbitrationVerb.STEAL,
            payload={"from": prev.username if prev else None},
        )
        return res


def _assert_holder(resolution, user) -> None:
    """Lève Conflict (409) si un AUTRE arbitre détient un verrou actif (exclusivité).

    À appeler SOUS `select_for_update` (sur `resolution`) dans la transaction d'écriture,
    sinon le contrôle n'est pas sérialisé vis-à-vis d'un acquire/steal concurrent."""
    from claire.common.exceptions import Conflict

    now = timezone.now()
    if _lock_active(resolution, now) and resolution.locked_by_id != user.id:
        holder = resolution.locked_by
        raise Conflict(
            f"Document en cours d'arbitrage par {display_name(holder) if holder else 'un autre arbitre'}."
        )
