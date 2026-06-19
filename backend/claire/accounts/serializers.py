from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Role, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "username", "email", "role", "display_name", "locale",
            "is_email_verified",
        ]
        read_only_fields = ["id", "role", "is_email_verified"]


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """PATCH /me — l'utilisateur édite son profil (jamais son rôle ni son e-mail)."""

    class Meta:
        model = User
        fields = ["display_name", "locale"]


def _run_password_validators(password: str, user=None) -> str:
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages))
    return password


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, style={"input_type": "password"}, trim_whitespace=False,
    )

    class Meta:
        model = User
        fields = ["username", "email", "password", "display_name"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cet e-mail.")
        return value

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Ce nom d'utilisateur est déjà pris.")
        return value

    def validate_password(self, value):
        return _run_password_validators(value)

    def create(self, validated_data):
        password = validated_data.pop("password")
        # Auto-inscription = annotateur, non vérifié (privilèges via admin uniquement).
        user = User(role=Role.ANNOTATOR, is_email_verified=False, **validated_data)
        user.set_password(password)
        user.save()
        return user


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(
        write_only=True, style={"input_type": "password"}, trim_whitespace=False,
    )

    def validate_new_password(self, value):
        return _run_password_validators(value)
