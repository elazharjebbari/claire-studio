"""Pose le modèle LLM par défaut (`prefill.judge`) sur les comptes EXISTANTS.

Le défaut de `ui_prefs.DEFAULTS` ne s'applique qu'aux comptes **neufs** : un compte déjà
créé a son blob `ui_preferences` persisté et garde donc son ancienne valeur. Cette commande
aligne l'existant, **sans écraser un choix exprimé** : elle ne touche qu'un compte dont
`prefill.judge` est absent/null **et** `prefill.asked` est faux (la modale de consentement
n'a jamais été montrée ⇒ l'utilisateur n'a jamais choisi de modèle, ni « Aucun »).

Idempotente : un second passage ne modifie plus rien.

    manage.py set_default_llm_judge [--judge fable] [--dry-run] [--force]
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from claire.accounts.ui_prefs import (
    DEFAULT_PREFILL_JUDGE,
    merge_ui_preferences,
    normalize_ui_preferences,
)
from claire.imports.models import Judge

User = get_user_model()


class Command(BaseCommand):
    help = "Aligne `prefill.judge` des comptes existants sur le modèle LLM par défaut."

    def add_arguments(self, parser):
        parser.add_argument(
            "--judge",
            default=DEFAULT_PREFILL_JUDGE,
            help=f"identifiant du juge (déf. : {DEFAULT_PREFILL_JUDGE})",
        )
        parser.add_argument(
            "--dry-run", action="store_true", help="n'écrit rien, affiche le plan"
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="écrase AUSSI les comptes ayant déjà exprimé un choix (asked=true ou juge posé)",
        )

    def handle(self, *args, **opts):
        judge = opts["judge"]
        if judge not in Judge.import_judges():
            raise CommandError(
                f"Juge inconnu : {judge!r} (connus : {', '.join(Judge.import_judges())})"
            )

        changed = skipped = 0
        for user in User.objects.all().order_by("username"):
            prefs = normalize_ui_preferences(user.ui_preferences)
            prefill = prefs.get("prefill", {})
            already = prefill.get("judge")
            expressed = bool(prefill.get("asked")) or bool(already)

            if already == judge:
                skipped += 1
                continue
            if expressed and not opts["force"]:
                self.stdout.write(
                    f"  = {user.username} : choix respecté (judge={already!r}, "
                    f"asked={prefill.get('asked')})"
                )
                skipped += 1
                continue

            self.stdout.write(f"  → {user.username} : {already!r} → {judge!r}")
            if not opts["dry_run"]:
                user.ui_preferences = merge_ui_preferences(prefs, {"prefill": {"judge": judge}})
                user.save(update_fields=["ui_preferences"])
            changed += 1

        verb = "seraient modifiés" if opts["dry_run"] else "modifiés"
        self.stdout.write(
            self.style.SUCCESS(
                f"Modèle par défaut « {judge} » : {changed} compte(s) {verb}, {skipped} inchangé(s)."
            )
        )
