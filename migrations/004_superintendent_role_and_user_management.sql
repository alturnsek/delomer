-- Migracija: nova vloga SUPERINTENDENT (enake operativne pravice kot ADMIN,
-- brez upravljanja uporabnikov).
--
-- Zagon:
--   DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' .env | cut -d= -f2)
--   docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" db mariadb -u delomer_user delomer < migrations/004_superintendent_role_and_user_management.sql

ALTER TABLE users
  MODIFY COLUMN role ENUM('SUPER_ADMIN','ADMIN','SUPERINTENDENT','MEMBER') NOT NULL DEFAULT 'MEMBER';
