#!/usr/bin/env bash
# JURIX 2026 Short Paper: maximum 5 pages excluding references.
# Lit main.aux (écrit par la dernière compilation) et indique la page où se termine
# le corps du texte (label `end:body`, placé juste avant les remerciements et la
# bibliographie dans main.tex), ainsi que le nombre total de pages de main.pdf.
set -euo pipefail
cd "$(dirname "$0")/.."
LIMIT=${1:-5}
[ -f main.aux ] || { echo "main.aux introuvable — compiler d'abord (latexmk -pdf main.tex)"; exit 2; }
# \newlabel{end:body}{{}{5}{}{...}{}} -> le 2e groupe = numéro de page
body_page=$(grep -o '\\newlabel{end:body}{{[^}]*}{[0-9]*}' main.aux | sed -E 's/.*\{([0-9]+)\}$/\1/' | tail -n1 || true)
total=$(pdfinfo main.pdf 2>/dev/null | awk '/^Pages:/{print $2}' || true)
[ -n "${total:-}" ] || total=$(python3 - <<'PY'
import re
data=open('main.pdf','rb').read()
print(len(re.findall(rb'/Type\s*/Page[^s]',data)))
PY
)
echo "Fin du corps de texte : page ${body_page:-?}"
echo "Pages totales (avec références) : ${total:-?}"
if [ -z "${body_page:-}" ]; then echo "ATTENTION : label end:body introuvable — recompiler."; exit 2; fi
if [ "$body_page" -le "$LIMIT" ]; then
  echo "OK  — corps dans la limite de ${LIMIT} pages (références exclues)."
else
  echo "ÉCHEC — le corps dépasse la limite de ${LIMIT} pages de $((body_page-LIMIT)) page(s). Couper le texte, jamais la mise en page."
  exit 1
fi
