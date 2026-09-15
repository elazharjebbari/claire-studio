# Runbook V9.2 — segmentation V9 + nature dérivée, validation stratifiée puis 50 docs

> **À lire d'abord** : `annotations/PROMPT_V9_2.md`.
> **Principe** : la couche LLM ne fait que la **segmentation thématique** (= V9,
> intacte) ; la **`legal_nature` est dérivée par script** (`derive_legal_nature.py`),
> hors-prompt. La phase A (sur les 5 docs, sans ré-annotation) a confirmé : **κ thème
> = 0,746 préservé**, nature best-effort (couverture ~41 %).

---

## 0. Contexte

- V9.1 (nature jugée par le LLM) = NO-GO (dégradait la segmentation). V9.2 corrige en
  **sortant la nature du prompt**.
- **Phase A (faite)** : dérivation sur annotations V9 → κ thème inchangé, nature
  couvrante à ~41 %, best-effort. Voir `docs/livrables/2026-05-29_v9.2-phaseA/`.
- **Phase B** (ce runbook) : valider la **segmentation** sur un échantillon
  **stratifié** (non-régression hors des pires cas) avant de scaler.
- **Phase C** : montée en charge sur les **50 documents**.
- 2 juges (Claude, Codex), **Opus uniquement**. Pas de 3ᵉ juge ni gold à ce stade.

---

## 1. ⚠ Indépendance des juges

- **Déplacer hors de `annotations/`** : tout l'historique (`v3_*` … `v9_1_*`) et les
  anciens `PROMPT_*`/`RUNBOOK_*`.
- **Conserver** : `PROMPT_V9_2.md`, `RUNBOOK_V9_2.md`, `v9_2_session1_claude/`,
  `v9_2_session2_codex/`.
- Références (hors `annotations/`, non affectées) : `…/ref_v9/`, `…/ref_v8_1/`,
  `…/ref_v9_1/`, `data/processed/v9_docfeatures/`.

---

## 2. Pipeline (phases B et C)

### Étape 1 — Sélection de l'échantillon

- **Phase B** : **~8-12 docs stratifiés** couvrant les profils : numéroté
  (YouTube, Atlas), narratif (WhatsApp, Spotify…), liste-lourd, long (Microsoft,
  Endomondo), court, plateforme ; **inclure 2-3 des 5 pires** (Twitter, Tinder) pour
  contrôler la stabilité.
- **Phase C** : les 50 documents.

### Étape 2 — Couche 0 (docfeatures)

```bash
python3 scripts/extract_document_features_v9.py <doc1> <doc2> ...
```

### Étape 3 — Annotation segmentation (Claude puis Codex, sessions vierges)

Fournir `PROMPT_V9_2.md` + source + docfeatures. Sorties :
`annotations/v9_2_session1_claude/<doc>_claude.json`,
`annotations/v9_2_session2_codex/<doc>_codex.json`. Indépendance stricte.

### Étape 4 — Validation segmentation (BLOQUANTE)

```bash
python3 scripts/validate_v9_2_annotations.py annotations/v9_2_session1_claude/
python3 scripts/validate_v9_2_annotations.py annotations/v9_2_session2_codex/
```

### Étape 5 — Dérivation déterministe de la nature

```bash
python3 scripts/derive_legal_nature.py --in annotations/v9_2_session1_claude --out annotations/v9_2_session1_claude
python3 scripts/derive_legal_nature.py --in annotations/v9_2_session2_codex  --out annotations/v9_2_session2_codex
```
(Écrase en place en ajoutant `legal_nature` + `legal_nature_marker`. Re-valider si besoin.)

### Étape 6 — Mesure

```bash
python3 scripts/compute_iaa_v9_2.py --dir annotations/v9_2_session1_claude \
    --docs <docs...> --plausibility-ref docs/reflexion/.../ref_v9_1 \
    --out docs/livrables/2026-05-XX_v9.2-phaseB/iaa.json
```
*(Pour κ thème inter-juge, le dossier doit contenir `<doc>_claude.json` ET
`<doc>_codex.json` ; sinon adapter, ou comparer les deux dossiers.)*

---

## 3. Critères

### Phase B — GO scaling (50 docs)

| # | Hypothèse | Métrique | Cible | Réfutée si |
|---|---|---|---|---|
| L5 | segmentation tient hors des pires cas | κ thème global | ≥ 0,70 | < 0,60 |
| — | pas de doc effondré | κ thème min par doc | ≥ 0,55 | un doc < 0,45 |
| — | non-régression cas faciles | κ thème (Atlas, YouTube) | ≥ 0,80 | < 0,70 |
| L2 | couverture nature | % non-UNKNOWN | ≥ 40 % (best-effort assumé) | — |

### Phase C — oracle final

- κ thème global ≥ 0,68 (L6) ; consensus = blocs où Claude et Codex s'accordent sur le
  thème ; dissensus marqué « à arbitrer » (3ᵉ juge / gold ultérieurs).
- Livrable : oracle = {blocs thématiques (contenu), thème (consensus), nature dérivée
  best-effort}.

---

## 4. Garde-fous

- **Une variable** : V9.2 ne change que « la nature sort du prompt ». La règle de
  préséance `LICENSE>USER` (intégrée au PROMPT_V9_2 §3.1) est à **surveiller** en
  phase B (vérifier qu'elle n'introduit pas de nouvelle confusion thématique).
- **Banc ≠ terrain d'itération** ; **fiabilité ≠ validité** (pas de gold) ;
  **intégrité** : `len(claude)==len(codex)==n_src` (bloquant).
- **La nature est best-effort** : ne JAMAIS en faire un critère GO ; l'aval consomme
  thème + contenu de bloc.

---

## 5. Checklist

- [ ] échantillon (B) ou 50 docs (C) sélectionné ; historique déplacé hors `annotations/`.
- [ ] docfeatures générés ; Claude + Codex annotés (segmentation, sessions vierges).
- [ ] validation segmentation : 0 erreur.
- [ ] nature dérivée (script) ; mesures κ thème + couverture calculées.
- [ ] verdict L5/L6 consigné dans un livrable daté.
