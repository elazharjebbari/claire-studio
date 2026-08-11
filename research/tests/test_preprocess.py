"""`preprocess/pipeline.py` — 68 % de couverture avant cet audit : `mask_entities`,
`remove_stopwords`, `simple_stem` et la fenêtre de contexte de `build_text` n'étaient
exercés par AUCUN test direct (seulement indirectement via `test_runner.py`, avec une
config par défaut qui n'active aucun de ces axes). Sans dépendance lourde, donc rapide.
"""

from pactiva_lab.data import Sentence
from pactiva_lab.preprocess.pipeline import (
    build_text,
    describe,
    detokenize,
    mask_entities,
    remove_stopwords,
    simple_stem,
)


# --------------------------------------------------------------------------- #
# detokenize — le corpus CLAUDETTE est pré-tokenisé
# --------------------------------------------------------------------------- #

def test_detokenize_recolle_la_ponctuation():
    assert detokenize("terms and conditions of use .") == "Terms and conditions of use."


def test_detokenize_recolle_les_contractions():
    assert detokenize("you ' re bound by this agreement") == "You're bound by this agreement"
    assert detokenize("we do n't guarantee availability") == "We do n't guarantee availability"


# --------------------------------------------------------------------------- #
# mask_entities — évite que le modèle mémorise le nom du service
# --------------------------------------------------------------------------- #

def test_mask_entities_url_et_email():
    text = "contact us at support@example.com or visit https://example.com/help"
    masked = mask_entities(text, ["url", "email"])
    assert "support@example.com" not in masked
    assert "https://example.com" not in masked
    assert "<EMAIL>" in masked
    assert "<URL>" in masked


def test_mask_entities_montant_et_date():
    text = "a fee of $9.99 applies starting January 1, 2024"
    masked = mask_entities(text, ["money", "date"])
    assert "<MONEY>" in masked
    assert "<DATE>" in masked


def test_mask_entities_ignore_les_types_non_demandes():
    text = "email us at a@b.com"
    assert mask_entities(text, ["url"]) == text  # aucun masquage : "url" ne matche rien ici


# --------------------------------------------------------------------------- #
# remove_stopwords
# --------------------------------------------------------------------------- #

def test_remove_stopwords_none_est_un_no_op():
    text = "the provider may terminate the agreement"
    assert remove_stopwords(text, "none") == text


def test_remove_stopwords_english_retire_les_mots_vides_courants():
    result = remove_stopwords("the provider may terminate the agreement", "english")
    assert "the" not in result.split()
    assert "provider" in result.split()


def test_remove_stopwords_legal_custom_retire_aussi_le_jargon_juridique():
    result = remove_stopwords("shall notwithstanding the foregoing terms apply", "legal_custom")
    assert "shall" not in result.split()
    assert "notwithstanding" not in result.split()
    assert "terms" in result.split()


# --------------------------------------------------------------------------- #
# simple_stem
# --------------------------------------------------------------------------- #

def test_simple_stem_retire_les_suffixes_anglais_courants():
    assert simple_stem("terminations terminating") == "termin terminat"


def test_simple_stem_epargne_les_mots_courts():
    """`len(low) > len(suffix) + 3` : un mot trop court ne doit pas être rasé à rien."""
    assert simple_stem("is as ") == "is as"


# --------------------------------------------------------------------------- #
# build_text — fenêtre de contexte bornée au document
# --------------------------------------------------------------------------- #

def _sentence(index, text, doc_position=0.0):
    return Sentence(
        document="doc1", index=index, text=text.lower(), text_detok=text,
        doc_position=doc_position, n_sentences=3, primary="X", themes=["X"],
        boundary=False, n_annotators=1, agreement="strict",
    )


def test_build_text_sans_contexte_rend_juste_la_phrase():
    sentences = [_sentence(0, "Preamble."), _sentence(1, "Termination clause."), _sentence(2, "Fees.")]
    text = build_text(sentences[1], neighbours=sentences, config={})
    assert text == "Termination clause."


def test_build_text_fenetre_de_contexte_reste_dans_le_document():
    """⭐ Une fenêtre qui déborderait sur un autre contrat serait une fuite discrète —
    ici `neighbours` ne contient QUE des phrases du même document par construction, donc
    `before`/`after` ne peuvent techniquement pas déborder ailleurs."""
    sentences = [_sentence(i, f"Sentence {i}.") for i in range(5)]
    text = build_text(
        sentences[2], neighbours=sentences,
        config={"context": {"window_before": 1, "window_after": 1}},
    )
    assert text == "Sentence 1. [SEP] Sentence 2. [SEP] Sentence 3."


def test_build_text_fenetre_bornee_en_debut_et_fin_de_document():
    sentences = [_sentence(i, f"Sentence {i}.") for i in range(3)]
    text = build_text(
        sentences[0], neighbours=sentences,
        config={"context": {"window_before": 2, "window_after": 0}},
    )
    assert text == "Sentence 0."  # rien avant le début : pas d'IndexError, pas de débordement


def test_build_text_applique_masquage_puis_minuscule_puis_stopwords():
    sentence = _sentence(0, "Contact us at a@b.com for TERMINATION details")
    text = build_text(
        sentence, neighbours=[sentence],
        config={"mask_entities": ["email"], "case": "lower", "stopwords": "english"},
    )
    assert "a@b.com" not in text
    assert "<email>" in text  # masqué AVANT la mise en minuscule
    assert text == text.lower()
    words = text.split()
    assert "at" not in words and "for" not in words  # stopwords anglais retirés en dernier


def test_build_text_inclut_la_position_symbolique_si_demandee():
    sentence = _sentence(0, "Preamble.", doc_position=0.95)
    text = build_text(
        sentence, neighbours=[sentence],
        config={"context": {"include_doc_position": True}},
    )
    assert text.startswith("<POS9>")


def test_build_text_tronque_au_nombre_de_mots_maximum():
    sentence = _sentence(0, " ".join(f"mot{i}" for i in range(20)))
    text = build_text(sentence, neighbours=[sentence], config={"max_length": 5})
    assert len(text.split()) == 5


# --------------------------------------------------------------------------- #
# describe — repris dans les tableaux d'ablation
# --------------------------------------------------------------------------- #

def test_describe_resume_uniquement_les_axes_actifs():
    assert describe({}) == "detok=regex_rules"
    full = describe({
        "case": "lower", "mask_entities": ["url", "email"], "stopwords": "english",
        "normalization": "stem",
        "context": {"window_before": 1, "window_after": 2, "include_doc_position": True},
    })
    assert full == "detok=regex_rules lower mask=url+email stop=english stem ctx=-1/+2 pos"
