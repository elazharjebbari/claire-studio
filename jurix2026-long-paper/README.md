# JURIX 2026 — Long Paper, Submission 157 (environnement LaTeX IOS Press)

> **JURIX 2026 Long Paper: maximum 10 pages excluding references.**
> *Executing the Grey List: Interpretable Queries for Unfair-Term Detection in Terms of Service*
> A. El Azhar Jebbari, J.-C. Lamirel, F. Z. Boulaich, F. Ouali.

Même gabarit et même outillage que le short paper (`../jurix2026-short-paper/`) : classe officielle
IOS Press « Book Article » v1.20, **aucun fichier de style modifié** (empreintes identiques au package officiel,
conservé intact dans `iospress-official/`).

## Compiler et vérifier

```bash
make            # latexmk -pdf main.tex, puis contrôle de la limite de 10 pages
make tables     # régénère tables/T3_queries.tex et T4_cost.tex depuis artifacts/evaluation/E2.json
make zip        # archive sources + PDF pour EasyChair / Overleaf
```

`tools/check_pages.sh` lit la page du label `end:body`, posé après la dernière section et avant la bibliographie. Dépendances : TeX Live 2020 ou plus récent, `pdflatex`, BibTeX
(`vancouver.bst`, pas biber), Python 3.10+ pour `make tables`.

## Arborescence

```
jurix2026-long-paper/
├── main.tex                      # frontmatter (titre, auteurs, résumé, mots-clés), \input des sections, biblio
├── sections/
│   ├── 01-introduction.tex        # question, RQ-A/B/C, contributions
│   ├── 02-related-work.tex
│   ├── 03-executable-grey-list.tex  # Table 1 (annexe ↔ CLAUDETTE ↔ thèmes ↔ expressibilité), templates, requêtes
│   ├── 04-materials.tex           # corpus, couche thématique (Table 2), extraction des templates
│   ├── 05-protocol.tex            # Table 3 (hypothèses pré-enregistrées), découpe, référence, métriques, baselines
│   ├── 06-results-a-retrieval.tex # Table 4 (par item)
│   ├── 07-results-b-cost.tex      # Table 5 (prix de l'interprétabilité)
│   ├── 08-results-c-errors.tex    # manqués et faux positifs
│   ├── 09-discussion.tex          # trois points, limites et suite (étude experte)
│   └── 10-conclusion.tex
├── tables/
│   ├── T3_queries.tex  T4_cost.tex   # GÉNÉRÉS — ne pas éditer à la main
│   └── make_paper_tables.py          # lit uniquement artifacts/evaluation/E2.json
├── artifacts/                    # copies figées des résultats sources, sans texte CLAUDETTE (MANIFEST.md : source, commit, SHA-256)
├── notes/E2_HANDOFF.md           # fiche de transfert des résultats (session d'évaluation → rédaction)
├── archive/                      # placeholder déposé le 14 sept. 2026 (PDF + source)
├── easychair-title.txt  easychair-abstract.txt  easychair-keywords.txt   # champs EasyChair en texte brut
├── references.bib  IOS-Book-Article.cls  vancouver.bst  iospress-official/
├── .latexmkrc  Makefile  tools/check_pages.sh  .gitignore
└── main.pdf                      # PDF compilé (version à déposer)
```

## Provenance des chiffres

Chaque chiffre de résultat vient d'un fichier de `artifacts/` (voir `artifacts/MANIFEST.md`) :

| Élément du papier | Source |
|---|---|
| Tables 4 et 5, Results A et B, résumé | `artifacts/evaluation/E2.json` |
| Tests (Holm, non-infériorité, Wilson) | `artifacts/evaluation/STATS.json` |
| Results C (manqués, faux positifs) | `artifacts/evaluation/DISAGREEMENT.json` (passe 0) |
| Extraction du hold-out, pilote, stabilité | `artifacts/extraction/*` |
| Seconde passe du hold-out (sensibilité : κ 0,82, union 0,34, item (i) non robuste) | `artifacts/extraction/holdout-v02_STABILITY_passes01.json`, `artifacts/evaluation/E2_pass1.json`, `STATS_pass1.json` |
| Requêtes gelées, empreintes | `artifacts/rules/grey_list_queries.yaml`, `artifacts/rules/FROZEN.txt` (v0.2, SHA-256 `c3303e67…`) |
| Table 1 | `artifacts/ontology/directive_93_13.yaml` |
| Discussion, complémentarité et union naïve (post hoc) | `artifacts/evaluation/POSTHOC_complementarity.json`, régénérable par `python3 tools/post_hoc_complementarity.py` |

La chaîne complète (extraction, règles, évaluation) vit dans `../legal-kg/` ; le protocole et ses écarts déclarés
sont décrits dans `../legal-kg/docs/GATES_LOG.md` et `../docs/pactiva-grey-list-157/`.

## Règles de rédaction propres à ce papier

- Nommer les modèles réellement servis (`claude-opus-5`, `gpt-6-astra`), jamais le harnais (Claude Code, Codex).
- Aucune validation experte n'a eu lieu dans cette étude : ne jamais écrire « validated by legal experts » à propos
  des templates ; l'analyse principale est la passe 0 (pré-enregistrée), la passe 1 n'est qu'un contrôle de sensibilité.
- Ne pas éditer `tables/*.tex` à la main : corriger la source, recopier dans `artifacts/`, puis `make tables`.
