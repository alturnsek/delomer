-- Migracija: kategorije dela, skupinski vnosi (udeleženci) in potrjevanje
-- delovnih vnosov (PENDING/APPROVED/REJECTED).
--
-- Zagon:
--   DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' .env | cut -d= -f2)
--   docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" db mariadb -u delomer_user delomer < migrations/003_work_categories_and_approvals.sql

CREATE TABLE IF NOT EXISTS work_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_work_categories_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_work_categories_org_name (organization_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE work_logs
  ADD COLUMN IF NOT EXISTS organization_id INT NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS category_id INT NULL AFTER organization_id,
  ADD COLUMN IF NOT EXISTS status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING' AFTER task,
  ADD COLUMN IF NOT EXISTS pending_since TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status,
  ADD COLUMN IF NOT EXISTS reviewed_by INT NULL AFTER pending_since,
  ADD COLUMN IF NOT EXISTS reviewed_at DATETIME NULL AFTER reviewed_by,
  ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500) NULL AFTER reviewed_at,
  ADD COLUMN IF NOT EXISTS is_auto_approved TINYINT(1) NOT NULL DEFAULT 0 AFTER rejection_reason;

ALTER TABLE work_logs
  ADD CONSTRAINT fk_work_logs_organization FOREIGN KEY IF NOT EXISTS (organization_id)
    REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE work_logs
  ADD CONSTRAINT fk_work_logs_category FOREIGN KEY IF NOT EXISTS (category_id)
    REFERENCES work_categories(id) ON DELETE SET NULL;

ALTER TABLE work_logs
  ADD CONSTRAINT fk_work_logs_reviewed_by FOREIGN KEY IF NOT EXISTS (reviewed_by)
    REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS work_log_participants (
  work_log_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (work_log_id, user_id),
  CONSTRAINT fk_wlp_work_log FOREIGN KEY (work_log_id) REFERENCES work_logs(id) ON DELETE CASCADE,
  CONSTRAINT fk_wlp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Obstoječi vnosi (pred to migracijo) nimajo organization_id - poravnaj jih
-- glede na avtorja, in dodaj avtorja kot udeleženca, da se prikažejo v seznamih.
UPDATE work_logs
  JOIN users ON users.id = work_logs.user_id
  SET work_logs.organization_id = users.organization_id
  WHERE work_logs.organization_id IS NULL;

INSERT IGNORE INTO work_log_participants (work_log_id, user_id)
  SELECT id, user_id FROM work_logs;
