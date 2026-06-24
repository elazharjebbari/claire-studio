"""Orchestration GOLD — construire les votes par phrase, recalculer, décider.

Le calcul est PUR (`claire.projects.gold_scoring.score_sentence`) ; le recompute est
SYNCHRONE (pur CPU, pas d'I/O — cf. dossier 06). On réutilise le modèle EXACT humain
(clause ancrée en *i*, sans forward-fill) et le modèle de bloc LLM (forward-fill,
`concordance._judge_vectors_for_document`). La décision humaine (`decided_by`) n'est
jamais écrasée par un recompute.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from claire.annotations.models import REFUGE_CODES, Annotation, ClauseRole
from claire.common.identity import display_name, user_color
from claire.projects.concordance import _judge_vectors_for_document
from claire.projects.gold_scoring import Vote, score_sentence
from claire.projects.models import MembershipRole
from claire.schemes.models import Theme

from .config import annotation_statuses, build_engine_config
from .models import (
    ArbitrationEvent,
    ArbitrationVerb,
    GoldResolution,
    GoldSentence,
    ResolutionStatus,
)

AUTO_LEVELS = ("auto_1click", "auto")


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
    resolution.pct_resolved = round(decided_count / n, 4) if n else 0.0
    if n > 0 and decided_count >= n:
        resolution.status = ResolutionStatus.RESOLVED
    elif decided_count > 0:
        resolution.status = ResolutionStatus.IN_PROGRESS
    else:
        resolution.status = ResolutionStatus.UNRESOLVED
    resolution.save(update_fields=["pct_resolved", "status", "updated_at"])


def recompute_document(resolution: GoldResolution, *, data: dict | None = None) -> dict:
    """Recalcule toutes les phrases : rafraîchit la proposition, applique l'auto-résolution
    sur les cas peu risqués, PRÉSERVE les décisions humaines. Idempotent : n'écrit que les
    lignes réellement modifiées (un GET sans changement de votes n'émet aucune écriture).
    Atomique. Renvoie un récapitulatif."""
    project, document = resolution.project, resolution.document
    cfg = build_engine_config(project)
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
                if score.auto_level in AUTO_LEVELS and primary_theme is not None:
                    gs.decided = True
                    gs.auto_resolved = True
                    gs.primary_theme = primary_theme
                    gs.secondaries = list(score.secondaries)
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


def resolve_and_payload(project, document) -> dict:
    """Recompute + payload de l'atelier pour un document."""
    resolution = get_or_create_resolution(project, document)
    data = build_document_data(project, document)
    recompute_document(resolution, data=data)
    return document_payload(resolution, data=data)


def document_payload(resolution: GoldResolution, *, data: dict | None = None) -> dict:
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
    return {
        "document": {
            "id": document.id,
            "external_id": document.external_id,
            "title": document.title,
            "n_sentences": document.n_sentences,
        },
        "status": resolution.status,
        "pct_resolved": resolution.pct_resolved,
        "locked": resolution.locked,
        "sentences": rows,
    }


# ── Décision & permissions ───────────────────────────────────────────────────
def is_arbiter(user, project, resolution: GoldResolution | None = None) -> bool:
    """Qui peut arbitrer : admin, lead, reviewer (preset défaut) ou arbitre explicite."""
    if getattr(user, "is_admin_role", False):
        return True
    roles = {MembershipRole.LEAD, MembershipRole.REVIEWER}
    if project.memberships.filter(user=user, role__in=roles).exists():
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


def auto_resolve_document(resolution, actor) -> dict:
    """Force l'auto-résolution (recompute) + trace l'événement."""
    summary = recompute_document(resolution)
    ArbitrationEvent.objects.create(
        resolution=resolution, index=None, actor=actor,
        verb=ArbitrationVerb.AUTO, payload=summary,
    )
    return summary
