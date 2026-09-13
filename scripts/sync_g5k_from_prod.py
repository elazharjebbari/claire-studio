"""Synchronise le package d'expérimentation vers Grid'5000 DEPUIS LA PRODUCTION.

Variante de `scripts/sync_g5k.sh` pour le serveur : la clé SSH Grid'5000 y est stockée
chiffrée (`ComputeCredential`), déchiffrée en mémoire le temps du transfert, jamais écrite
ailleurs que dans un fichier temporaire à permissions restreintes (même mécanisme que le
runner `g5k.py`).

Pourquoi c'est nécessaire : `~/pactiva-src` sur les frontales n'est PAS couvert par le
déploiement de la plateforme. Constaté le 13 septembre 2026, les frontales portaient encore
la version du 14 août — sans l'axe de taxonomie. Le garde-fou `assert_capabilities` fait
désormais échouer ce cas au lieu de produire des chiffres faux ; ce script le corrige.

Usage (sur le serveur) :
    python manage.py shell < scripts/sync_g5k_from_prod.py
"""

import hashlib
import json
import subprocess
from pathlib import Path

from claire.lab.crypto import decrypt_secret
from claire.lab.g5k_ssh import temporary_ssh_key
from claire.lab.models import ComputeCredential

ROOT = Path("/var/www/claire-studio")
SITES = ("lyon", "nancy")
REMOTE_DIR = "pactiva-src"

PKG_SRC = ROOT / "research" / "pactiva_lab"
SPEC_SRC = ROOT / "frontend" / "src" / "lib" / "taxonomy" / "taxonomies.json"

credential = ComputeCredential.objects.filter(kind="g5k").first()
if credential is None or not credential.ssh_key_encrypted:
    raise SystemExit("aucune clé SSH Grid'5000 enregistrée")

spec_sha = hashlib.sha256(SPEC_SRC.read_bytes()).hexdigest()
report = {"login": credential.login, "specSha": spec_sha[:16], "sites": {}}

with temporary_ssh_key(decrypt_secret(credential.ssh_key_encrypted)) as key_path:
    ssh_opts = [
        "-i", str(key_path),
        "-o", "StrictHostKeyChecking=no",
        "-o", "UserKnownHostsFile=/dev/null",
        "-o", "ConnectTimeout=30",
    ]
    access = f"{credential.login}@access.grid5000.fr"
    rsh = "ssh " + " ".join(ssh_opts)

    for site in SITES:
        entry = {}
        # `~` côté access.grid5000.fr pointe le home PARTAGÉ du site visé via le préfixe
        # `<site>/` : c'est la convention déjà utilisée par le runner pour le dataset.
        target = f"{access}:{site}/{REMOTE_DIR}/pactiva_lab/"

        # --delete : un module retiré de la source doit disparaître à distance, sinon il
        # resterait importable et masquerait une régression.
        push = subprocess.run(
            ["rsync", "-az", "--delete", "--mkpath",
             "--exclude", "__pycache__", "--exclude", "*.pyc", "--exclude", ".pytest_cache",
             "-e", rsh, f"{PKG_SRC}/", target],
            capture_output=True, text=True, timeout=900,
        )
        entry["package"] = "ok" if push.returncode == 0 else push.stderr[-300:]

        spec = subprocess.run(
            ["rsync", "-az", "-e", rsh, str(SPEC_SRC),
             f"{access}:{site}/{REMOTE_DIR}/pactiva_lab/taxonomies.json"],
            capture_output=True, text=True, timeout=300,
        )
        entry["spec"] = "ok" if spec.returncode == 0 else spec.stderr[-300:]

        # Vérification : le distant porte-t-il bien la version attendue ?
        check = subprocess.run(
            ["ssh", *ssh_opts, access,
             f"ssh {site} 'cd ~/{REMOTE_DIR} && "
             "echo taxonomy=$(test -f pactiva_lab/taxonomy.py && echo PRESENT || echo ABSENT) && "
             "echo spec=$(sha256sum pactiva_lab/taxonomies.json 2>/dev/null | cut -c1-16) && "
             "echo caps=$(grep -c CAPABILITIES pactiva_lab/__init__.py 2>/dev/null || echo 0) && "
             "echo axe=$(grep -c taxonomy pactiva_lab/data.py 2>/dev/null || echo 0)'"],
            capture_output=True, text=True, timeout=180,
        )
        entry["verification"] = (check.stdout or check.stderr).strip()[:300]
        report["sites"][site] = entry

print(json.dumps(report, ensure_ascii=False))
