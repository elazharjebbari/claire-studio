"""Modèles lourds — embeddings gelés, fine-tuning, étiquetage de séquence.

Dépendances **optionnelles** (`sentence-transformers`, `transformers`, `torch`,
`scikit-learn`), importées paresseusement. Le socle du package doit rester exécutable
sans elles : on veut pouvoir lancer les baselines sur une frontale Grid'5000 ou sur le
VPS sans y installer PyTorch.

Quand une dépendance manque, on lève un message qui dit **quoi installer** — plutôt qu'un
`ImportError` opaque au milieu d'un run de plusieurs heures.
"""

from __future__ import annotations

import hashlib
import json
import os
from collections import Counter
from pathlib import Path

from .baselines import Model


class MissingDependency(RuntimeError):
    """Dépendance optionnelle absente — avec la commande d'installation."""


def _require(module: str, extra: str):
    try:
        return __import__(module)
    except ImportError as exc:  # pragma: no cover - dépend de l'environnement
        raise MissingDependency(
            f"'{module}' est requis pour ce modèle. "
            f"Installer avec : pip install 'pactiva-lab[{extra}]'"
        ) from exc


class EmbeddingCache:
    """Cache d'embeddings sur disque, indexé par (modèle, empreinte du texte).

    Encoder est le poste de coût dominant des approches à embeddings gelés. Avec ce
    cache, comparer quatre têtes de classification sur le même encodeur devient quasi
    gratuit — c'est ce qui rend le criblage réaliste sans GPU.
    """

    def __init__(self, root: str | Path | None = None):
        self.root = Path(root or os.environ.get("PACTIVA_LAB_CACHE", ".cache/embeddings"))
        self.root.mkdir(parents=True, exist_ok=True)
        self.hits = 0
        self.misses = 0

    def _path(self, encoder: str, text: str) -> Path:
        digest = hashlib.sha256((encoder + "\n" + text).encode("utf-8")).hexdigest()
        return self.root / f"{digest}.json"

    def get(self, encoder: str, texts: list[str]) -> list[list[float] | None]:
        """Un vecteur par texte, `None` pour chaque manque — jamais tout-ou-rien.

        Indexé PAR PHRASE plutôt que par lot entier : en validation croisée, les plis se
        recouvrent à ~80 % (mêmes phrases, ensembles train/test différents), et un lot
        entier n'est presque jamais identique bit à bit d'un pli à l'autre. Avec un lot
        entier comme clé, le cache ne servait donc quasiment jamais — tout le corpus était
        ré-encodé à chaque pli. C'est ce qui a fait déborder le délai d'un run réel en
        production (`embeddings-frozen`, 12 août 2026) : un seul pli sur cinq a suffi à
        dépasser l'heure.
        """
        result = []
        for text in texts:
            path = self._path(encoder, text)
            if path.exists():
                self.hits += 1
                result.append(json.loads(path.read_text(encoding="utf-8")))
            else:
                self.misses += 1
                result.append(None)
        return result

    def put(self, encoder: str, texts: list[str], vectors: list[list[float]]) -> None:
        for text, vector in zip(texts, vectors):
            self._path(encoder, text).write_text(json.dumps(vector), encoding="utf-8")


class EmbeddingsHead(Model):
    """Encodeur gelé + tête légère (régression logistique, SVM, k-NN, MLP).

    Le k-NN mérite une mention : il fournit une **explication par l'exemple** (« cette
    phrase ressemble à celles-ci, étiquetées ainsi »), ce qui a une valeur propre en
    AI & Law et pourrait alimenter les suggestions de l'atelier d'annotation.
    """

    name = "embeddings_head"

    def __init__(self, config: dict, seed: int = 42):
        self.encoder_name = config["encoder"]
        self.head_name = config.get("head", "logreg")
        self.pooling = config.get("pooling", "mean")
        self.knn_k = int(config.get("knn_k", 5))
        self.use_cache = bool(config.get("cache_embeddings", True))
        self.seed = seed
        self._encoder = None
        self._cache = EmbeddingCache() if self.use_cache else None

    def _encode(self, texts: list[str]) -> list[list[float]]:
        if self._cache is None:
            st = _require("sentence_transformers", "embeddings")
            if self._encoder is None:
                self._encoder = st.SentenceTransformer(self.encoder_name)
            return self._encoder.encode(texts, show_progress_bar=False).tolist()

        vectors = self._cache.get(self.encoder_name, texts)
        missing = [i for i, v in enumerate(vectors) if v is None]
        if missing:
            st = _require("sentence_transformers", "embeddings")
            if self._encoder is None:
                self._encoder = st.SentenceTransformer(self.encoder_name)
            missing_texts = [texts[i] for i in missing]
            fresh = self._encoder.encode(missing_texts, show_progress_bar=False).tolist()
            self._cache.put(self.encoder_name, missing_texts, fresh)
            for i, vector in zip(missing, fresh):
                vectors[i] = vector
        return vectors

    def _build_head(self):
        sklearn = _require("sklearn", "sklearn")  # noqa: F841
        from sklearn.linear_model import LogisticRegression
        from sklearn.neighbors import KNeighborsClassifier
        from sklearn.neural_network import MLPClassifier
        from sklearn.svm import LinearSVC

        # `random_state=self.seed` partout où l'API le permet (même quand l'algorithme
        # est déterministe par défaut, comme LogisticRegression pour la plupart des
        # solveurs) : un audit ne devrait jamais avoir à deviner quelles familles de
        # modèle respectent la graine et lesquelles l'ignorent silencieusement.
        if self.head_name == "linear_svm":
            return LinearSVC(class_weight="balanced", random_state=self.seed)
        if self.head_name == "knn":
            return KNeighborsClassifier(n_neighbors=self.knn_k)
        if self.head_name == "mlp":
            return MLPClassifier(
                hidden_layer_sizes=(256,), max_iter=400, random_state=self.seed
            )
        return LogisticRegression(
            max_iter=2000, class_weight="balanced", n_jobs=-1, random_state=self.seed
        )

    def fit(self, texts, labels, extra=None):
        self.head = self._build_head()
        self.head.fit(self._encode(texts), labels)
        self.fallback = Counter(labels).most_common(1)[0][0] if labels else ""

    def predict(self, texts, extra=None):
        return list(self.head.predict(self._encode(texts)))

    def predict_proba(self, texts, extra=None):
        vectors = self._encode(texts)
        if hasattr(self.head, "predict_proba"):
            classes = list(self.head.classes_)
            return [
                dict(zip(classes, row)) for row in self.head.predict_proba(vectors)
            ]
        return [{label: 1.0} for label in self.head.predict(vectors)]


class TransformerFinetune(Model):
    """Fine-tuning d'un encodeur (Legal-BERT, RoBERTa, DeBERTa, ModernBERT).

    ⚠️ Sur Grid'5000, vérifier que `pytorch-cuda` correspond au CUDA du nœud : en cas de
    désaccord, PyTorch ne voit pas le GPU et l'entraînement se poursuit sur CPU pendant
    des heures sans le signaler. Le script de lancement pose un garde-fou explicite.
    """

    name = "transformer_finetune"

    def __init__(self, config: dict, seed: int = 42):
        self.config = config
        # `checkpoint` (vocabulaire transformer_finetune) OU `encoder` (vocabulaire des
        # familles embeddings/sequence_labeling — « l'étiquetage de séquence partage
        # l'encodeur »). Bug réel attrapé par la campagne de validation du 15 août 2026 :
        # le preset sequence-boundary déclarait `encoder:` et le run GPU réel échouait
        # en KeyError('checkpoint') après une réservation Grid'5000 entière.
        self.checkpoint = config.get("checkpoint") or config.get("encoder")
        if not self.checkpoint:
            raise ValueError(
                "config du modèle sans `checkpoint` ni `encoder` — un nom de modèle "
                "pré-entraîné est requis pour le fine-tuning"
            )
        self.seed = seed

    def fit(self, texts, labels, extra=None):
        torch = _require("torch", "transformers")
        transformers = _require("transformers", "transformers")
        from torch.utils.data import DataLoader, TensorDataset

        # DOIT précéder `from_pretrained` : la tête de classification (jamais présente
        # dans les poids pré-entraînés) est réinitialisée aléatoirement à chaque appel —
        # sans cette graine, deux runs de MÊME configuration produiraient des poids de
        # départ différents, et donc des résultats différents. C'était un manque réel :
        # `seed` figurait dans la configuration (destiné au rééchantillonnage bootstrap)
        # sans jamais atteindre ce modèle, jusqu'à l'audit de reproductibilité.
        torch.manual_seed(self.seed)

        cfg = self.config
        self.classes = sorted(set(labels))
        index = {label: i for i, label in enumerate(self.classes)}

        tokenizer = transformers.AutoTokenizer.from_pretrained(self.checkpoint)
        model = transformers.AutoModelForSequenceClassification.from_pretrained(
            self.checkpoint, num_labels=len(self.classes)
        )
        # fp32 FORCÉ : transformers 5 charge au dtype DU CHECKPOINT — celui de
        # deberta-v3 est en fp16, et l'entraînement plantait en « expected scalar type
        # Half but found Float » (run GPU réel, campagne de validation du 16 août
        # 2026). legal-bert/roberta/ModernBERT passaient par chance : checkpoints fp32.
        model = model.float()
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model.to(device)

        encoded = tokenizer(
            texts, truncation=True, padding=True,
            max_length=int(cfg.get("max_length", 128)), return_tensors="pt",
        )
        targets = torch.tensor([index[label] for label in labels])
        # Générateur EXPLICITE plutôt que l'état RNG global de torch : rejouable même si
        # d'autres opérations aléatoires ont eu lieu entre-temps dans le même processus
        # (par exemple un pli précédent d'une validation croisée).
        shuffle_generator = torch.Generator().manual_seed(self.seed)
        loader = DataLoader(
            TensorDataset(encoded["input_ids"], encoded["attention_mask"], targets),
            batch_size=int(cfg.get("batch_size", 16)), shuffle=True,
            generator=shuffle_generator,
        )

        # Pondération inverse à la fréquence : sans elle, les thèmes rares (FEEDBACK à
        # 0,34 % du corpus) ne sont jamais prédits et le macro-F1 s'effondre.
        counts = Counter(labels)
        weights = torch.tensor(
            [len(labels) / (len(self.classes) * counts[c]) for c in self.classes],
            dtype=torch.float,
        ).to(device)
        loss_fn = torch.nn.CrossEntropyLoss(
            weight=weights if cfg.get("loss", "weighted_ce") == "weighted_ce" else None
        )
        optimizer = torch.optim.AdamW(
            model.parameters(), lr=float(cfg.get("learning_rate", 2e-5)),
            weight_decay=float(cfg.get("weight_decay", 0.01)),
        )

        model.train()
        for _ in range(int(cfg.get("epochs", 5))):
            for input_ids, attention_mask, target in loader:
                optimizer.zero_grad()
                output = model(
                    input_ids=input_ids.to(device), attention_mask=attention_mask.to(device)
                )
                loss = loss_fn(output.logits, target.to(device))
                loss.backward()
                optimizer.step()

        self.model, self.tokenizer, self.device = model, tokenizer, device

    def predict(self, texts, extra=None):
        return [max(scores, key=scores.get) for scores in self.predict_proba(texts, extra)]

    def predict_proba(self, texts, extra=None):
        torch = _require("torch", "transformers")
        self.model.eval()
        out = []
        batch_size = int(self.config.get("batch_size", 16))
        with torch.no_grad():
            for start in range(0, len(texts), batch_size):
                chunk = texts[start : start + batch_size]
                encoded = self.tokenizer(
                    chunk, truncation=True, padding=True,
                    max_length=int(self.config.get("max_length", 128)), return_tensors="pt",
                ).to(self.device)
                probabilities = torch.softmax(self.model(**encoded).logits, dim=-1)
                for row in probabilities.cpu().tolist():
                    out.append(dict(zip(self.classes, row)))
        return out


def build_heavy_model(family: str, config: dict, seed: int = 42) -> Model:
    if family == "embeddings_head":
        return EmbeddingsHead(config, seed=seed)
    if family in ("transformer_finetune", "sequence_labeling"):
        # L'étiquetage de séquence partage l'encodeur ; le CRF viendra en surcouche.
        return TransformerFinetune(config, seed=seed)
    raise ValueError(f"famille lourde inconnue : {family!r}")
