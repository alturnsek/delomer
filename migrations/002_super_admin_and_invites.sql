-- Migracija: SUPER_ADMIN vloga + vabila uporabnikov (invite/set-password tok).
-- Nadomesti samopostrežno registracijo iz migracije 001 (organizacije zdaj
-- ustvarja samo SUPER_ADMIN, uporabnike v društvo pa vabi ADMIN društva).
--
-- Zagon:
--   DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' .env | cut -d= -f2)
--   docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" db mariadb -u delomer_user delomer < migrations/002_super_admin_and_invites.sql

ALTER TABLE users
  MODIFY COLUMN role ENUM('SUPER_ADMIN','ADMIN','MEMBER') NOT NULL DEFAULT 'MEMBER';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS invite_token VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS invite_token_expires_at DATETIME NULL;

ALTER TABLE users
  ADD UNIQUE INDEX IF NOT EXISTS uq_users_invite_token (invite_token);

-- Ročno po tej migraciji: označi svoj obstoječi račun kot SUPER_ADMIN, npr.:
--   UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'tvoj@email.si';
