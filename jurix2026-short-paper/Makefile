# Short paper JURIX 2026 — cibles de confort (latexmk fait le vrai travail)
.PHONY: all pdf check clean distclean zip
all: pdf check
pdf:
	latexmk -pdf main.tex
check: pdf
	tools/check_pages.sh 5
clean:
	latexmk -c
distclean:
	latexmk -C
# Archive pour EasyChair / Overleaf (sources + PDF, sans artefacts de compilation)
zip: pdf
	zip -r jurix2026-short-paper.zip main.tex references.bib IOS-Book-Article.cls vancouver.bst \
	  .latexmkrc sections tables figures README.md main.pdf -x 'figures/*.aux' 'figures/*.log'
