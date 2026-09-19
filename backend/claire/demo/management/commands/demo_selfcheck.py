"""Contrôle de bout en bout de la démonstration : jeu figé, modèle, une classification réelle."""
import json
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from claire.demo import runner, services


class Command(BaseCommand):
    help = "Vérifie le jeu figé, le modèle servi et exécute une classification de trois phrases."

    def add_arguments(self, parser):
        parser.add_argument("--model", default=None, help="dossier du modèle (défaut : DEMO_MODEL_DIR)")

    def handle(self, *args, **options):
        contracts = services.list_contracts()
        if len(contracts) != 17:
            raise CommandError(f"population hold-out : {len(contracts)} contrats trouvés (attendu 17) — "
                               f"jeu figé : {services.dataset_dir()}")
        self.stdout.write(f"jeu figé OK : {services.dataset_dir()} — 17 contrats hold-out")
        detail = services.contract_detail(contracts[0]["document"])
        annotators = {v["annotator"] for s in detail["sentences"] for v in s["votes"]}
        if any(not a.startswith("A") for a in annotators):
            raise CommandError(f"pseudonymes attendus, obtenu {sorted(annotators)}")
        self.stdout.write(f"pseudonymes OK : {sorted(annotators)}")
        model_dir = options["model"] or getattr(settings, "DEMO_MODEL_DIR", "")
        if not Path(str(model_dir), "model_config.json").exists():
            raise CommandError(f"modèle introuvable : {model_dir!r} (DEMO_MODEL_DIR)")
        with tempfile.TemporaryDirectory() as tmp:
            inp = Path(tmp) / "in.json"
            out = Path(tmp) / "out.json"
            inp.write_text(json.dumps({"text": "We may terminate your account at any time without notice. "
                                               "Fees are non refundable. This agreement is governed by the laws of Delaware."}))
            import subprocess
            cmd = runner._command(str(model_dir), inp, out)
            completed = subprocess.run(cmd, cwd=str(runner.research_root()), capture_output=True, text=True,
                                       timeout=int(getattr(settings, "DEMO_JOB_TIMEOUT", 120)),
                                       env={**__import__("os").environ, "HF_HUB_OFFLINE": "1",
                                            "PYTHONPATH": str(runner.research_root())})
            if completed.returncode != 0:
                raise CommandError(f"predict a échoué : {completed.stderr[-800:]}")
            result = json.loads(out.read_text())
        labels = [s["label"] for s in result["sentences"]]
        self.stdout.write(f"modèle OK : {result['n_sentences']} phrases → {labels} en {result['timing_s']} s "
                          f"(segmenteur {result.get('segmenter')})")
        self.stdout.write(self.style.SUCCESS("demo_selfcheck : tout est en place"))
