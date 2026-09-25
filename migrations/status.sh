#!/bin/bash
# Pokaže, katere migracije so bile izvedene na tej bazi (glede na schema_migrations)
# in katere .sql datoteke v migrations/ na to še čakajo.
#
# Uporaba (iz mape z docker-compose.yml):
#   ./migrations/status.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPLIED_FILE="$(mktemp)"
trap 'rm -f "$APPLIED_FILE"' EXIT

echo "=== Izvedene migracije (schema_migrations) ==="
if ! docker compose exec -T db sh -c 'exec mariadb -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  <<< "SELECT version, applied_at FROM schema_migrations ORDER BY version;"
then
  echo "(tabela schema_migrations ne obstaja - poženi migrations/014_schema_migrations_table.sql)"
fi

docker compose exec -T db sh -c 'exec mariadb -N -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  <<< "SELECT version FROM schema_migrations;" > "$APPLIED_FILE" 2>/dev/null || true

echo
echo "=== Datoteke v migrations/, ki jih schema_migrations (še) ne pozna ==="
for f in "$REPO_DIR"/migrations/*.sql; do
  name="$(basename "$f")"
  if ! grep -qx "$name" "$APPLIED_FILE"; then
    echo "  $name"
  fi
done
