ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users (username) WHERE deleted_at IS NULL;
