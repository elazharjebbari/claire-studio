"""Intégration du 4ᵉ juge LLM **Fable** (session v9.2 « fable »).

Prouve, de bout en bout, que Fable n'est pas un cas particulier mais un juge de plein
droit : import par défaut, idempotence, absence de régression sur les juges déjà en base,
promotion en compte annotateur, présence dans la concordance et le triage à N juges.

Prouve AUSSI le correctif structurel qui a rendu l'ajout possible : la nomenclature des
juges est DÉRIVÉE d'une source unique (`imports.models.Judge`) et non recopiée. Le test
`test_aucune_liste_de_juges_en_dur` échoue si quelqu'un réintroduit une liste littérale —
c'est cette duplication qui avait fait manquer Mistral dans `frontend/src/types/contract.ts`.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from django.core.management import call_command

from claire.imports.models import Judge, PreAnnotation, PreClause

pytestmark = pytest.mark.django_db

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent

# Extrait LITTÉRAL de data/preannotations/fable/Atlas_fable.json (3 premiers segments,
# 6 premières phrases) : fidèle au format réellement produit par la session 4, mais
# embarqué pour que le test tienne sans le corpus (data/preannotations est gitignoré).
ATLAS_FABLE = {
    "doc": "Atlas",
    "judge": "fable",
    "version": "v9.2-nature-derived",
    "document_plan": {
        "estimated_n_blocks": 18,
        "rationale_global": "ToS narratif sans numérotation de sections.",
        "segments": [
            {
                "start_id": 0,
                "theme": "META",
                "rationale": "identité de l'opérateur du site",
                "evidence_span": "owned and operated by atlas solutions group inc.",
            },
            {
                "start_id": 1,
                "theme": "PREAMBLE_SCOPE",
                "rationale": "clause d'acceptation des conditions",
                "evidence_span": "you understand and agree to accept and adhere to the following terms and conditions",
            },
            {
                "start_id": 3,
                "theme": "MODIFICATION_OF_TERMS",
                "rationale": "droit unilatéral de modification",
                "evidence_span": "we reserve the right to change this user agreement",
            },
        ],
    },
    "annotations": [
        {
            "id": 0,
            "theme": "META",
            "block_id": 0,
            "is_block_start": True,
            "rationale": "ouverture par l'identité de l'entité exploitante",
            "rationale_codes": {
                "decision_trigger": "document_start",
                "relation_to_prev": "document_start",
                "evidence_span": "owned and operated by atlas solutions group inc.",
                "revised_from_plan": False,
                "confidence": 0.9,
            },
            "legal_nature": "META",
            "legal_nature_marker": "inc.",
        },
        {
            "id": 1,
            "theme": "PREAMBLE_SCOPE",
            "block_id": 1,
            "is_block_start": True,
            "rationale": "clause d'acceptation qui ouvre le champ contractuel",
            "rationale_codes": {
                "decision_trigger": "topic_keyword",
                "relation_to_prev": "opens_new_topic",
                "evidence_span": "you understand and agree to accept and adhere to the following terms and conditions",
                "revised_from_plan": False,
                "confidence": 0.92,
            },
            "legal_nature": "UNKNOWN",
            "legal_nature_marker": "",
        },
        {"id": 2, "theme": "META", "block_id": 2, "is_block_start": True,
         "rationale": "date d'entrée en vigueur",
         "rationale_codes": {"decision_trigger": "topic_keyword",
                             "relation_to_prev": "opens_new_topic",
                             "evidence_span": "in effect as of mar 02 , 2015",
                             "revised_from_plan": False, "confidence": 0.8},
         "legal_nature": "UNKNOWN", "legal_nature_marker": ""},
        {"id": 3, "theme": "MODIFICATION_OF_TERMS", "block_id": 3, "is_block_start": True,
         "rationale": "droit unilatéral de modification",
         "rationale_codes": {"decision_trigger": "topic_keyword",
                             "relation_to_prev": "opens_new_topic",
                             "evidence_span": "we reserve the right to change this user agreement",
                             "revised_from_plan": False, "confidence": 0.93},
         "legal_nature": "OBLIGATION", "legal_nature_marker": "reserve the right"},
        {"id": 4, "theme": "MODIFICATION_OF_TERMS", "block_id": 3, "is_block_start": False,
         "reason": "prolongement", "legal_nature": "UNKNOWN", "legal_nature_marker": ""},
    ],
}


def _write_judge_file(root: Path, judge: str, doc_id: str, raw: dict) -> Path:
    jdir = root / judge
    jdir.mkdir(parents=True, exist_ok=True)
    path = jdir / f"{doc_id}_{judge}.json"
    path.write_text(json.dumps(raw), encoding="utf-8")
    return path


def _fable_payload(doc_id: str) -> dict:
    raw = json.loads(json.dumps(ATLAS_FABLE))
    raw["doc"] = doc_id
    return raw


# ── 1. Nomenclature : une seule source de vérité ─────────────────────────────────
def test_fable_est_dans_la_nomenclature():
    assert Judge.FABLE.value == "fable"
    assert "fable" in Judge.values
    # Ordre d'AFFICHAGE (taille de modèle décroissante), pas ordre d'ajout.
    assert Judge.import_judges() == ["fable", "claude", "codex", "mistral"]
    # `other` est un fourre-tout, jamais un dossier de données à importer.
    assert "other" not in Judge.import_judges()


def test_ordre_d_affichage_est_par_taille_de_modele():
    from claire.imports.models import JUDGE_DISPLAY_ORDER, judge_display_rank

    assert JUDGE_DISPLAY_ORDER == ("fable", "claude", "codex", "mistral")
    assert sorted(["mistral", "fable", "codex", "claude"], key=judge_display_rank) == [
        "fable", "claude", "codex", "mistral",
    ]
    # Un juge non classé ne disparaît pas : il passe en fin de liste.
    assert sorted(["zzz", "fable"], key=judge_display_rank) == ["fable", "zzz"]


def test_known_judges_est_derive_de_judge():
    """La config gold ne recopie plus la liste : elle la dérive (sinon un poids par juge
    déclaré pour Fable serait silencieusement supprimé à la validation)."""
    from claire.gold.config import KNOWN_JUDGES

    assert KNOWN_JUDGES == set(Judge.values)
    assert "fable" in KNOWN_JUDGES


def test_choices_du_champ_judge_incluent_fable():
    field = PreAnnotation._meta.get_field("judge")
    assert ("fable", "Fable") in field.choices


def test_aucune_liste_de_juges_en_dur():
    """Garde anti-régression structurelle : aucun module applicatif ne doit re-déclarer une
    liste littérale de juges — c'est cette duplication qui avait fait diverger le frontend.

    Deux exemptions, et deux seulement : `imports/models.py` (la SOURCE : `Judge` +
    `JUDGE_DISPLAY_ORDER`) et les migrations (qui figent l'historique du schéma)."""
    source = BACKEND_ROOT / "claire" / "imports" / "models.py"
    pattern = re.compile(r"""["'](claude|codex|mistral|fable)["']\s*,\s*["'](claude|codex|mistral|fable)["']""")
    offenders = []
    for path in (BACKEND_ROOT / "claire").rglob("*.py"):
        if "migrations" in path.parts or path == source:
            continue
        if pattern.search(path.read_text(encoding="utf-8")):
            offenders.append(str(path.relative_to(BACKEND_ROOT)))
    assert offenders == [], f"Liste de juges en dur (dériver de Judge) : {offenders}"


# ── 2. Import : par défaut, idempotent, sans régression ──────────────────────────
def test_import_prend_fable_par_defaut(tmp_path, project, document_with_sentences):
    """Sans `--judges`, la commande importe Fable : le script de prod n'a rien à changer."""
    _write_judge_file(
        tmp_path, "fable", document_with_sentences.external_id,
        _fable_payload(document_with_sentences.external_id),
    )
    call_command("import_preannotations", "--project", project.slug, "--dir", str(tmp_path))

    pre = PreAnnotation.objects.get(project=project, judge="fable")
    assert pre.schema_version == "v9.2"
    assert pre.preclauses.count() == 3  # 3 segments du plan


def test_import_fable_est_idempotent(tmp_path, project, document_with_sentences):
    _write_judge_file(
        tmp_path, "fable", document_with_sentences.external_id,
        _fable_payload(document_with_sentences.external_id),
    )
    for _ in range(3):
        call_command(
            "import_preannotations", "--project", project.slug,
            "--dir", str(tmp_path), "--judges", "fable",
        )
    assert PreAnnotation.objects.filter(project=project, judge="fable").count() == 1
    assert PreClause.objects.filter(preannotation__judge="fable").count() == 3


def test_import_fable_ne_touche_pas_les_autres_juges(
    tmp_path, project, document_with_sentences
):
    """Fable est un 4ᵉ enregistrement (clé d'unicité project+doc+judge+version), jamais un
    écrasement : les pré-annotations de Claude restent bit à bit identiques."""
    claude_raw = _fable_payload(document_with_sentences.external_id)
    claude_raw["judge"] = "claude"
    _write_judge_file(tmp_path, "claude", document_with_sentences.external_id, claude_raw)
    call_command(
        "import_preannotations", "--project", project.slug,
        "--dir", str(tmp_path), "--judges", "claude",
    )
    before = PreAnnotation.objects.get(project=project, judge="claude")
    before_clauses = list(before.preclauses.order_by("order").values())
    before_imported_at = before.imported_at

    _write_judge_file(
        tmp_path, "fable", document_with_sentences.external_id,
        _fable_payload(document_with_sentences.external_id),
    )
    call_command("import_preannotations", "--project", project.slug, "--dir", str(tmp_path))

    after = PreAnnotation.objects.get(project=project, judge="claude")
    assert after.imported_at == before_imported_at
    assert list(after.preclauses.order_by("order").values()) == before_clauses
    assert PreAnnotation.objects.filter(project=project, judge="fable").count() == 1


# ── 3. Normalisation du format réel produit par la session 4 ─────────────────────
def test_payload_fable_reel_se_normalise():
    """Le format v9.2 « nature dérivée » de Fable : segments → clauses pivot, et la
    `legal_nature` de la PHRASE D'ANCRE est rattachée au segment (consultation, jamais
    appliquée d'office)."""
    from claire.imports.loaders import normalize_preannotation

    version, clauses = normalize_preannotation(ATLAS_FABLE)
    assert version == "v9.2"  # le tag `v9.2-nature-derived` reste dans `raw`
    assert [c["anchor_index"] for c in clauses] == [0, 1, 3]
    assert [c["theme"] for c in clauses] == ["META", "PREAMBLE_SCOPE", "MODIFICATION_OF_TERMS"]
    assert clauses[0]["legal_nature"] == "META"          # nature de la phrase 0
    assert clauses[2]["legal_nature"] == "OBLIGATION"    # nature de la phrase d'ancre 3
    assert clauses[0]["evidence_span"].startswith("owned and operated")


def test_themes_fable_normalises_vers_le_schema(project, document_with_sentences):
    """Le vocabulaire v9.2 de Fable (`THIRD_PARTY`, `LIABILITY_LIMITATION`…) passe par la
    même normalisation que les autres juges : jamais de violation d'INV-3."""
    from claire.imports.serializers import PreAnnotationSerializer
    from claire.imports.services import ingest_preannotation

    raw = _fable_payload(document_with_sentences.external_id)
    raw["document_plan"]["segments"] = [
        {"start_id": 0, "theme": "THIRD_PARTY", "rationale": "", "evidence_span": ""},
        {"start_id": 1, "theme": "LIABILITY_LIMITATION", "rationale": "", "evidence_span": ""},
    ]
    pre = ingest_preannotation(
        project=project, document=document_with_sentences, judge="fable", raw=raw
    )
    codes = [c["theme_code"] for c in PreAnnotationSerializer(pre).data["clauses"]]
    assert "THIRD_PARTY_SERVICES" in codes
    assert "LIMITATION_LIABILITY" in codes


# ── 4. Fable, juge de plein droit dans les surfaces à N juges ────────────────────
@pytest.fixture
def project_4_juges(project, document_with_sentences):
    """Un document où les 4 juges ont une segmentation, avec un dissensus contrôlé :
    phrase 0 → 3 votes META vs 1 vote PREAMBLE_SCOPE (majorité 3/4)."""
    from claire.imports.services import ingest_preannotation

    themes = {"claude": "META", "codex": "PREAMBLE_SCOPE", "mistral": "META", "fable": "META"}
    for judge, theme in themes.items():
        raw = {
            "doc": document_with_sentences.external_id,
            "judge": judge,
            "version": "v9.2",
            "document_plan": {
                "segments": [
                    {"start_id": 0, "theme": theme, "rationale": "", "evidence_span": ""},
                    {"start_id": 2, "theme": "TERMINATION", "rationale": "", "evidence_span": ""},
                ]
            },
        }
        ingest_preannotation(
            project=project, document=document_with_sentences, judge=judge, raw=raw
        )
    return project


def test_concordance_expose_les_4_juges(project_4_juges, document_with_sentences):
    """6 paires (C(4,2)) au lieu de 3 : la comparaison juge↔juge intègre Fable."""
    from claire.projects.concordance import _judge_vectors_for_document

    vecs = _judge_vectors_for_document(
        project_4_juges, document_with_sentences, document_with_sentences.n_sentences
    )
    assert sorted(vecs) == ["claude", "codex", "fable", "mistral"]
    pairs = [
        (a, b) for i, a in enumerate(sorted(vecs)) for b in sorted(vecs)[i + 1:]
    ]
    assert len(pairs) == 6
    assert ("claude", "fable") in pairs and ("fable", "mistral") in pairs


def test_gold_expose_fable_en_reference_llm(project_4_juges, document_with_sentences):
    """Dans l'atelier gold, Fable apparaît en `llm_details` (référence pour l'arbitre) —
    et reste un NON-VOTANT : la résolution est strictement inter-annotateurs."""
    from claire.gold.services import build_document_data

    data = build_document_data(project_4_juges, document_with_sentences)
    details = data["per_sentence"][0]["llm_details"]
    # Ordre d'affichage garanti (et non ordre d'insertion en base) pour l'arbitre.
    assert [d["judge"] for d in details] == ["fable", "claude", "codex", "mistral"]
    fable_votes = [v for v in data["per_sentence"][0]["votes"] if v.voter_id == "fable"]
    assert len(fable_votes) == 1 and fable_votes[0].is_llm is True


def test_triage_route_avec_4_juges():
    """Le moteur de triage encaisse 4 votants : majorité 3/4 → thème majoritaire en tête."""
    from claire.triage.engine import triage_engine

    out = triage_engine(
        {"claude": "META", "codex": "PREAMBLE_SCOPE", "mistral": "META", "fable": "META"},
        {"claude": True, "codex": True, "mistral": True, "fable": True},
    )
    assert out is not None
    assert out["candidates"][0] == "META"
    assert out["boundary"]["support"] == 4


# ── 5. Promotion de Fable en compte annotateur ───────────────────────────────────
def test_llm_annotator_status_liste_fable(project_4_juges):
    from claire.gold.llm_seed import llm_annotator_status

    status = llm_annotator_status(project_4_juges)
    assert [r["judge"] for r in status] == ["fable", "claude", "codex", "mistral"]
    rows = {r["judge"]: r for r in status}
    assert rows["fable"]["added"] is False
    assert rows["fable"]["documents"] == 1


def test_promotion_fable_via_api(auth, admin_user, project_4_juges):
    """`POST gold/llm-annotators {judge: fable}` — refusé avant le correctif (liste en dur
    claude/codex/mistral), accepté maintenant que la validation dérive de `Judge`."""
    from claire.projects.models import MembershipRole, ProjectMembership

    ProjectMembership.objects.create(
        project=project_4_juges, user=admin_user, role=MembershipRole.LEAD
    )
    client = auth(admin_user)
    url = f"/api/v1/projects/{project_4_juges.slug}/gold/llm-annotators"

    resp = client.post(url, {"judge": "fable", "action": "add"}, format="json")
    assert resp.status_code == 200, resp.content
    assert resp.json()["annotationsCreated"] == 1

    from claire.annotations.models import Annotation, AnnotationStatus

    ann = Annotation.objects.get(project=project_4_juges, annotator__username="fable")
    assert ann.status == AnnotationStatus.SUBMITTED

    # Réversible : le juge redevient une simple référence LLM, ses pré-annotations restent.
    resp = client.post(url, {"judge": "fable", "action": "remove"}, format="json")
    assert resp.status_code == 200, resp.content
    assert not Annotation.objects.filter(annotator__username="fable").exists()
    assert PreAnnotation.objects.filter(project=project_4_juges, judge="fable").exists()


def test_juge_inconnu_toujours_refuse(auth, admin_user, project_4_juges):
    """La dérivation n'ouvre pas la porte à n'importe quoi : `other` et l'inconnu restent 400."""
    from claire.projects.models import MembershipRole, ProjectMembership

    ProjectMembership.objects.create(
        project=project_4_juges, user=admin_user, role=MembershipRole.LEAD
    )
    client = auth(admin_user)
    url = f"/api/v1/projects/{project_4_juges.slug}/gold/llm-annotators"
    for judge in ("other", "gpt-tout-puissant", ""):
        resp = client.post(url, {"judge": judge, "action": "add"}, format="json")
        assert resp.status_code == 400, (judge, resp.content)


# ── 6. Fable est le modèle proposé PAR DÉFAUT ────────────────────────────────────
def test_defaut_serveur_est_fable():
    """Un compte NEUF a Fable pré-sélectionné — mais l'auto-exécution reste opt-in."""
    from claire.accounts.ui_prefs import DEFAULT_PREFILL_JUDGE, DEFAULTS, normalize_ui_preferences

    assert DEFAULT_PREFILL_JUDGE == "fable"
    assert DEFAULT_PREFILL_JUDGE in Judge.import_judges()
    assert DEFAULTS["prefill"]["judge"] == "fable"
    assert DEFAULTS["prefill"]["enabled"] is False  # jamais de pré-annotation sans accord
    assert normalize_ui_preferences({})["prefill"]["judge"] == "fable"


def test_defaut_front_et_serveur_sont_en_parite():
    """`DEFAULT_LLM_JUDGE` (frontend) == `DEFAULT_PREFILL_JUDGE` (serveur) : un défaut qui
    diverge donnerait un modèle armé côté serveur et un autre affiché côté client."""
    from claire.accounts.ui_prefs import DEFAULT_PREFILL_JUDGE

    src = (REPO_ROOT / "frontend" / "src" / "lib" / "llmJudges.ts").read_text(encoding="utf-8")
    m = re.search(r'export const DEFAULT_LLM_JUDGE\s*=\s*"([^"]+)"', src)
    assert m, "DEFAULT_LLM_JUDGE introuvable dans frontend/src/lib/llmJudges.ts"
    assert m.group(1) == DEFAULT_PREFILL_JUDGE


def test_nomenclature_front_et_back_sont_en_parite():
    """Les identifiants de `LLM_JUDGES` (frontend) == `Judge.import_judges()` (backend),
    ORDRE COMPRIS. C'est LE test qui manquait : `contract.ts` avait raté Mistral pendant
    des mois, et un ordre d'affichage divergent donnerait deux classements à l'écran."""
    src = (REPO_ROOT / "frontend" / "src" / "lib" / "llmJudges.ts").read_text(encoding="utf-8")
    ids = re.findall(r'\{\s*id:\s*"([^"]+)"', src)
    assert ids == Judge.import_judges()

    contract = (REPO_ROOT / "frontend" / "src" / "types" / "contract.ts").read_text(encoding="utf-8")
    m = re.search(r"export type Judge =([^;]+);", contract)
    assert m, "type Judge introuvable dans contract.ts"
    declared = set(re.findall(r'"([^"]+)"', m.group(1)))
    assert declared == set(Judge.values)


def test_commande_aligne_les_comptes_existants(annotator, reviewer):
    """Les comptes DÉJÀ créés gardent leur blob persisté : la commande les aligne, sans
    jamais écraser un choix exprimé."""
    from claire.accounts.ui_prefs import normalize_ui_preferences

    # Compte « historique » : aucun modèle armé, consentement jamais demandé.
    annotator.ui_preferences = normalize_ui_preferences({})
    annotator.ui_preferences["prefill"] = {"enabled": False, "judge": None, "asked": False}
    annotator.save(update_fields=["ui_preferences"])
    # Compte qui a CHOISI « Aucun » (modale déjà montrée) → doit rester intact.
    reviewer.ui_preferences = normalize_ui_preferences({})
    reviewer.ui_preferences["prefill"] = {"enabled": False, "judge": None, "asked": True}
    reviewer.save(update_fields=["ui_preferences"])

    call_command("set_default_llm_judge")
    annotator.refresh_from_db()
    reviewer.refresh_from_db()
    assert annotator.ui_preferences["prefill"]["judge"] == "fable"
    assert annotator.ui_preferences["prefill"]["enabled"] is False
    assert reviewer.ui_preferences["prefill"]["judge"] is None  # choix respecté

    # Idempotence : second passage → plus aucun changement.
    call_command("set_default_llm_judge")
    annotator.refresh_from_db()
    assert annotator.ui_preferences["prefill"]["judge"] == "fable"


def test_commande_refuse_un_juge_inconnu():
    from django.core.management.base import CommandError

    with pytest.raises(CommandError):
        call_command("set_default_llm_judge", "--judge", "gpt-tout-puissant")


# ── 7. Le corpus réel, quand il est présent (data/preannotations est gitignoré) ──
FABLE_DIR = REPO_ROOT / "data" / "preannotations" / "fable"


@pytest.mark.skipif(not FABLE_DIR.exists(), reason="corpus Fable absent (data/ gitignoré)")
def test_corpus_fable_reel_est_complet_et_conforme():
    """Contrôle du matériau livré : 50 documents, format v9.2 exploitable, même périmètre
    que Claude/Codex (Mistral, lui, n'en couvre que 22)."""
    files = sorted(FABLE_DIR.glob("*_fable.json"))
    assert len(files) == 50

    from claire.imports.loaders import normalize_preannotation

    total_clauses = 0
    for path in files:
        raw = json.loads(path.read_text(encoding="utf-8"))
        doc_id = path.name[: -len("_fable.json")]
        assert raw["judge"] == "fable"
        assert raw["doc"] == doc_id
        version, clauses = normalize_preannotation(raw)
        assert version == "v9.2"
        assert clauses, f"{doc_id} : aucun segment exploitable"
        total_clauses += len(clauses)
    assert total_clauses == 1728

    peers = {p.name[: -len("_claude.json")]
             for p in (REPO_ROOT / "data" / "preannotations" / "claude").glob("*_claude.json")}
    assert {p.name[: -len("_fable.json")] for p in files} == peers
