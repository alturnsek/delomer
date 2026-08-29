-- Migracija: nastavitve društva (logotip, opis, funkcionarji) in podpora
-- za spremembo gesla/emaila s strani uporabnika (obstoječi stolpci
-- password_hash/email na users že obstajajo - tu ni potrebna sprememba
-- sheme zanju, samo za organizacije/funkcionarje).
--
-- Zagon:
--   DB_PASSWORD=$(grep -m1 '^DB_PASSWORD=' .env | cut -d= -f2)
--   docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" db mariadb -u delomer_user delomer < migrations/009_org_settings_and_user_account.sql

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS logo_path VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS description TEXT NULL;

CREATE TABLE IF NOT EXISTS organization_officials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  title VARCHAR(150) NOT NULL, -- funkcija, npr. "Predsednik"
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  whatsapp VARCHAR(100) NULL,
  viber VARCHAR(100) NULL,
  telegram VARCHAR(100) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_org_officials_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
