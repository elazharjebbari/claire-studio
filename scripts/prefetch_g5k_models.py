"""Pré-télécharge les checkpoints HuggingFace dans le cache PARTAGÉ des frontales Grid'5000.

POURQUOI. Les nœuds de calcul Grid'5000 n'ont pas l'accès Internet dont dispose la
frontale — vérifié le 13 septembre 2026 : `curl https://huggingface.co` renvoie 200 depuis
lyon, et aucune variable `http_proxy` n'est définie. Un fine-tuning Legal-BERT lancé sans
cache pré-peuplé échouerait donc APRÈS la réservation du GPU, sur une erreur réseau.

Le cache visé est `~/.cache/huggingface` (persistant, propre à chaque site, partagé entre
tous les runs) — c'est celui que `runners/g5k.py` exporte désormais via `HF_HOME`. Il est
adressé par révision : le re-télécharger est idempotent, et un run ultérieur qui demande
le même checkpoint ne paie plus rien.

Usage (sur le serveur de production) :
    python manage.py shell < scripts/prefetch_g5k_models.py
"""

import json
import subprocess

from claire.lab.crypto import decrypt_secret
from claire.lab.g5k_ssh import temporary_ssh_key
from claire.lab.models import ComputeCredential

SITES = ("lyon", "nancy")
ENV_NAME = "pactiva-lab"

# Les checkpoints des presets GPU (`docs/pactiva-lab/specs/pipeline-presets.yaml`).
CHECKPOINTS = (
    "nlpaueb/legal-bert-base-uncased",   # legal-bert-finetune, multilabel-finetune, sequence-boundary
    "roberta-base",                      # encoders-comparison
    "microsoft/deberta-v3-base",         # encoders-comparison
    "answerdotai/ModernBERT-base",       # encoders-comparison
    "intfloat/e5-large-v2",              # embeddings-frozen, learning-curve
)

credential = ComputeCredential.objects.filter(kind="g5k").first()
if credential is None or not credential.ssh_key_encrypted:
    raise SystemExit("aucune clé SSH Grid'5000 enregistrée")

# `snapshot_download` est idempotent : relancer le script ne retélécharge que ce qui manque.
remote = f"""
set -e
module load conda 2>/dev/null || true
source activate {ENV_NAME} 2>/dev/null || conda activate {ENV_NAME}
export HF_HOME="$HOME/.cache/huggingface"
export HF_HUB_DISABLE_TELEMETRY=1
# Le transfert Xet (protocole de déduplication par blocs de HuggingFace) renvoie 404
# sur les frontales Grid'5000 — constaté le 13 septembre 2026 sur lyon ET nancy,
# alors que l'API HTTP classique répond 200. On force donc le transfert HTTP.
export HF_HUB_DISABLE_XET=1
python - <<'PYFETCH'
from huggingface_hub import snapshot_download
for repo in {list(CHECKPOINTS)!r}:
    for attempt in (1, 2):
        try:
            path = snapshot_download(repo, max_workers=1)
            print(f"OK   {{repo}} -> {{path}}")
            break
        except Exception as exc:
            if attempt == 2:
                print(f"FAIL {{repo}} : {{type(exc).__name__}} {{exc}}"[:200])
PYFETCH
echo "cache: $(du -sh $HOME/.cache/huggingface 2>/dev/null | cut -f1)"
"""

opts = ["-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null",
        "-o", "ConnectTimeout=30"]
access = f"{credential.login}@access.grid5000.fr"
report = {"login": credential.login, "sites": {}}

with temporary_ssh_key(decrypt_secret(credential.ssh_key_encrypted)) as key_path:
    for site in SITES:
        done = subprocess.run(
            ["ssh", "-i", str(key_path), *opts, access, f"ssh {site} bash -s"],
            input=remote, capture_output=True, text=True, timeout=3600,
        )
        report["sites"][site] = {
            "rc": done.returncode,
            "out": (done.stdout or "").strip().splitlines()[-8:],
            "err": (done.stderr or "").strip()[-200:] if done.returncode else "",
        }

print(json.dumps(report, ensure_ascii=False, indent=2))
