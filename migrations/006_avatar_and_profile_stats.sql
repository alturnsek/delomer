-- Migracija: profilna slika uporabnika (pot do naložene datoteke).
-- Statistika dela (GET /api/users/me/stats) ne rabi nove sheme - agregira
-- obstoječe work_logs/work_log_participants.
--
-- Zagon:
--   DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' .env | cut -d= -f2)
--   docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" db mariadb -u delomer_user delomer < migrations/006_avatar_and_profile_stats.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_path VARCHAR(255) NULL;
