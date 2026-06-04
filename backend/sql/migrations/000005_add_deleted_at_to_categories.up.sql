ALTER TABLE categories ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
CREATE UNIQUE INDEX categories_name_unique_idx ON categories (name) WHERE deleted_at IS NULL;
