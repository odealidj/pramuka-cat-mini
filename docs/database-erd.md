# Database Schema & ERD: Pramuka CAT

Dokumen ini merincikan desain tabel pada database PostgreSQL untuk sistem ujian, lengkap dengan _Entity-Relationship Diagram_ (ERD).

## 1. Entity-Relationship Diagram (ERD)
Diagram di bawah ini menggambarkan relasi antar entitas utama dalam sistem.

```mermaid
erDiagram
    users ||--o{ sessions : "memiliki sesi"
    users ||--o{ user_event_approvals : "mendaftar/mengikuti"
    users {
        uuid id PK
        string username "Unique jika aktif (Partial Index WHERE deleted_at IS NULL)"
        string password_hash
        string full_name
        string role "ENUM: super_admin, admin, peserta"
        string photo_url "Nullable"
        boolean email_notifications "Default: true"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at "Soft Delete Indicator"
    }

    sessions {
        uuid id PK "Berperan sebagai Session ID"
        uuid user_id FK
        string refresh_token
        boolean is_blocked "True jika di-revoke"
        timestamp expires_at
        timestamp created_at
    }

    categories ||--o{ questions : "mengelompokkan"
    categories {
        serial id PK
        string name "Misal: PUPK, Sandi (Unique jika aktif)"
        timestamp created_at
        timestamp deleted_at "Soft Delete Indicator — NULL = aktif"
    }

    questions ||--o{ event_questions : "dimasukkan ke"
    questions ||--o{ user_answers : "menjadi soal untuk"
    questions {
        uuid id PK
        int category_id FK
        text question_text
        text option_a
        text option_b
        text option_c
        text option_d
        char correct_answer "A, B, C, atau D"
        int weight "Bobot nilai soal"
        timestamp created_at
        timestamp deleted_at "Soft Delete Indicator — NULL = aktif"
    }

    events ||--o{ event_questions : "mencakup"
    events ||--o{ user_event_approvals : "menyelenggarakan"
    events {
        uuid id PK
        string name "Nama ujian"
        timestamp start_time
        timestamp end_time
        int duration_minutes "Durasi pengerjaan"
        decimal passing_grade "Batas lulus"
        timestamp created_at
        timestamp deleted_at "Soft Delete Indicator — NULL = aktif"
    }

    event_questions {
        uuid event_id PK,FK
        uuid question_id PK,FK
    }

    user_event_approvals ||--o{ user_answers : "memiliki riwayat"
    user_event_approvals {
        uuid id PK
        uuid user_id FK
        uuid event_id FK
        string status "ENUM: pending, approved, revoked"
        boolean is_completed "Apakah sudah submit?"
        decimal score "Total nilai"
        boolean is_passed "Lulus / Tidak"
        timestamp started_at
        timestamp completed_at
        timestamp created_at
        timestamp updated_at
    }

    user_answers {
        uuid id PK
        uuid approval_id FK
        uuid question_id FK
        char selected_answer "A/B/C/D"
        boolean is_correct
        timestamp created_at
    }
```

---

## 2. Rincian Tabel (Data Dictionary)

### a. Tabel `users`
Menyimpan data identitas Peserta dan Admin.
- Username dibuat unik menggunakan **Partial Unique Index** (`users_username_unique_idx ON users (username) WHERE deleted_at IS NULL`). Ini berarti user yang dihapus (*soft-deleted*) membebaskan username-nya sehingga bisa digunakan oleh akun baru.
- Terdapat kolom `role` untuk membedakan otoritas (`super_admin`, `admin`, `peserta`). `super_admin` memiliki akses tak terbatas ke seluruh sistem termasuk manajemen admin lainnya.
- Terdapat kolom `deleted_at` untuk mendukung **Soft-Delete**; data user yang dihapus tetap tersimpan utuh di sistem agar relasi ujian historisnya tidak rusak, namun user tersebut berstatus dinonaktifkan.
- Menyediakan kolom `photo_url` untuk menyimpan referensi/tautan ke foto profil pengguna yang di-upload ke server lokal.
- Kolom `email_notifications` menyimpan preferensi pengguna apakah bersedia dikirimi email oleh sistem (seperti notifikasi _background job_).
- Kolom `updated_at` diperbarui otomatis setiap kali data user diubah.

### b. Tabel `sessions`
Tabel pendukung untuk keamanan Autentikasi ganda (Stateful JWT).
- Menyimpan riwayat **Refresh Token** saat user *login*.
- Kolom `is_blocked` memungkinkan Admin menendang paksa (mencabut akses jarak jauh) user yang dicurigai melakukan kecurangan tanpa menunggu token kedaluwarsa.

### c. Tabel `categories`
Tabel referensi (Kamus Kategori) untuk memudahkan Admin memfilter bank soal berdasarkan materi tertentu.
- Terdapat kolom `deleted_at` untuk mendukung **Soft-Delete**. Kategori yang dihapus hanya ditandai, tidak benar-benar dihapus dari database, sehingga soal-soal lamanya tetap bisa direferensikan oleh riwayat ujian.
- **Unique Partial Index** (`categories_name_unique_idx`) dibuat di PostgreSQL: `CREATE UNIQUE INDEX categories_name_unique_idx ON categories (name) WHERE deleted_at IS NULL`. Index ini memastikan **tidak ada dua kategori aktif dengan nama yang sama**, namun kategori yang sudah dihapus boleh memiliki nama yang sama dengan kategori aktif (untuk memungkinkan pembuatan kembali).
- Kategori yang sudah dihapus (`deleted_at IS NOT NULL`) tidak tampil di daftar maupun _dropdown_ pilihan saat Admin menambah atau mengedit soal.

### d. Tabel `questions`
Pusat dari Bank Soal.
- Setiap baris memiliki 4 opsi teks (`option_a` - `option_d`).
- Kolom `correct_answer` hanya menyimpan satu huruf (A/B/C/D) sebagai kunci jawaban mutlak.
- Terdapat validasi keunikan teks soal (mengabaikan spasi, huruf kapital, dan format penomoran) yang dijalankan pada level aplikasi/kueri untuk mencegah redudansi bank soal. **Pengecekan hanya dilakukan terhadap soal dari kategori yang masih aktif** (`JOIN categories WHERE deleted_at IS NULL`).
- Soal yang kategorinya dihapus secara otomatis **diarsipkan**: tidak ditampilkan di Bank Soal, tidak bisa dipilih untuk Event baru, dan tidak ikut divalidasi duplikasi. Data soalnya tetap ada untuk keperluan riwayat ujian.
- Kolom `weight` krusial untuk fitur **Sistem Bobot Soal**, defaultnya bisa diisi `1` atau sesuai instruksi Admin.
- Kolom `deleted_at` mendukung **Soft-Delete** langsung pada level soal: soal yang dihapus oleh Admin tidak benar-benar dihilangkan dari database, melainkan hanya ditandai sehingga riwayat ujian peserta yang pernah mengerjakan soal tersebut tetap utuh.

### d. Tabel `events`
Tabel ini bertindak sebagai "Ruang Ujian".
- Mengontrol kapan rentang ujian bisa diakses (`start_time` hingga `end_time`).
- `duration_minutes` digunakan *Frontend* untuk memunculkan *Countdown Timer*.
- `passing_grade` akan dicocokkan otomatis dengan nilai peserta di akhir sesi ujian.

### e. Tabel Pivot `event_questions`
Tabel relasi (Many-to-Many) antara `events` dan `questions`. Jika admin memilih soal secara spesifik untuk event tertentu (Distribusi Soal Manual), relasinya disimpan di sini.

### f. Tabel `user_event_approvals`
Jantung dari operasional peserta ujian. Berperan ganda sebagai tabel "Pendaftaran" sekaligus "Rapor Ujian".
- Ketika peserta mengklik "Ikut Event", baris dibuat dengan `status = pending`.
- Jika admin menyetujui, `status = approved`. Jika dibatalkan, `status = revoked`.
- Setelah peserta selesai ujian, `is_completed` diset _true_, lalu nilai dijumlahkan ke `score` dan `is_passed` dikalkulasi.
- Kolom `started_at` mencatat waktu pasti (timestamp) kapan peserta mulai mengerjakan soal untuk pertama kalinya.
- Kolom `completed_at` mencatat waktu pasti (timestamp) kapan sesi ujian tersebut diakhiri, baik secara manual oleh peserta atau secara otomatis karena waktu habis (auto-submit).

### g. Tabel `user_answers`
Tabel riwayat per jawaban. Sangat berguna untuk kebutuhan **Monitoring dan Review**.
- Admin bisa melihat jawaban apa yang dipilih peserta di setiap nomor dan apakah statusnya `is_correct` (benar).
- Data pada tabel ini merupakan data final yang di-_push_ dari Redis saat ujian selesai/terkumpul.
- Terdapat **Unique Constraint** `(approval_id, question_id)`. Mekanisme penyimpanan jawaban menggunakan pola **Upsert** (`ON CONFLICT (approval_id, question_id) DO UPDATE SET`): setiap jawaban disimpan satu kali per soal per peserta, dan akan ditimpa jika peserta mengubah jawabannya sebelum submit.

---

## 3. Indeks Database (Performance Indexes)

Beberapa index kritis ditambahkan untuk mendukung performa pencarian teks:

> **Prasyarat:** Ekstensi `pg_trgm` harus diaktifkan di PostgreSQL untuk mendukung GIN Trigram indexes.
> ```sql
> CREATE EXTENSION IF NOT EXISTS pg_trgm;
> ```

| Nama Index | Tabel | Tipe | Kolom | Fungsi |
|---|---|---|---|---|
| `idx_users_full_name_trgm` | `users` | GIN Trigram | `full_name` | Pencarian peserta berdasarkan nama (fuzzy search) |
| `categories_name_unique_idx` | `categories` | Unique Partial | `name WHERE deleted_at IS NULL` | Validasi nama unik hanya untuk kategori aktif |
| `idx_categories_name_trgm` | `categories` | GIN Trigram | `name` | Pencarian kategori berdasarkan nama |
| `idx_questions_question_text_fts` | `questions` | GIN Full-Text | `question_text` (tsvector `indonesian`) | Pencarian teks soal menggunakan Full-Text Search Bahasa Indonesia |
| `idx_events_name_fts` | `events` | GIN Full-Text | `name` (tsvector `indonesian`) | Pencarian event berdasarkan nama |
| `users_username_unique_idx` | `users` | Unique Partial | `username WHERE deleted_at IS NULL` | Username unik hanya untuk user aktif (bukan yang sudah dihapus) |
