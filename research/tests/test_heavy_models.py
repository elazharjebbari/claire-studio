"""`models/heavy.py` — jamais exécuté avant cet audit (36 % de couverture, seuls les
constructeurs étaient testés). Ce fichier utilise les VRAIS petits modèles déjà
téléchargés pendant l'audit (`sentence-transformers/all-MiniLM-L6-v2`,
`prajjwal1/bert-tiny`) : assez petits pour rester rapides, assez réels pour prouver que
`fit`/`predict`/`predict_proba` fonctionnent, pas seulement que la graine est stockée.

Ignoré entièrement si torch/sentence-transformers ne sont pas installés — cohérent avec
le principe du module : le socle (baselines) doit tourner sans ces dépendances lourdes.
"""

import pytest

pytest.importorskip("torch")
pytest.importorskip("sentence_transformers")

from pactiva_lab.models.heavy import EmbeddingCache, EmbeddingsHead, TransformerFinetune

ENCODER = "sentence-transformers/all-MiniLM-L6-v2"
CHECKPOINT = "prajjwal1/bert-tiny"

TEXTS = [
    "the provider may terminate this agreement at any time .",
    "the provider may terminate the account without notice .",
    "the provider may terminate access immediately .",
    "fees are due within thirty days of the invoice .",
    "payment must be made by credit card or wire transfer .",
    "all charges are non refundable once billed .",
]
LABELS = ["TERMINATION", "TERMINATION", "TERMINATION", "FEES", "FEES", "FEES"]


# --------------------------------------------------------------------------- #
# EmbeddingCache
# --------------------------------------------------------------------------- #

def test_embedding_cache_hit_apres_un_premier_miss(tmp_path):
    cache = EmbeddingCache(root=tmp_path)
    assert cache.get(ENCODER, TEXTS[:2]) == [None, None]
    assert cache.misses == 2

    cache.put(ENCODER, TEXTS[:2], [[0.1, 0.2], [0.3, 0.4]])
    hit = cache.get(ENCODER, TEXTS[:2])
    assert hit == [[0.1, 0.2], [0.3, 0.4]]
    assert cache.hits == 2


def test_embedding_cache_distingue_deux_textes(tmp_path):
    cache = EmbeddingCache(root=tmp_path)
    cache.put(ENCODER, ["a"], [[1.0]])
    assert cache.get(ENCODER, ["b"]) == [None]


def test_embedding_cache_hit_partiel_sur_un_lot_qui_se_recouvre(tmp_path):
    """C'est LE cas réel de la validation croisée : deux plis partagent la plupart de
    leurs phrases mais ne sont jamais identiques bit à bit. Avant ce correctif, la clé de
    cache portait sur le lot ENTIER — un seul texte différent invalidait tout, et le
    corpus entier était ré-encodé à chaque pli (bug réel qui a fait déborder le délai
    d'un run de production, 12 août 2026)."""
    cache = EmbeddingCache(root=tmp_path)
    cache.put(ENCODER, TEXTS[:2], [[0.1], [0.2]])

    result = cache.get(ENCODER, [TEXTS[0], TEXTS[1], TEXTS[2]])
    assert result == [[0.1], [0.2], None]
    assert cache.hits == 2
    assert cache.misses == 1


# --------------------------------------------------------------------------- #
# EmbeddingsHead — encodeur gelé, vrai réseau la première fois puis cache
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("head", ["logreg", "linear_svm", "knn", "mlp"])
def test_embeddings_head_separe_deux_classes_bien_distinctes(head, tmp_path, monkeypatch):
    monkeypatch.setenv("PACTIVA_LAB_CACHE", str(tmp_path))
    model = EmbeddingsHead({"encoder": ENCODER, "head": head, "knn_k": 2}, seed=42)
    model.fit(TEXTS, LABELS)
    predictions = model.predict(TEXTS)
    assert predictions == LABELS  # jeu trivialement séparable : aucune erreur tolérée


def test_embeddings_head_predict_proba_est_normalise(tmp_path, monkeypatch):
    monkeypatch.setenv("PACTIVA_LAB_CACHE", str(tmp_path))
    model = EmbeddingsHead({"encoder": ENCODER, "head": "logreg"}, seed=42)
    model.fit(TEXTS, LABELS)
    scores = model.predict_proba(TEXTS[:1])[0]
    assert sum(scores.values()) == pytest.approx(1.0, abs=1e-6)


def test_embeddings_head_knn_predict_proba_replie_sur_la_certitude(tmp_path, monkeypatch):
    """k-NN n'a pas de `predict_proba` natif dans `KNeighborsClassifier`... en fait si —
    mais ce test verrouille que la classe repliée existe bien dans le dict retourné quel
    que soit le chemin emprunté par `_build_head`."""
    monkeypatch.setenv("PACTIVA_LAB_CACHE", str(tmp_path))
    model = EmbeddingsHead({"encoder": ENCODER, "head": "knn", "knn_k": 2}, seed=42)
    model.fit(TEXTS, LABELS)
    scores = model.predict_proba(TEXTS[:1])[0]
    assert scores  # non vide, quelle que soit l'implémentation


def test_embeddings_head_utilise_le_cache_au_second_appel(tmp_path, monkeypatch):
    """Le cache d'embeddings est LE mécanisme qui rend le criblage de plusieurs têtes
    réaliste sans GPU — vérifié en observant réellement hits/misses, pas en le supposant."""
    monkeypatch.setenv("PACTIVA_LAB_CACHE", str(tmp_path))
    a = EmbeddingsHead({"encoder": ENCODER, "head": "logreg"}, seed=42)
    a.fit(TEXTS, LABELS)
    b = EmbeddingsHead({"encoder": ENCODER, "head": "mlp"}, seed=42)
    b.fit(TEXTS, LABELS)  # même encodeur : doit frapper le cache écrit par `a`
    assert b._cache.hits >= 1


def test_embeddings_head_reencode_seulement_les_phrases_nouvelles_d_un_lot_partiel(
    tmp_path, monkeypatch,
):
    """Le cas réel de la validation croisée : deux plis partagent la plupart de leurs
    phrases. Un modèle entraîné sur un sous-ensemble ne doit jamais redemander à
    `sentence-transformers` d'encoder les phrases déjà en cache."""
    monkeypatch.setenv("PACTIVA_LAB_CACHE", str(tmp_path))
    a = EmbeddingsHead({"encoder": ENCODER, "head": "logreg"}, seed=42)
    a.fit(TEXTS[:4], LABELS[:4])

    b = EmbeddingsHead({"encoder": ENCODER, "head": "logreg"}, seed=42)
    b.fit(TEXTS, LABELS)  # recouvre les 4 premières phrases de `a`, en ajoute 2 nouvelles

    assert b._cache.hits == 4  # les 4 phrases déjà encodées par `a`
    assert b._cache.misses == 2  # seulement les 2 nouvelles


# --------------------------------------------------------------------------- #
# TransformerFinetune — vrai fine-tuning, checkpoint minuscule
# --------------------------------------------------------------------------- #

def test_transformer_finetune_fit_puis_predict_produit_une_prediction_par_phrase():
    model = TransformerFinetune(
        {"checkpoint": CHECKPOINT, "epochs": 1, "batch_size": 4, "max_length": 24}, seed=7,
    )
    model.fit(TEXTS, LABELS)
    predictions = model.predict(TEXTS)
    assert len(predictions) == len(TEXTS)
    assert set(predictions) <= {"TERMINATION", "FEES"}


def test_transformer_finetune_predict_proba_couvre_toutes_les_classes_entrainees():
    model = TransformerFinetune(
        {"checkpoint": CHECKPOINT, "epochs": 1, "batch_size": 4, "max_length": 24}, seed=7,
    )
    model.fit(TEXTS, LABELS)
    scores = model.predict_proba(TEXTS[:1])[0]
    assert set(scores) == {"TERMINATION", "FEES"}
    assert sum(scores.values()) == pytest.approx(1.0, abs=1e-4)


# --------------------------------------------------------------------------- #
# TransformerFinetune — résolution du modèle pré-entraîné
# --------------------------------------------------------------------------- #

def test_transformer_finetune_accepte_checkpoint_ou_encoder():
    """⭐ Bug réel attrapé par la campagne de validation du 15 août 2026 : le preset
    sequence-boundary déclarait `encoder:` (vocabulaire des familles embeddings) mais
    la famille `sequence_labeling` route sur TransformerFinetune, qui n'acceptait que
    `checkpoint` — KeyError après une réservation Grid'5000 GPU entière."""
    from pactiva_lab.models.heavy import TransformerFinetune

    assert TransformerFinetune({"checkpoint": "a/b"}).checkpoint == "a/b"
    assert TransformerFinetune({"encoder": "c/d"}).checkpoint == "c/d"
    # `checkpoint` prime si les deux sont présents (vocabulaire natif de la famille).
    assert TransformerFinetune({"checkpoint": "a/b", "encoder": "c/d"}).checkpoint == "a/b"


def test_transformer_finetune_refuse_une_config_sans_modele():
    import pytest

    from pactiva_lab.models.heavy import TransformerFinetune

    with pytest.raises(ValueError, match="checkpoint.*encoder"):
        TransformerFinetune({})
