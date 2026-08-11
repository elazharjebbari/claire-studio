"""Modèles de référence — bibliothèque standard uniquement.

Sans plancher, aucun gain n'est interprétable : un macro-F1 de 0,68 n'a de sens que
comparé à ce que produisent la classe majoritaire, la position dans le document, et un
TF-IDF sommaire. Ces baselines sont souvent redoutables en juridique — leur omission est
la critique la plus fréquente adressée aux articles de ML appliqué au droit.

Quatre familles, toutes sans dépendance :

* `majority`      — la classe la plus fréquente. Le plancher absolu.
* `position_only` — la seule position relative dans le document. **Diagnostique** : si
  elle est forte, le thème d'une clause est largement structurel, ce qui répond à moitié
  à la question du rôle du contexte.
* `tfidf_linear`  — TF-IDF + classifieur linéaire, implémenté à la main.
* `llm_judge`     — les prédictions des quatre juges, lues dans le dataset. Aucune
  inférence n'est relancée : elles sont déjà en base, c'est une baseline gratuite.
"""

from __future__ import annotations

import math
from collections import Counter, defaultdict


class Model:
    """Interface minimale commune. `fit` puis `predict`, rien d'autre."""

    name = "model"

    def fit(self, texts: list[str], labels: list[str], extra: list[dict] | None = None) -> None:
        raise NotImplementedError

    def predict(self, texts: list[str], extra: list[dict] | None = None) -> list[str]:
        raise NotImplementedError

    def predict_proba(
        self, texts: list[str], extra: list[dict] | None = None
    ) -> list[dict[str, float]]:
        """Scores par classe. Par défaut : certitude absolue sur la prédiction, ce qui
        donnera un ECE médiocre — et c'est honnête, une baseline non calibrée doit
        apparaître comme telle."""
        return [{label: 1.0} for label in self.predict(texts, extra)]


class MajorityBaseline(Model):
    name = "majority"

    def fit(self, texts, labels, extra=None):
        self.label = Counter(labels).most_common(1)[0][0] if labels else ""

    def predict(self, texts, extra=None):
        return [self.label] * len(texts)


class PositionBaseline(Model):
    """Prédit le thème le plus fréquent de la zone du document (dixièmes).

    Baseline diagnostique : les ToS suivent une structure très régulière (préambule,
    compte, usage, contenu, résiliation, responsabilité, litiges). Si cette baseline est
    forte, une large part du signal est positionnelle, ce qui oriente la lecture de tous
    les autres résultats.
    """

    name = "position_only"
    BUCKETS = 10

    def fit(self, texts, labels, extra=None):
        extra = extra or [{} for _ in labels]
        counts: dict[int, Counter] = defaultdict(Counter)
        for row, label in zip(extra, labels):
            counts[self._bucket(row.get("doc_position", 0.0))][label] += 1
        self.by_bucket = {
            bucket: counter.most_common(1)[0][0] for bucket, counter in counts.items()
        }
        self.fallback = Counter(labels).most_common(1)[0][0] if labels else ""

    def _bucket(self, position: float) -> int:
        return min(self.BUCKETS - 1, max(0, int(position * self.BUCKETS)))

    def predict(self, texts, extra=None):
        extra = extra or [{} for _ in texts]
        return [
            self.by_bucket.get(self._bucket(row.get("doc_position", 0.0)), self.fallback)
            for row in extra
        ]


class TfidfLinear(Model):
    """TF-IDF + centroïde pondéré (Rocchio), implémenté sans dépendance.

    Le choix du centroïde plutôt que d'une régression logistique est délibéré : il donne
    une baseline solide, déterministe, sans optimisation itérative — donc sans graine à
    surveiller ni risque de non-convergence silencieuse. La variante scikit-learn reste
    disponible en option pour qui veut la régression logistique exacte.
    """

    name = "tfidf_linear"

    def __init__(self, *, ngram_max: int = 1, min_df: int = 2, class_weight: str = "balanced"):
        self.ngram_max = ngram_max
        self.min_df = min_df
        self.class_weight = class_weight

    def _tokens(self, text: str) -> list[str]:
        words = [w for w in text.lower().split() if w]
        grams = list(words)
        for n in range(2, self.ngram_max + 1):
            grams.extend(
                " ".join(words[i : i + n]) for i in range(len(words) - n + 1)
            )
        return grams

    def fit(self, texts, labels, extra=None):
        documents = [self._tokens(t) for t in texts]
        df: Counter = Counter()
        for tokens in documents:
            df.update(set(tokens))
        self.vocabulary = {t for t, n in df.items() if n >= self.min_df}
        total = len(documents) or 1
        self.idf = {
            t: math.log((1 + total) / (1 + df[t])) + 1.0 for t in self.vocabulary
        }

        sums: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        counts: Counter = Counter()
        for tokens, label in zip(documents, labels):
            vector = self._vector(tokens)
            counts[label] += 1
            for term, weight in vector.items():
                sums[label][term] += weight

        # `balanced` : centroïde moyen par classe. Sans cela, une classe à 1 163
        # occurrences écraserait une classe à 31 — exactement le problème de la longue
        # traîne que le macro-F1 met en évidence.
        self.centroids = {}
        for label, vector in sums.items():
            divisor = counts[label] if self.class_weight == "balanced" else 1.0
            centroid = {t: w / divisor for t, w in vector.items()}
            norm = math.sqrt(sum(w * w for w in centroid.values())) or 1.0
            self.centroids[label] = {t: w / norm for t, w in centroid.items()}
        self.fallback = counts.most_common(1)[0][0] if counts else ""

    def _vector(self, tokens: list[str]) -> dict[str, float]:
        counts = Counter(t for t in tokens if t in self.vocabulary)
        if not counts:
            return {}
        vector = {t: (1 + math.log(n)) * self.idf[t] for t, n in counts.items()}
        norm = math.sqrt(sum(w * w for w in vector.values())) or 1.0
        return {t: w / norm for t, w in vector.items()}

    def _scores(self, text: str) -> dict[str, float]:
        vector = self._vector(self._tokens(text))
        if not vector:
            return {}
        return {
            label: sum(weight * centroid.get(term, 0.0) for term, weight in vector.items())
            for label, centroid in self.centroids.items()
        }

    def predict(self, texts, extra=None):
        out = []
        for text in texts:
            scores = self._scores(text)
            out.append(max(scores, key=scores.get) if scores else self.fallback)
        return out

    def predict_proba(self, texts, extra=None):
        out = []
        for text in texts:
            scores = self._scores(text)
            if not scores:
                out.append({self.fallback: 1.0})
                continue
            # Softmax sur les similarités cosinus : donne des scores comparables entre
            # phrases, indispensables pour la calibration et le LRAP.
            top = max(scores.values())
            exponentials = {k: math.exp((v - top) * 8) for k, v in scores.items()}
            total = sum(exponentials.values()) or 1.0
            out.append({k: v / total for k, v in exponentials.items()})
        return out


class LlmJudgeBaseline(Model):
    """Rejoue les prédictions d'un juge LLM déjà présentes dans le dataset.

    N'entraîne rien et n'appelle aucun réseau : les quatre juges ont annoté les 50
    documents, leurs sorties sont dans `judges.jsonl`. C'est le comparateur direct de la
    question « le supervisé bat-il les LLM ? », et il ne coûte rien.
    """

    name = "llm_judge"

    def __init__(self, judge: str, judges_index: dict):
        self.judge = judge
        self.index = judges_index
        self.fallback = ""

    def fit(self, texts, labels, extra=None):
        # Le juge n'apprend pas ; on retient seulement un repli pour les phrases qu'il
        # n'a pas couvertes, afin de ne pas fabriquer d'absence de prédiction.
        self.fallback = Counter(labels).most_common(1)[0][0] if labels else ""

    def predict(self, texts, extra=None):
        extra = extra or [{} for _ in texts]
        out = []
        for row in extra:
            key = (row.get("document"), row.get("index"))
            out.append(self.index.get(key, {}).get(self.judge) or self.fallback)
        return out


def build_model(config: dict, *, judges_index: dict | None = None, seed: int = 42) -> Model:
    """Fabrique le modèle décrit par la configuration.

    Les familles lourdes (`embeddings_head`, `transformer_finetune`, `sequence_labeling`)
    sont importées PARESSEUSEMENT : le socle doit rester utilisable sans torch ni
    scikit-learn, et l'absence d'une dépendance optionnelle doit produire un message
    clair plutôt qu'un ImportError au milieu d'un run.

    `seed` vient de la configuration TOP-NIVEAU (pas de `config["model"]`) : c'est elle
    qui gouverne la reproductibilité du plan scientifique (§3.4) — sans elle,
    `TransformerFinetune` réinitialiserait une tête de classification différente à
    chaque run, et le mélange du DataLoader ne serait pas rejouable.
    """
    family = config.get("family", "majority")
    if family == "majority":
        return MajorityBaseline()
    if family == "position_only":
        return PositionBaseline()
    if family == "tfidf_linear":
        return TfidfLinear(
            ngram_max=int(config.get("ngram_max", 1)),
            min_df=int(config.get("min_df", 2)),
            class_weight=config.get("class_weight", "balanced"),
        )
    if family == "llm_judge":
        return LlmJudgeBaseline(config["judge"], judges_index or {})
    if family in ("embeddings_head", "transformer_finetune", "sequence_labeling"):
        from .heavy import build_heavy_model

        return build_heavy_model(family, config, seed=seed)
    raise ValueError(f"famille de modèle inconnue : {family!r}")
