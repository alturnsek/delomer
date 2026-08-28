-- Migracija: društva (organizations) in vloge (role) na uporabnikih.
-- Za ROČNO poganjanje na že obstoječi bazi (npr. TrueNAS), ker init.sql
-- teče samo ob prvem zagonu praznega MariaDB volumna.
--
-- Zagon:
--   docker compose exec -T db mariadb -u delomer_user -p delomer < migrations/001_organizations_and_roles.sql

CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organization_id INT NULL AFTER id,
  ADD COLUMN IF NOT EXISTS role ENUM('ADMIN','MEMBER') NOT NULL DEFAULT 'MEMBER' AFTER organization_id;

ALTER TABLE users
  ADD CONSTRAINT fk_users_organization FOREIGN KEY IF NOT EXISTS (organization_id)
    REFERENCES organizations(id) ON DELETE SET NULL;
