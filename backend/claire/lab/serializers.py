"""Sérialiseurs du Lab.

Un point de vigilance domine ce module : **le secret d'un identifiant de calcul n'est
jamais exposé, à aucun niveau de sérialisation**. Le champ est en écriture seule, et un
test balaie récursivement la réponse pour s'en assurer — un champ ajouté par inadvertance
à un sérialiseur imbriqué serait sinon invisible.
"""

from __future__ import annotations

from rest_framework import serializers

from .models import (
    ComputeCredential,
    ComputeTarget,
    Experiment,
    ExperimentRun,
    LabDataset,
    RunArtifact,
)


class LabDatasetSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = LabDataset
        fields = [
            "id", "label", "maturity", "aggregation", "status", "fingerprint",
            "n_documents", "n_sentences", "n_annotations", "created_at",
        ]
        read_only_fields = fields


class LabDatasetSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabDataset
        fields = [
            "id", "label", "maturity", "aggregation", "scope", "manifest", "splits",
            "fingerprint", "status", "storage_path", "n_documents", "n_sentences",
            "n_annotations", "error", "created_at",
        ]
        read_only_fields = fields


class DatasetRequestSerializer(serializers.Serializer):
    """Critères de construction — communs au preflight et à la construction."""

    label = serializers.CharField(required=False, allow_blank=True, default="")
    maturity = serializers.ChoiceField(
        choices=["any", "complete", "submitted", "gold"], default="complete"
    )
    aggregation = serializers.ChoiceField(
        choices=["single", "consensus", "soft"], default="consensus"
    )
    documents = serializers.ListField(child=serializers.CharField(), required=False)
    annotators = serializers.ListField(child=serializers.CharField(), required=False)
    min_annotators = serializers.IntegerField(required=False, min_value=0, default=0)
    exclude_partial = serializers.BooleanField(required=False, default=True)
    completeness_threshold = serializers.FloatField(
        required=False, min_value=0.0, max_value=1.0, default=1.0
    )
    single_annotator = serializers.CharField(required=False, allow_blank=True)
    k = serializers.IntegerField(required=False, min_value=2, max_value=10, default=5)
    seed = serializers.IntegerField(required=False, min_value=0, default=42)
    force = serializers.BooleanField(required=False, default=False)

    def to_scope(self) -> dict:
        data = self.validated_data
        return {
            "documents": data.get("documents") or [],
            "annotators": data.get("annotators") or [],
            "min_annotators": data.get("min_annotators", 0),
            "exclude_partial": data.get("exclude_partial", True),
            "completeness_threshold": data.get("completeness_threshold", 1.0),
        }


class ComputeTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComputeTarget
        fields = ["id", "name", "kind", "config", "is_default"]


class ExperimentSerializer(serializers.ModelSerializer):
    dataset_fingerprint = serializers.CharField(source="dataset.fingerprint", read_only=True)

    class Meta:
        model = Experiment
        fields = [
            "id", "name", "task", "dataset", "dataset_fingerprint", "config",
            "compute_target", "preset", "tags", "created_at",
        ]
        read_only_fields = ["id", "created_at", "dataset_fingerprint"]


class RunArtifactSerializer(serializers.ModelSerializer):
    class Meta:
        model = RunArtifact
        fields = ["id", "kind", "name", "mime", "bytes", "checksum", "created_at"]
        read_only_fields = fields


class ExperimentRunSerializer(serializers.ModelSerializer):
    experiment_name = serializers.CharField(source="experiment.name", read_only=True)
    task = serializers.CharField(source="experiment.task", read_only=True)
    artifacts = RunArtifactSerializer(many=True, read_only=True)

    class Meta:
        model = ExperimentRun
        fields = [
            "id", "experiment", "experiment_name", "task", "status", "progress", "phase",
            "config", "fingerprint", "metrics", "environment", "external_job_id",
            "error_code", "error_detail", "attempt", "started_at", "completed_at",
            "created_at", "artifacts",
        ]
        read_only_fields = fields


class ExperimentRunSummarySerializer(serializers.ModelSerializer):
    experiment_name = serializers.CharField(source="experiment.name", read_only=True)
    task = serializers.CharField(source="experiment.task", read_only=True)
    macro_f1 = serializers.SerializerMethodField()

    class Meta:
        model = ExperimentRun
        fields = [
            "id", "experiment_name", "task", "status", "progress", "phase",
            "macro_f1", "error_code", "created_at", "completed_at",
        ]
        read_only_fields = fields

    def get_macro_f1(self, obj) -> float | None:
        return (obj.metrics or {}).get("metrics", {}).get("macro_f1")


class ComputeCredentialSerializer(serializers.ModelSerializer):
    """Lecture d'un identifiant — SANS le secret.

    `has_password` remplace le mot de passe : l'UI a besoin de savoir qu'un secret existe,
    jamais de le connaître. Aucune méthode de ce sérialiseur ne touche à
    `secret_encrypted`.
    """

    has_password = serializers.SerializerMethodField()

    class Meta:
        model = ComputeCredential
        fields = [
            "id", "kind", "login", "has_password", "last_tested_at",
            "last_test_ok", "last_test_detail",
        ]
        read_only_fields = fields

    def get_has_password(self, obj) -> bool:
        return bool(obj.secret_encrypted)


class ComputeCredentialWriteSerializer(serializers.Serializer):
    """Écriture seule. Le mot de passe entre, il ne ressort jamais."""

    kind = serializers.ChoiceField(choices=["g5k"], default="g5k")
    login = serializers.CharField(max_length=120)
    password = serializers.CharField(max_length=500, write_only=True, trim_whitespace=False)
