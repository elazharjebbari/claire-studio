# Runbook V9.2 — juge **Mistral** (session 3) — segmentation thématique + nature dérivée

> **À lire d'abord** : `annotations/PROMPT_V9_2_MISTRAL.md` (la spec d'annotation).
> **But** : produire un **3ᵉ juge** (`mistral`, modèle `mistral-medium-3.5` via le CLI
> `vibe`) au **format V9.2 strict**, comparable aux sessions déjà faites
> `v9_2_session1_claude/` et `v9_2_session2_codex/` (50 docs chacune).
> **Principe** : la couche LLM ne fait que la **segmentation thématique** ; la
> `legal_nature` est **dérivée par script** (`derive_legal_nature.py`), hors-prompt.
> **Découpage** : phase pilote (10 docs) → si validation propre → phase d'échelle (40
> docs restants). Mêmes 10 docs pilotes que les sessions précédentes.

---

## 0. ⚠ Indépendance des juges (BLOQUANT pour la validité)

`vibe` scanne le dépôt. **Mistral ne doit jamais lire** les annotations des autres juges,
en particulier `docs/reflexion/2026-06-02_segmentation-ancree-plan/ref_v9_2/`
(qui contient `v9_2_session1_claude/` et `v9_2_session2_codex/`), ni aucun autre dossier
`*_session*` / `v3_*` / `v9_*` / `ref_*` d'annotation. Sources autorisées :
`PROMPT_V9_2_MISTRAL.md`, ce runbook, `data/raw/claudette_tos/Sentences/<doc>.txt`,
`data/processed/v9_docfeatures/<doc>_docfeatures.json`. (Rappel intégral : PROMPT §0.)

---

## 1. Pré-requis CLI Mistral (`vibe`) — à faire une seule fois

```bash
# 1) Installer / mettre à jour le CLI
uv tool install mistral-vibe        # ou : uv tool upgrade mistral-vibe

# 2) Authentification (clé API Mistral)
export MISTRAL_API_KEY="sk-…"        # ou : vibe --setup (assistant interactif)

# 3) Fixer le modèle au niveau projet : .vibe/config.toml (déjà créé par ce livrable)
#    active_model = "mistral-medium-3.5"   (alias roulant : "mistral-vibe-cli-latest")
cat .vibe/config.toml
```

> Le fichier `./.vibe/config.toml` (niveau projet) **prime** sur `~/.vibe/config.toml`.
> Vérifie que `active_model` vaut bien `mistral-medium-3.5` avant de lancer.

---

## 2. Phases et listes de documents

**Phase pilote (10 docs, stratifiés — court/long/numéroté/narratif/durs)** :

```
Amazon Crowdtangle Endomondo Google Headspace Instagram Skype Spotify WhatsApp eBay
```

**Phase d'échelle (40 docs restants)** :

```
9gag Academia Airbnb Atlas Betterpoints_UK Booking Deliveroo Dropbox Duolingo Evernote
Facebook Fitbit LindenLab LinkedIn Masquerade Microsoft Moves-app Netflix Nintendo Oculus
Onavo PokemonGo Rovio Skyscanner Snap Supercell Syncme Tinder TripAdvisor TrueCaller
Twitter Uber Viber Vimeo Vivino WorldOfWarcraft Yahoo YouTube Zynga musically
```

---

## 3. Boucle d'annotation (ce que `vibe` exécute pour CHAQUE doc)

Pour un document `<doc>` :

1. `n = grep -cve '^[[:space:]]*$' data/raw/claudette_tos/Sentences/<doc>.txt`
   → nombre **exact** d'entrées attendues.
2. Lire entièrement `data/raw/claudette_tos/Sentences/<doc>.txt` et
   `data/processed/v9_docfeatures/<doc>_docfeatures.json`.
3. Appliquer **PROMPT_V9_2_MISTRAL.md** : produire `document_plan` + `annotations`
   (`id` 0..n−1, `theme`, `block_id`, `is_block_start`, justification aux frontières).
4. Écrire `annotations/v9_2_session3_mistral/<doc>_mistral.json` (JSON valide, `judge`
   = `"mistral"`, `doc` = nom exact).
5. **Auto-valider ce seul fichier** (étape 4 ci-dessous) ; si erreur → corriger et
   re-valider **jusqu'à 0 erreur** avant de passer au doc suivant.

---

## 4. Validation segmentation (BLOQUANTE)

Par fichier (dans la boucle) :

```bash
python3 scripts/validate_v9_2_annotations.py annotations/v9_2_session3_mistral/<doc>_mistral.json
```

À la fin d'une phase (contrôle global) :

```bash
python3 scripts/validate_v9_2_annotations.py annotations/v9_2_session3_mistral/
```

Cible : **0 erreur**. Les erreurs `I1` (mapping 1-N), `I2` (id), `I5` (block_id),
`I6` (is_block_start), `I7` (un thème/bloc), `I8` (justification de frontière) sont
**bloquantes**. Les `W evidence_span` (warning) sont tolérés mais à minimiser.

---

## 5. Commandes de lancement `vibe` (mode non-interactif)

**Pilote** (10 docs) :

```bash
vibe --agent auto-approve --output text --max-turns 800 \
  --prompt "Lis @annotations/RUNBOOK_V9_2_MISTRAL.md et @annotations/PROMPT_V9_2_MISTRAL.md. \
Annote SEULEMENT les 10 documents de la phase pilote (§2). Pour chaque doc, suis la boucle §3 \
et valide §4 jusqu'à 0 erreur avant de passer au suivant. INTERDICTION de lire les dossiers \
des autres juges (PROMPT §0). N'écris que dans annotations/v9_2_session3_mistral/."
```

**Échelle** (40 docs restants), une fois le pilote validé propre :

```bash
vibe --agent auto-approve --output text --max-turns 3000 \
  --prompt "Lis @annotations/RUNBOOK_V9_2_MISTRAL.md et @annotations/PROMPT_V9_2_MISTRAL.md. \
Annote les 40 documents de la phase d'échelle (§2) NON encore présents dans \
annotations/v9_2_session3_mistral/. Boucle §3, validation §4 jusqu'à 0 erreur par doc. \
Indépendance stricte (PROMPT §0)."
```

> Garde-fous coût/itérations : `--max-turns N` (cap de tours) ; option `--max-price D`
> (budget $) et `--max-tokens N` si tu veux borner. `--agent auto-approve` évite les
> confirmations interactives (écritures de fichiers + `grep`/`python3` de validation).
> Tu peux restreindre l'outillage avec `--enabled-tools` si besoin.

---

## 6. Post-traitement (après les 50 docs validés)

### 6.1 Dérivation déterministe de la nature (hors-prompt)

```bash
python3 scripts/derive_legal_nature.py \
  --in annotations/v9_2_session3_mistral --out annotations/v9_2_session3_mistral
```

(Ajoute `legal_nature` + `legal_nature_marker` en place. Best-effort, **jamais** un
critère GO.) Re-valider ensuite si besoin (la nature est optionnelle pour le validateur).

### 6.2 Récapitulatif

```bash
python3 scripts/validate_v9_2_annotations.py annotations/v9_2_session3_mistral/
```

---

## 7. Mesure inter-juges à 3 juges (script dédié)

Quand les 50 docs Mistral sont validés + nature dérivée, lance
`scripts/compute_iaa_v9_2_multi.py` (N juges : **κ Cohen par paire** + **κ Fleiss** +
**unanimité/majorité** + top confusions de thèmes par paire) :

```bash
REF=docs/reflexion/2026-06-02_segmentation-ancree-plan/ref_v9_2
python3 scripts/compute_iaa_v9_2_multi.py \
  --judge claude=$REF/v9_2_session1_claude \
  --judge codex=$REF/v9_2_session2_codex \
  --judge mistral=annotations/v9_2_session3_mistral \
  --out docs/livrables/2026-06-XX_v9.2-3juges/iaa3.json
```

- Sans `--docs` : **intersection auto** des docs présents chez les 3 juges (ne mesure que
  les docs alignés ; longueurs différentes → doc ignoré avec avertissement).
- **Validé** : sur claude↔codex, reproduit **exactement** le κ Cohen du script 2-juges
  d'origine (`compute_iaa_v9_2.py`). Le κ Fleiss est l'accord global des 3 juges.
- **Oracle consensus** : `unanimity_pct` (les 3 d'accord) sert de base aux blocs
  d'oracle ; les dissensus (`top_confusions`) sont les paires « à arbitrer ».

> Le script d'origine `compute_iaa_v9_2.py` (claude vs codex, même dossier) reste
> inchangé. Le nouveau script généralise à N juges sans le casser.

---

## 8. Critères (rappel V9.2, non bloquants pour la production des fichiers)

| # | Hypothèse | Métrique | Cible |
|---|---|---|---|
| L5 | segmentation tient | κ thème global (par paire incluant Mistral) | ≥ 0,70 |
| — | pas de doc effondré | κ thème min par doc | ≥ 0,55 |
| L2 | couverture nature | % non-UNKNOWN (dérivée) | ≥ 40 % (best-effort) |

---

## 9. Checklist

- [ ] `vibe` installé, `MISTRAL_API_KEY` configurée, `active_model = mistral-medium-3.5`.
- [ ] dossier `annotations/v9_2_session3_mistral/` présent ; indépendance respectée (§0).
- [ ] pilote 10 docs annotés → validation **0 erreur** → décision de continuer.
- [ ] échelle 40 docs annotés → validation globale **0 erreur** (50/50).
- [ ] nature dérivée (script) ; récap de couverture.
- [ ] mesure inter-juges à 3 juges traitée séparément (§7) ; verdict consigné dans un livrable daté.
