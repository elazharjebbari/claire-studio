"""`build_run_script` (`runners/g5k.py`) — le script bash exécuté SUR le nœud distant.

Jamais vérifié avant cette batterie (les tests de `Grid5000Backend.submit` ne
contrôlaient que l'EXISTENCE du fichier `run.sh`, pas son contenu) alors que c'est le
point de sécurité documenté du module : sans le garde-fou `require_gpu`, un désaccord
CUDA/pytorch-cuda rend le GPU invisible et le job tourne SIX HEURES sur CPU sans rien
signaler (docs/pactiva-g5k/research/05_MONITORING_ML_GPU.md §4.3-4.4). C'est une
fonction pure — aucun réseau, aucune DB — donc la priorité pour une couverture dense
avant l'arrivée d'identifiants réels : c'est le seul endroit où le run peut échouer de
façon COÛTEUSE (walltime consommé) plutôt qu'immédiatement.
"""

from claire.lab.runners.g5k import build_run_script


def test_require_gpu_ajoute_le_garde_fou_avec_les_codes_de_sortie_dedies():
    script = build_run_script(run_id="r1", require_gpu=True, env_name="pactiva-lab", workdir="~/pactiva")
    assert "nvidia-smi" in script
    assert "exit 64" in script
    assert "torch.cuda.is_available()" in script
    assert "exit 65" in script


def test_sans_require_gpu_aucun_garde_fou_ni_import_torch():
    """Un job CPU (baselines tfidf) ne doit jamais dépendre de `nvidia-smi` — un nœud
    sans pilote GPU ferait échouer un job qui n'en a pourtant pas besoin."""
    script = build_run_script(run_id="r1", require_gpu=False, env_name="pactiva-lab", workdir="~/pactiva")
    assert "nvidia-smi" not in script
    assert "exit 64" not in script
    assert "exit 65" not in script


def test_le_garde_fou_precede_toujours_le_lancement_du_pipeline():
    """Un garde-fou APRÈS `python -m pactiva_lab run` ne protège plus rien — l'entraînement
    aurait déjà tourné sur CPU pendant des heures avant d'être détecté."""
    script = build_run_script(run_id="r1", require_gpu=True, env_name="pactiva-lab", workdir="~/pactiva")
    assert script.index("nvidia-smi") < script.index("python -m pactiva_lab run")


def test_marqueur_de_fin_normale_toujours_present():
    """`_SENTINEL` distingue une fin normale d'une coupure par walltime — sans lui,
    `Grid5000Backend.fetch` ne peut jamais savoir si le run est allé au bout."""
    for require_gpu in (True, False):
        script = build_run_script(run_id="r1", require_gpu=require_gpu, env_name="e", workdir="~/pactiva")
        assert 'echo "DONE" > results/_SENTINEL' in script


def test_set_euo_pipefail_pour_qu_un_echec_intermediaire_ne_soit_jamais_silencieux():
    script = build_run_script(run_id="r1", require_gpu=False, env_name="e", workdir="~/pactiva")
    assert script.startswith("#!/usr/bin/env bash\nset -euo pipefail\n")


def test_run_id_et_workdir_composent_le_chemin_distant():
    script = build_run_script(run_id="abc-123", require_gpu=False, env_name="e", workdir="~/monworkdir")
    assert 'RUN_DIR="$HOME/monworkdir/runs/abc-123"' in script


def test_le_tilde_est_jamais_laisse_litteral_entre_guillemets_doubles():
    """Bug réel trouvé le 14 août 2026 sur un vrai job Grid'5000 (site Rennes) : `~` ne
    s'étend JAMAIS entre guillemets doubles en bash — `RUN_DIR="~/pactiva/..."` laissait
    un tilde littéral dans la valeur, et `cd "$RUN_DIR"` échouait avec
    `No such file or directory` (confirmé dans le stderr OAR du job réel). `$HOME` est
    une variable, elle s'étend normalement entre guillemets — c'est le remplacement
    correct, fait ici EN PYTHON avant d'écrire le script plutôt qu'en bash."""
    script = build_run_script(run_id="r1", require_gpu=False, env_name="e", workdir="~/pactiva")
    assert '"~' not in script
    assert 'RUN_DIR="$HOME/pactiva/runs/r1"' in script


def test_workdir_sans_tilde_traverse_sans_modification():
    script = build_run_script(
        run_id="r1", require_gpu=False, env_name="e", workdir="/mnt/group_storage/pactiva",
    )
    assert 'RUN_DIR="/mnt/group_storage/pactiva/runs/r1"' in script


def test_env_name_avec_espace_est_protege_par_shlex_quote():
    """`env_name` vient de la config utilisateur (`compute.g5k.env_name`) — un nom
    contenant un espace ou un métacaractère shell ne doit ni casser le script ni
    permettre l'injection d'une commande arbitraire sur le nœud distant."""
    script = build_run_script(run_id="r1", require_gpu=False, env_name="pactiva lab", workdir="~/pactiva")
    assert "'pactiva lab'" in script
    assert "source activate 'pactiva lab'" in script or "conda activate 'pactiva lab'" in script


def test_env_name_avec_metacaractere_shell_ne_permet_pas_l_injection():
    hostile = "x; rm -rf ~"
    script = build_run_script(run_id="r1", require_gpu=False, env_name=hostile, workdir="~/pactiva")
    # shlex.quote entoure la valeur hostile de guillemets simples : le `;` reste à
    # l'intérieur d'une chaîne littérale, jamais interprété comme séparateur de commande.
    quoted = f"'{hostile}'"
    assert quoted in script


def test_hf_home_isole_par_run_pour_ne_jamais_partager_le_cache_entre_jobs():
    script = build_run_script(run_id="r42", require_gpu=False, env_name="e", workdir="~/pactiva")
    assert 'export HF_HOME="${HF_HOME:-$RUN_DIR/.hf}"' in script


def test_ld_library_path_precede_le_garde_fou_gpu():
    """Bug réel trouvé le 14 août 2026 sur un vrai nœud GPU (cluster gemini, lyon) :
    sans ce réglage, `import torch` échoue avec `GLIBCXX_3.4.29' not found` (le
    libstdc++ SYSTÈME du nœud est plus ancien que celui attendu par l'environnement
    conda) — AVANT même d'atteindre le garde-fou GPU, qui plante donc lui aussi au lieu
    de rapporter proprement l'absence de GPU (code 64/65)."""
    script = build_run_script(run_id="r1", require_gpu=True, env_name="e", workdir="~/pactiva")
    assert 'export LD_LIBRARY_PATH="${CONDA_PREFIX:-}/lib:${LD_LIBRARY_PATH:-}"' in script
    assert script.index("LD_LIBRARY_PATH") < script.index("nvidia-smi")
