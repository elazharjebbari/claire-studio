import logging

from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from django.utils import timezone

from claire.audit.services import record_event
from claire.collaboration.models import Comment, Review, ReviewDecision
from claire.collaboration.serializers import CommentSerializer, ReviewSerializer
from claire.common.exceptions import Conflict, Locked
from claire.common.pagination import results_envelope
from claire.common.permissions import (
    IsAnnotationOwner,
    IsAnnotationOwnerOrReviewer,
    IsReviewerOrAdmin,
)
from claire.imports.models import PreAnnotation
from claire.imports.services import seed_annotation_from_preannotation

from django.db import transaction

from claire.corpora.models import Sentence
from claire.schemes.models import LegalNature, Theme

from .models import (
    Annotation,
    AnnotationStatus,
    BoundaryType,
    Clause,
    ClauseRole,
)
from .serializers import (
    AnnotationDetailSerializer,
    AnnotationListSerializer,
    AnnotationVersionSerializer,
    AnnotationWriteSerializer,
    ClauseSerializer,
)
from .services import (
    create_version,
    diff_versions,
    ensure_primary_tag,
    set_clause_theme_tags,
    transition_status,
)


def _assert_not_locked(annotation) -> None:
    """Refuse toute écriture de contenu sur une annotation VERROUILLÉE (423).

    Deux verrous possibles : NIVEAU PROJET (gel de campagne posé par un admin, override
    prioritaire) ou NIVEAU ANNOTATION (soumission auto / verrou manuel). Tant que l'un
    tient, on ne crée/modifie/supprime aucune clause. Le frontend traduit le 423 en
    avertissement adapté (« Projet verrouillé » vs « Document verrouillé »)."""
    if annotation.project.locked:
        raise Locked(
            "Projet verrouillé par un administrateur : édition gelée pour toute la "
            "campagne."
        )
    if annotation.locked:
        raise Locked("Document verrouillé : déverrouillez-le pour le modifier.")


def _assert_project_not_locked(annotation) -> None:
    """Refuse une soumission tant que le PROJET est verrouillé (campagne gelée)."""
    if annotation.project.locked:
        raise Locked(
            "Projet verrouillé par un administrateur : soumissions gelées pour toute "
            "la campagne."
        )


def _assert_submittable(annotation) -> None:
    """Refuse la soumission d'une annotation VIDE (≥1 clause requise)."""
    if not annotation.clauses.exists():
        raise Conflict(
            "Impossible de soumettre une annotation vide : ajoutez au moins une clause."
        )


def _apply_boundary_and_level(clause, data) -> list[str]:
    """Applique boundary {type, support} et triageLevel depuis une charge (camel/snake).
    Retourne la liste des champs modifiés (pour save(update_fields=...))."""
    changed: list[str] = []
    boundary = data.get("boundary")
    if isinstance(boundary, dict):
        btype = boundary.get("type")
        if btype in (BoundaryType.HARD, BoundaryType.SOFT):
            clause.boundary_type = btype
            changed.append("boundary_type")
        if boundary.get("support") is not None:
            clause.boundary_support = int(boundary["support"])
            changed.append("boundary_support")
    level = data.get("triage_level", data.get("triageLevel"))
    if level is not None:
        clause.triage_level = str(level)[:2]
        changed.append("triage_level")
    return changed


def _apply_scalar_fields(clause, item, scheme) -> list[str]:
    """Applique à une clause les champs scalaires PRÉSENTS dans `item` (camel/snake) :
    legal_nature (code→FK ou null), evidence_span, rationale, certainty. Donne au batch la
    MÊME couverture de champs que add_clause unitaire (parité). Retourne les champs modifiés."""
    changed: list[str] = []
    if "legal_nature" in item or "legalNature" in item:
        code = item.get("legal_nature", item.get("legalNature"))
        if code:
            try:
                clause.legal_nature = scheme.legal_natures.get(code=code)
                changed.append("legal_nature")
            except LegalNature.DoesNotExist:
                pass
        else:
            clause.legal_nature = None
            changed.append("legal_nature")
    es = item.get("evidence_span", item.get("evidenceSpan"))
    if es is not None:
        clause.evidence_span = es
        changed.append("evidence_span")
    if item.get("rationale") is not None:
        clause.rationale = item.get("rationale")
        changed.append("rationale")
    if item.get("certainty") is not None:
        clause.certainty = item.get("certainty")
        changed.append("certainty")
    return changed

logger = logging.getLogger("claire.annotations")


class AnnotationViewSet(viewsets.ModelViewSet):
    queryset = Annotation.objects.select_related(
        "project", "project__scheme", "document", "annotator"
    ).prefetch_related("clauses__theme", "clauses__anchor_sentence")
    permission_classes = [IsAnnotationOwnerOrReviewer]
    filter_backends = [DjangoFilterBackend]
    # project/document/annotator are handled manually in get_queryset so they
    # accept BOTH a numeric PK and the human key the frontend sends (project
    # slug, document external_id, annotator username — see endpoints.ts).
    filterset_fields = {
        "status": ["exact"],
    }

    # Écriture du CONTENU réservée au propriétaire (intégrité IAA, R1) : ni admin
    # ni reviewer n'éditent l'annotation d'autrui. Les autres actions gardent le
    # défaut `IsAnnotationOwnerOrReviewer` (lecture, versions, comments…), et
    # `reviews` conserve son `IsReviewerOrAdmin` déclaré sur le @action.
    _OWNER_ONLY_ACTIONS = {"update", "partial_update", "destroy", "submit", "add_clause"}

    def get_permissions(self):
        if self.action in self._OWNER_ONLY_ACTIONS:
            return [IsAnnotationOwner()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "list":
            return AnnotationListSerializer
        if self.action in {"update", "partial_update"}:
            return AnnotationWriteSerializer
        return AnnotationDetailSerializer

    def get_queryset(self):
        from django.db.models import Count

        qs = super().get_queryset()
        # Avoid N+1 on the list serializer's clause count (perf audit M9):
        # one annotated COUNT instead of one query per row. Keep a stable
        # ordering for pagination (annotate can otherwise drop Meta ordering).
        qs = qs.annotate(n_clauses_agg=Count("clauses", distinct=True)).order_by(
            "-updated_at"
        )
        # Indépendance des sessions (ADR-001, INV-ISO) : un annotateur non privilégié
        # ne voit QUE SES propres sessions — jamais le contenu (clauses, rationale,
        # certitude) des sessions d'autrui, pour ne pas biaiser son annotation ni
        # contaminer l'accord inter-annotateurs (IAA). La supervision (lecture des
        # sessions d'autrui) reste réservée aux admins/owners et reviewers (rôle
        # qualité transverse). La collaboration passe par les commentaires et la
        # comparaison humain↔LLM, jamais par la lecture directe du brouillon d'un pair.
        user = self.request.user
        if not (
            getattr(user, "is_admin_role", False)
            or getattr(user, "role", None) == "reviewer"
        ):
            qs = qs.filter(annotator=user)
        # support ?project=<slug|pk>, ?document=<external_id|pk>,
        # ?annotator=<username|pk> (frontend sends the human keys).
        project = self.request.query_params.get("project")
        if project:
            qs = qs.filter(project__pk=project) if project.isdigit() else (
                qs.filter(project__slug=project)
            )
        document = self.request.query_params.get("document")
        if document:
            qs = qs.filter(document__pk=document) if document.isdigit() else (
                qs.filter(document__external_id=document)
            )
        annotator = self.request.query_params.get("annotator")
        if annotator:
            qs = qs.filter(annotator__pk=annotator) if annotator.isdigit() else (
                qs.filter(annotator__username=annotator)
            )
        return qs

    def create(self, request, *args, **kwargs):
        """POST /annotations — optional seed=preannotation:<judge> (INV-4 idempotent)."""
        from claire.corpora.models import Document
        from claire.projects.models import Project

        data = request.data
        project = get_object_or_404(
            Project, slug=data.get("project") or data.get("project_slug")
        )
        document = get_object_or_404(
            Document, external_id=data.get("document") or data.get("document_id"),
            corpus=project.corpus,
        )

        seed = data.get("seed")  # e.g. "preannotation:claude"
        if seed and seed.startswith("preannotation:"):
            judge = seed.split(":", 1)[1]
            pre = get_object_or_404(
                PreAnnotation, project=project, document=document, judge=judge
            )
            annotation = seed_annotation_from_preannotation(pre, request.user)
            return Response(
                AnnotationDetailSerializer(annotation).data,
                status=status.HTTP_201_CREATED,
            )

        # Plain human annotation; enforce INV-4 idempotency.
        annotation, created = Annotation.objects.get_or_create(
            project=project, document=document, annotator=request.user
        )
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(AnnotationDetailSerializer(annotation).data, status=code)

    def partial_update(self, request, *args, **kwargs):
        annotation = self.get_object()
        ser = AnnotationWriteSerializer(annotation, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        new_status = ser.validated_data.get("status")
        certainty = ser.validated_data.get("global_certainty", "__nochange__")

        if certainty != "__nochange__":
            # Édition de CONTENU gelée si verrouillé (les transitions de statut, elles,
            # restent permises — c'est ainsi qu'on rouvre/déverrouille).
            _assert_not_locked(annotation)
            annotation.global_certainty = certainty
            annotation.save(update_fields=["global_certainty", "updated_at"])
        if new_status and new_status != annotation.status:
            # Campagne gelée (verrou projet) → l'annotateur ne change AUCUN statut
            # (ni soumettre, ni rouvrir). Les transitions de revue passent par d'autres
            # endpoints (réservés admin/reviewer), non affectés.
            _assert_project_not_locked(annotation)
            if new_status == AnnotationStatus.SUBMITTED:
                _assert_submittable(annotation)
            transition_status(annotation, new_status, request.user)
        return Response(AnnotationDetailSerializer(annotation).data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        annotation = self.get_object()
        # Campagne gelée (verrou projet) → soumission refusée.
        _assert_project_not_locked(annotation)
        # Garde anti-soumission VIDE (filet de sécurité serveur ; le front bloque déjà
        # via le gate de validation). Une session sans aucune clause ne fait référence
        # à rien — refuser plutôt que figer un snapshot vide.
        _assert_submittable(annotation)
        transition_status(annotation, AnnotationStatus.SUBMITTED, request.user)
        return Response(AnnotationDetailSerializer(annotation).data)

    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        """Verrouille manuellement (édition gelée). Idempotent. Owner + reviewer/admin."""
        annotation = self.get_object()
        if not annotation.locked:
            annotation.locked = True
            annotation.locked_at = timezone.now()
            annotation.locked_by = request.user
            annotation.save(update_fields=["locked", "locked_at", "locked_by", "updated_at"])
            record_event(
                actor=request.user, verb="annotation.locked", target=annotation,
                payload={"status": annotation.status},
            )
        return Response(AnnotationDetailSerializer(annotation).data)

    @action(detail=True, methods=["post"])
    def unlock(self, request, pk=None):
        """Déverrouille. Un document SOUMIS est ROUVERT en `draft` (on souhaite y revenir
        → une re-soumission recréera une version et re-verrouillera). Un verrou MANUEL
        sur un BROUILLON est simplement levé. Les états terminaux ou de revue
        (in_review / approved / rejected / archived) ne sont PAS déverrouillables ici :
        leur verrou protège le contenu et seule la machine de revue peut les rouvrir —
        sinon on pourrait éditer un gold approuvé/archivé. Idempotent. Owner + reviewer/admin."""
        annotation = self.get_object()
        # Verrou PROJET (override) : déverrouillage de session impossible tant que la
        # campagne est gelée — seul un admin peut lever le verrou projet.
        if annotation.project.locked:
            raise Conflict(
                "Projet verrouillé par un administrateur : déverrouillage de session "
                "impossible tant que la campagne est gelée."
            )
        if annotation.status == AnnotationStatus.SUBMITTED:
            # Réouverture : transition_status(draft) lève le verrou (règle d'état) +
            # journalise annotation.draft. On ajoute un événement unlocked explicite.
            transition_status(annotation, AnnotationStatus.DRAFT, request.user)
            record_event(
                actor=request.user, verb="annotation.unlocked", target=annotation,
                payload={"reopened": True},
            )
        elif annotation.status == AnnotationStatus.DRAFT:
            if annotation.locked:
                annotation.locked = False
                annotation.locked_at = None
                annotation.locked_by = None
                annotation.save(
                    update_fields=["locked", "locked_at", "locked_by", "updated_at"]
                )
                record_event(
                    actor=request.user, verb="annotation.unlocked", target=annotation,
                    payload={"reopened": False},
                )
        else:
            # in_review / approved / rejected / archived : non déverrouillable directement
            # (le verrou est la garde d'intégrité du contenu après revue).
            raise Conflict(
                "Document en revue/approuvé/archivé : non déverrouillable directement "
                "(le contenu reste protégé)."
            )
        return Response(AnnotationDetailSerializer(annotation).data)

    # --- clauses ----------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="clauses")
    def add_clause(self, request, pk=None):
        annotation = self.get_object()
        _assert_not_locked(annotation)
        # Idempotence (chantier C) : un retry portant le même client_op_id retombe
        # sur la clause déjà créée (200) — pas de doublon, pas de conflit faux positif.
        # Coercition str : le client peut renvoyer un client_op_id NUMÉRIQUE (ex. l'id
        # serveur d'une clause restaurée par un undo) — `str(...)` évite le 500
        # (AttributeError: 'int' object has no attribute 'strip') et garde l'idempotence.
        client_op_id = str(request.data.get("client_op_id") or "").strip()
        if client_op_id:
            existing = annotation.clauses.filter(client_op_id=client_op_id).first()
            if existing is not None:
                # Court-circuit d'idempotence borné à l'ANCRE : on ne retourne la clause que
                # si elle est sur la phrase demandée. Sinon (même op_id réutilisé pour une
                # autre ancre — anormal) on n'IGNORE PAS silencieusement la décision : on
                # relâche l'op_id stale et on applique la décision sur l'ancre demandée.
                req_anchor = request.data.get("anchor_index", request.data.get("anchorIndex"))
                if req_anchor is None or existing.anchor_sentence.index == req_anchor:
                    return Response(ClauseSerializer(existing).data, status=status.HTTP_200_OK)
                client_op_id = ""
        ser = ClauseSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        attrs = ser._resolve(annotation, dict(ser.validated_data))
        # `theme` scalaire absent mais `themes` fourni → dériver du primaire (ergonomie).
        themes_in = request.data.get("themes")
        if "theme" not in attrs and isinstance(themes_in, list) and themes_in:
            prim = next((t for t in themes_in if t.get("role") == "primary"), themes_in[0])
            try:
                attrs["theme"] = annotation.project.scheme.themes.get(code=prim.get("label"))
            except Theme.DoesNotExist:
                pass
        if "anchor_sentence" not in attrs or "theme" not in attrs:
            return Response(
                {"detail": "anchorIndex and theme are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        existing = annotation.clauses.filter(
            anchor_sentence=attrs["anchor_sentence"]
        ).first()
        # UPSERT (chantier triage) : accepter une suggestion sur une phrase DÉJÀ annotée
        # (annotation seedée d'un LLM → chaque phrase a déjà une clause) ne doit PAS
        # échouer en 409 ; c'est une MAJ de la clause existante avec la décision retenue.
        # Opt-in via `upsert:true` pour préserver INV-2 en annotation manuelle (sinon 409).
        upsert = bool(request.data.get("upsert"))
        if existing is not None and not upsert:
            raise Conflict("A clause already starts on this sentence (INV-2).")
        with transaction.atomic():
            if existing is not None:
                clause = existing
                for field in (
                    "theme", "legal_nature", "evidence_span",
                    "rationale", "certainty", "validated",
                ):
                    if field in attrs:
                        setattr(clause, field, attrs[field])
                if client_op_id:
                    clause.client_op_id = client_op_id
                clause.save()
            else:
                attrs.setdefault("order", annotation.clauses.count())
                clause = Clause.objects.create(
                    annotation=annotation, client_op_id=client_op_id, **attrs
                )
            changed = _apply_boundary_and_level(clause, request.data)
            if changed:
                clause.save(update_fields=changed)
            # Multi-label : si `themes` fourni, on pose le set ; sinon tag primaire mono.
            themes = request.data.get("themes")
            if isinstance(themes, list) and themes:
                set_clause_theme_tags(clause, themes, annotation.project.scheme)
            else:
                ensure_primary_tag(clause)
        code = status.HTTP_200_OK if existing is not None else status.HTTP_201_CREATED
        return Response(ClauseSerializer(clause).data, status=code)

    @action(detail=True, methods=["post"], url_path="clauses/batch")
    def add_clauses_batch(self, request, pk=None):
        """Acceptation par lot (C1) : crée N clauses en une transaction.

        Idempotent (clientOpId rejoué → clause existante). Les conflits INV-2 (phrase
        déjà annotée) sont rapportés par item SANS abandonner le lot. Corps :
        ``{"clauses": [{anchorIndex, themes|theme, boundary?, triageLevel?, clientOpId?}]}``.
        """
        annotation = self.get_object()
        _assert_not_locked(annotation)
        scheme = annotation.project.scheme
        document = annotation.document
        items = request.data.get("clauses") or []
        # Upsert par lot (cf. add_clause) : si demandé, une phrase déjà annotée est MISE
        # À JOUR au lieu d'être rapportée en conflit — l'acceptation C1 reste idempotente.
        upsert = bool(request.data.get("upsert"))
        created, conflicts = [], []

        def primary_code(item):
            themes = item.get("themes")
            if isinstance(themes, list) and themes:
                prim = next((t for t in themes if t.get("role") == "primary"), themes[0])
                return prim.get("label")
            return item.get("theme")

        with transaction.atomic():
            order0 = annotation.clauses.count()
            # `created_count` n'avance QUE sur une vraie création → ordres contigus (les
            # items upsertés ne consomment pas de slot d'ordre, sinon trous dans `order`).
            created_count = 0
            for idx, item in enumerate(items):
                op = str(item.get("client_op_id") or item.get("clientOpId") or "").strip()
                if op:
                    existing = annotation.clauses.filter(client_op_id=op).first()
                    if existing is not None:
                        created.append(ClauseSerializer(existing).data)
                        continue
                anchor_index = item.get("anchor_index", item.get("anchorIndex"))
                code = primary_code(item)
                if anchor_index is None or not code:
                    conflicts.append({"anchorIndex": anchor_index, "reason": "anchorIndex et theme requis"})
                    continue
                try:
                    sentence = document.sentences.get(index=anchor_index)
                except Sentence.DoesNotExist:
                    conflicts.append({"anchorIndex": anchor_index, "reason": "phrase inexistante"})
                    continue
                try:
                    theme = scheme.themes.get(code=code)
                except Theme.DoesNotExist:
                    conflicts.append({"anchorIndex": anchor_index, "reason": f"thème '{code}' hors scheme"})
                    continue
                # Validation par item AVANT toute écriture (le lot est transactionnel) : une
                # certitude hors plage déclencherait sinon un IntegrityError (CHECK
                # ck_clause_certainty_range) qui avorterait TOUT le lot. On la rapporte comme
                # un conflit d'item et on poursuit — cohérent avec add_clause unitaire (422).
                cert = item.get("certainty")
                if cert is not None and cert not in (0, 1, 2, 3):
                    conflicts.append({"anchorIndex": anchor_index, "reason": "certitude invalide (0–3)"})
                    continue
                existing_at_anchor = annotation.clauses.filter(
                    anchor_sentence=sentence
                ).first()
                if existing_at_anchor is not None and not upsert:
                    conflicts.append({"anchorIndex": anchor_index, "reason": "déjà annotée (INV-2)"})
                    continue
                if existing_at_anchor is not None:
                    clause = existing_at_anchor
                    clause.theme = theme
                    fields = ["theme"]
                    if item.get("validated") is not None:
                        clause.validated = bool(item.get("validated"))
                        fields.append("validated")
                    if op:
                        clause.client_op_id = op
                        fields.append("client_op_id")
                    clause.save(update_fields=fields)
                else:
                    clause = Clause.objects.create(
                        annotation=annotation, anchor_sentence=sentence, theme=theme,
                        order=order0 + created_count, client_op_id=op,
                        validated=bool(item.get("validated") or False),
                    )
                    created_count += 1
                # Parité avec add_clause unitaire : champs scalaires + frontière/niveau.
                sch = _apply_scalar_fields(clause, item, scheme)
                if sch:
                    clause.save(update_fields=sch)
                ch = _apply_boundary_and_level(clause, item)
                if ch:
                    clause.save(update_fields=ch)
                themes = item.get("themes")
                if isinstance(themes, list) and themes:
                    set_clause_theme_tags(clause, themes, scheme)
                else:
                    ensure_primary_tag(clause)
                created.append(ClauseSerializer(clause).data)

        http = status.HTTP_201_CREATED if created else status.HTTP_409_CONFLICT
        return Response({"created": created, "conflicts": conflicts}, status=http)

    # --- versions ---------------------------------------------------------
    @action(detail=True, methods=["get", "post"])
    def versions(self, request, pk=None):
        annotation = self.get_object()
        if request.method == "POST":
            version = create_version(
                annotation, author=request.user,
                label=request.data.get("label", ""),
            )
            return Response(
                AnnotationVersionSerializer(version).data,
                status=status.HTTP_201_CREATED,
            )
        qs = annotation.versions.select_related("author")
        return Response(results_envelope(AnnotationVersionSerializer(qs, many=True).data))

    @action(
        detail=True, methods=["get"],
        url_path=r"versions/(?P<number>\d+)/diff",
    )
    def version_diff(self, request, pk=None, number=None):
        """Diff au format CONTRAT (consommé par DiffView) :
        {from:{number,label}, to:{number,label}, clauses:[{anchorIndex,status,
        before,after,changedFields}], summary:{added,removed,modified,unchanged}}.
        `?against=` choisit la base (0/absent → version précédente ; sinon ce numéro)."""
        annotation = self.get_object()
        n = int(number)
        target = get_object_or_404(annotation.versions, number=n)

        against = request.query_params.get("against")
        if against not in (None, "", "0"):
            base = annotation.versions.filter(number=int(against)).first()
        else:
            base = annotation.versions.filter(number__lt=n).order_by("-number").first()

        # Champs comparés → nom camelCase exposé dans changed_fields.
        fields = {
            "theme": "theme",
            "legal_nature": "legalNature",
            "evidence_span": "evidenceSpan",
            "rationale": "rationale",
            "certainty": "certainty",
        }

        def by_anchor(snap):
            return {c["anchor_index"]: c for c in (snap or {}).get("clauses", [])}

        old = by_anchor(base.snapshot) if base else {}
        new = by_anchor(target.snapshot)
        clauses = []
        added = removed = modified = unchanged = 0
        for k in sorted(set(old) | set(new)):
            o, nw = old.get(k), new.get(k)
            if o is None:
                status_ = "added"; added += 1
            elif nw is None:
                status_ = "removed"; removed += 1
            else:
                changed = [camel for snake, camel in fields.items() if o.get(snake) != nw.get(snake)]
                if changed:
                    status_ = "modified"; modified += 1
                else:
                    status_ = "unchanged"; unchanged += 1
            clauses.append(
                {
                    "anchor_index": k,
                    "status": status_,
                    "before": o,
                    "after": nw,
                    "changed_fields": (
                        [camel for snake, camel in fields.items() if (o or {}).get(snake) != (nw or {}).get(snake)]
                        if (o and nw)
                        else []
                    ),
                }
            )
        return Response(
            {
                "annotation_id": annotation.pk,
                "from": {"number": base.number if base else 0, "label": base.label if base else "∅"},
                "to": {"number": target.number, "label": target.label},
                "clauses": clauses,
                "summary": {
                    "added": added,
                    "removed": removed,
                    "modified": modified,
                    "unchanged": unchanged,
                },
            }
        )

    # --- comments ---------------------------------------------------------
    @action(detail=True, methods=["get", "post"])
    def comments(self, request, pk=None):
        annotation = self.get_object()
        if request.method == "POST":
            ser = CommentSerializer(data=request.data)
            ser.is_valid(raise_exception=True)
            comment = Comment.objects.create(
                annotation=annotation, author=request.user,
                **ser.build_comment_kwargs(annotation),
            )
            return Response(
                CommentSerializer(comment).data, status=status.HTTP_201_CREATED
            )
        qs = annotation.comments.select_related("author")
        return Response(results_envelope(CommentSerializer(qs, many=True).data))

    # --- attribution (point 3) -------------------------------------------
    @action(detail=True, methods=["get"])
    def attribution(self, request, pk=None):
        """GET /annotations/{id}/attribution?by=clause|sentence — dernier auteur par
        cible. Dérivé des clauses (auteur = annotateur de l'annotation), couleur
        d'identité déterministe. Renvoie {by, results:[{index,actorId,...}]}."""
        from claire.common.identity import display_name, user_color

        annotation = self.get_object()
        by = "sentence" if request.query_params.get("by") == "sentence" else "clause"
        actor = annotation.annotator
        results = [
            {
                "index": c.anchor_sentence.index,
                "actor_id": actor.pk if actor else None,
                "actor_name": display_name(actor),
                "actor_color": user_color(actor.pk if actor else 0),
                "verb": "clause.create",
                "at": annotation.updated_at.isoformat(),
            }
            for c in annotation.clauses.select_related("anchor_sentence").all()
        ]
        return Response({"by": by, "results": results})

    # --- présence (points 4b/7) ------------------------------------------
    @action(detail=True, methods=["get"])
    def presence(self, request, pk=None):
        """GET /annotations/{id}/presence — participants actifs. Sans backend WS, on
        renvoie l'utilisateur courant (présence minimale, non temps réel)."""
        from claire.common.identity import display_name, user_color

        self.get_object()
        u = request.user
        results = [
            {
                "user_id": u.pk,
                "name": display_name(u),
                "color": user_color(u.pk),
                "focus_sentence": None,
                "active": True,
            }
        ]
        return Response({"count": len(results), "results": results})

    # --- reviews ----------------------------------------------------------
    @action(
        detail=True, methods=["get", "post"],
        permission_classes=[IsReviewerOrAdmin],
    )
    def reviews(self, request, pk=None):
        annotation = self.get_object()
        if request.method == "POST":
            ser = ReviewSerializer(data=request.data)
            ser.is_valid(raise_exception=True)
            review = Review.objects.create(
                annotation=annotation, reviewer=request.user,
                **ser.validated_data,
            )
            # Drive the state machine from the review decision.
            if annotation.status == AnnotationStatus.SUBMITTED:
                transition_status(
                    annotation, AnnotationStatus.IN_REVIEW, request.user
                )
            if review.decision == ReviewDecision.APPROVE:
                transition_status(
                    annotation, AnnotationStatus.APPROVED, request.user
                )
            elif review.decision == ReviewDecision.REJECT:
                transition_status(
                    annotation, AnnotationStatus.REJECTED, request.user
                )
            return Response(
                ReviewSerializer(review).data, status=status.HTTP_201_CREATED
            )
        qs = annotation.reviews.select_related("reviewer")
        return Response(results_envelope(ReviewSerializer(qs, many=True).data))


class ClauseViewSet(viewsets.ModelViewSet):
    """PATCH /clauses/{id}, DELETE /clauses/{id}."""

    queryset = Clause.objects.select_related(
        "annotation", "annotation__project__scheme", "theme", "anchor_sentence"
    )
    serializer_class = ClauseSerializer
    # Édition d'une clause réservée au propriétaire de l'annotation (R1).
    permission_classes = [IsAnnotationOwner]
    http_method_names = ["get", "patch", "delete", "post"]  # post : swap-primary, boundary

    def get_queryset(self):
        # Indépendance (ADR-001) : un non‑privilégié ne lit/édite que les clauses de
        # SES sessions ; admin/reviewer gardent la portée (supervision/qualité).
        qs = super().get_queryset()
        user = self.request.user
        if getattr(user, "is_admin_role", False) or getattr(user, "role", None) == "reviewer":
            return qs
        return qs.filter(annotation__annotator=user)

    def get_object(self):
        obj = super().get_object()
        # Object-level permission keyed on the parent annotation.
        self.check_object_permissions(self.request, obj.annotation)
        return obj

    def destroy(self, request, *args, **kwargs):
        clause = self.get_object()
        _assert_not_locked(clause.annotation)
        return super().destroy(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        clause = self.get_object()
        _assert_not_locked(clause.annotation)
        ser = ClauseSerializer(clause, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        attrs = ser._resolve(clause.annotation, dict(ser.validated_data))
        new_anchor = attrs.get("anchor_sentence")
        if new_anchor and clause.annotation.clauses.exclude(pk=clause.pk).filter(
            anchor_sentence=new_anchor
        ).exists():
            raise Conflict("Another clause already starts on this sentence (INV-2).")
        with transaction.atomic():
            for field, value in attrs.items():
                setattr(clause, field, value)
            _apply_boundary_and_level(clause, request.data)
            clause.save()
            # Multi-label : `themes` remplace le set ; sinon, garder le miroir scalaire cohérent.
            themes = request.data.get("themes")
            if isinstance(themes, list) and themes:
                set_clause_theme_tags(clause, themes, clause.annotation.project.scheme)
            elif attrs.get("theme") is not None:
                # le thème scalaire a changé → resynchroniser le tag primaire.
                set_clause_theme_tags(
                    clause, [{"label": clause.theme.code, "role": "primary"}],
                    clause.annotation.project.scheme,
                )
            else:
                ensure_primary_tag(clause)
        return Response(ClauseSerializer(clause).data)

    @action(detail=True, methods=["post"], url_path="swap-primary")
    def swap_primary(self, request, pk=None):
        """Permute primaire/secondaire en un geste. Corps : ``{"label": <code>}``."""
        clause = self.get_object()
        _assert_not_locked(clause.annotation)
        target = request.data.get("label")
        tags = list(clause.theme_tags.select_related("theme").all())
        cur_primary = next((t for t in tags if t.role == ClauseRole.PRIMARY), None)
        new_primary = next((t for t in tags if t.theme.code == target), None)
        if new_primary is None:
            raise Conflict(f"thème '{target}' absent de cette clause.")
        if cur_primary is not None and cur_primary.theme.code == target:
            return Response(ClauseSerializer(clause).data)  # déjà primaire, no-op
        # target → primaire ; l'ancien primaire → secondaire ; les autres inchangés.
        payload = []
        for t in tags:
            if t.theme.code == target:
                role = "primary"
            elif cur_primary is not None and t.pk == cur_primary.pk:
                role = "secondary"
            else:
                role = t.role
            payload.append({"label": t.theme.code, "role": role, "support": t.support})
        set_clause_theme_tags(clause, payload, clause.annotation.project.scheme)
        return Response(ClauseSerializer(clause).data)

    @action(detail=True, methods=["post"])
    def boundary(self, request, pk=None):
        """Figer la frontière dure/molle. Corps : ``{"op": "set_hard"|"set_soft", "validatedBy"?}``.
        (merge/scission = DELETE/POST clause via les endpoints existants.)"""
        clause = self.get_object()
        _assert_not_locked(clause.annotation)
        op = request.data.get("op")
        if op == "set_hard":
            clause.boundary_type = BoundaryType.HARD
        elif op == "set_soft":
            clause.boundary_type = BoundaryType.SOFT
        else:
            raise Conflict("op invalide (attendu : set_hard | set_soft).")
        fields = ["boundary_type"]
        if request.data.get("validatedBy") or request.data.get("validated_by"):
            clause.validated = True
            fields.append("validated")
        clause.save(update_fields=fields)
        return Response(ClauseSerializer(clause).data)
