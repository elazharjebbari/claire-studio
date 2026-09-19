"""API publique de la démonstration — `/api/v1/public/demo/*`.

Tous les endpoints sont `AllowAny` sans authentification et limités par adresse (scope `demo` ;
`classify` ajoute `demo_burst`). Aucun identifiant d'annotateur, aucun texte collé ne transite
ailleurs que dans la réponse au visiteur qui l'a soumis.
"""
from __future__ import annotations

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle
from rest_framework.views import APIView

from . import runner, services
from .models import DemoJob, DemoJobSource, DemoJobStatus


class _PublicView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "demo"


class ManifestView(_PublicView):
    def get(self, request):
        return Response(services.manifest())


class ContractListView(_PublicView):
    def get(self, request):
        return Response({"contracts": services.list_contracts()})


class ContractDetailView(_PublicView):
    def get(self, request, document: str):
        try:
            return Response(services.contract_detail(document))
        except services.DemoInputError as exc:
            return Response({"code": exc.code, "detail": exc.detail}, status=status.HTTP_404_NOT_FOUND)


class _BurstThrottle(SimpleRateThrottle):
    """Second budget, court, sur `classify` seulement (le scope `demo` couvre toutes les lectures)."""
    scope = "demo_burst"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class ClassifyView(_PublicView):
    throttle_classes = [ScopedRateThrottle, _BurstThrottle]
    throttle_scope = "demo"

    def post(self, request):
        code_required = getattr(settings, "DEMO_ACCESS_CODE", "") or ""
        if code_required and request.headers.get("X-Demo-Code", "") != code_required:
            return Response({"code": "access_code_required", "detail": "An access code is required."},
                            status=status.HTTP_403_FORBIDDEN)
        data = request.data if isinstance(request.data, dict) else {}
        source = str(data.get("source") or "text")
        if source not in DemoJobSource.values:
            return Response({"code": "bad_source", "detail": "source must be 'text' or 'contract'."},
                            status=status.HTTP_400_BAD_REQUEST)
        if runner.queue_full():
            return Response({"code": "queue_full",
                             "detail": "Three requests are already waiting; please try again in a minute."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            if source == DemoJobSource.CONTRACT:
                document = str(data.get("document") or "")
                sentences = services.contract_sentences(document)
                job = DemoJob.objects.create(source=source, document=document, title=document,
                                             n_chars=sum(len(s) for s in sentences),
                                             client_hash=services.client_hash(request))
                runner.write_input(job, sentences=sentences)
            else:
                text = services.validate_text(str(data.get("text") or ""))
                title = str(data.get("title") or "")[:200]
                job = DemoJob.objects.create(source=source, title=title, n_chars=len(text),
                                             client_hash=services.client_hash(request))
                runner.write_input(job, text=text)
        except services.DemoInputError as exc:
            return Response({"code": exc.code, "detail": exc.detail}, status=status.HTTP_400_BAD_REQUEST)
        position = runner.enqueue(job)
        job.refresh_from_db()
        return Response({"job_id": str(job.id), "status": job.status, "position": position},
                        status=status.HTTP_202_ACCEPTED)


class JobView(_PublicView):
    def get(self, request, job_id):
        try:
            job = DemoJob.objects.get(pk=job_id)
        except (DemoJob.DoesNotExist, ValueError):
            return Response({"code": "not_found", "detail": "Unknown job."}, status=status.HTTP_404_NOT_FOUND)
        payload = {
            "job_id": str(job.id), "status": job.status, "source": job.source,
            "document": job.document or None, "title": job.title or None,
            "timings": job.timings, "result": None, "error": job.error,
        }
        if job.status == DemoJobStatus.DONE and job.result:
            result = dict(job.result)
            if job.source == DemoJobSource.CONTRACT and job.document:
                try:
                    result["comparison"] = services.comparison(job.document, result.get("sentences") or [])
                except services.DemoInputError:
                    result["comparison"] = None
            payload["result"] = result
        return Response(payload)
