"""ActivityEvent serializer — CONTRACT-aligned shape.

ActivityEvent -> {id, actorId, actorName, verb, targetType, targetId,
                  payload, createdAt}
"""

from rest_framework import serializers

from .models import ActivityEvent


class ActivityEventSerializer(serializers.ModelSerializer):
    actor_id = serializers.PrimaryKeyRelatedField(source="actor", read_only=True)
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = ActivityEvent
        fields = [
            "id", "actor_id", "actor_name", "verb", "target_type",
            "target_id", "payload", "created_at",
        ]

    def get_actor_name(self, obj):
        return obj.actor.display_name or obj.actor.username
