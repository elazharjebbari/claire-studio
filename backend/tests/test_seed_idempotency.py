"""Le seed de démonstration doit être un no-op au second passage."""

import pytest
from django.apps import apps
from django.core.management import call_command
from django.db import connection

pytestmark = pytest.mark.django_db(transaction=True)


def _database_state() -> tuple:
    """Capture les lignes de tous les modèles, indépendamment du moteur SQL."""
    tables = set(connection.introspection.table_names())
    state = []
    for model in apps.get_models(include_auto_created=True):
        if model._meta.proxy or not model._meta.managed or model._meta.db_table not in tables:
            continue
        fields = tuple(field.attname for field in model._meta.concrete_fields)
        rows = tuple(model._base_manager.order_by(model._meta.pk.attname).values_list(*fields))
        state.append((model._meta.label_lower, fields, rows))
    return tuple(sorted(state))


def test_seed_demo_second_pass_does_not_mutate_database(settings):
    settings.SEED_HUMAN_FROM_LLM = False
    call_command("seed_demo", max_docs=2, verbosity=0)
    first = _database_state()

    call_command("seed_demo", max_docs=2, verbosity=0)

    assert _database_state() == first
