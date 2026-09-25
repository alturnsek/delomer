#!/bin/bash
# Poženi migracijsko SQL datoteko brez ročnega vnašanja/kopiranja gesla -
# uporabi uporabnika/geslo/bazo, ki jih Docker Compose že nastavi znotraj
# "db" kontejnerja (MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE).
#
# Pred zagonom naredi stisnjeno varnostno kopijo cele baze (migrations/backups/,
# NI v gitu - vsebuje prave podatke). Po uspešnem zagonu migracijo zabeleži v
# tabelo schema_migrations (če ta že obstaja - za migracije pred 014 je ni).
#
# Uporaba (iz mape z docker-compose.yml, npr. ~/delomer na TrueNAS):
#   ./migrations/run.sh migrations/011_login_history.sql

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Uporaba: $0 <pot-do-migracije.sql>" >&2
  exit 1
fi

MIGRATION_FILE="$1"
MIGRATION_NAME="$(basename "$MIGRATION_FILE")"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$REPO_DIR/migrations/backups"
BACKUP_FILE="$BACKUP_DIR/pre-${MIGRATION_NAME%.sql}-$(date -u +%Y%m%d-%H%M%S).sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Varnostna kopija baze -> $BACKUP_FILE"
docker compose exec -T db sh -c 'exec mariadb-dump -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  | gzip > "$BACKUP_FILE"

echo "Zaganjam migracijo: $MIGRATION_NAME"
docker compose exec -T db sh -c 'exec mariadb -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
  < "$MIGRATION_FILE"

if docker compose exec -T db sh -c 'exec mariadb -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' <<SQL
INSERT IGNORE INTO schema_migrations (version) VALUES ('$MIGRATION_NAME');
SQL
then
  echo "Migracija $MIGRATION_NAME zabeležena v schema_migrations."
else
  echo "Opozorilo: zapis v schema_migrations ni uspel (tabela morda še ne obstaja - v redu za migracije pred 014, glej migrations/014_schema_migrations_table.sql)." >&2
fi

echo "Migracija $MIGRATION_NAME uspešno izvedena. Varnostna kopija: $BACKUP_FILE"
