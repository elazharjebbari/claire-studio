"""API du Lab.

Le Lab est réservé aux rôles `lead` / `reviewer` (et aux administrateurs) : un annotateur
n'a rien à y faire, et surtout ne doit jamais y découvrir un classement de ses pairs. La
politique d'indépendance déjà en vigueur dans le produit s'applique ici.
"""

from __future__ import annotations

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from claire.analysis.policy import access_for
from claire.projects.models import Project

from .contracts import ConfigValidationError, expand_sweep, validate_config
from .crypto import CredentialsKeyMissing, encrypt_secret, is_configured
from .models import (
    ComputeCredential,
    Experiment,
    ExperimentRun,
    LabDataset,
    RunStatus,
)
from .g5k_reference import gpu_clusters_for, load_static_catalogue
from .preflight import preflight
from .presets import load_presets
from .serializers import (
    ComputeCredentialSerializer,
    ComputeCredentialWriteSerializer,
    DatasetRequestSerializer,
    ExperimentRunSerializer,
    ExperimentRunSummarySerializer,
    ExperimentSerializer,
    LabDatasetSerializer,
    LabDatasetSummarySerializer,
)
from .services import (
    DuplicateDataset,
    DuplicateRun,
    build_dataset,
    cancel_run,
    comparable,
    queue_run,
)


def _project_for(request, slug: str) -> Project:
    """Charge le projet et refuse l'accès aux rôles sans droit d'analyse projet."""
    project = get_object_or_404(Project, slug=slug)
    try:
        access = access_for(request.user, project)
    except PermissionError as exc:
        raise PermissionDenied(str(exc)) from exc
    if not access.may_create_project_artifact:
        raise PermissionDenied("lab_requires_reviewer_role")
    return project


class PermissionDenied(Exception):
    """Refus d'accès, converti en 403 par les vues."""


def _forbidden(detail: str) -> Response:
    return Response({"code": "forbidden", "detail": detail}, status=status.HTTP_403_FORBIDDEN)


# --------------------------------------------------------------------------- #
# Datasets
# --------------------------------------------------------------------------- #

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def dataset_preflight(request, slug: str):
    """Simule la construction SANS rien créer.

    Le point d'ergonomie central : l'utilisateur voit combien de documents il obtiendra
    et lesquels seront écartés, AVANT de s'engager.
    """
    try:
        project = _project_for(request, slug)
    except PermissionDenied as exc:
        return _forbidden(str(exc))

    serializer = DatasetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    report = preflight(
        project,
        maturity=serializer.validated_data["maturity"],
        scope=serializer.to_scope(),
        k=serializer.validated_data["k"],
    )
    return Response(report)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def datasets(request, slug: str):
    try:
        project = _project_for(request, slug)
    except PermissionDenied as exc:
        return _forbidden(str(exc))

    if request.method == "GET":
        queryset = LabDataset.objects.filter(project=project)
        maturity = request.query_params.get("maturity")
        if maturity:
            queryset = queryset.filter(maturity=maturity)
        return Response(LabDatasetSummarySerializer(queryset, many=True).data)

    serializer = DatasetRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    try:
        dataset = build_dataset(
            project=project,
            user=request.user,
            label=data.get("label", ""),
            maturity=data["maturity"],
            aggregation=data["aggregation"],
            scope=serializer.to_scope(),
            k=data["k"],
            seed=data["seed"],
            single_annotator=data.get("single_annotator") or None,
            force=data.get("force", False),
        )
    except DuplicateDataset as exc:
        # 409 plutôt qu'une reconstruction silencieuse : on renvoie l'existant, ce qui
        # évite deux datasets identiques aux identifiants différents dans l'article.
        return Response(
            {
                "code": "dataset_duplicate",
                "detail": "un jeu de données identique existe déjà",
                "dataset": LabDatasetSummarySerializer(exc.dataset).data,
            },
            status=status.HTTP_409_CONFLICT,
        )
    except ValueError as exc:
        code = str(exc).split(" ")[0].rstrip(":")
        return Response(
            {"code": code or "dataset_invalid", "detail": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(LabDatasetSerializer(dataset).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dataset_detail(request, slug: str, dataset_id):
    try:
        project = _project_for(request, slug)
    except PermissionDenied as exc:
        return _forbidden(str(exc))
    dataset = get_object_or_404(LabDataset, id=dataset_id, project=project)
    return Response(LabDatasetSerializer(dataset).data)


# --------------------------------------------------------------------------- #
# Presets — mode guidé de configuration d'expérience
# --------------------------------------------------------------------------- #

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def presets(request, slug: str):
    """Catalogue des presets scientifiques (`pipeline-presets.yaml`).

    Chaque preset porte une config PARTIELLE (sans `dataset_id`, complété au moment de
    la création réelle de l'expérience avec le dataset choisi par l'utilisateur).
    """
    try:
        _project_for(request, slug)
    except PermissionDenied as exc:
        return _forbidden(str(exc))
    return Response(load_presets())


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def g5k_clusters(request, slug: str):
    """Clusters GPU Grid'5000 compatibles avec une VRAM minimale demandée.

    Catalogue STATIQUE (voir `g5k_reference.catalogue_file` pour pourquoi) — ne
    nécessite PAS d'identifiants Grid'5000 configurés : même sans compte, un chercheur
    voit quel cluster viser avant d'en demander un. `configured` indique si l'utilisateur
    a des identifiants API enregistrés (pour distinguer « catalogue informatif » de
    « prêt à réserver »), sans jamais bloquer l'affichage.
    """
    try:
        _project_for(request, slug)
    except PermissionDenied as exc:
        return _forbidden(str(exc))
    try:
        min_vram_gb = float(request.query_params.get("minVramGb", 8))
    except (TypeError, ValueError):
        return Response(
            {"code": "invalid_min_vram", "detail": "minVramGb doit être un nombre"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    configured = ComputeCredential.objects.filter(
        user=request.user, kind="g5k", secret_encrypted__gt=""
    ).exists()
    clusters = gpu_clusters_for(min_vram_gb, load_static_catalogue())
    return Response({"configured": configured, "clusters": clusters})


# --------------------------------------------------------------------------- #
# Expériences et runs
# --------------------------------------------------------------------------- #

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def experiments(request, slug: str):
    try:
        project = _project_for(request, slug)
    except PermissionDenied as exc:
        return _forbidden(str(exc))

    if request.method == "GET":
        queryset = Experiment.objects.filter(project=project).select_related("dataset")
        return Response(ExperimentSerializer(queryset, many=True).data)

    serializer = ExperimentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    config = serializer.validated_data.get("config") or {}
    try:
        validate_config(config)
    except ConfigValidationError as exc:
        # Le chemin JSON-pointer permet à l'éditeur de pointer la ligne fautive.
        return Response(
            {"code": "config_invalid", "detail": str(exc), "path": exc.path},
            status=status.HTTP_400_BAD_REQUEST,
        )
    experiment = serializer.save(project=project, created_by=request.user)
    return Response(ExperimentSerializer(experiment).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def experiment_estimate(request, slug: str, experiment_id):
    """Combien de runs, et pour combien de temps ? À savoir AVANT de lancer."""
    try:
        project = _project_for(request, slug)
    except PermissionDenied as exc:
        return _forbidden(str(exc))
    experiment = get_object_or_404(Experiment, id=experiment_id, project=project)
    try:
        variants = expand_sweep(experiment.config)
    except ConfigValidationError as exc:
        return Response(
            {"code": "sweep_too_large", "detail": str(exc), "path": exc.path},
            status=status.HTTP_400_BAD_REQUEST,
        )
    family = (experiment.config.get("model") or {}).get("family", "majority")
    per_run = {
        "majority": 0.2, "position_only": 0.2, "llm_judge": 0.3,
        "tfidf_linear": 1.0, "embeddings_head": 8.0,
        "transformer_finetune": 45.0, "sequence_labeling": 60.0,
    }.get(family, 5.0)
    return Response(
        {
            "n_runs": len(variants),
            "estimated_minutes": round(len(variants) * per_run),
            "requires_gpu": bool((experiment.config.get("compute") or {}).get("require_gpu")),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def experiment_run(request, slug: str, experiment_id):
    try:
        project = _project_for(request, slug)
    except PermissionDenied as exc:
        return _forbidden(str(exc))
    experiment = get_object_or_404(Experiment, id=experiment_id, project=project)
    force = bool(request.data.get("force"))

    try:
        variants = expand_sweep(experiment.config)
    except ConfigValidationError as exc:
        return Response(
            {"code": "sweep_too_large", "detail": str(exc), "path": exc.path},
            status=status.HTTP_400_BAD_REQUEST,
        )

    targets_g5k = (experiment.config.get("compute") or {}).get("target") == "g5k"
    max_sweep = getattr(settings, "LAB_G5K_MAX_RUNS_PER_SWEEP", 3)
    if targets_g5k and len(variants) > max_sweep and not force:
        # Grid'5000 déconseille explicitement de soumettre de nombreux petits jobs OAR
        # (docs/pactiva-g5k/research/02_OAR_KADEPLOY.md §4.3) — un avertissement, pas un
        # blocage : l'utilisateur peut confirmer avec `force`.
        return Response(
            {
                "code": "g5k_sweep_too_large",
                "detail": (
                    f"{len(variants)} runs Grid'5000 séparés — déconseillé par la "
                    "documentation officielle (préférer une réservation plus large). "
                    "Renvoyer avec force=true pour continuer quand même."
                ),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    run_ids, duplicates = [], []
    for config in variants:
        try:
            run = queue_run(experiment=experiment, config=config, force=force)
            run_ids.append(str(run.id))
        except DuplicateRun as exc:
            duplicates.append(str(exc.run.id))

    if not run_ids and duplicates:
        return Response(
            {
                "code": "run_duplicate",
                "detail": "ces runs ont déjà été exécutés à l'identique",
                "run_ids": duplicates,
            },
            status=status.HTTP_409_CONFLICT,
        )
    return Response(
        {"run_ids": run_ids, "duplicates": duplicates}, status=status.HTTP_202_ACCEPTED
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def runs(request, slug: str):
    try:
        project = _project_for(request, slug)
    except PermissionDenied as exc:
        return _forbidden(str(exc))
    queryset = ExperimentRun.objects.filter(experiment__project=project).select_related(
        "experiment"
    )
    state = request.query_params.get("status")
    if state:
        queryset = queryset.filter(status=state)
    return Response(ExperimentRunSummarySerializer(queryset[:200], many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def run_detail(request, slug: str, run_id):
    try:
        project = _project_for(request, slug)
    except PermissionDenied as exc:
        return _forbidden(str(exc))
    run = get_object_or_404(
        ExperimentRun.objects.select_related("experiment"),
        id=run_id, experiment__project=project,
    )
    return Response(ExperimentRunSerializer(run).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def run_cancel(request, slug: str, run_id):
    try:
        project = _project_for(request, slug)
    except PermissionDenied as exc:
        return _forbidden(str(exc))
    run = get_object_or_404(ExperimentRun, id=run_id, experiment__project=project)
    if run.status in (RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.CANCELLED):
        return Response(
            {"code": "run_finished", "detail": "run déjà terminé"},
            status=status.HTTP_409_CONFLICT,
        )
    cancel_run(run)
    return Response({"status": "cancelling"}, status=status.HTTP_202_ACCEPTED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def compare_runs(request, slug: str):
    """Compare N runs — et REFUSE si les plis diffèrent.

    Comparer deux modèles évalués sur des découpages différents produit un écart qui ne
    veut rien dire. Le refus explicite vaut mieux qu'un tableau trompeur.
    """
    try:
        project = _project_for(request, slug)
    except PermissionDenied as exc:
        return _forbidden(str(exc))

    run_ids = request.data.get("run_ids") or []
    metric = request.data.get("metric", "macro_f1")
    selected = list(
        ExperimentRun.objects.filter(
            id__in=run_ids, experiment__project=project
        ).select_related("experiment__dataset")
    )
    ok, reason = comparable(selected)
    rows = [
        {
            "run_id": str(run.id),
            "label": run.experiment.name,
            "value": (run.metrics or {}).get("metrics", {}).get(metric),
            "ci": (run.metrics or {}).get("metrics", {}).get(f"{metric}_ci"),
            "human_ceiling": (run.metrics or {}).get("human_ceiling", {}).get("value"),
        }
        for run in selected
    ]
    return Response({"comparable": ok, "incomparable_reason": reason or None, "rows": rows})


# --------------------------------------------------------------------------- #
# Identifiants de calcul
# --------------------------------------------------------------------------- #

@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def compute_credentials(request):
    if request.method == "GET":
        queryset = ComputeCredential.objects.filter(user=request.user)
        return Response(
            {
                "configured": is_configured(),
                "credentials": ComputeCredentialSerializer(queryset, many=True).data,
            }
        )

    serializer = ComputeCredentialWriteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    ssh_key = serializer.validated_data.get("ssh_key") or ""
    existing = ComputeCredential.objects.filter(
        user=request.user, kind=serializer.validated_data["kind"]
    ).first()
    try:
        encrypted = encrypt_secret(serializer.validated_data["password"])
        if ssh_key:
            ssh_key_encrypted = encrypt_secret(ssh_key)
        else:
            # Absente de la requête : on NE remplace PAS une clé déjà enregistrée —
            # sinon changer son mot de passe effacerait silencieusement sa clé SSH.
            ssh_key_encrypted = existing.ssh_key_encrypted if existing else ""
    except CredentialsKeyMissing as exc:
        # 503 et non 500 : la plateforme fonctionne, c'est la configuration serveur qui
        # manque. Et surtout : REFUS d'écrire, jamais de stockage en clair.
        return Response(
            {"code": "credentials_key_missing", "detail": str(exc)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    credential, _ = ComputeCredential.objects.update_or_create(
        user=request.user,
        kind=serializer.validated_data["kind"],
        defaults={
            "login": serializer.validated_data["login"],
            "secret_encrypted": encrypted,
            "ssh_key_encrypted": ssh_key_encrypted,
            "last_tested_at": None,
            "last_test_ok": None,
            "last_test_ssh_ok": None,
            "last_test_detail": "",
        },
    )
    return Response(ComputeCredentialSerializer(credential).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def compute_credentials_test(request, credential_id: int):
    """Test de connexion réel — évite de découvrir un mot de passe faux après une
    réservation de plusieurs heures."""
    from django.utils import timezone

    from .crypto import decrypt_secret
    from .runners.g5k import Grid5000Backend

    credential = get_object_or_404(ComputeCredential, id=credential_id, user=request.user)
    backend = Grid5000Backend(
        login=credential.login,
        password=decrypt_secret(credential.secret_encrypted),
        ssh_key=decrypt_secret(credential.ssh_key_encrypted) if credential.ssh_key_encrypted else None,
    )
    api_ok, ssh_ok, detail = backend.test_connection()
    credential.last_tested_at = timezone.now()
    credential.last_test_ok = api_ok
    credential.last_test_ssh_ok = ssh_ok
    credential.last_test_detail = detail[:300]
    credential.save(
        update_fields=["last_tested_at", "last_test_ok", "last_test_ssh_ok", "last_test_detail"]
    )
    return Response(
        {
            "ok": api_ok,
            "apiOk": api_ok,
            "sshOk": ssh_ok,
            "detail": detail,
            "testedAt": credential.last_tested_at,
        }
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def compute_credential_delete(request, credential_id: int):
    credential = get_object_or_404(ComputeCredential, id=credential_id, user=request.user)
    credential.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
