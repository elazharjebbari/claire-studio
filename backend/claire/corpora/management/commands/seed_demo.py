"""Idempotent demo seeder (CONTRACT-aligned).

Creates:
- users: admin / annotateur / reviewer (+ a second annotator for IAA demo)
- LabelScheme from vocabulary.yaml
- a Corpus + 3-5 CLAUDETTE documents (real data if present, else fallback fixtures)
- a demo Project + memberships + assignments
- pre-annotations (claude + codex), normalised to the pivot
- 1-2 example human annotations seeded from a pre-annotation, with a comment
  and a global certainty, plus one submitted (so progress/IAA has data).

Re-runnable: uses get_or_create / update_or_create throughout.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from claire.annotations.models import (
    Annotation,
    AnnotationSource,
    AnnotationStatus,
)
from claire.annotations.services import transition_status
from claire.collaboration.models import Comment
from claire.common.persistence import update_or_create_changed
from claire.corpora.loaders import (
    clean_sentence,
    load_claudette_document,
)
from claire.corpora.models import Corpus, Document, ReferenceLabel, Sentence
from claire.imports.models import Judge
from claire.imports.services import (
    ingest_preannotation,
    seed_annotation_from_preannotation,
)
from claire.projects.models import (
    Assignment,
    MembershipRole,
    Project,
    ProjectMembership,
)
from claire.schemes.loaders import load_scheme_from_yaml

logger = logging.getLogger("claire.seed")
User = get_user_model()

DEMO_DOCS = ["Dropbox", "Netflix", "Spotify", "Vimeo", "Endomondo"]
UNFAIRNESS_CATEGORIES = ["A", "CH", "CR", "J", "LAW", "LTD", "TER", "USE"]


class Command(BaseCommand):
    help = "Seed a fully working demo dataset (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--max-docs", type=int, default=5)

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Seeding demo data...")

        admin = self._user("admin", "admin", "admin@claire.local", is_super=True)
        annotator = self._user("alice", "annotator", "alice@claire.local")
        annotator2 = self._user("bob", "annotator", "bob@claire.local")
        reviewer = self._user("rita", "reviewer", "rita@claire.local")

        scheme = load_scheme_from_yaml(settings.VOCABULARY_FILE)
        self.stdout.write(f"  scheme: {scheme.slug} ({scheme.themes.count()} themes)")

        corpus, _ = update_or_create_changed(
            Corpus,
            slug=settings.SEED_CORPUS_SLUG,
            defaults={
                "name": "CLAUDETTE ToS (UNFAIR-ToS)",
                "description": "Terms of Service with unfairness annotations (Lippi 2019).",
                "source_url": "http://claudette.eui.eu/ToS.zip",
                "license": "research",
                "default_language": "en",
            },
        )

        max_docs = options["max_docs"]
        documents = self._load_documents(corpus, DEMO_DOCS[:max_docs])
        self.stdout.write(f"  documents: {[d.external_id for d in documents]}")

        project, _ = update_or_create_changed(
            Project,
            slug=settings.SEED_PROJECT_SLUG,
            defaults={
                "name": "CLAUDETTE Gold v1",
                "corpus": corpus,
                "scheme": scheme,
                "guidelines": "Annotate clause boundaries by theme. Use certainty 0-3.",
                "status": "active",
            },
        )

        for user, role in [
            (annotator, MembershipRole.ANNOTATOR),
            (annotator2, MembershipRole.ANNOTATOR),
            (reviewer, MembershipRole.REVIEWER),
            (admin, MembershipRole.LEAD),
        ]:
            ProjectMembership.objects.get_or_create(
                project=project, user=user, defaults={"role": role}
            )

        for doc in documents:
            for user in (annotator, annotator2):
                Assignment.objects.get_or_create(project=project, document=doc, assignee=user)

        # Pre-annotations (claude + codex).
        pre_index = self._load_preannotations(project, documents)
        self.stdout.write(f"  pre-annotations: {len(pre_index)}")

        # Human annotations (§7) : version humaine VIDE par défaut (LLM = suggestions).
        # SEED_HUMAN_FROM_LLM=True restaure des annotations pré-remplies (démo/IAA).
        if settings.SEED_HUMAN_FROM_LLM:
            self._seed_example_annotations(
                project, documents, pre_index, annotator, annotator2, reviewer
            )
        else:
            n = self._seed_empty_drafts(project, documents, annotator, annotator2)
            self.stdout.write(f"  annotations: {n} empty human drafts (LLM = suggestions)")

        self.stdout.write(self.style.SUCCESS("Demo seed complete."))

    # ------------------------------------------------------------------ helpers
    def _user(self, username, role, email, is_super=False):
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "role": role,
                "display_name": username.title(),
                "is_staff": is_super,
                "is_superuser": is_super,
                "is_email_verified": True,
            },
        )
        if created:
            user.set_password(settings.SEED_PASSWORD)
            user.save()
        return user

    def _load_documents(self, corpus, names) -> list[Document]:
        claudette_dir = Path(settings.CLAUDETTE_DIR)
        documents: list[Document] = []
        if (claudette_dir / "Sentences").exists():
            for name in names:
                if (claudette_dir / "Sentences" / f"{name}.txt").exists():
                    documents.append(load_claudette_document(corpus, claudette_dir, name))
            if documents:
                return documents

        # Fallback to bundled fixtures.
        self.stdout.write("  (raw CLAUDETTE not found, using fallback fixtures)")
        return self._load_documents_from_fixture(corpus)

    @transaction.atomic
    def _load_documents_from_fixture(self, corpus) -> list[Document]:
        fixture = json.loads(
            (settings.FIXTURES_DIR / "claudette_fallback.json").read_text(encoding="utf-8")
        )
        documents = []
        for entry in fixture["documents"]:
            raw_lines = entry["sentences"]
            n = len(raw_lines)
            document, _ = update_or_create_changed(
                Document,
                corpus=corpus,
                external_id=entry["external_id"],
                defaults={
                    "title": entry["external_id"],
                    "language": "en",
                    "n_sentences": n,
                    "source_meta": {"loader": "fixture"},
                },
            )
            existing = sorted(document.sentences.values_list("index", flat=True))
            if existing == list(range(n)):
                documents.append(document)
                continue
            if not document.clauses_exist():
                document.sentences.all().delete()
            Sentence.objects.bulk_create(
                [
                    Sentence(
                        document=document,
                        index=i,
                        raw_text=raw,
                        clean_text=clean_sentence(raw),
                    )
                    for i, raw in enumerate(raw_lines)
                ]
            )
            sentence_map = {s.index: s for s in document.sentences.all()}
            ref = []
            for cat, vals in entry["labels"].items():
                for idx, val in enumerate(vals):
                    if val in (1, 2, 3) and idx in sentence_map:
                        ref.append(
                            ReferenceLabel(
                                sentence=sentence_map[idx],
                                category=cat,
                                level=val,
                                source="claudette",
                            )
                        )
            ReferenceLabel.objects.bulk_create(ref)
            documents.append(document)
        return documents

    def _load_preannotations(self, project, documents) -> dict:
        """Return {(external_id, judge): PreAnnotation}."""
        doc_by_id = {d.external_id: d for d in documents}
        index = {}
        ann_dir = Path(settings.ANNOTATIONS_DIR)
        sources = [
            (Judge.CLAUDE, "v9_4_session1_claude", "_claude.json"),
            (Judge.CODEX, "v9_4_session2_codex", "_codex.json"),
        ]
        loaded_from_disk = False
        for judge, subdir, suffix in sources:
            base = ann_dir / subdir
            if not base.exists():
                continue
            for doc in documents:
                f = base / f"{doc.external_id}{suffix}"
                if f.exists():
                    raw = json.loads(f.read_text(encoding="utf-8"))
                    pre = ingest_preannotation(project, doc, judge, raw)
                    index[(doc.external_id, judge)] = pre
                    loaded_from_disk = True

        if not loaded_from_disk:
            fixture = json.loads(
                (settings.FIXTURES_DIR / "preannotations_fallback.json").read_text(encoding="utf-8")
            )
            for entry in fixture["preannotations"]:
                doc = doc_by_id.get(entry["document"])
                if doc is None:
                    continue
                pre = ingest_preannotation(project, doc, entry["judge"], entry["raw"])
                index[(doc.external_id, entry["judge"])] = pre
        return index

    def _seed_empty_drafts(self, project, documents, *annotators) -> int:
        """Create EMPTY human draft annotations (§7) — one per doc × annotator.

        Idempotent; no clause copied from the LLM (suggestions only).
        """
        count = 0
        for doc in documents:
            for annotator in annotators:
                _, created = Annotation.objects.get_or_create(
                    project=project,
                    document=doc,
                    annotator=annotator,
                    defaults={
                        "status": AnnotationStatus.DRAFT,
                        "source": AnnotationSource.HUMAN,
                    },
                )
                count += int(created)
        return count

    def _seed_example_annotations(
        self, project, documents, pre_index, annotator, annotator2, reviewer
    ):
        if not documents:
            return
        first = documents[0]

        # Annotator 1: seed from claude, add certainty + comment, submit.
        claude_pre = pre_index.get((first.external_id, Judge.CLAUDE))
        if (
            claude_pre
            and not project.annotations.filter(document=first, annotator=annotator).exists()
        ):
            ann = seed_annotation_from_preannotation(claude_pre, annotator)
            ann.global_certainty = 2
            ann.save(update_fields=["global_certainty"])
            first_clause = ann.clauses.first()
            if first_clause:
                Comment.objects.create(
                    annotation=ann,
                    clause=first_clause,
                    author=annotator,
                    body="Seeded from Claude; verified the opening clause.",
                )
            transition_status(ann, AnnotationStatus.SUBMITTED, annotator)

        # Annotator 2: seed from codex (for IAA), submit.
        codex_pre = pre_index.get((first.external_id, Judge.CODEX))
        if (
            codex_pre
            and not project.annotations.filter(document=first, annotator=annotator2).exists()
        ):
            ann2 = seed_annotation_from_preannotation(codex_pre, annotator2)
            ann2.global_certainty = 1
            ann2.save(update_fields=["global_certainty"])
            transition_status(ann2, AnnotationStatus.SUBMITTED, annotator2)
