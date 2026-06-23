"""Centralised DRF exception handler — consistent, debuggable error envelope."""

import logging

from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("claire.api")


class Conflict(Exception):
    """Raised by services for 409 conflicts (versioning, illegal transitions)."""

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


class Locked(Exception):
    """Raised when writing to a LOCKED annotation (423 Locked).

    Un document verrouillé (soumis ou verrouillé manuellement) gèle l'édition : on
    refuse l'écriture avec un code dédié (423) pour que le frontend affiche un
    avertissement « déverrouillez pour modifier » plutôt qu'une erreur générique.
    """

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def claire_exception_handler(exc, context):
    if isinstance(exc, Conflict):
        logger.info("conflict detail=%r", exc.detail)
        return Response({"detail": exc.detail}, status=status.HTTP_409_CONFLICT)

    if isinstance(exc, Locked):
        logger.info("locked detail=%r", exc.detail)
        return Response({"detail": exc.detail}, status=status.HTTP_423_LOCKED)

    response = exception_handler(exc, context)
    if response is None and isinstance(exc, IntegrityError):
        logger.warning("integrity_error detail=%r", str(exc))
        return Response(
            {"detail": "Integrity constraint violated.", "error": str(exc)},
            status=status.HTTP_409_CONFLICT,
        )
    return response
