-- Migracija: izbris uporabnika (SUPER_ADMIN) - hibridni pristop.
-- Če uporabnik nima nobenega povezanega dela (ni ga ustvaril, ni bil sodelavec),
-- se zbriše v celoti. Če ima kakršnokoli delo, se namesto tega anonimizira
-- (ime/priimek -> "Izbrisan uporabnik", email/geslo/slika odstranjeni, trajno
-- neaktiven), da obstoječe ure in statistika društva ostanejo nespremenjene.
-- `is_deleted` loči to trajno stanje od navadne (de)aktivacije.
--
-- Zagon:
--   ./migrations/run.sh migrations/013_super_admin_user_delete.sql

ALTER TABLE users ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;
