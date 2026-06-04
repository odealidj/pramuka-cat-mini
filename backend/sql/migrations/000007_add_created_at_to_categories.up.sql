ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Isi created_at untuk baris yang sudah ada dengan waktu sekarang
-- (urutan insert tetap tercermin dari kolom id yang SERIAL/auto-increment)
UPDATE categories SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
