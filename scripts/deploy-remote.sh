#!/usr/bin/env bash
#
# Runs ON THE VPS, piped in over SSH by .github/workflows/deploy.yml.
#
# Kept in the repo (rather than inlined in the workflow) so the deploy steps are
# reviewable, and so a heredoc's indentation can never silently change them.
set -euo pipefail

APP_DIR="${APP_DIR:-/home/faraz/Sell-Similar-Extension}"
BRANCH="${BRANCH:-main}"

echo "==> Deploying $BRANCH to $APP_DIR"
cd "$APP_DIR"

# Deterministic checkout. .env is gitignored, so it survives the reset; any
# hand-edits to tracked files on the server are intentionally discarded.
git fetch --all --prune
git reset --hard "origin/$BRANCH"
echo "==> Now at: $(git log --oneline -1)"

corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm build

echo "==> Restarting services"
pm2 restart api worker cron --update-env
pm2 save

# Give the processes a moment, then prove they actually came back.
sleep 6
echo "==> Health checks"
curl -fsS --max-time 10 http://127.0.0.1:3001/health && echo
curl -fsS --max-time 10 http://127.0.0.1:3003/health && echo
echo "==> Deploy OK"
