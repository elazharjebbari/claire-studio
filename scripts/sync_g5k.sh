#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# sync_g5k.sh — Synchronise le package d'expérimentation vers Grid'5000.
#
# POURQUOI CE SCRIPT EXISTE. Le package `pactiva_lab` déployé sur les frontales
# Grid'5000 (~/pactiva-src) n'est PAS couvert par le déploiement de la plateforme : il se
# synchronise à la main. Constaté le 13 septembre 2026 : les frontales portaient encore la
# version du 14 août, sans l'axe de taxonomie — un run étiqueté T11 y aurait produit
# silencieusement des chiffres T20. Le garde-fou de capacité (`runner.assert_capabilities`)
# fait désormais échouer ce cas, et ce script est le moyen de le corriger.
#
# Ce qui est transféré :
#   * le package `research/pactiva_lab/` ;
#   * la SPÉCIFICATION DE TAXONOMIE, déposée à côté du package — sur Grid'5000 il n'y a
#     pas d'arborescence `frontend/`, et la projection en a besoin même en T20.
#
# La spécification transférée est une COPIE DE DÉPLOIEMENT : elle est écrasée à chaque
# synchronisation depuis l'unique source du dépôt, donc elle ne peut pas diverger.
#
# Usage :
#   bash scripts/sync_g5k.sh [--sites "lyon nancy"] [--login <identifiant>] [--check-only]
# -----------------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SITES="${G5K_SITES:-lyon nancy}"
LOGIN="${G5K_LOGIN:-}"
REMOTE_DIR="${G5K_REMOTE_DIR:-pactiva-src}"
SSH_KEY="${G5K_SSH_KEY:-$HOME/.ssh/id_rsa}"
CHECK_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sites) SITES="$2"; shift 2 ;;
    --login) LOGIN="$2"; shift 2 ;;
    --key) SSH_KEY="$2"; shift 2 ;;
    --check-only) CHECK_ONLY=1; shift ;;
    *) echo "option inconnue : $1" >&2; exit 2 ;;
  esac
done

[[ -n "$LOGIN" ]] || { echo "ERREUR : identifiant Grid'5000 requis (--login ou G5K_LOGIN)" >&2; exit 2; }

SPEC_SRC="$ROOT_DIR/frontend/src/lib/taxonomy/taxonomies.json"
PKG_SRC="$ROOT_DIR/research/pactiva_lab"
[[ -f "$SPEC_SRC" ]] || { echo "ERREUR : spécification introuvable ($SPEC_SRC)" >&2; exit 1; }
[[ -d "$PKG_SRC" ]] || { echo "ERREUR : package introuvable ($PKG_SRC)" >&2; exit 1; }

SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25)
ACCESS="${LOGIN}@access.grid5000.fr"

log() { printf '\033[34m[sync-g5k]\033[0m %s\n' "$*"; }

# Empreintes attendues, pour vérifier APRÈS transfert que le distant porte bien la source.
SPEC_SHA="$(shasum -a 256 "$SPEC_SRC" | cut -d' ' -f1)"
CAPS="$(grep -o 'CAPABILITIES = frozenset({[^}]*})' "$PKG_SRC/__init__.py" || true)"
log "spécification locale : ${SPEC_SHA:0:16}…"
log "capacités locales    : ${CAPS:-aucune}"

for SITE in $SITES; do
  log "── site $SITE ─────────────────────────────────────"

  if [[ "$CHECK_ONLY" -eq 0 ]]; then
    log "transfert du package…"
    # `--delete` retire les fichiers qui n'existent plus dans la source : sans cela un
    # module supprimé continuerait d'être importable à distance.
    rsync -az --delete \
      --exclude '__pycache__' --exclude '*.pyc' --exclude '.pytest_cache' \
      -e "ssh ${SSH_OPTS[*]}" \
      "$PKG_SRC/" "${ACCESS}:${SITE}/${REMOTE_DIR}/pactiva_lab/" 2>/dev/null \
      || rsync -az --delete \
        --exclude '__pycache__' --exclude '*.pyc' \
        -e "ssh ${SSH_OPTS[*]}" \
        "$PKG_SRC/" "${ACCESS}:${REMOTE_DIR}/pactiva_lab/"

    log "transfert de la spécification de taxonomie…"
    rsync -az -e "ssh ${SSH_OPTS[*]}" \
      "$SPEC_SRC" "${ACCESS}:${REMOTE_DIR}/pactiva_lab/taxonomies.json"
  fi

  log "vérification à distance…"
  ssh "${SSH_OPTS[@]}" "$ACCESS" "ssh $SITE '
    set -e
    cd ~/${REMOTE_DIR}
    echo \"taxonomy.py : \$(test -f pactiva_lab/taxonomy.py && echo PRESENT || echo ABSENT)\"
    echo \"spec        : \$(sha256sum pactiva_lab/taxonomies.json 2>/dev/null | cut -c1-16)\"
    echo \"capacités   : \$(grep -o \"CAPABILITIES = frozenset({[^}]*})\" pactiva_lab/__init__.py 2>/dev/null || echo ABSENTES)\"
    echo \"axe data.py : \$(grep -c taxonomy pactiva_lab/data.py 2>/dev/null || echo 0) occurrence(s)\"
  '" || log "⚠ vérification impossible sur $SITE"
done

log "Terminé. Empreinte de spécification attendue : ${SPEC_SHA:0:16}…"
