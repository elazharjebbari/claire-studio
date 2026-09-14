# JURIX 2026 — Short Paper (environnement LaTeX IOS Press)

> **JURIX 2026 Short Paper: maximum 5 pages excluding references.**
> (Appel officiel : *« Short papers should not exceed 5 pages (excluding acknowledgements and references) »*.)

Projet LaTeX prêt à l'emploi pour rédiger le short paper *« A Thematic Layer for CLAUDETTE »*
(titre de travail) destiné à JURIX 2026 (Toulouse, 9–10 décembre 2026), construit **exclusivement**
à partir du gabarit officiel IOS Press « Book Article ». Aucun fichier de style n'a été modifié.

## 1. Sources officielles utilisées

| Source | Référence | Ce qui en est tiré |
|---|---|---|
| JURIX 2026 — *Call for Papers* | <https://www.irit.fr/jurix2026/call-for-papers/> | short ≤ 5 p. hors remerciements/références ; format IOS Press ; relecture **single-blind** ; dépôt EasyChair `jurix2026` |
| JURIX 2026 — *Important dates* | <https://www.irit.fr/jurix2026/important-dates/> | soumission **13 septembre 2026 (AoE)** (repoussée du 5) ; notification 8 octobre ; camera-ready 15 octobre |
| IOS Press — *Book article instructions* | <https://www.iospress.com/book-article-instructions> | renvoi vers le package LaTeX officiel |
| Package LaTeX officiel (VTeX pour IOS Press) | <https://github.com/vtex-soft/texsupport.IOS-Book-Article> (commit `5793ef0e`, classe **v1.20 du 2024/01/31**) | `IOS-Book-Article.cls`, `IOS-Book-Article.tmpl`, `vancouver.bst`, exemple `ios-book-article.tex/.pdf`, `ios-book-article_LaTeX_Instructions.pdf` |

Le package d'origine est conservé intact dans [`iospress-official/`](iospress-official/) (zip + fichiers).
Empreintes SHA-256 des deux fichiers copiés à la racine, identiques à l'original :

```
d806e89af55ca96d6ce3988161d3b77dc95377cfe4bf41caa314bfd7468374cd  IOS-Book-Article.cls
3e335079b35c68d610985398b5efc10f1ab32c0d2fb7a7cab9b9506d66c46130  vancouver.bst
```

## 2. Arborescence

```
jurix2026-short-paper/
├── main.tex                  # manuscrit, dérivé de IOS-Book-Article.tmpl (frontmatter, sections, biblio)
├── references.bib            # BibTeX — 3 entrées FICTIVES d'exemple (clés example_*), à supprimer
├── IOS-Book-Article.cls      # classe officielle IOS Press — NE PAS MODIFIER
├── vancouver.bst             # style bibliographique officiel IOS Press (Vancouver/NLM) — inchangé
├── sections/
│   ├── 01-introduction.tex   # placeholders courts + plan suggéré en commentaire
│   ├── 02-related-work.tex
│   ├── 03-methodology.tex    # « Data and Method » (avec une équation d'exemple)
│   ├── 04-results.tex        # inclut le tableau et la figure d'exemple
│   ├── 05-discussion.tex
│   └── 06-conclusion.tex
├── tables/example-table.tex  # tableau d'exemple (booktabs), légende AU-DESSUS
├── figures/example-figure.pdf  (+ .tex source, + README.md sur les formats acceptés)
├── tools/check_pages.sh      # contrôle de la limite de 5 pages (références exclues)
├── iospress-official/        # package officiel intact (référence)
├── .latexmkrc  Makefile  .vscode/settings.json  .gitignore
└── main.pdf                  # PDF compilé
```

La structure en six sections est un point de départ : `main.tex` ne fait qu'`\input` les fichiers,
fusionner ou supprimer une section se fait en une ligne. Le texte du papier est en anglais ; les
commentaires de travail sont en français.

## 3. Dépendances

- **Distribution TeX** : testé avec **TeX Live 2025** (pdfTeX 1.40.27, latexmk 4.86a, BibTeX 0.99d).
  Version minimale recommandée : **TeX Live 2020** ou MiKTeX à jour (la classe requiert `etoolbox`,
  `environ` et `hyperref`, tous présents dans toute distribution récente). Overleaf : TeX Live 2024
  ou 2025 (par défaut).
- **Moteur** : `pdflatex` (la classe cible *pdflatex ou latex* ; ne pas utiliser XeLaTeX/LuaLaTeX
  sans nécessité, `mathptmx`/`inputenc` sont pensés pour pdfTeX).
- **Bibliographie** : `bibtex` (pas biber) avec `vancouver.bst`.
- **Packages chargés par `main.tex`** (tous dans TeX Live standard, aucun n'altère la mise en page) :
  `mathptmx`, `fontenc` (T1), `inputenc` (utf8), `graphicx`, `booktabs`, `multirow`, `array`,
  `amsmath`, `amssymb`. `hyperref`, `etoolbox` et `url` sont chargés **par la classe** — ne pas les
  recharger.
- **Optionnel** : `standalone`, `tikz`, `helvet` uniquement pour régénérer `figures/example-figure.pdf` ;
  `poppler` (`pdfinfo`) pour le compteur de pages (repli Python automatique sinon).

## 4. Compilation

### En ligne de commande (recommandé)

```bash
cd jurix2026-short-paper
latexmk -pdf main.tex          # pdflatex + bibtex + relances, piloté par .latexmkrc
tools/check_pages.sh           # contrôle « ≤ 5 pages hors références »
```

Équivalents : `make` (compile + contrôle), `make clean` (artefacts), `make distclean` (tout,
PDF compris), `make zip` (archive sources + PDF pour EasyChair/Overleaf).

### Séquence classique (identique au résultat de latexmk)

```bash
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex
```

### VS Code

1. Installer l'extension **LaTeX Workshop** (James Yu).
2. Ouvrir le dossier `jurix2026-short-paper/` comme racine de l'espace de travail.
3. `.vscode/settings.json` déclare la recette *latexmk (pdflatex + bibtex)*, la compilation à
   l'enregistrement et exclut `iospress-official/` et `figures/` de la détection du fichier racine.
4. Compiler : `Ctrl/Cmd + Alt + B` (ou l'icône ▶ de LaTeX Workshop) ; PDF dans un onglet ;
   SyncTeX actif (`Ctrl/Cmd + clic` dans le PDF ↔ source).

### Overleaf

1. `make zip` (ou zipper à la main : `main.tex`, `references.bib`, `IOS-Book-Article.cls`,
   `vancouver.bst`, `sections/`, `tables/`, `figures/`, `.latexmkrc`).
2. Overleaf → *New Project* → *Upload Project* → déposer le zip.
3. *Menu* → **Main document** : `main.tex` ; **Compiler** : `pdfLaTeX` ; **TeX Live version** :
   2024 ou 2025. Overleaf exécute BibTeX automatiquement.
4. Le dossier `iospress-official/` peut être omis du zip (référence seulement).

## 5. Gestion de la limite de 5 pages

**JURIX 2026 Short Paper: maximum 5 pages excluding references.**

- La limite couvre **tout ce qui précède les remerciements** : titre, auteurs, résumé, mots-clés,
  corps, tableaux, figures, notes de bas de page. Sont exclus : remerciements et références.
- `main.tex` place un `\label{end:body}` (largeur nulle) juste avant le bloc *Acknowledgements*
  et la bibliographie ; `tools/check_pages.sh` lit la page de ce label dans `main.aux` et échoue
  si elle dépasse 5. Le script s'exécute aussi via `make check`.
- La classe ne numérote pas les pages (IOS Press : *« You do not need to include page numbers »*),
  d'où le contrôle par label plutôt qu'à l'œil.
- **Aucune compression artificielle** : marges, `\textwidth`, `\textheight`, taille de police,
  interligne, espacements de titres, taille des légendes et espacement bibliographique sont ceux
  de la classe et **doivent le rester** (les instructions IOS Press l'interdisent explicitement).
  Les leviers légitimes : concision, tableaux synthétiques, figures informatives, suppression des
  redites, méthode compacte, état de l'art ciblé. Budget indicatif inscrit en tête de chaque
  fichier de `sections/`.

## 6. Conventions IOS Press à respecter en rédigeant

| Règle (instructions officielles) | Application dans ce projet |
|---|---|
| Times 10 pt, interligne simple, zone de texte 12,4 × 20 cm | classe + `mathptmx`, rien à faire |
| Titres : majuscules initiales sauf articles/conjonctions/prépositions | à appliquer dans `\title{}` et `\section{}` |
| Références Vancouver/NLM, numéros entre crochets, ordre d'apparition, DOI si connu | `\cite{clé}` → `[n]` ; `vancouver.bst` ; DOI via champ `note` (voir §7) |
| Légende **au-dessus** des tableaux, **en dessous** des figures ; « **Table 1.** » gras, texte roman | `tables/example-table.tex` et `sections/04-results.tex` montrent le patron |
| Renvoyer aux flottants par *Table~1*, *Figure~1* ; jamais « above/below » | `Table~\ref{tab:…}`, `Figure~\ref{fig:…}` |
| Police ≥ 8 pt dans les tableaux, ≥ 6 pt dans les figures ; figures en PDF/EPS/PNG/JPG | voir `figures/README.md` |
| Équations numérotées en continu, référencées *Eq. (1)* | `\begin{equation}` + `Eq.~(\ref{eq:…})` |
| Notes de bas de page au minimum (< 10 % de la zone de texte) | le `\thanks{}` de l'auteur correspondant en est une |
| Toujours `\label` + `\ref` pour les renvois | déjà en place sur sections, tableau, figure, équation |

## 7. Bibliographie

- Fichier : `references.bib`. Style : `vancouver.bst` (numérique, **ordre de citation**, format NLM).
- Citation : `\cite{cle}` → `[1]` ; `\cite{a,b}` → `[2,3]` ; `\cite[chap. 2]{cle}` → `[1, chap. 2]`.
- **DOI** : le `vancouver.bst` livré garde son résolveur DOI désactivé (`adddoiresolver := 0`),
  un champ `doi` seul n'est donc pas imprimé. IOS Press demandant le DOI, l'écrire dans `note` :
  `note = {{doi}: 10.xxxx/yyyy}` (les accolades gardent « doi: » en minuscules). Le champ `doi`
  peut rester à côté pour les métadonnées. Un champ `url` s'imprime « Available from: … ».
- Les trois entrées `example_*` sont fictives : les supprimer, puis `grep -rn "example_" sections/`.
- L'avertissement BibTeX *« empty author and editor in example_misc »* est une bizarrerie du style
  sur les entrées `misc` (il attend aussi un éditeur) ; il est sans effet sur le rendu.
- Ne jamais écrire le caractère arobase dans un commentaire du `.bib` : BibTeX y verrait une entrée.

## 8. Contrôle de conformité (état du 14 septembre 2026)

| Exigence | Source | État |
|---|---|---|
| Format IOS Press, classe officielle non modifiée | CfP JURIX ; `README` IOS Press | ✅ SHA-256 identique à l'original |
| `main.tex` dérivé de `IOS-Book-Article.tmpl` (frontmatter, `\fnms/\snm`, `\address[X]`, `keyword`/`\sep`, `\runningtitle`, `\runningauthor`) | `.tmpl` + `ios-book-article.tex` | ✅ |
| Aucune commande de mise en page (`\textwidth`, marges, interligne, police, espacements) | Instructions §2.1, §2.3 | ✅ aucune |
| Times 10 pt | Instructions §2.2 | ✅ `mathptmx` (comme l'exemple officiel), polices toutes embarquées |
| Sections numérotées standard | Instructions §2.4 | ✅ |
| Références Vancouver/NLM, `vancouver.bst`, BibTeX | Instructions §2.6 | ✅ compilé, `[1]`–`[3]`, DOI imprimés |
| Tableau : légende au-dessus ; figure : légende en dessous | Instructions §3.1 | ✅ patrons en place |
| Single-blind : auteurs et affiliations présents | CfP JURIX | ✅ (co-auteurs et e-mail à compléter — `TODO`) |
| Short paper ≤ 5 pages hors remerciements/références | CfP JURIX | ✅ outil `tools/check_pages.sh` (actuellement : corps sur 2 pages, 3 avec références) |
| Compilation sans erreur, sans référence/citation indéfinie, sans *overfull box* | — | ✅ `latexmk` exit 0 ; séquence classique exit 0 ; 0 erreur ; 0 overfull |
| UTF-8 (é, œ, è dans les affiliations) | — | ✅ rendu correct |
| Page A4, `hyperref` de la classe (liens noirs) | classe | ✅ |
| Format de soumission | CfP JURIX | PDF via EasyChair (`jurix2026`) ; sources + PDF exigés seulement pour la camera-ready |

Seul avertissement restant dans le journal : `hyperref … pdfpagelabels turned off because \thepage
is undefined` — conséquence voulue de la classe (pas de numéros de page), sans incidence.

## 9. Avant de soumettre

1. `grep -rn "TODO" main.tex sections tables` → plus aucun résultat (auteurs, e-mail, ORCID, affiliation).
2. Supprimer le tableau et la figure d'exemple (`tables/example-table.tex`, `figures/example-figure.*`)
   et les entrées `example_*` de `references.bib`.
3. `latexmk -C && latexmk -pdf main.tex && tools/check_pages.sh` → `OK`.
4. Vérifier `main.log` : 0 `!`, 0 *undefined*, 0 *overfull*.
5. Déposer `main.pdf` sur EasyChair (catégorie **short paper**) avant le **13 septembre 2026 AoE**
   (= 14 septembre, 14 h 00 heure de Paris). `make zip` prépare l'archive sources si demandée.
