-- Migracija: člani brez računa (samo seznam, doda jih admin vnaprej brez emaila),
-- samopostrežna registracija preko skupne registracijske kode društva, in nova
-- vloga PUBLIC - deljen "kiosk" račun (npr. tablica v prostorih društva), ki
-- lahko samo vnaša delo in vidi seznam članov/ekip za izbiro sodelavcev.
--
-- Zagon:
--   ./migrations/run.sh migrations/012_public_roster_and_kiosk.sql

-- email ni več obvezen - član brez računa (dodan v naprej, samo za izbiro
-- med sodelavci) nima emaila, dokler se sam ne registrira ali ga admin ne povabi
ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL;

-- nova vloga PUBLIC poleg obstoječih
ALTER TABLE users MODIFY COLUMN role ENUM('SUPER_ADMIN','ADMIN','SUPERINTENDENT','MEMBER','PUBLIC') NOT NULL DEFAULT 'MEMBER';

ALTER TABLE organizations ADD COLUMN join_code VARCHAR(32) NULL AFTER description;
ALTER TABLE organizations ADD COLUMN registration_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER join_code;
ALTER TABLE organizations ADD UNIQUE KEY uq_organizations_join_code (join_code);

-- vsakemu obstoječemu društvu dodeli naključno registracijsko kodo
UPDATE organizations SET join_code = SUBSTRING(REPLACE(UUID(), '-', ''), 1, 10) WHERE join_code IS NULL;
