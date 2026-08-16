"""Point d'entrée : `python -m pactiva_lab run --config c.json --data d/ --out o/`.

Volontairement minimal : le runner ne connaît ni base de données ni API. Il lit des
fichiers et en écrit d'autres — c'est ce qui lui permet de tourner à l'identique en
local, sur le VPS et sur un nœud Grid'5000.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .runner import Cancelled, run_experiment


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pactiva_lab")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="exécute une expérience")
    run.add_argument("--config", required=True, help="chemin du fichier de configuration")
    run.add_argument("--data", required=True, help="dossier du dataset")
    run.add_argument("--out", required=True, help="dossier de sortie")
    run.add_argument("--progress", default=None, help="chemin du fichier de progression")
    run.add_argument("--cancel-file", default=None,
                     help="si ce fichier apparaît, le run s'arrête proprement")

    args = parser.parse_args(argv)
    if args.command != "run":
        parser.error("commande inconnue")

    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    cancel_path = Path(args.cancel_file) if args.cancel_file else None

    try:
        result = run_experiment(
            config, args.data, args.out,
            progress_path=args.progress,
            should_cancel=(lambda: cancel_path.exists()) if cancel_path else None,
        )
    except Cancelled as exc:
        print(f"ANNULÉ : {exc}", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"ÉCHEC : {exc}", file=sys.stderr)
        return 1

    metrics = result["metrics"]
    ceiling = (result.get("human_ceiling") or {}).get("value")
    print(f"tâche      : {result['task']}")
    if "preprocess" in result:
        print(f"prétrait.  : {result['preprocess']}")
    print(f"macro-F1   : {metrics.get('macro_f1')}   micro-F1 : {metrics.get('micro_f1')}")
    if ceiling is not None:
        print(f"plafond    : {ceiling}  ({result['human_ceiling'].get('metric')})")
    ci = metrics.get("macro_f1_ci")
    if ci and ci.get("low") is not None:
        print(f"IC 95%     : [{ci['low']}, {ci['high']}]  (n={ci['nResamples']} tirages)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
