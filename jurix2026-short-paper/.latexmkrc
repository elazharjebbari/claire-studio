# Configuration latexmk — short paper JURIX 2026 (classe IOS Press)
# Usage : latexmk -pdf main.tex   (ou simplement : latexmk)
$pdf_mode = 1;                 # pdflatex -> PDF (la classe vise pdflatex/latex)
$pdflatex = 'pdflatex -interaction=nonstopmode -file-line-error -synctex=1 %O %S';
$bibtex_use = 2;               # BibTeX (vancouver.bst) — PAS biber
@default_files = ('main.tex');
$clean_ext = 'synctex.gz run.xml bbl nav snm vrb';
