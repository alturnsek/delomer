-- Migracija: app_settings (npr. način pošiljanja emailov - log/real preko
-- Resend), ki jo SUPER_ADMIN preklaplja iz UI brez potrebe po redeployu.
--
-- Zagon:
--   DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' .env | cut -d= -f2)
--   docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" db mariadb -u delomer_user delomer < migrations/008_app_settings_and_org_editing.sql

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('email_mode', 'log');

-- Po tej migraciji lahko po potrebi ročno označiš uporabnika kot SUPER_ADMIN:
--   UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'aco2@turo.si';
