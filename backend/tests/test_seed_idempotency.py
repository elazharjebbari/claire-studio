"""Le seed de démonstration doit être un no-op au second passage."""

import pytest
from django.core.management import call_command
from django.db import connection

pytestmark = pytest.mark.django_db(transaction=True)


def _sqlite_dump() -> tuple[str, ...]:
    assert connection.vendor == "sqlite"
    return tuple(connection.connection.iterdump())


def test_seed_demo_second_pass_does_not_mutate_database(settings):
    settings.SEED_HUMAN_FROM_LLM = False
    call_command("seed_demo", max_docs=2, verbosity=0)
    first = _sqlite_dump()

    call_command("seed_demo", max_docs=2, verbosity=0)

    assert _sqlite_dump() == first
