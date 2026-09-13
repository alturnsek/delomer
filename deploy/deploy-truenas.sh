#!/bin/bash
# Poganja se ZNOTRAJ deploy-webhook kontejnerja (glej Dockerfile.webhook), ne
# na TrueNAS gostitelju samem. /workspace je bind-mount projektne mape
# (docker-compose.yml + .env), /var/run/docker.sock pa gostiteljev Docker
# daemon - "docker compose" ukazi tu spodaj torej upravljajo prave, sosednje
# kontejnerje na TrueNAS, ne nekaj znotraj tega kontejnerja samega.
set -euo pipefail

cd /workspace

echo "=== $(date -u '+%Y-%m-%d %H:%M:%S UTC') Deploy start ==="
docker compose pull app
docker compose up -d app
docker image prune -f
echo "=== $(date -u '+%Y-%m-%d %H:%M:%S UTC') Deploy konec ==="
