#!/bin/bash
# Deploy skripta: potegne najnovejšo Docker sliko iz Docker Hub in
# ponovno zažene "app" kontejner. Ne sprejema argumentov (kliče jo
# samo webhook-server.js, brez uporabniškega vnosa), zato ni tveganja
# za injection.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$REPO_DIR/deploy/deploy.log"

cd "$REPO_DIR"

{
  echo "=== $(date -u '+%Y-%m-%d %H:%M:%S UTC') Deploy start ==="
  docker compose pull app
  docker compose up -d app
  docker image prune -f
  echo "=== $(date -u '+%Y-%m-%d %H:%M:%S UTC') Deploy konec ==="
} >> "$LOG_FILE" 2>&1
