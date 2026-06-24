from django.conf import settings
from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from claire.common.throttling import LoginRateThrottle

from .emails import send_password_reset_email, send_verification_email
from .serializers import (
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
    VerifyEmailSerializer,
)
from .tokens import read_email_verify_token, read_password_reset
from .ui_prefs import merge_ui_preferences

User = get_user_model()


class LoginView(TokenObtainPairView):
    """POST /api/v1/auth/login — JWT obtain, rate-limited (security.md §4).

    The dedicated ``LoginRateThrottle`` returns 429 + Retry-After once the
    per-IP login budget is exhausted (anti brute-force, threat_model.md §3.1 D).
    """

    throttle_classes = [LoginRateThrottle]


class MeView(APIView):
    """GET /api/v1/me — current user. PATCH /api/v1/me — edit own profile."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(request=ProfileUpdateSerializer, responses=UserSerializer)
    def patch(self, request):
        # Préférences UI par compte (point produit) : PATCH PARTIEL fusionné sur l'existant,
        # whitelist stricte (jamais de JSON arbitraire), version forcée. Le blob reste
        # camelCase verbatim (exclu de la conversion via JSON_UNDERSCOREIZE.ignore_fields).
        if "ui_preferences" in request.data:
            incoming = request.data.get("ui_preferences")
            if not isinstance(incoming, dict):
                return Response(
                    {"detail": "uiPreferences must be an object."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            request.user.ui_preferences = merge_ui_preferences(
                request.user.ui_preferences, incoming
            )
            request.user.save(update_fields=["ui_preferences"])

        # Champs de profil (display_name / locale) — inchangés.
        profile_fields = {k: request.data[k] for k in ("display_name", "locale") if k in request.data}
        if profile_fields:
            ser = ProfileUpdateSerializer(request.user, data=profile_fields, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()

        return Response(UserSerializer(request.user).data)


class RegisterView(APIView):
    """POST /api/v1/auth/register — self-signup (annotator, unverified) + e-mail."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    @extend_schema(request=RegisterSerializer, responses=UserSerializer)
    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        send_verification_email(user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class VerifyEmailView(APIView):
    """POST /api/v1/auth/verify-email — {token} → marque l'e-mail vérifié."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    @extend_schema(request=VerifyEmailSerializer)
    def post(self, request):
        ser = VerifyEmailSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        uid = read_email_verify_token(
            ser.validated_data["token"], settings.EMAIL_TOKEN_MAX_AGE
        )
        if uid is None:
            return Response(
                {"detail": "Lien de vérification invalide ou expiré."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Idempotent : revérifier ne fait rien de mal.
        User.objects.filter(pk=uid).update(is_email_verified=True)
        return Response({"detail": "Adresse e-mail vérifiée."})


class PasswordResetRequestView(APIView):
    """POST /api/v1/auth/password-reset — {email} → envoie un lien (sans fuite)."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @extend_schema(request=PasswordResetRequestSerializer)
    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = User.objects.filter(email__iexact=ser.validated_data["email"]).first()
        if user is not None:
            send_password_reset_email(user)
        # Réponse constante : ne jamais révéler si l'e-mail existe (énumération).
        return Response({"detail": "Si un compte existe, un e-mail a été envoyé."})


class PasswordResetConfirmView(APIView):
    """POST /api/v1/auth/password-reset/confirm — {uid, token, new_password}."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @extend_schema(request=PasswordResetConfirmSerializer)
    def post(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = read_password_reset(
            ser.validated_data["uid"], ser.validated_data["token"]
        )
        if user is None:
            return Response(
                {"detail": "Lien de réinitialisation invalide ou expiré."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(ser.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Mot de passe réinitialisé."})
