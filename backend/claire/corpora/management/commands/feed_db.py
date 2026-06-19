"""Feed the database with the REAL project data (idempotent / re-runnable).

Unlike ``seed_demo`` (which falls back to bundled fixtures), ``feed_db`` is the
canonical loader for the data that now ships inside the project:

- CLAUDETTE corpus    : ``settings.CLAUDETTE_DIR`` (Sentences/ + Labels_<CAT>/)
- LLM pre-annotations : ``settings.PREANNOTATIONS_DIR/{claude,codex}/<Doc>_<judge>.json``
                        (schema v9.4)
- Translations        : ``settings.TRANSLATIONS_ROOT/claudette_fr/<Doc>.txt``

What it creates / updates (everything via update_or_create / get_or_create, so a
second run produces zero duplicates and leaves the row counts stable):

1. LabelScheme ``claire-themes-v1`` from vocabulary.yaml.
2. Demo users: admin / alice (annotator) / bob (annotator) / rita (reviewer),
   password ``claire-demo``.
3. N CLAUDETTE documents (``--max-docs`` default 12, ``--all`` for the 50).
4. Pre-annotations for claude AND codex of those docs (PreAnnotation/PreClause).
5. Demo Project ``claudette-gold-v1`` (corpus + scheme + memberships).
6. Per document: a human Annotation by alice seeded from claude and one by bob
   seeded from codex, both ``submitted`` (a submit auto-creates an immutable
   AnnotationVersion). Plus a couple of comments and one review (visible work + IAA).
7. A TranslationSet ``claudette_fr`` (fr, by_external_id) and its sync.

Usage::

    python manage.py feed_db                 # 12 docs
    python manage.py feed_db --all           # all 50
    python manage.py feed_db --max-docs 4
    python manage.py feed_db --reset --all   # wipe data tables, then refeed
"""

from __future__ import annotations

import argparse
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
    AnnotationVersion,
    Clause,
)
from claire.annotations.services import transition_status
from claire.collaboration.models import Comment, Review, ReviewDecision
from claire.corpora.loaders import list_available_documents, load_claudette_document
from claire.corpora.models import Corpus, Document, ReferenceLabel, Sentence
from claire.imports.models import Judge, PreAnnotation, PreClause
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
from claire.translations.models import Translation, TranslationSet
from claire.translations.services import sync_translation_set

logger = logging.getLogger("claire.seed")
User = get_user_model()


class Command(BaseCommand):
    help = "Feed the DB with the real CLAUDETTE data + pre-annotations (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--max-docs", type=int, default=12)
        parser.add_argument(
            "--all", action="store_true",
            help="Import every available CLAUDETTE document (overrides --max-docs).",
        )
        parser.add_argument(
            "--reset", action="store_true",
            help="Delete data rows (annotations, preannotations, documents, "
                 "translations, projects) before refeeding. Users/scheme kept.",
        )
        # Dé-rigidification (H1/H2) : plus aucune valeur métier en dur ; défauts
        # depuis settings (env-driven), surchargeables au cas par cas en CLI.
        parser.add_argument(
            "--corpus-slug", default=None,
            help="Slug du corpus (défaut: settings.SEED_CORPUS_SLUG).",
        )
        parser.add_argument(
            "--project-slug", default=None,
            help="Slug du projet (défaut: settings.SEED_PROJECT_SLUG).",
        )
        parser.add_argument(
            "--translation-folder", default=None,
            help="Sous-dossier de traductions (défaut: settings.SEED_TRANSLATION_FOLDER).",
        )
        parser.add_argument(
            "--password", default=None,
            help="Mot de passe des comptes de démo (défaut: settings.SEED_PASSWORD).",
        )
        # §7 : la version humaine démarre VIDE par défaut (LLM = suggestions à
        # adopter). --seed-human restaure le pré-remplissage humain depuis le LLM
        # (démo/IAA peuplée) ; --no-seed-human force le vide. None ⇒ settings.
        parser.add_argument(
            "--seed-human", action=argparse.BooleanOptionalAction, default=None,
            help="Pré-remplir les annotations humaines depuis le LLM "
                 "(défaut: settings.SEED_HUMAN_FROM_LLM=False ⇒ brouillons vides).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        # Valeurs effectives : CLI > settings (env) > défaut. Rien en dur.
        self.password = options["password"] or settings.SEED_PASSWORD
        corpus_slug = options["corpus_slug"] or settings.SEED_CORPUS_SLUG
        project_slug = options["project_slug"] or settings.SEED_PROJECT_SLUG
        self.translation_folder = (
            options["translation_folder"] or settings.SEED_TRANSLATION_FOLDER
        )
        seed_human = (
            options["seed_human"]
            if options["seed_human"] is not None
            else settings.SEED_HUMAN_FROM_LLM
        )

        if options["reset"]:
            self._reset()

        self.stdout.write("Feeding DB with real data...")

        # 1. Scheme ----------------------------------------------------------
        scheme = load_scheme_from_yaml(settings.VOCABULARY_FILE)
        self.stdout.write(
            f"  scheme: {scheme.slug} ({scheme.themes.count()} themes, "
            f"{scheme.legal_natures.count()} legal natures)"
        )

        # 2. Users -----------------------------------------------------------
        admin = self._user("admin", "admin", "admin@claire.local", is_super=True)
        alice = self._user("alice", "annotator", "alice@claire.local")
        bob = self._user("bob", "annotator", "bob@claire.local")
        rita = self._user("rita", "reviewer", "rita@claire.local")
        self.stdout.write(
            f"  users: admin, alice, bob, rita (password '{self.password}')"
        )

        # 3. Corpus + documents ---------------------------------------------
        corpus, _ = Corpus.objects.update_or_create(
            slug=corpus_slug,
            defaults={
                "name": "CLAUDETTE ToS (UNFAIR-ToS)",
                "description": "Terms of Service with unfairness annotations (Lippi 2019).",
                "source_url": "http://claudette.eui.eu/ToS.zip",
                "license": "research",
                "default_language": "en",
            },
        )
        documents = self._load_documents(corpus, options)
        self.stdout.write(f"  documents: {len(documents)} loaded")

        # 4. Pre-annotations (claude + codex) -------------------------------
        project, _ = Project.objects.update_or_create(
            slug=project_slug,
            defaults={
                "name": "CLAUDETTE Gold v1",
                "corpus": corpus,
                "scheme": scheme,
                "guidelines": "Annotate clause boundaries by theme. Use certainty 0-3.",
                "status": "active",
            },
        )
        pre_index = self._load_preannotations(project, documents)
        self.stdout.write(f"  pre-annotations: {len(pre_index)} (claude + codex)")

        # 5. Memberships + assignments --------------------------------------
        for user, role in [
            (alice, MembershipRole.ANNOTATOR),
            (bob, MembershipRole.ANNOTATOR),
            (rita, MembershipRole.REVIEWER),
            (admin, MembershipRole.LEAD),
        ]:
            ProjectMembership.objects.get_or_create(
                project=project, user=user, defaults={"role": role}
            )
        for doc in documents:
            for user in (alice, bob):
                Assignment.objects.get_or_create(
                    project=project, document=doc, assignee=user
                )

        # 6. Human annotations ----------------------------------------------
        # §7 : par défaut la version humaine démarre VIDE (brouillons sans clause) ;
        # le LLM reste une suggestion (PreAnnotation) à adopter dans le workspace,
        # jamais copiée dans l'annotation humaine. --seed-human restaure le pré-
        # remplissage depuis le LLM (démo/IAA peuplée).
        if seed_human:
            n_annotations = self._seed_annotations(
                project, documents, pre_index, alice, bob, rita
            )
            self.stdout.write(
                f"  annotations: {n_annotations} human (seeded from LLM, submitted)"
            )
        else:
            n_drafts = self._seed_empty_drafts(project, documents, alice, bob)
            self.stdout.write(
                f"  annotations: {n_drafts} empty human drafts "
                f"(version humaine vide — LLM = suggestions)"
            )

        # 7. Translations ---------------------------------------------------
        ts = self._declare_translations(corpus)
        if ts is not None:
            result = sync_translation_set(ts)
            self.stdout.write(
                f"  translations: set '{ts.name}' status={ts.status} "
                f"docs={result.get('documents', 0)} rows={result.get('created', 0)}"
            )

        self.stdout.write(self.style.SUCCESS("feed_db complete."))

    # ------------------------------------------------------------------ reset
    def _reset(self):
        self.stdout.write(self.style.WARNING("  --reset: clearing data tables..."))
        Review.objects.all().delete()
        Comment.objects.all().delete()
        AnnotationVersion.objects.all().delete()
        Clause.objects.all().delete()
        Annotation.objects.all().delete()
        PreClause.objects.all().delete()
        PreAnnotation.objects.all().delete()
        Assignment.objects.all().delete()
        Translation.objects.all().delete()
        TranslationSet.objects.all().delete()
        ReferenceLabel.objects.all().delete()
        Sentence.objects.all().delete()
        ProjectMembership.objects.all().delete()
        Project.objects.all().delete()
        Document.objects.all().delete()

    # ------------------------------------------------------------------ users
    def _user(self, username, role, email, is_super=False):
        user, _ = User.objects.update_or_create(
            username=username,
            defaults={
                "email": email,
                "role": role,
                "display_name": username.title(),
                "is_staff": is_super,
                "is_superuser": is_super,
            },
        )
        # Always (re)set the demo password so logins are predictable & idempotent.
        user.set_password(self.password)
        user.save(update_fields=["password"])
        return user

    # -------------------------------------------------------------- documents
    def _select_doc_names(self, options) -> list[str]:
        available = list_available_documents(settings.CLAUDETTE_DIR)
        if not available:
            return []
        if options["all"]:
            return available
        return available[: options["max_docs"]]

    def _load_documents(self, corpus, options) -> list[Document]:
        claudette_dir = Path(settings.CLAUDETTE_DIR)
        names = self._select_doc_names(options)
        documents: list[Document] = []
        for name in names:
            documents.append(load_claudette_document(corpus, claudette_dir, name))
        return documents

    # ---------------------------------------------------------- preannotations
    def _load_preannotations(self, project, documents) -> dict:
        """Return {(external_id, judge): PreAnnotation} from the real JSON tree."""
        pre_root = Path(settings.PREANNOTATIONS_DIR)
        index: dict = {}
        for judge, subdir, suffix in [
            (Judge.CLAUDE, "claude", "_claude.json"),
            (Judge.CODEX, "codex", "_codex.json"),
        ]:
            base = pre_root / subdir
            if not base.exists():
                continue
            for doc in documents:
                f = base / f"{doc.external_id}{suffix}"
                if not f.exists():
                    continue
                raw = json.loads(f.read_text(encoding="utf-8"))
                pre = ingest_preannotation(project, doc, judge, raw)
                index[(doc.external_id, judge)] = pre
        return index

    # ----------------------------------------------------------- annotations
    def _seed_empty_drafts(self, project, documents, *annotators) -> int:
        """Create EMPTY human draft annotations (one per doc × annotator).

        The human version starts empty (CONTRACT / §7): the annotator opens a
        draft and adopts LLM suggestions incrementally. No clause is copied from
        the LLM. Idempotent (get_or_create on the unique (project, doc, annotator)).
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

    def _seed_annotations(
        self, project, documents, pre_index, alice, bob, rita
    ) -> int:
        count = 0
        for i, doc in enumerate(documents):
            count += self._seed_one(
                project, doc, pre_index.get((doc.external_id, Judge.CLAUDE)),
                alice, certainty=2, comment_first=(i == 0),
            )
            count += self._seed_one(
                project, doc, pre_index.get((doc.external_id, Judge.CODEX)),
                bob, certainty=1, comment_first=False,
            )
            # One example review on the first document's alice annotation.
            if i == 0:
                self._example_review(project, doc, alice, rita)
        return count

    def _seed_one(self, project, doc, pre, annotator, certainty, comment_first) -> int:
        if pre is None:
            return 0
        existing = project.annotations.filter(
            document=doc, annotator=annotator
        ).first()
        if existing is not None:
            # Idempotent: ensure it is submitted, but never duplicate.
            if existing.status == AnnotationStatus.DRAFT:
                transition_status(existing, AnnotationStatus.SUBMITTED, annotator)
            return 0
        ann = seed_annotation_from_preannotation(pre, annotator)
        ann.global_certainty = certainty
        ann.save(update_fields=["global_certainty"])
        if comment_first:
            first_clause = ann.clauses.first()
            if first_clause is not None:
                Comment.objects.get_or_create(
                    annotation=ann, clause=first_clause, author=annotator,
                    body="Seeded from the LLM judge; verified the opening clause.",
                )
                Comment.objects.get_or_create(
                    annotation=ann, author=annotator,
                    body="Global certainty set after a first review pass.",
                    clause=None, sentence=None,
                )
        transition_status(ann, AnnotationStatus.SUBMITTED, annotator)
        return 1

    def _example_review(self, project, doc, annotator, reviewer):
        ann = project.annotations.filter(
            document=doc, annotator=annotator
        ).first()
        if ann is None or ann.reviews.exists():
            return
        if ann.status == AnnotationStatus.SUBMITTED:
            transition_status(ann, AnnotationStatus.IN_REVIEW, reviewer)
        Review.objects.create(
            annotation=ann, reviewer=reviewer, score=4,
            decision=ReviewDecision.APPROVE,
            body="Clean segmentation; themes consistent with the guidelines.",
        )
        if ann.status == AnnotationStatus.IN_REVIEW:
            transition_status(ann, AnnotationStatus.APPROVED, reviewer)

    # ---------------------------------------------------------- translations
    def _declare_translations(self, corpus) -> TranslationSet | None:
        folder = Path(settings.TRANSLATIONS_ROOT) / self.translation_folder
        if not folder.exists():
            self.stdout.write(
                f"  translations: {self.translation_folder} folder absent, skipped"
            )
            return None
        ts, _ = TranslationSet.objects.update_or_create(
            corpus=corpus,
            name="CLAUDETTE FR",
            defaults={
                "target_language": "fr",
                "folder_path": self.translation_folder,
                "mapping_strategy": "by_external_id",
                "status": "declared",
            },
        )
        return ts
