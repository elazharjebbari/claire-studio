# Long paper JURIX 2026 (Submission 157) — cibles de confort (latexmk fait le vrai travail)
.PHONY: all pdf check tables clean distclean zip
all: pdf check
pdf:
	latexmk -pdf main.tex
check: pdf
	tools/check_pages.sh 10
# Régénère T3/T4 depuis la copie figée de l'évaluation (artifacts/evaluation/E2.json)
tables:
	python3 tables/make_paper_tables.py artifacts/evaluation/E2.json
clean:
	latexmk -c
distclean:
	latexmk -C
# Archive pour EasyChair / Overleaf (sources + PDF, sans artefacts de compilation)
zip: pdf
	zip -r jurix2026-long-paper-157.zip main.tex references.bib IOS-Book-Article.cls vancouver.bst \
	  .latexmkrc sections tables README.md main.pdf
