"""Sélection informée de cluster GPU — pur, aucun appel réseau ici.

La Reference API de Grid'5000 expose `gpu_devices` par nœud (modèle, mémoire en
octets, `compute_capability`) — voir `docs/pactiva-g5k/research/03_API_REST.md` §3.3.
Ce module filtre un catalogue DÉJÀ récupéré (par `g5k_client.py` en production, ou par
une fixture de données réelles en test/dev — voir
`docs/pactiva-g5k/specs/g5k-clusters-gpu-sample.json`) pour ne proposer que les
clusters dont la VRAM convient au modèle qu'on veut fine-tuner.

Legal-BERT-base (~440 Mo, 110M paramètres) tient dans 8 Go de VRAM ; les presets de
`pipeline-presets.yaml` demandent explicitement des checkpoints de cette taille — voir
`docs/pactiva-g5k/06_ANALYSE_BESOIN_PACTIVA.md` §1. Inutile de cibler les clusters les
plus contendus (H100/H200/MI300X, réservés aux LLM) pour ce besoin.
"""

from __future__ import annotations

BYTES_PER_GB = 1024**3


def _gpus_of(node: dict) -> list[dict]:
    return list((node.get("gpu_devices") or {}).values())


def gpu_clusters_for(min_vram_gb: float, nodes: dict[str, dict]) -> list[dict]:
    """Filtre `nodes` (mapping `node_uid -> {"site", "cluster", "node": <JSON
    reference-repository>}`) : ne garde que les nœuds ayant au moins un GPU dont la
    mémoire est >= `min_vram_gb`. Trie par VRAM du meilleur GPU du nœud, croissante —
    le premier résultat est le plus petit cluster qui convient, pour ne pas
    monopoliser inutilement une ressource contendue.

    Un nœud sans `gpu_devices` (pas de GPU) est exclu silencieusement : ce n'est pas
    une exclusion à motiver comme pour une sélection d'annotations, juste un filtre
    matériel.
    """
    min_bytes = min_vram_gb * BYTES_PER_GB
    matches = []
    for entry in nodes.values():
        node = entry.get("node") or {}
        gpus = _gpus_of(node)
        if not gpus:
            continue
        best_gpu = max(gpus, key=lambda g: g.get("memory") or 0)
        if (best_gpu.get("memory") or 0) < min_bytes:
            continue
        matches.append(
            {
                "site": entry.get("site"),
                "cluster": entry.get("cluster"),
                "node": node.get("uid"),
                "gpuModel": best_gpu.get("model"),
                "gpuVramGb": round((best_gpu.get("memory") or 0) / BYTES_PER_GB, 1),
                "gpuCount": len(gpus),
            }
        )
    matches.sort(key=lambda m: m["gpuVramGb"])
    return matches
