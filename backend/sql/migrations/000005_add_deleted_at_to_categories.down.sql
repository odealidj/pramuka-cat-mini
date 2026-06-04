DROP INDEX IF EXISTS categories_name_unique_idx;
ALTER TABLE categories DROP COLUMN deleted_at;
