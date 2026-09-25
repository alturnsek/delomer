CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  logo_path VARCHAR(255) NULL,
  description TEXT NULL,
  join_code VARCHAR(32) NULL UNIQUE,
  registration_enabled TINYINT(1) NOT NULL DEFAULT 1,
  hour_rounding_minutes INT NOT NULL DEFAULT 1,
  hour_display_format ENUM('DECIMAL','WHOLE','DHM') NOT NULL DEFAULT 'DECIMAL',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_officials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  title VARCHAR(150) NOT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  whatsapp VARCHAR(100) NULL,
  viber VARCHAR(100) NULL,
  telegram VARCHAR(100) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_org_officials_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL
);

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('email_mode', 'log');

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NULL,
  role ENUM('SUPER_ADMIN','ADMIN','SUPERINTENDENT','MEMBER','PUBLIC') NOT NULL DEFAULT 'MEMBER',
  email VARCHAR(255) NULL UNIQUE, -- NULL = član brez računa (samo na seznamu)
  password_hash VARCHAR(255) NOT NULL DEFAULT '', -- prazno = račun še ni aktiviran (čaka na vabilo/samopostrežno registracijo) ali social login
  first_name VARCHAR(100) NOT NULL DEFAULT '',
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  invite_token VARCHAR(255) NULL,
  invite_token_expires_at DATETIME NULL,
  avatar_path VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1, -- deaktiviran uporabnik ne more dodajati/biti dodan v delo
  is_deleted TINYINT(1) NOT NULL DEFAULT 0, -- trajno izbrisan (anonimiziran)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_invite_token (invite_token),
  CONSTRAINT fk_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS work_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1, -- deaktivirana kategorija ostane na starih vnosih, ni pa več na voljo za nove
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_work_categories_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_work_categories_org_name (organization_id, name)
);

CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teams_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_teams_org_name (organization_id, name)
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (team_id, user_id),
  CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS work_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL, -- ustvarjatelj (edini, ki lahko ureja dokler ni APPROVED)
  organization_id INT NULL,
  category_id INT NULL,
  task VARCHAR(255) NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  pending_since TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- za 30-dnevni auto-approve
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  rejection_reason VARCHAR(500) NULL,
  is_auto_approved TINYINT(1) NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_work_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_work_logs_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
  CONSTRAINT fk_work_logs_category FOREIGN KEY (category_id) REFERENCES work_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_work_logs_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_work_logs_user_id (user_id),
  INDEX idx_work_logs_organization_id (organization_id)
);

CREATE TABLE IF NOT EXISTS work_log_participants (
  work_log_id INT NOT NULL,
  user_id INT NOT NULL,
  minutes_override INT NULL, -- ročno popravljene minute za tega udeleženca (npr. prišel kasneje); NULL = privzeto trajanje vnosa
  PRIMARY KEY (work_log_id, user_id),
  CONSTRAINT fk_wlp_work_log FOREIGN KEY (work_log_id) REFERENCES work_logs(id) ON DELETE CASCADE,
  CONSTRAINT fk_wlp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  ip_address VARCHAR(64) NULL,
  location VARCHAR(255) NULL,
  browser VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_login_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_login_history_user_id (user_id)
);

-- Sledenje izvedenim migracijam (glej migrations/014_schema_migrations_table.sql).
-- Na svežem razvojnem okolju ta datoteka (init.sql) že postavi celotno trenutno
-- shemo, zato spodaj zabeležimo vse migracije kot izvedene - stanje je enako,
-- kot če bi jih pognali eno za drugo.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO schema_migrations (version) VALUES
  ('001_organizations_and_roles.sql'),
  ('002_super_admin_and_invites.sql'),
  ('003_work_categories_and_approvals.sql'),
  ('004_superintendent_role_and_user_management.sql'),
  ('005_teams_category_status_and_minute_overrides.sql'),
  ('006_avatar_and_profile_stats.sql'),
  ('007_user_deactivation.sql'),
  ('008_app_settings_and_org_editing.sql'),
  ('009_org_settings_and_user_account.sql'),
  ('010_hour_accounting_settings.sql'),
  ('011_login_history.sql'),
  ('012_public_roster_and_kiosk.sql'),
  ('013_super_admin_user_delete.sql'),
  ('014_schema_migrations_table.sql');
