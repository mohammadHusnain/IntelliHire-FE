-- Development database and a dedicated role. Run as a PostgreSQL superuser:
--   psql -U postgres -f scripts/create_dev_database.sql
-- Change the password, and use the same one in DATABASE_URL (backend/.env).
-- CREATEDB lets pytest-django create and drop its own test database; do not
-- grant it to the production role.
CREATE ROLE intellihire LOGIN PASSWORD 'change-me' CREATEDB;
CREATE DATABASE intellihire OWNER intellihire ENCODING 'UTF8';
