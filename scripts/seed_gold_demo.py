"""Jeu de démonstration du module GOLD — reproduit la situation RÉELLE de production.

Utilisé par `scripts/gold-demo-e2e.sh` pour valider, **par l'interface**, la chaîne
complète : blocage → déblocage → politique des secondaires → arbitrage → gel du gold.

Le scénario reprend fidèlement les quatre configurations qui posent problème en vrai :

  phrase 0  accord strict des 3 annotateurs, MÊMES secondaires  → auto_1click ;
            sert à démontrer la politique des secondaires (advisory les jette).
  phrase 1  majorité 2/3                                         → auto ;
  phrase 2  ÉGALITÉ 1-1-1 (trois thèmes différents)              → manual + tie ;
            c'est le cas des 462 arbitrages réels de la campagne.
  phrase 3  couverte par UN SEUL annotateur                      → jamais auto-résolue.

Et surtout : un annotateur ASSIGNÉ qui n'a jamais annoté (comme `jc.lamirel`), plus un
LEAD qui a réellement annoté (comme le responsable de campagne) — la combinaison exacte
qui gelait les 50 documents.

Lecture/écriture sur la base LOCALE de démonstration uniquement.
"""

import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402

from claire.annotations.models import (  # noqa: E402
    Annotation,
    AnnotationStatus,
    Clause,
    ClauseRole,
    ClauseTheme,
)
from claire.corpora.models import Corpus, Document, Sentence  # noqa: E402
from claire.projects.models import (  # noqa: E402
    Assignment,
    MembershipRole,
    Project,
    ProjectMembership,
)
from claire.schemes.models import LabelScheme, Theme  # noqa: E402

User = get_user_model()

SLUG = "demo-gold"
PASSWORD = "demo-gold-e2e"  # compte de DÉMONSTRATION local, jamais déployé

THEMES = [
    ("TERMINATION", "Résiliation", "#F97316"),
    ("LIMITATION_LIABILITY", "Limitation de responsabilité", "#DC2626"),
    ("MODIFICATION_OF_TERMS", "Modification des conditions", "#F59E0B"),
    ("FEES_PAYMENT", "Frais & paiement", "#10B981"),
    ("PREAMBLE_SCOPE", "Préambule & périmètre", "#8B5CF6"),
    ("MISC_BOILERPLATE", "Boilerplate divers", "#94A3B8"),
]

SENTENCES = [
    "We may terminate your account at any time and for any reason, without notice.",
    "You agree to pay all fees associated with your subscription before the due date.",
    "The provider reserves the right to modify these terms, limit its liability and "
    "define the scope of the service at its sole discretion.",
    "These terms are governed by the laws of the State of California.",
]

# (annotateur, {index: (primaire, [secondaires])}) — cf. le tableau du docstring.
VOTES = {
    "demo.alice": {
        0: ("TERMINATION", ["FEES_PAYMENT"]),
        1: ("FEES_PAYMENT", []),
        2: ("MODIFICATION_OF_TERMS", []),
        3: ("MISC_BOILERPLATE", []),
    },
    "demo.bob": {
        0: ("TERMINATION", ["FEES_PAYMENT"]),
        1: ("FEES_PAYMENT", []),
        2: ("LIMITATION_LIABILITY", []),
    },
    # Le LEAD a réellement annoté (comme en production).
    "demo.lead": {
        0: ("TERMINATION", ["FEES_PAYMENT"]),
        1: ("TERMINATION", []),
        2: ("PREAMBLE_SCOPE", []),
    },
}


def reset() -> None:
    """Repart d'un état propre : le jeu de démonstration est jetable et idempotent.

    Les comptes sont référencés par `ActivityEvent.actor` en PROTECT (la piste d'audit ne
    doit jamais disparaître par effet de bord) : on purge donc d'abord les événements des
    comptes de démonstration, puis les comptes."""
    from claire.audit.models import ActivityEvent

    Project.objects.filter(slug=SLUG).delete()
    Corpus.objects.filter(slug=SLUG).delete()
    LabelScheme.objects.filter(slug=SLUG).delete()
    demo_users = User.objects.filter(username__startswith="demo.")
    ActivityEvent.objects.filter(actor__in=demo_users).delete()
    demo_users.delete()


def build() -> dict:
    scheme = LabelScheme.objects.create(slug=SLUG, name="Démo GOLD", version="1.0.0")
    themes = {
        code: Theme.objects.create(
            scheme=scheme, code=code, label=label, color=color, order=i
        )
        for i, (code, label, color) in enumerate(THEMES)
    }
    corpus = Corpus.objects.create(slug=SLUG, name="Démo GOLD")
    document = Document.objects.create(
        corpus=corpus, external_id="DemoToS", title="Conditions d'utilisation (démo)",
        n_sentences=len(SENTENCES),
    )
    sentences = {
        i: Sentence.objects.create(document=document, index=i, raw_text=text)
        for i, text in enumerate(SENTENCES)
    }

    project = Project.objects.create(
        slug=SLUG, name="Démonstration — résolution GOLD", corpus=corpus, scheme=scheme
    )

    users = {}
    for username in (*VOTES, "demo.absent"):
        user = User.objects.create_user(
            username=username, password=PASSWORD, email=f"{username}@example.test"
        )
        users[username] = user
        role = MembershipRole.LEAD if username == "demo.lead" else MembershipRole.ANNOTATOR
        ProjectMembership.objects.create(project=project, user=user, role=role)
        Assignment.objects.create(project=project, document=document, assignee=user)

    # `demo.absent` est ASSIGNÉ mais n'annote JAMAIS : c'est lui qui gèle la résolution
    # tant que les participants attendus ne sont pas déclarés.
    for username, per_index in VOTES.items():
        annotation = Annotation.objects.create(
            project=project, document=document, annotator=users[username],
            status=AnnotationStatus.SUBMITTED,
        )
        for index, (primary, secondaries) in per_index.items():
            clause = Clause.objects.create(
                annotation=annotation, anchor_sentence=sentences[index],
                theme=themes[primary], validated=True,
            )
            ClauseTheme.objects.create(
                clause=clause, theme=themes[primary], role=ClauseRole.PRIMARY
            )
            for code in secondaries:
                ClauseTheme.objects.create(
                    clause=clause, theme=themes[code], role=ClauseRole.SECONDARY
                )

    return {"project": project.slug, "document": document.external_id}


if __name__ == "__main__":
    reset()
    info = build()
    print(f"seed ok: projet={info['project']} document={info['document']}")
