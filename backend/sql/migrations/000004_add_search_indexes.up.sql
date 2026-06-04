-- Mengaktifkan ekstensi pg_trgm (Trigram) untuk ILIKE optimization
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Index Trigram untuk Users (full_name)
CREATE INDEX idx_users_full_name_trgm ON users USING gin (full_name gin_trgm_ops);

-- 2. Index Trigram untuk Categories (name)
CREATE INDEX idx_categories_name_trgm ON categories USING gin (name gin_trgm_ops);

-- 3. Index Full Text Search (FTS) untuk Questions (question_text)
CREATE INDEX idx_questions_question_text_fts ON questions USING gin (to_tsvector('indonesian', question_text));

-- 4. Index Full Text Search (FTS) untuk Events (name)
CREATE INDEX idx_events_name_fts ON events USING gin (to_tsvector('indonesian', name));
