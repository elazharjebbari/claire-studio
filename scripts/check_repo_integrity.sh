#!/usr/bin/env bash
# Contrôles statiques du socle CI/build/deploy. Aucun accès réseau ni mutation.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if rg -n 'annotation-studio/|pnpm|pnpm-lock' .github/workflows Makefile scripts --glob '!check_repo_integrity.sh'; then
  echo "✗ orchestration obsolète : ancien préfixe ou pnpm détecté" >&2
  exit 1
fi

while IFS= read -r directory; do
  [ -d "$directory" ] || {
    echo "✗ working-directory CI absent : $directory" >&2
    exit 1
  }
done < <(sed -n 's/^[[:space:]]*working-directory:[[:space:]]*//p' .github/workflows/*.yml | sort -u)

for required in \
  backend/Dockerfile \
  frontend/Dockerfile \
  frontend/package-lock.json \
  deploy/systemd/claire-studio.service \
  deploy/systemd/claire-studio-web.service; do
  [ -f "$required" ] || {
    echo "✗ fichier requis absent : $required" >&2
    exit 1
  }
done

bash -n deploy/deploy-claire.sh
bash -n deploy/provision.sh
bash -n deploy/push-preannotations.sh

rg -q 'worktree sale' deploy/deploy-claire.sh
rg -q 'DEPLOY_UNSAFE' deploy/deploy-claire.sh
rg -q 'FRONTEND_URL' deploy/deploy-claire.sh
rg -q -- '--allow-migrations' deploy/deploy-claire.sh

echo "✓ intégrité CI/build/deploy validée"
