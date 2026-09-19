from django.urls import path

from .views import ClassifyView, ContractDetailView, ContractListView, JobView, ManifestView

urlpatterns = [
    path("public/demo/manifest", ManifestView.as_view(), name="demo-manifest"),
    path("public/demo/contracts", ContractListView.as_view(), name="demo-contracts"),
    path("public/demo/contracts/<str:document>", ContractDetailView.as_view(), name="demo-contract-detail"),
    path("public/demo/classify", ClassifyView.as_view(), name="demo-classify"),
    path("public/demo/jobs/<uuid:job_id>", JobView.as_view(), name="demo-job"),
]
