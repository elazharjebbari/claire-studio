"""Prétraitement composable — bibliothèque standard uniquement.

Le corpus CLAUDETTE est **pré-tokenisé** : « terms and conditions of use . », « you ' re »,
espaces avant la ponctuation. Or les tokenizers des transformers modernes sont entraînés
sur du texte naturel. La détokenisation est donc probablement le prétraitement le plus
rentable du plan — et le mesurer est en soi un résultat méthodologique utile à la
communauté, personne ne documentant l'effet de ce détail sur les corpus juridiques.

Les étapes sont déclarées dans la configuration et composées ici : ajouter un axe de
prétraitement ne demande qu'une fonction et une clé, jamais de modification du reste.
"""

from __future__ import annotations

import re

# Motifs d'entités à masquer. Masquer évite que le modèle apprenne le nom du service
# plutôt que le thème de la clause — un risque réel sur 50 ToS de grandes marques.
ENTITY_PATTERNS = {
    "url": re.compile(r"https?://\S+|www\.\S+", re.I),
    "email": re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b"),
    "money": re.compile(r"[$€£]\s?\d[\d,.]*|\b\d[\d,.]*\s?(?:usd|eur|gbp|dollars?|euros?)\b", re.I),
    "date": re.compile(
        r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{1,2},?\s+\d{4}\b"
        r"|\b\d{1,2}/\d{1,2}/\d{2,4}\b", re.I,
    ),
    "section_ref": re.compile(r"\b(?:section|clause|article|paragraph)\s+\d+(?:\.\d+)*\b", re.I),
}

# Mots vides propres au juridique : très fréquents, peu discriminants entre thèmes.
LEGAL_STOPWORDS = {
    "shall", "hereby", "herein", "thereof", "hereunder", "pursuant", "whereas",
    "aforementioned", "notwithstanding", "foregoing", "including", "without",
}

ENGLISH_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he",
    "in", "is", "it", "its", "of", "on", "that", "the", "to", "was", "were", "will", "with",
}


def detokenize(text: str) -> str:
    """Restaure une ponctuation naturelle sur du texte tokenisé."""
    out = text
    out = re.sub(r"\s+([,.;:!?%)\]}])", r"\1", out)
    out = re.sub(r"([(\[{$])\s+", r"\1", out)
    out = re.sub(r"\bn\s+'\s*t\b", "n't", out)
    out = re.sub(r"\s+'\s*(s|t|re|ve|ll|d|m)\b", r"'\1", out)
    out = re.sub(r'\s+"\s*', '" ', out)
    out = re.sub(r"\s{2,}", " ", out).strip()
    return out[:1].upper() + out[1:] if out else out


def mask_entities(text: str, kinds: list[str]) -> str:
    for kind in kinds:
        pattern = ENTITY_PATTERNS.get(kind)
        if pattern:
            text = pattern.sub(f"<{kind.upper()}>", text)
    return text


def remove_stopwords(text: str, mode: str) -> str:
    if mode == "none":
        return text
    words = ENGLISH_STOPWORDS if mode == "english" else LEGAL_STOPWORDS | ENGLISH_STOPWORDS
    return " ".join(token for token in text.split() if token.lower() not in words)


def simple_stem(text: str) -> str:
    """Racinisation minimale (suffixes anglais courants).

    Volontairement rudimentaire : importer NLTK pour trois suffixes contredirait le
    principe d'un socle sans dépendance. Suffisant pour la variante TF-IDF, où seul
    compte l'effet relatif de l'axe.
    """
    out = []
    for token in text.split():
        low = token.lower()
        for suffix in ("ations", "ation", "ities", "ingly", "ing", "ies", "ed", "ly", "s"):
            if len(low) > len(suffix) + 3 and low.endswith(suffix):
                low = low[: -len(suffix)]
                break
        out.append(low)
    return " ".join(out)


def build_text(
    sentence,
    *,
    neighbours: list,
    config: dict,
) -> str:
    """Texte d'entrée d'une phrase, contexte et normalisations appliqués.

    `neighbours` : les phrases du MÊME document, dans l'ordre. La fenêtre de contexte est
    strictement bornée au document — une fenêtre qui déborderait sur le contrat suivant
    serait une fuite discrète et coûteuse (elle est testée).
    """
    detok = config.get("detokenize", "regex_rules")
    context = config.get("context") or {}
    before = int(context.get("window_before", 0))
    after = int(context.get("window_after", 0))
    separator = context.get("separator", " [SEP] ")

    def render(item) -> str:
        raw = item.text_detok if detok != "none" else item.text
        if detok == "regex_rules" and raw == item.text:
            raw = detokenize(raw)
        if config.get("mask_entities"):
            raw = mask_entities(raw, config["mask_entities"])
        if config.get("case") == "lower":
            raw = raw.lower()
        mode = config.get("stopwords", "none")
        if mode != "none":
            raw = remove_stopwords(raw, mode)
        normalization = config.get("normalization", "none")
        if normalization in ("stem", "lemma"):
            raw = simple_stem(raw)
        return raw

    position = next(
        (i for i, item in enumerate(neighbours) if item.index == sentence.index), None
    )
    if position is None:
        return render(sentence)

    start = max(0, position - before)
    end = min(len(neighbours), position + after + 1)
    parts = [render(neighbours[i]) for i in range(start, end)]
    text = separator.join(parts)

    if context.get("include_doc_position"):
        # Discrétisé en dixièmes : un modèle textuel ne peut pas exploiter un flottant,
        # mais il exploite très bien un marqueur symbolique de zone du document.
        bucket = min(9, int(sentence.doc_position * 10))
        text = f"<POS{bucket}> {text}"

    max_length = int(config.get("max_length", 128))
    words = text.split()
    if len(words) > max_length:
        text = " ".join(words[:max_length])
    return text


def describe(config: dict) -> str:
    """Résumé lisible du prétraitement — repris dans les tableaux d'ablation."""
    context = config.get("context") or {}
    bits = [f"detok={config.get('detokenize', 'regex_rules')}"]
    if config.get("case") == "lower":
        bits.append("lower")
    if config.get("mask_entities"):
        bits.append("mask=" + "+".join(config["mask_entities"]))
    if config.get("stopwords", "none") != "none":
        bits.append(f"stop={config['stopwords']}")
    if config.get("normalization", "none") != "none":
        bits.append(config["normalization"])
    window = (context.get("window_before", 0), context.get("window_after", 0))
    if any(window):
        bits.append(f"ctx=-{window[0]}/+{window[1]}")
    if context.get("include_doc_position"):
        bits.append("pos")
    return " ".join(bits)
