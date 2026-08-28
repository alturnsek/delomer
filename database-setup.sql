-- =========================================================
-- Delomer — postavitev podatkovne baze (MVP shema)
-- =========================================================
--
-- Ta datoteka ustvari shemo, ki jo trenutno uporablja koda v:
--   src/config/db.js, src/config/passport.js,
--   src/routes/users.js, src/routes/work.js
--
-- MVP funkcionalnost: SUPER_ADMIN ustvarja društva, ADMIN društva vabi
-- člane (email + nastavitev gesla preko povezave), prijava (local + Google),
-- vpis dela s kategorijami in skupinskimi udeleženci, potrjevanje/zavračanje
-- (PENDING/APPROVED/REJECTED) z 30-dnevnim auto-approve.
--
-- ---------------------------------------------------------
-- KAKO UPORABITI TO DATOTEKO
-- ---------------------------------------------------------
--
-- 1) Lokalno, z Docker Compose (priporočeno, avtomatsko):
--      Ni potrebe po ročnem zagonu — docker-compose.yml ob prvem zagonu
--      MariaDB kontejnerja avtomatsko izvede identično datoteko
--      "init.sql" (mount na /docker-entrypoint-initdb.d/init.sql).
--      Samo poženeš: docker compose up -d db   (ali npm run dev)
--
-- 2) Ročno, v že tekoč MariaDB Docker kontejner:
--      docker compose exec -T db mariadb -u delomer_user -p delomer < database-setup.sql
--      (geslo je DB_PASSWORD iz .env)
--
-- 3) Ročno, na navadnem MariaDB/MySQL strežniku (npr. Azure VM brez
--    Dockerja, ali kaksen drug gostujoč strežnik):
--      a) ustvari bazo in uporabnika (kot root):
--           CREATE DATABASE delomer CHARACTER SET utf8mb4;
--           CREATE USER 'delomer_user'@'%' IDENTIFIED BY 'tvoje_geslo';
--           GRANT ALL PRIVILEGES ON delomer.* TO 'delomer_user'@'%';
--           FLUSH PRIVILEGES;
--      b) naloži shemo:
--           mysql -u delomer_user -p delomer < database-setup.sql
--         (ali mariadb -u delomer_user -p delomer < database-setup.sql)
--
-- Po namestitvi mora .env vsebovati ujemajoč DB_HOST/DB_PORT/DB_USER/
-- DB_PASSWORD/DB_NAME, da se aplikacija poveže na to bazo.
--
-- =========================================================

CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NULL, -- društvo, kateremu uporabnik pripada
  role ENUM('SUPER_ADMIN','ADMIN','SUPERINTENDENT','MEMBER') NOT NULL DEFAULT 'MEMBER',
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL DEFAULT '', -- prazno = račun čaka na nastavitev gesla (vabilo) ali social login
  first_name VARCHAR(100) NOT NULL DEFAULT '',
  last_name VARCHAR(100) NOT NULL DEFAULT '',
  invite_token VARCHAR(255) NULL,
  invite_token_expires_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_invite_token (invite_token),
  CONSTRAINT fk_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS work_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_work_categories_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY uq_work_categories_org_name (organization_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS work_log_participants (
  work_log_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (work_log_id, user_id),
  CONSTRAINT fk_wlp_work_log FOREIGN KEY (work_log_id) REFERENCES work_logs(id) ON DELETE CASCADE,
  CONSTRAINT fk_wlp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
