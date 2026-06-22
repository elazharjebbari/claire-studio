"""Moteur de triage — MIROIR Python de frontend/src/lib/triage/engine.ts.

Fonction PURE : (theme_votes, boundary_votes, rules) -> dict | None. Doit produire EXACTEMENT
le même routage que le moteur TS (parité testée sur un golden partagé). Sert au pré-calcul
batch / à la consolidation oracle côté serveur. Codes CANONIQUES de l'app.
"""

from __future__ import annotations

from collections import Counter

from .rules import RULES


def _is_refuge(theme: str, rules: dict) -> bool:
    return theme in rules["refuges"]


def _priority_index(theme: str, rules: dict) -> int:
    try:
        return rules["priority"].index(theme)
    except ValueError:
        return 10**9


def _rank_stable(counts: Counter, rules: dict) -> list[tuple[str, int]]:
    # support décroissant, puis index de priorité croissant (déterministe, ordre-indépendant).
    return sorted(
        counts.items(),
        key=lambda kv: (-kv[1], _priority_index(kv[0], rules)),
    )


def _cluster_of(a: str, b: str, rules: dict) -> bool:
    return any(
        (x == a and y == b) or (x == b and y == a) for (x, y) in rules["clusters"]
    )


def _find_cluster_pair(themes: list[str], rules: dict):
    uniq = [t for t in dict.fromkeys(themes) if not _is_refuge(t, rules)]
    for i in range(len(uniq)):
        for j in range(i + 1, len(uniq)):
            if _cluster_of(uniq[i], uniq[j], rules):
                return (uniq[i], uniq[j])
    return None


def _choose_primary(a: str, b: str, counts: Counter, rules: dict):
    for p in rules["precedence"]:
        if p["over"] == a and p["under"] == b:
            return a, b, f"préséance {a}>{b}"
        if p["over"] == b and p["under"] == a:
            return b, a, f"préséance {b}>{a}"
    ca, cb = counts.get(a, 0), counts.get(b, 0)
    if ca != cb:
        return (a, b, "majorité de votes") if ca > cb else (b, a, "majorité de votes")
    if _priority_index(a, rules) <= _priority_index(b, rules):
        return a, b, "liste de priorité"
    return b, a, "liste de priorité"


def _votes_view(theme_votes: dict) -> str:
    return " · ".join(f"{j}:{t}" for j, t in theme_votes.items())


def triage_engine(
    theme_votes: dict,
    boundary_votes: dict,
    rules: dict | None = None,
    structural_hard_trigger: bool = False,
):
    """Trie une phrase. Renvoie None si < min_judges (carte masquée)."""
    rules = rules or RULES
    norm = {j: rules["theme_aliases"].get(t, t) for j, t in theme_votes.items()}
    judges = list(norm.keys())
    total = len(judges)
    if total < rules["thresholds"]["min_judges"]:
        return None

    themes = [norm[j] for j in judges]
    counts = Counter(themes)
    ranked = _rank_stable(counts, rules)
    top_label, top_support = ranked[0]

    b_support = sum(1 for j in judges if boundary_votes.get(j) is True)
    boundary = {
        "type": "hard" if (b_support == total or structural_hard_trigger) else "soft",
        "support": b_support,
    }

    ctx = _votes_view(theme_votes)
    candidates = [lbl for lbl, _ in ranked]

    def out(level, action, label_mode, disagreement, labels, explanation, needs_human, override=None):
        r = {
            "level": level,
            "action": action,
            "label_mode": label_mode,
            "disagreement_type": disagreement,
            "labels": labels,
            "candidates": candidates,
            "boundary": boundary,
            "explanation": explanation,
            "needs_human": needs_human,
            "rules_version": rules["version"],
        }
        if override is not None:
            r["override"] = override
        return r

    def mono(label, support):
        return [{"label": label, "role": "primary", "support": support}]

    # ── UNANIME ──
    if top_support == total:
        if boundary["type"] == "hard":
            return out("C1", "batch_accept", "mono", "accord", mono(top_label, total),
                       {"context": ctx, "decision": f"{top_label} · frontière dure ({total}/{total})",
                        "logic": "accord unanime sur le thème et la frontière → acceptation par lot."},
                       False)
        return out("C2", "confirm", "mono", "accord", mono(top_label, total),
                   {"context": ctx, "decision": f"{top_label} · frontière molle ({b_support}/{total})",
                    "logic": "thème unanime mais frontière en majorité : confirmer (fusion/scission possible)."},
                   True)

    has_majority = top_support * 2 > total

    if has_majority:
        maj = top_label
        non_maj = [(lbl, sup) for (lbl, sup) in ranked if lbl != maj]
        dissident_top = non_maj[0][0] if non_maj else maj

        # 1. cluster (tous dissidents ; prime sur override)
        partner = next(
            (lbl for (lbl, _) in non_maj
             if not _is_refuge(maj, rules) and not _is_refuge(lbl, rules) and _cluster_of(maj, lbl, rules)),
            None,
        )
        if partner is not None:
            primary, secondary, rule = _choose_primary(maj, partner, counts, rules)
            return out("C3", "validate_set", "multi", "cluster_multilabel",
                       [{"label": primary, "role": "primary", "support": counts.get(primary, 0)},
                        {"label": secondary, "role": "secondary", "support": counts.get(secondary, 0)}],
                       {"context": ctx, "decision": f"multi : {primary} (primaire) + {secondary} (secondaire)",
                        "logic": f"couple de cluster {maj}↔{partner} = chevauchement juridique réel ; primaire par {rule}."},
                       True)

        # 2. majorité-refuge → C5
        if _is_refuge(maj, rules):
            k = rules["reliability_kappa"].get(maj)
            return out("C5", "arbitrate", "open", "eclate", [],
                       {"context": ctx, "decision": "aucune présélection",
                        "logic": f"la majorité est un refuge ({maj}" + (f", κ={k}" if k is not None else "") +
                                 "), peu fiable → arbitrage humain plutôt qu'acceptation."},
                       True)

        # 3. override anti-refuge : majorité précise + tous dissidents refuges
        if non_maj and all(_is_refuge(lbl, rules) for (lbl, _) in non_maj):
            k = rules["reliability_kappa"].get(dissident_top)
            return out("C2", "confirm", "mono", "accord", mono(maj, top_support),
                       {"context": ctx, "decision": maj,
                        "logic": f"override anti-refuge : {dissident_top} est un refuge" +
                                 (f" (κ={k})" if k is not None else "") +
                                 f" → on impose le précis {maj}. Réversible (valeur d'origine conservée)."},
                       True, override={"kind": "refuge_to_precis", "from": dissident_top, "to": maj})

        # 4. C4
        return out("C4", "verify", "mono", "majorite_autre", mono(maj, top_support),
                   {"context": ctx, "decision": f"{maj} (majorité {top_support}/{total})",
                    "logic": f"majorité hors refuge/cluster : vérifier le candidat minoritaire {dissident_top} avant d'accepter."},
                   True)

    # ── ÉCLATÉ ──
    pair = _find_cluster_pair(themes, rules)
    if pair is not None:
        primary, secondary, rule = _choose_primary(pair[0], pair[1], counts, rules)
        return out("C3", "validate_set", "multi", "cluster_multilabel",
                   [{"label": primary, "role": "primary", "support": counts.get(primary, 0)},
                    {"label": secondary, "role": "secondary", "support": counts.get(secondary, 0)}],
                   {"context": ctx, "decision": f"multi : {primary} (primaire) + {secondary} (secondaire)",
                    "logic": f"votes éclatés mais couple de cluster {pair[0]}↔{pair[1]} présent → multi-label ; primaire par {rule}."},
                   True)

    return out("C5", "arbitrate", "open", "eclate", [],
               {"context": ctx, "decision": "aucune présélection",
                "logic": "votes éclatés (refuge/bruit) : votre jugement fait foi ; choisir 1, créer un multi, ou marquer indécidable."},
               True)
