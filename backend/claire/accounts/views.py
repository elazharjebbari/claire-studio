from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from claire.common.throttling import LoginRateThrottle

from .serializers import UserSerializer


class LoginView(TokenObtainPairView):
    """POST /api/v1/auth/login — JWT obtain, rate-limited (security.md §4).

    The dedicated ``LoginRateThrottle`` returns 429 + Retry-After once the
    per-IP login budget is exhausted (anti brute-force, threat_model.md §3.1 D).
    """

    throttle_classes = [LoginRateThrottle]


class MeView(APIView):
    """GET /api/v1/me — current authenticated user."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)
