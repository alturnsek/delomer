-- Migracija: tabela za sledenje izvedenim migracijam. Od te točke naprej
-- migrations/run.sh sam zabeleži vsako uspešno izvedeno migracijo. Migracije
-- 001-013 so bile na produkciji izvedene ročno, pred uvedbo te tabele - spodaj
-- jih zabeležimo kot že izvedene (backfill), da stanje ustreza resnici.
--
-- Zagon:
--   ./migrations/run.sh migrations/014_schema_migrations_table.sql

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
