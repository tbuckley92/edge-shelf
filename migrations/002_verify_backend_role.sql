-- Migration owner already owns these tables and bypasses RLS.
-- Permit explicit SET ROLE to the restricted backend for verification.
grant shelf_backend to postgres;
