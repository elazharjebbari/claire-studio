"""Taxonomies de thèmes — projection PURE T20 → T14 / T11 / T10 (côté Python).

Miroir exact de `frontend/src/lib/taxonomy/index.ts` : les deux lisent le MÊME fichier de
spécification (`frontend/src/lib/taxonomy/taxonomies.json`), sur le modèle déjà établi dans
ce projet par les cas d'or du moteur gold (un JSON partagé, lu par pytest ET par vitest,
avec un test de parité de chaque côté).

Pourquoi ici et pas en base : **T20 est canonique**. Les autres taxonomies ne sont jamais
des données — ce sont des projections déterministes, appliquées au chargement d'un dataset
pour les expérimentations, et à l'affichage pour l'interface. Aucune annotation, aucune
décision gold n'est réécrite.

Reproductibilité : `spec_fingerprint()` donne l'empreinte du fichier de spécification. Tout
résultat publié cite (dataset, taxonomie, empreinte de spécification, preset, run) ; une
modification des mappings change l'empreinte et rend la divergence immédiatement visible.
"""

from __future__ import annotations

import hashlib
import json
import os
from functools import lru_cache
from pathlib import Path

def _spec_candidates() -> list:
    """Où chercher la spécification, par ordre de priorité.

    Le package doit fonctionner DANS le dépôt (développement, CI) comme DÉPLOYÉ SEUL
    (Grid'5000 : `~/pactiva-src/pactiva_lab/` sans arborescence frontend). Sans cette
    résolution multi-chemins, tout run distant échouerait au premier appel de projection
    — y compris un run T20, puisque `project_theme` interroge la spécification pour
    connaître la taxonomie canonique.
    """
    candidates = []
    override = os.environ.get("PACTIVA_TAXONOMY_SPEC")
    if override:
        candidates.append(Path(override))
    # 1. Dépôt complet : research/pactiva_lab/ → racine → frontend/…
    candidates.append(
        Path(__file__).resolve().parents[2]
        / "frontend" / "src" / "lib" / "taxonomy" / "taxonomies.json"
    )
    # 2. Copie DÉPLOYÉE à côté du package (posée par `scripts/sync_g5k.sh`, jamais
    #    éditée à la main : c'est un artefact de transfert, pas une seconde source).
    candidates.append(Path(__file__).resolve().parent / "taxonomies.json")
    return candidates


def spec_path() -> Path:
    for candidate in _spec_candidates():
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(
        "spécification de taxonomie introuvable. Cherché : "
        + " ; ".join(str(c) for c in _spec_candidates())
        + ". Sur un déploiement autonome (Grid'5000), synchronisez le package avec "
        "`scripts/sync_g5k.sh`, qui dépose la spécification à côté du package."
    )


# Compat : conservé pour les appelants existants (résolu à l'import, jamais lu ici).
SPEC_PATH = _spec_candidates()[1]


@lru_cache(maxsize=1)
def load_spec(path: str | None = None) -> dict:
    """Spécification complète (mémoïsée). `path` permet de tester une spec alternative."""
    target = Path(path) if path else spec_path()
    return json.loads(target.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def spec_fingerprint() -> str:
    """SHA-256 des octets de la spécification — à journaliser avec tout résultat publié."""
    return hashlib.sha256(spec_path().read_bytes()).hexdigest()


def canonical_id() -> str:
    return load_spec()["canonical"]


def taxonomy_ids() -> list[str]:
    return [t["id"] for t in load_spec()["taxonomies"]]


def get_taxonomy(taxonomy_id: str) -> dict:
    for t in load_spec()["taxonomies"]:
        if t["id"] == taxonomy_id:
            return t
    raise KeyError(f"taxonomie inconnue : {taxonomy_id!r}")


@lru_cache(maxsize=8)
def projection(taxonomy_id: str) -> dict:
    """Index thème T20 → code de catégorie pour cette taxonomie."""
    return {
        member: category["code"]
        for category in get_taxonomy(taxonomy_id)["categories"]
        for member in category["members"]
    }


def project_theme(code: str | None, taxonomy_id: str) -> str:
    """Projette un thème T20. Un code inconnu est renvoyé TEL QUEL (jamais escamoté)."""
    if not code:
        return ""
    if taxonomy_id == canonical_id():
        return code
    return projection(taxonomy_id).get(code, code)


def project_theme_set(codes, taxonomy_id: str) -> list:
    """Projette un JEU de thèmes en préservant l'ordre et en DÉDUPLIQUANT.

    Deux thèmes T20 distincts peuvent tomber dans la même macro-catégorie : la clause
    devient alors mono-étiquette. C'est le comportement voulu, et c'est exactement ce que
    mesure la baisse du taux multi-label après fusion — ne jamais « compenser » ici."""
    seen = set()
    out = []
    for code in codes:
        projected = project_theme(code, taxonomy_id)
        if projected and projected not in seen:
            seen.add(projected)
            out.append(projected)
    return out


def project_primary_and_secondaries(primary, secondaries, taxonomy_id: str) -> tuple:
    """Projette (primaire, secondaires) en garantissant l'invariant « un secondaire n'est
    jamais égal au primaire ».

    C'est LE piège de la fusion : un secondaire peut devenir identique au primaire une fois
    projeté (ex. USER_CONTENT et LICENSE_IP → CONTENT_IP). Le laisser passer gonflerait
    artificiellement la cardinalité et fausserait α-MASI comme le taux multi-label."""
    projected_primary = project_theme(primary, taxonomy_id)
    projected_secondaries = [
        code
        for code in project_theme_set(secondaries or [], taxonomy_id)
        if code != projected_primary
    ]
    return projected_primary, projected_secondaries


def categories(taxonomy_id: str) -> list:
    return get_taxonomy(taxonomy_id)["categories"]


def category_codes(taxonomy_id: str) -> list:
    return [c["code"] for c in categories(taxonomy_id)]


def members_of(code: str, taxonomy_id: str) -> list:
    for category in categories(taxonomy_id):
        if category["code"] == code:
            return list(category["members"])
    return []


# ── Populations figées (anti-contamination du hold-out) ──────────────────────
def population(name: str) -> dict:
    """`designSet` (33 documents de conception) ou `holdout` (17 documents de validation)."""
    pops = load_spec()["populations"]
    if name not in pops:
        raise KeyError(f"population inconnue : {name!r} (attendu : {sorted(pops)})")
    return pops[name]


def population_documents(name: str) -> set:
    return set(population(name)["documents"])


def is_holdout(external_id: str) -> bool:
    return external_id in population_documents("holdout")


def taxonomy_of(config: dict) -> str:
    """Taxonomie demandée par la configuration (`data.taxonomy`), T20 par défaut.

    T20 = canonique (aucune projection). Toute autre valeur projette au CHARGEMENT : les
    fichiers du dataset restent intacts, les plis ne bougent pas, et deux runs de
    taxonomies différentes sont donc APPARIÉS par construction."""
    return str(((config.get("data") or {}).get("taxonomy")) or "T20")


def population_of(config: dict) -> str | None:
    """Population de documents (`data.population`) : `designSet`, `holdout`, ou None (tout).

    C'est la garde anti-contamination : les 17 documents de validation n'ont pas servi à
    concevoir les fusions, et un résultat publié doit dire sur laquelle des deux
    populations il a été mesuré."""
    value = (config.get("data") or {}).get("population")
    return str(value) if value else None


def filter_population(rows: list, population: str | None, key=lambda r: r["document"]) -> list:
    """Restreint des lignes à une population figée (spécification de taxonomie)."""
    if not population:
        return rows
    from .taxonomy import population_documents

    allowed = population_documents(population)
    return [r for r in rows if key(r) in allowed]
