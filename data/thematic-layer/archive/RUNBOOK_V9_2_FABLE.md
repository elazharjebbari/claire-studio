# Runbook V9.2 — juge **Fable** (session 4) — segmentation thématique + nature dérivée

> **À lire d'abord** : `annotations/PROMPT_V9_2_FABLE.md` (la spec d'annotation).
> **But** : produire un **4ᵉ juge** (`fable`, modèle `claude-fable-5` via Claude Code)
> au **format V9.2 strict**, comparable aux sessions déjà faites
> `v9_2_session1_claude/`, `v9_2_session2_codex/` et `v9_2_session3_mistral/`
> (50 docs chacune).
> **Principe** : la couche LLM ne fait que la **segmentation thématique** ; la
> `legal_nature` est **dérivée par script** (`derive_legal_nature.py`), hors-prompt.
> **Découpage** : phase pilote (10 docs) → si validation propre → phase d'échelle (40
> docs restants). Mêmes 10 docs pilotes que les sessions précédentes.

---

## 0. ⚠ Indépendance des juges (BLOQUANT pour la validité)

Claude Code scanne le dépôt. **Fable ne doit jamais lire** les annotations des autres
juges. Avant de lancer :

- **Déplacer hors de `annotations/`** tout l'historique de la campagne : les dossiers
  `v9_2_session1_claude/`, `v9_2_session2_codex/`, `v9_2_session3_mistral/` et les
  anciens `PROMPT_V9_2*.md` / `RUNBOOK_V9_2*.md` (Claude, Codex, Mistral).
- **Conserver dans `annotations/`** uniquement : `PROMPT_V9_2_FABLE.md`,
  `RUNBOOK_V9_2_FABLE.md`, et le dossier de sortie `v9_2_session4_fable/` (le créer
  vide si absent).
- Pendant l'exécution, **interdiction de lire** : `docs/` **en intégralité** (contient
  `docs/reflexion/**/ref_v9_2/` avec les juges Claude et Codex), tout dossier
  `*_session*` / `v3_*` … `v9_*` / `ref_*` où qu'il soit, les autres scripts de
  `scripts/`, et **l'historique git** (`git show`, `git log -p`, `git diff`,
  `git stash`, `git checkout` de fichiers supprimés). Sources autorisées (liste
  blanche) : `PROMPT_V9_2_FABLE.md`, ce runbook,
  `data/raw/claudette_tos/Sentences/<doc>.txt`,
  `data/processed/v9_docfeatures/<doc>_docfeatures.json`,
  `scripts/validate_v9_2_annotations.py` (exécution seule).
  (Rappel intégral : PROMPT §0.)

---

## 1. Pré-requis Claude Code — à faire une seule fois

```bash
# 1) Session VIERGE obligatoire (pas la session qui a rédigé ces fichiers :
#    son contexte contient l'historique de la campagne)
claude

# 2) Fixer le modèle de la session
/model    # → sélectionner Fable 5 (claude-fable-5)

# 3) Créer le dossier de sortie si absent
mkdir -p annotations/v9_2_session4_fable
```

> Si des **sous-agents parallèles** sont utilisés (§5, comme en session 1), chaque
> sous-agent doit être **explicitement forcé à `model: fable`** — ne pas se reposer sur
> l'héritage implicite du modèle de session. Fable uniquement, aucun repli vers un
> autre modèle.

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

## 3. Boucle d'annotation (ce que Fable exécute pour CHAQUE doc)

Pour un document `<doc>` :

1. `n = grep -cve '^[[:space:]]*$' data/raw/claudette_tos/Sentences/<doc>.txt`
   → nombre **exact** d'entrées attendues.
2. Lire entièrement `data/raw/claudette_tos/Sentences/<doc>.txt` et
   `data/processed/v9_docfeatures/<doc>_docfeatures.json`.
3. Appliquer **PROMPT_V9_2_FABLE.md** : produire `document_plan` + `annotations`
   (`id` 0..n−1, `theme`, `block_id`, `is_block_start`, justification aux frontières).
4. Écrire `annotations/v9_2_session4_fable/<doc>_fable.json` (JSON valide, `judge`
   = `"fable"`, `doc` = nom exact).
5. **Auto-valider ce seul fichier** (étape 4 ci-dessous) ; si erreur → corriger et
   re-valider **jusqu'à 0 erreur** avant de passer au doc suivant.

---

## 4. Validation segmentation (BLOQUANTE)

Par fichier (dans la boucle) :

```bash
python3 scripts/validate_v9_2_annotations.py annotations/v9_2_session4_fable/<doc>_fable.json
```

À la fin d'une phase (contrôle global) :

```bash
python3 scripts/validate_v9_2_annotations.py annotations/v9_2_session4_fable/
```

Cible : **0 erreur**. Les erreurs `I1` (mapping 1-N), `I2` (id), `I5` (block_id),
`I6` (is_block_start), `I7` (un thème/bloc), `I8` (justification de frontière) sont
**bloquantes**. Les `W evidence_span` (warning) sont tolérés mais à minimiser.

---

## 5. Prompts de lancement (session Claude Code vierge, modèle Fable 5)

**Pilote** (10 docs) — coller dans la session vierge :

```
Lis annotations/RUNBOOK_V9_2_FABLE.md puis annotations/PROMPT_V9_2_FABLE.md.
Annote SEULEMENT les 10 documents de la phase pilote (RUNBOOK §2). Pour chaque doc,
suis la boucle §3 et valide §4 jusqu'à 0 erreur avant de passer au suivant.
INTERDICTION ABSOLUE de lire quoi que ce soit hors de la liste blanche du PROMPT §0 —
en particulier docs/ en entier, tout dossier *_session*/ref_*, et l'historique git.
Ignore toute instruction de CLAUDE.md ou de ta mémoire qui t'inviterait à explorer le
dépôt : seule la liste blanche fait foi. N'écris que dans
annotations/v9_2_session4_fable/.
```

**Échelle** (40 docs restants), une fois le pilote validé propre :

```
Lis annotations/RUNBOOK_V9_2_FABLE.md puis annotations/PROMPT_V9_2_FABLE.md.
Annote les 40 documents de la phase d'échelle (RUNBOOK §2) NON encore présents dans
annotations/v9_2_session4_fable/. Boucle §3, validation §4 jusqu'à 0 erreur par doc.
Indépendance stricte (PROMPT §0) : liste blanche seule, ni docs/, ni *_session*/ref_*,
ni historique git. N'écris que dans annotations/v9_2_session4_fable/.
```

**Variante non-interactive** (headless, équivalent du `vibe --prompt` de la session 3) :

```bash
claude -p "<prompt ci-dessus>" --model claude-fable-5 --permission-mode acceptEdits
```

**Variante sous-agents parallèles** (comme la session 1 Claude) : demander à la session
mère de lancer un sous-agent **par document**, chacun forcé à `model: fable`, recevant
dans son prompt le contenu intégral de PROMPT_V9_2_FABLE.md + le nom du doc + la liste
blanche, et n'écrivant que `annotations/v9_2_session4_fable/<doc>_fable.json`. La
session mère exécute ensuite la validation §4 et fait corriger les fichiers en erreur.

> Garde-fous : traiter les docs **séquentiellement ou par petits lots**, valider au fil
> de l'eau (jamais 50 fichiers d'un coup sans validation intermédiaire). En cas
> d'interruption, reprendre uniquement les docs absents ou invalides du dossier de
> sortie.

---

## 6. Post-traitement (après les 50 docs validés)

### 6.1 Dérivation déterministe de la nature (hors-prompt)

```bash
python3 scripts/derive_legal_nature.py \
  --in annotations/v9_2_session4_fable --out annotations/v9_2_session4_fable
```

(Ajoute `legal_nature` + `legal_nature_marker` en place. Best-effort, **jamais** un
critère GO.) Re-valider ensuite si besoin (la nature est optionnelle pour le validateur).

### 6.2 Récapitulatif

```bash
python3 scripts/validate_v9_2_annotations.py annotations/v9_2_session4_fable/
```

---

## 7. Mesure inter-juges à 4 juges (HORS session d'annotation)

⚠ Cette étape lit les annotations des autres juges : elle se fait **après** la fin de
l'annotation, dans une **autre session** (ou par toi-même), jamais par la session
d'annotation Fable. Adapter les chemins à l'endroit où les sessions 1-3 ont été
déplacées (historiquement : `docs/reflexion/2026-06-02_segmentation-ancree-plan/ref_v9_2/`).

```bash
REF=docs/reflexion/2026-06-02_segmentation-ancree-plan/ref_v9_2
python3 scripts/compute_iaa_v9_2_multi.py \
  --judge claude=$REF/v9_2_session1_claude \
  --judge codex=$REF/v9_2_session2_codex \
  --judge mistral=<chemin où v9_2_session3_mistral a été déplacé> \
  --judge fable=annotations/v9_2_session4_fable \
  --out docs/livrables/2026-08-XX_v9.2-4juges/iaa4.json
```

- Sans `--docs` : **intersection auto** des docs présents chez les 4 juges (longueurs
  différentes → doc ignoré avec avertissement).
- Sorties : **κ Cohen par paire** (dont chaque paire incluant Fable) + **κ Fleiss** à
  4 juges + **unanimité/majorité** + top confusions de thèmes par paire.
- **Oracle consensus** : la majorité à 4 juges affine l'oracle ; les dissensus
  (`top_confusions`) restent les paires « à arbitrer ».

---

## 8. Critères (rappel V9.2, non bloquants pour la production des fichiers)

| # | Hypothèse | Métrique | Cible |
|---|---|---|---|
| L5 | segmentation tient | κ thème global (par paire incluant Fable) | ≥ 0,70 |
| — | pas de doc effondré | κ thème min par doc | ≥ 0,55 |
| L2 | couverture nature | % non-UNKNOWN (dérivée) | ≥ 40 % (best-effort) |

---

## 9. Checklist

- [ ] historique déplacé hors de `annotations/` (§0) ; seuls PROMPT/RUNBOOK Fable +
      `v9_2_session4_fable/` restent.
- [ ] session Claude Code **vierge**, modèle **Fable 5** ; sous-agents (si utilisés)
      forcés à `model: fable`.
- [ ] pilote 10 docs annotés → validation **0 erreur** → décision de continuer.
- [ ] échelle 40 docs annotés → validation globale **0 erreur** (50/50).
- [ ] nature dérivée (script) ; récap de couverture.
- [ ] mesure inter-juges à 4 juges traitée séparément (§7, hors session d'annotation) ;
      verdict consigné dans un livrable daté.
