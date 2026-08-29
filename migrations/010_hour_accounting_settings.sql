-- Migracija: nastavitve načina obračunavanja/prikaza ur na nivoju društva
-- (zaokroževanje na X minut, format prikaza: decimalno/cele ure/dnevi-ure-minute).
--
-- Zagon:
--   DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' .env | cut -d= -f2)
--   docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" db mariadb -u delomer_user delomer < migrations/010_hour_accounting_settings.sql

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS hour_rounding_minutes INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS hour_display_format ENUM('DECIMAL','WHOLE','DHM') NOT NULL DEFAULT 'DECIMAL';
