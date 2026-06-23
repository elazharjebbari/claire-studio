"""Round-trip SANS PERTE sous séquences ALÉATOIRES (property-based, hypothesis).

Garantie « campagne-ready » complémentaire de test_submission_persistence.py
(qui couvre des cas FIXES) : ici on PROUVE par génération aléatoire que, quelle que
soit la séquence d'opérations (create N clauses → PATCH aléatoires → DELETE aléatoires
→ SUBMIT), AUCUNE donnée n'est perdue.

Deux invariants vérifiés sur CHAQUE exemple :
  (I1)  snapshot de la version soumise == build_snapshot(DB courante) pour ['clauses']
        (le figé == le vivant : la soumission ne tronque rien) ;
  (I2)  pour chaque clause VIVANTE, la relecture DB DIRECTE (Clause / ClauseTheme)
        == les valeurs effectivement envoyées par le dernier write la concernant
        (thème primaire, set des secondaires, boundary, triage, certainty,
        legal_nature, evidence, rationale, validated).

Isolation entre exemples : `pytest.mark.django_db` ouvre UNE transaction pour toute
la fonction de test, mais hypothesis y exécute des dizaines d'exemples. On crée donc
une ANNOTATION NEUVE (avec un annotateur neuf, pour ne pas violer INV-4
UNIQUE(project, document, annotator)) à CHAQUE exemple — l'état d'un exemple ne fuit
jamais sur le suivant. Le projet/document/scheme des fixtures sont partagés (lecture
seule), ce qui est sûr : seules les écritures (Annotation/Clause/ClauseTheme) sont
spécifiques à l'exemple.

Aucun fichier de production n'est modifié. Tout VRAI bug produit est signalé, pas corrigé.
"""

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from claire.annotations.models import Annotation, Clause, ClauseTheme
from claire.annotations.services import build_snapshot
from claire.audit.models import ActivityEvent

pytestmark = pytest.mark.django_db

API = "/api/v1"

# Thèmes non-refuge : un secondaire ne peut JAMAIS être un refuge (invariant
# validate_clause_theme_set). META / TERMINATION sont les seuls non-refuges du fixture.
PRIMARY_THEMES = ["META", "TERMINATION"]
NATURES = [None, "OBLIGATION"]
TRIAGE = ["", "C1", "C2", "C3", "C4", "C5"]
BOUNDARY_TYPES = ["hard", "soft"]

# Textes courts : vides, ASCII, unicode (accents + emoji + RTL) pour traquer toute
# perte d'encodage au round-trip API → DB → snapshot. On EXCLUT les caractères de
# contrôle de la catégorie Cc (dont le NUL \x00 que Django/PostgreSQL refusent
# légitimement, "Null characters are not allowed") et les surrogates : ce ne sont
# pas des saisies d'annotateur réalistes, et ce refus est un comportement correct,
# pas une perte de donnée. On garde tabulation, accents, RTL et emoji.
#
# Contrat connu et VOULU : les CharField DRF (evidence_span, rationale) ont
# `trim_whitespace=True` — les espaces de bordure sont retirés à l'écriture. Ce
# n'est PAS une perte de donnée (le contenu signifiant est préservé) mais une
# normalisation documentée. La valeur ATTENDUE en base est donc le texte ÉBARBÉ
# (`.strip()`), calculé via `_stored(text)` ci-dessous. Le générateur produit
# DÉLIBÉRÉMENT des bordures d'espaces (et du tout-espace) pour PROUVER que cette
# normalisation est la seule transformation appliquée — rien d'autre n'est perdu.
_FREE_TEXT = st.text(
    alphabet=st.characters(
        blacklist_categories=("Cs",),  # surrogates
        blacklist_characters="\x00",   # NUL explicitement (refus DB/serializer correct)
        min_codepoint=1,
    ),
    min_size=1,
    max_size=12,
).filter(lambda s: "\x00" not in s and "\x1a" not in s)
SHORT_TEXT = st.one_of(
    st.just(""),
    _FREE_TEXT,
    st.sampled_from(["café", "résiliation", "✓ ok", "مادة", "a\tb", "  spaces  ", "   "]),
)


def _stored(text: str) -> str:
    """Valeur ATTENDUE en base pour un CharField DRF `trim_whitespace=True`.

    DRF ébarbe les espaces de bordure à la validation (comportement voulu, pas une
    perte). On reproduit ICI la même normalisation pour comparer à l'identique.
    `str.strip()` retire exactement les caractères d'espace Unicode de bordure —
    dont la tabulation `\\t` — comme `CharField.run_validation`.
    """
    return text.strip()


def _clause_strategy(draw):
    """Tire la spec d'UNE clause (les champs ; l'ancre est attribuée à part)."""
    primary = draw(st.sampled_from(PRIMARY_THEMES))
    # 0 ou 1 secondaire, distinct du primaire, jamais refuge.
    others = [t for t in PRIMARY_THEMES if t != primary]
    secondary = draw(st.sampled_from([None] + others))
    return {
        "primary": primary,
        "secondary": secondary,
        "legal_nature": draw(st.sampled_from(NATURES)),
        "certainty": draw(st.sampled_from([None, 0, 1, 2, 3])),
        "validated": draw(st.booleans()),
        "evidence_span": draw(SHORT_TEXT),
        "rationale": draw(SHORT_TEXT),
        "boundary_type": draw(st.sampled_from(BOUNDARY_TYPES)),
        "boundary_support": draw(st.integers(min_value=1, max_value=9)),
        "triage_level": draw(st.sampled_from(TRIAGE)),
    }


def _payload(anchor, spec):
    """Construit le payload camelCase POST/PATCH pour une spec de clause.

    On utilise TOUJOURS `themes` (liste multi-label) : un seul élément si mono,
    deux si un secondaire est tiré. Le serveur dérive le `theme` scalaire du primaire.

    IMPORTANT : on envoie TOUJOURS `certainty` et `legalNature`, y compris `null`,
    pour que le payload PORTE la décision de remise à null. Un PATCH qui OMETTRAIT
    le champ laisse l'ancienne valeur en place (sémantique PATCH partielle) — ce
    n'est PAS une perte de donnée mais l'absence d'ordre de modification. Comme la
    `live spec` modélise un REMPLACEMENT intégral, le payload doit être complet,
    sinon on testerait une intention jamais transmise (faux négatif de fidélité).
    """
    themes = [{"label": spec["primary"], "role": "primary", "support": 0}]
    if spec["secondary"] is not None:
        themes.append({"label": spec["secondary"], "role": "secondary", "support": 0})
    payload = {
        "anchorIndex": anchor,
        "themes": themes,
        "legalNature": spec["legal_nature"],  # None inclus → reset explicite
        "evidenceSpan": spec["evidence_span"],
        "rationale": spec["rationale"],
        "validated": spec["validated"],
        "boundary": {"type": spec["boundary_type"], "support": spec["boundary_support"]},
        "triageLevel": spec["triage_level"],
        "certainty": spec["certainty"],  # None inclus → reset explicite vers null
    }
    return payload


def _expected_secondaries(spec):
    return {spec["secondary"]} if spec["secondary"] is not None else set()


def _assert_clause_matches_spec(clause: Clause, spec: dict):
    """(I2) Relecture DB DIRECTE d'une clause vivante == valeurs attendues de sa spec."""
    # Thème scalaire = miroir du primaire.
    assert clause.theme.code == spec["primary"], (
        f"theme scalaire {clause.theme.code} != primaire {spec['primary']}"
    )
    # Set multi-label en base : exactement 1 primary (= primaire) + les secondaires.
    tags = list(ClauseTheme.objects.filter(clause=clause).select_related("theme"))
    primaries = [t for t in tags if t.role == "primary"]
    assert len(primaries) == 1, f"exactement 1 primaire attendu, {len(primaries)} trouvés"
    assert primaries[0].theme.code == spec["primary"]
    secondaries = {t.theme.code for t in tags if t.role == "secondary"}
    assert secondaries == _expected_secondaries(spec), (
        f"secondaires DB {secondaries} != attendus {_expected_secondaries(spec)}"
    )
    # Aucun refuge ne s'est glissé en secondaire (invariant produit).
    assert not (secondaries & {"PREAMBLE_SCOPE", "MISC_BOILERPLATE"})

    # Scalaires.
    nat = clause.legal_nature.code if clause.legal_nature else None
    assert nat == spec["legal_nature"], f"legal_nature {nat} != {spec['legal_nature']}"
    assert clause.certainty == spec["certainty"], (
        f"certainty {clause.certainty} != {spec['certainty']}"
    )
    assert clause.validated is spec["validated"]
    # evidence_span / rationale : la SEULE transformation tolérée est l'ébarbage des
    # espaces de bordure (CharField DRF trim_whitespace=True, voulu). On compare donc
    # à la valeur ÉBARBÉE `_stored(...)` — tout le contenu signifiant doit survivre.
    assert clause.evidence_span == _stored(spec["evidence_span"]), (
        f"evidence {clause.evidence_span!r} != {_stored(spec['evidence_span'])!r} "
        f"(envoyé {spec['evidence_span']!r})"
    )
    assert clause.rationale == _stored(spec["rationale"]), (
        f"rationale {clause.rationale!r} != {_stored(spec['rationale'])!r} "
        f"(envoyé {spec['rationale']!r})"
    )
    # Frontière + triage.
    assert clause.boundary_type == spec["boundary_type"]
    assert clause.boundary_support == spec["boundary_support"]
    expected_triage = spec["triage_level"][:2]  # le serveur tronque triage_level à 2 car.
    assert clause.triage_level == expected_triage, (
        f"triage {clause.triage_level!r} != {expected_triage!r}"
    )


@settings(
    max_examples=40,
    deadline=None,
    # django_db garde une seule transaction pour la fonction ; hypothesis y boucle.
    # On gère l'isolation NOUS-MÊMES (annotation neuve par exemple), donc on supprime
    # les check-santé qui s'effraient des fixtures function-scoped réutilisées et de
    # la lenteur relative des allers-retours API.
    suppress_health_check=[
        HealthCheck.function_scoped_fixture,
        HealthCheck.too_slow,
    ],
)
@given(data=st.data())
def test_random_sequence_roundtrip_no_data_loss(
    data, auth, project, document_with_sentences, scheme_with_themes
):
    c = auth  # `auth` est la factory; on forcera l'auth sur l'annotateur de l'exemple.

    # --- annotation NEUVE par exemple (isolation INV-4 + INV-2) -----------------
    from tests.conftest import UserFactory

    annotator = UserFactory()  # username séquencé → pas de collision UNIQUE
    annotation = Annotation.objects.create(
        project=project, document=document_with_sentences, annotator=annotator
    )
    client = c(annotator)

    # --- ancres distinctes (sous-ensemble non vide de 0..4) ---------------------
    anchors = data.draw(
        st.lists(
            st.integers(min_value=0, max_value=4),
            min_size=1, max_size=5, unique=True,
        ),
        label="anchors",
    )

    # spec courante par ancre vivante : la VÉRITÉ attendue après le dernier write.
    live: dict[int, dict] = {}
    cid_by_anchor: dict[int, int] = {}

    # --- 1) CREATE : une clause par ancre ---------------------------------------
    for anchor in anchors:
        spec = _clause_strategy(data.draw)
        r = client.post(
            f"{API}/annotations/{annotation.id}/clauses",
            _payload(anchor, spec),
            format="json",
        )
        assert r.status_code == 201, (anchor, spec, r.status_code, r.content)
        live[anchor] = spec
        cid_by_anchor[anchor] = r.json()["id"]

    # --- 2) PATCH aléatoires (remplace intégralement la spec d'une ancre) --------
    n_patches = data.draw(st.integers(min_value=0, max_value=len(anchors) + 2),
                          label="n_patches")
    for _ in range(n_patches):
        if not live:
            break
        anchor = data.draw(st.sampled_from(sorted(live.keys())), label="patch_anchor")
        new_spec = _clause_strategy(data.draw)
        cid = cid_by_anchor[anchor]
        # PATCH n'envoie PAS anchorIndex (on garde la même ancre → pas de conflit INV-2).
        body = _payload(anchor, new_spec)
        body.pop("anchorIndex")
        r = client.patch(f"{API}/clauses/{cid}", body, format="json")
        assert r.status_code == 200, (anchor, new_spec, r.status_code, r.content)
        live[anchor] = new_spec

    # --- 3) DELETE aléatoires ----------------------------------------------------
    deletable = sorted(live.keys())
    to_delete = data.draw(
        st.lists(st.sampled_from(deletable) if deletable else st.nothing(),
                 max_size=len(deletable), unique=True),
        label="to_delete",
    )
    for anchor in to_delete:
        cid = cid_by_anchor[anchor]
        r = client.delete(f"{API}/clauses/{cid}")
        assert r.status_code == 204, (anchor, r.status_code, r.content)
        del live[anchor]
        del cid_by_anchor[anchor]

    # --- 4) global_certainty aléatoire via PATCH annotation ----------------------
    gc = data.draw(st.sampled_from([None, 0, 1, 2, 3]), label="global_certainty")
    if gc is not None:
        r = client.patch(
            f"{API}/annotations/{annotation.id}", {"globalCertainty": gc}, format="json"
        )
        assert r.status_code == 200, (gc, r.status_code, r.content)

    # --- 5) SUBMIT ---------------------------------------------------------------
    versions_before = annotation.versions.count()
    r = client.post(f"{API}/annotations/{annotation.id}/submit")
    assert r.status_code == 200, (r.status_code, r.content)
    annotation.refresh_from_db()
    assert annotation.status == "submitted"
    assert annotation.global_certainty == gc

    # Audit + version de soumission créés.
    assert ActivityEvent.objects.filter(
        verb="annotation.submitted", target_id=str(annotation.id)
    ).exists()
    version = annotation.versions.order_by("-number").first()
    assert version is not None
    assert annotation.versions.count() == versions_before + 1

    # ===========================================================================
    # (I1) Le snapshot FIGÉ == l'état DB VIVANT (aucune divergence post-soumission).
    # ===========================================================================
    live_snapshot = build_snapshot(annotation)
    assert version.snapshot["clauses"] == live_snapshot["clauses"], (
        "snapshot figé != DB vivante",
        version.snapshot["clauses"],
        live_snapshot["clauses"],
    )

    # Le snapshot couvre EXACTEMENT les ancres encore vivantes (ni perte ni fantôme).
    snap_anchors = {cl["anchor_index"] for cl in version.snapshot["clauses"]}
    assert snap_anchors == set(live.keys()), (snap_anchors, set(live.keys()))
    assert annotation.global_certainty == version.snapshot["global_certainty"]

    # ===========================================================================
    # (I2) Relecture DB DIRECTE de chaque clause vivante == sa spec attendue.
    # ===========================================================================
    db_clauses = {
        cl.anchor_sentence.index: cl
        for cl in Clause.objects.filter(annotation=annotation).select_related(
            "anchor_sentence", "theme", "legal_nature"
        )
    }
    assert set(db_clauses.keys()) == set(live.keys()), (
        "ensemble d'ancres en DB != attendu",
        set(db_clauses.keys()), set(live.keys()),
    )
    for anchor, spec in live.items():
        _assert_clause_matches_spec(db_clauses[anchor], spec)

    # Cohérence croisée snapshot↔DB sur les secondaires (le multi-label ne disparaît
    # pas au figeage) : on revérifie le set de thèmes par ancre dans le snapshot.
    snap_by_anchor = {cl["anchor_index"]: cl for cl in version.snapshot["clauses"]}
    for anchor, spec in live.items():
        themes = snap_by_anchor[anchor]["themes"]
        roles = {t["label"]: t["role"] for t in themes}
        assert roles.get(spec["primary"]) == "primary"
        for sec in _expected_secondaries(spec):
            assert roles.get(sec) == "secondary"
        assert snap_by_anchor[anchor]["triage_level"] == (spec["triage_level"][:2] or None)
