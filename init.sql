CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NULL,
  role ENUM('SUPER_ADMIN','ADMIN','SUPERINTENDENT','MEMBER') NOT NULL DEFAULT 'MEMBER',
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL DEFAULT '', -- prazno = račun še ni aktiviran (čaka na nastavitev gesla) ali social login
  first_name VARCHAR(100) NOT NULL DEFAULT '',
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  invite_token VARCHAR(255) NULL,
  invite_token_expires_at DATETIME NULL,
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
