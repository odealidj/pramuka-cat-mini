DROP INDEX IF EXISTS users_username_unique_idx;
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
