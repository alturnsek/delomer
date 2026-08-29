-- Migracija: deaktivacija uporabnika (ne more dodajati dela, drugi ga ne
-- morejo dodati kot sodelavca; zgodovina njegovega dela ostane nedotaknjena).
--
-- Zagon:
--   DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' .env | cut -d= -f2)
--   docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" db mariadb -u delomer_user delomer < migrations/007_user_deactivation.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1;
