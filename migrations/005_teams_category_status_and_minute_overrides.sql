-- Migracija:
--   - kategorije dela: deaktivacija namesto brisanja (is_active)
--   - ekipe (teams) za hitro dodajanje več udeležencev naenkrat
--   - minutes_override na posameznega udeleženca delovnega vnosa
--
-- Zagon:
--   DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' .env | cut -d= -f2)
--   docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" db mariadb -u delomer_user delomer < migrations/005_teams_category_status_and_minute_overrides.sql

ALTER TABLE work_categories
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_teams_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_teams_org_name (organization_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS team_members (
  team_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (team_id, user_id),
  CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE work_log_participants
  ADD COLUMN IF NOT EXISTS minutes_override INT NULL;
