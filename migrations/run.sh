#!/bin/bash
# Poženi migracijsko SQL datoteko brez ročnega vnašanja/kopiranja gesla -
# uporabi uporabnika/geslo/bazo, ki jih Docker Compose že nastavi znotraj
# "db" kontejnerja (MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE).
#
# Uporaba (iz mape z docker-compose.yml, npr. ~/delomer na TrueNAS):
#   ./migrations/run.sh migrations/011_login_history.sql

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Uporaba: $0 <pot-do-migracije.sql>" >&2
  exit 1
fi

docker compose exec -T db sh -c 'exec mariadb -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < "$1"
