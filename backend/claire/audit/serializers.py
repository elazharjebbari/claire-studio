from rest_framework import serializers

from .models import ActivityEvent


class ActivityEventSerializer(serializers.ModelSerializer):
    actor = serializers.SlugRelatedField(slug_field="username", read_only=True)

    class Meta:
        model = ActivityEvent
        fields = [
            "id", "actor", "verb", "target_type", "target_id", "payload",
            "created_at",
        ]
