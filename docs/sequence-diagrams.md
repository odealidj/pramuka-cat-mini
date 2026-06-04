# Sequence Diagrams: Pramuka CAT

Dokumen ini berisi diagram urutan (_Sequence Diagram_) yang menjelaskan alur interaksi antara Pengguna, Frontend (Next.js), Backend API (Go Echo), Database Utama (PostgreSQL), dan Cache (Redis) untuk fitur-fitur krusial di aplikasi.

## 1. Alur Login & Autentikasi
Alur ini menjelaskan bagaimana peserta atau admin memvalidasi identitas mereka ke dalam sistem.

**Langkah-langkah (Narasi):**
1. Pengguna (Peserta/Admin) memasukkan _Username_ dan _Password_ di halaman Login Frontend.
2. Frontend mengirim *request* `POST /login` ke Backend.
3. Backend mencari data pengguna di database PostgreSQL berdasarkan _Username_.
4. Database mengembalikan data pengguna beserta *hash* dari password.
5. Backend melakukan verifikasi (mencocokkan *hash* password dengan *input* pengguna).
6. Jika **Valid**, Backend akan men-*generate* JWT (_JSON Web Token_) dan mengirimkannya ke Frontend. Frontend kemudian mengalihkan pengguna ke halaman *Dashboard*.
7. Jika **Tidak Valid**, Backend mengirim kode *error* 401 dan Frontend menampilkan pesan gagal.

```mermaid
sequenceDiagram
    participant P as Peserta/Admin
    participant F as Frontend (Next.js)
    participant B as Backend (Go API)
    participant R as Redis
    participant DB as Postgres

    P->>F: Input Username & Password
    F->>B: POST /api/v1/auth/login
    B->>DB: Query User by Username
    DB-->>B: Return User Data & Hash Password
    B->>B: Verify Password Hash
    alt Password Valid
        B->>B: Generate Access & Refresh Token
        B->>DB: Simpan Sesi (Refresh Token)
        B->>R: Cache Session ID (Access Token, TTL 15m)
        B-->>F: Return Tokens & User Info (200 OK)
        F->>P: Redirect ke Dashboard
    else Password Invalid
        B-->>F: Return Error (401 Unauthorized)
        F->>P: Tampilkan Pesan Error
    end
```

## 1.5 Alur Refresh Token & Keamanan Sesi
Alur ini berjalan secara transparan di *background* untuk memastikan kenyamanan peserta tanpa mengorbankan keamanan.

**Langkah-langkah (Narasi):**
1. Setiap kali Frontend meminta data, *Access Token* dikirim ke Backend. Backend mengecek ketersediaan `Session ID` tersebut di **Redis**. Jika ada, _request_ dilayani sangat cepat.
2. Jika *Access Token* kedaluwarsa atau terhapus dari Redis, Frontend diam-diam memanggil `POST /auth/refresh` dengan membawa *Refresh Token*.
3. Backend memverifikasi *Refresh Token* ke PostgreSQL (tabel `sessions`). Sistem memastikan sesi belum kedaluwarsa dan tidak sedang `is_blocked = true` (belum dicabut aksesnya oleh admin).
4. Jika valid, Backend mencetak pasangan token baru, menyimpannya kembali ke DB dan Redis, lalu membalas ke Frontend agar pengguna tidak menyadari ada token yang baru diterbitkan.

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as Backend API
    participant R as Redis
    participant DB as Postgres

    F->>B: POST /api/v1/auth/refresh (Membawa Refresh Token)
    B->>DB: Verifikasi Refresh Token & Cek is_blocked
    DB-->>B: Sesi Valid
    B->>B: Generate New Access & Refresh Tokens
    B->>DB: Update Refresh Token Baru di PostgreSQL
    B->>R: Cache Session ID Baru di Redis (TTL 15m)
    B-->>F: Return Tokens Baru
```

## 2. Alur Manajemen Event & Setup Soal (Admin Flow)
Alur ini merinci bagaimana Admin menyiapkan Bank Soal dan merilis Jadwal Ujian (Event).

**Langkah-langkah (Narasi):**
1. Admin masuk ke halaman Manajemen Soal dan menginput data soal beserta opsi jawaban (A/B/C/D), kunci jawaban, dan bobot.
2. Frontend mengirim data soal ke Backend melalui `POST /questions`, lalu Backend menyimpannya di PostgreSQL.
3. Setelah bank soal dirasa cukup, Admin masuk ke halaman Manajemen Event untuk menerbitkan ujian baru.
4. Admin menginput nama Event, rentang waktu ujian, _Passing Grade_ (batas lulus), dan mengatur parameter pengambilan soal (misal: "Acak 100 soal dari kategori PUPK").
5. Frontend mengirim konfigurasi ini melalui `POST /events`.
6. Backend memvalidasi data dan menyimpannya di PostgreSQL sebagai Event ujian baru yang siap diikuti (di-_enroll_) oleh para anggota pramuka.

```mermaid
sequenceDiagram
    participant A as Admin
    participant F as Frontend
    participant B as Backend API
    participant DB as Postgres

    A->>F: Input Soal Baru (Soal, Opsi, Kunci, Bobot, Kategori)
    F->>B: POST /api/v1/admin/questions
    B->>DB: Cek Duplikasi Teks Soal
    note over B,DB: Hanya cek soal dari kategori aktif (deleted_at IS NULL)
    alt Teks Soal / Opsi Duplikat
        DB-->>B: Ditemukan Duplikat
        B-->>F: Error 400 ("Soal serupa sudah terdaftar" / "Opsi jawaban duplikat")
        F->>A: Tampilkan Alert (Form Tetap Terbuka)
    else Teks Unik
        DB-->>B: Bebas Duplikat
        B->>DB: Insert Question Data
        DB-->>B: OK
        B-->>F: Success (Soal Tersimpan)
        F->>A: Tampilkan Soal yang Baru Ditambahkan (Single-Item View)
    end

    A->>F: Setup Event Baru (Waktu, Passing Grade, Rule Soal)
    F->>B: POST /api/v1/admin/events
    B->>DB: Insert Event & Distribusi Soal
    note over B,DB: Soal dari kategori yang dihapus tidak diikutsertakan
    DB-->>B: OK
    B-->>F: Success (Event Diterbitkan)
```

## 2.5. Alur Manajemen Kategori (Admin Flow)
Alur ini menjelaskan bagaimana Admin mengelola kategori soal, termasuk mekanisme *soft delete* dan validasi nama unik.

```mermaid
sequenceDiagram
    participant A as Admin
    participant F as Frontend
    participant B as Backend API
    participant DB as Postgres

    A->>F: Input Nama Kategori Baru
    F->>B: POST /api/v1/admin/categories
    B->>DB: Cek Nama (GetCategoryByName WHERE deleted_at IS NULL)
    alt Nama Sudah Ada
        DB-->>B: Ditemukan Duplikat
        B-->>F: Error 400 ("Kategori dengan nama '...' sudah ada")
        F->>A: Tampilkan Toast Error
    else Nama Unik
        DB-->>B: Bebas Duplikat
        B->>DB: INSERT INTO categories (name)
        DB-->>B: OK
        B-->>F: Success (201 Created)
        F->>A: Daftar Kategori Diperbarui
    end

    A->>F: Klik Hapus Kategori
    F->>A: Tampilkan Dialog Konfirmasi
    A->>F: Konfirmasi "Ya, Hapus"
    F->>B: DELETE /api/v1/admin/categories/:id
    B->>DB: UPDATE categories SET deleted_at = NOW() WHERE id = :id
    note over B,DB: Soal yang terhubung tidak ikut terhapus,
    note over B,DB: namun otomatis tidak tampil & tidak bisa dipilih untuk Event baru
    DB-->>B: OK
    B-->>F: Success (200 OK)
    F->>A: Kategori Hilang dari Daftar
```

## 3. Alur Persetujuan (Approval) Peserta
Peserta tidak bisa sembarangan mengikuti ujian meskipun sudah login. Mereka harus mendaftar/memilih *event*, lalu disetujui Admin.

**Langkah-langkah (Narasi):**
1. Peserta memilih *Event* yang tersedia di *Dashboard* dan menekan tombol "Ikut Ujian" (Enroll).
2. Backend menerima _request_ tersebut dan mencatat riwayat partisipasi peserta di database dengan status `pending`.
3. Admin masuk ke halaman *Approval* dan melihat tabel daftar peserta berstatus `pending`.
4. Admin menekan tombol "Approve" (Setuju) untuk mengizinkan peserta tersebut.
5. Frontend Admin mengirim instruksi ke Backend untuk memperbarui (_update_) status peserta menjadi `approved` di database PostgreSQL.
6. Backend mendistribusikan *task* pengiriman Notifikasi & Email ke *Worker Background* agar Frontend langsung menerima respon sukses tanpa penundaan.
7. *Worker Background* secara asinkron mengirim Notifikasi (In-App) dan Email ke Peserta.

```mermaid
sequenceDiagram
    participant P as Peserta
    participant A as Admin
    participant F as Frontend
    participant B as Backend API
    participant DB as Postgres
    participant W as Task Worker (Asynq)
    participant E as Email Server (SMTP)

    P->>F: Request Ikut Event Ujian
    F->>B: POST /protected/exams/enroll (body: { event_id })
    B->>DB: Insert Status = 'pending'
    B-->>F: Sukses (Menunggu Approval)
    
    A->>F: Buka Daftar Peserta Pending
    F->>B: GET /admin/events/:id/participants
    B->>DB: Fetch Data
    DB-->>B: Data Peserta Pending
    B-->>F: List Peserta
    
    A->>F: Klik "Approve" untuk Peserta X
    F->>B: PUT /admin/events/:event_id/participants/:approval_id/approve
    B->>DB: Update Status = 'approved'
    B->>W: DistributeTaskSendEmail & CreateNotification (Background)
    B-->>F: OK
    
    Note over W,E: Proses Asinkron (Di Luar Siklus Request HTTP)
    W->>DB: Insert In-App Notification
    W->>E: Kirim Email Pemberitahuan via SMTP
```

## 4. Alur Pelaksanaan Ujian (Real-time & Auto-Resume)
Ini adalah alur di mana Redis berperan sebagai penyimpan jawaban sementara untuk menahan *load* ke database utama.

**Langkah-langkah (Narasi):**
1. Peserta (yang statusnya sudah `approved`) menekan tombol "Mulai Ujian".
2. Backend memvalidasi status peserta dan apakah saat ini adalah waktu ujian yang legal berdasarkan database.
3. Backend menarik daftar soal secara acak (sesuai _rule_ Event) dari PostgreSQL.
4. Backend menyimpan paket soal ini berserta batas waktu (Timer) ke dalam *Cache* (Redis) khusus untuk sesi peserta tersebut.
5. Frontend mulai menampilkan soal satu per satu, dan *Timer Countdown* berjalan.
6. Setiap kali peserta memilih jawaban (A/B/C/D), Frontend mengirim respons di _background_ ke Backend.
7. Backend secara _real-time_ menyimpan jawaban tersebut ke Redis tanpa membebani (Hit) database PostgreSQL, memastikan aplikasi berkinerja tinggi dan jawaban aman jika internet terputus (_Auto-Resume_).

```mermaid
sequenceDiagram
    participant P as Peserta
    participant F as Frontend
    participant B as Backend API
    participant R as Redis
    participant DB as Postgres

    P->>F: Klik "Mulai Ujian"
    F->>B: GET /protected/exams/:id/start
    B->>DB: Cek Status (Apakah Approved?) & Waktu Event
    DB-->>B: Valid
    B->>DB: Tarik Soal Acak (Sesuai Konfigurasi Event)
    DB-->>B: Daftar Soal
    B->>R: Cache Daftar Soal & Sisa Waktu Ujian
    B-->>F: Return Soal & Durasi Timer
    F->>P: Tampilkan Lembar Ujian & Mulai Timer

    loop Setiap Kali Memilih Jawaban
        P->>F: Pilih Opsi (A/B/C/D)
        F->>B: POST /protected/exams/:id/submit-answer
        B->>R: Simpan Jawaban Sementara (Real-time)
        B-->>F: OK (Tanpa Hit DB)
    end
```

## 5. Alur Penilaian & Auto-Submit (Scoring Flow)
Terjadi ketika waktu di *browser* habis, atau peserta sengaja menekan tombol "Selesai".

**Langkah-langkah (Narasi):**
1. *Trigger* pengumpulan ujian bisa terjadi dua cara: Peserta klik "Selesai" secara manual, ATAU Frontend memicu paksa (*Auto-Submit*) karena Timer menunjukkan angka `00:00`.
2. Frontend menembak _endpoint_ `submit` ke Backend.
3. Backend mengambil seluruh opsi jawaban yang diisi peserta dari *Cache* (Redis).
4. Backend mencocokkan jawaban peserta dengan kunci jawaban yang benar di database, lalu mengakumulasi poin berdasarkan bobot soal.
5. Backend melakukan proses standardisasi skor akhir menjadi skala 100 dengan rumus Auto-Bobot `(Skor Peserta / Total Bobot Event) * 100`.
6. Backend membandingkan total nilai peserta dengan _Passing Grade_ yang diatur pada *Event* tersebut untuk meluluskan atau menggagalkan peserta.
7. Hasil akhir (Total Nilai dan Status Lulus/Tidak Lulus) disimpan secara permanen ke PostgreSQL.
8. Sesi *Cache* ujian peserta di Redis dibersihkan.
9. Frontend memunculkan layar "Hasil Ujian" yang menampilkan rekap nilai.

```mermaid
sequenceDiagram
    participant P as Peserta/Sistem
    participant F as Frontend (Timer)
    participant B as Backend API
    participant R as Redis
    participant DB as Postgres

    alt Klik Submit Manual
        P->>F: Klik "Selesai"
    else Waktu Habis (Auto-Submit)
        F->>F: Timer = 00:00 (Trigger Event)
    end

    F->>B: POST /protected/exams/:id/finish
    B->>R: Tarik Semua Jawaban Sementara Peserta
    R-->>B: List Jawaban
    B->>DB: Cocokkan Jawaban dengan Kunci (Kalkulasi Bobot)
    B->>B: Hitung Total Nilai & Tentukan Lulus/Tidak (Passing Grade)
    B->>DB: Insert Nilai Akhir & Ubah Status Jadi 'completed'
    B->>R: Hapus Data Cache Ujian Peserta
    B-->>F: Return Nilai Akhir & Status Kelulusan
    F->>P: Tampilkan Layar Hasil Ujian
```

## 6. Alur Command Palette (Ctrl+K)

```mermaid
sequenceDiagram
    participant U as Admin/Peserta
    participant N as Navbar
    participant CP as CommandPalette (Component)
    participant L as DashboardLayout
    participant R as Next.js Router

    U->>N: Klik tombol Cari (atau tekan Ctrl+K / Cmd+K)
    N->>CP: document.dispatchEvent('openCommandPalette')
    CP->>CP: setIsOpen(true), fokus ke input pencarian

    U->>CP: Ketik query pencarian
    CP->>CP: Filter ITEMS berdasarkan role & query

    alt Pilih Item Navigasi
        U->>CP: Klik atau Enter pada item (mis: "Buka Dashboard")
        CP->>R: router.push(href)
        CP->>CP: setIsOpen(false)
    else Pilih Item Aksi Cepat
        U->>CP: Klik atau Enter pada item (mis: "Buat Soal Baru")
        CP->>L: window.dispatchEvent('triggerQuickAction', { detail: 'question' })
        L->>L: setQuickAction('question')
        L->>L: Render QuickActionModal yang sesuai
        CP->>CP: setIsOpen(false)
    else Tekan ESC atau klik backdrop
        U->>CP: ESC / klik di luar panel
        CP->>CP: setIsOpen(false)
    end
```

## 7. Alur Aksi Cepat (Quick Action Modal)

```mermaid
sequenceDiagram
    participant A as Admin
    participant D as Dashboard / CommandPalette
    participant L as DashboardLayout (QuickActionModals)
    participant B as Backend API
    participant F as Frontend Router

    A->>D: Klik "Tambah Soal Baru" (Quick Actions panel atau Command Palette)
    D->>L: window.dispatchEvent(triggerQuickAction: 'question')
    L->>L: setQuickAction('question')
    L->>A: Tampilkan QuestionFormModal

    A->>L: Isi form & submit
    L->>B: POST /admin/questions
    alt Sukses
        B-->>L: 201 Created
        L->>A: Toast sukses ("Soal berhasil ditambahkan")
        L->>F: router.push('/dashboard/questions')
        L->>L: setQuickAction(null) — tutup modal
    else Gagal (validasi/duplikat)
        B-->>L: 400 Error
        L->>A: Tampilkan pesan error di dalam modal (form tetap terbuka)
    end
```

## 8. Alur Sidebar Collapse/Expand

```mermaid
sequenceDiagram
    participant U as Admin (Desktop)
    participant L as DashboardLayout
    participant S as Sidebar
    participant N as Navbar

    U->>S: Klik tombol chevron di header Sidebar
    S->>L: onToggleCollapse()
    L->>L: setIsCollapsed(!isCollapsed)
    L->>S: isCollapsed={true}
    L->>N: isCollapsed={true}

    Note over S: Lebar berubah: w-64 → w-20 (transisi 300ms)
    Note over S: Label nav items disembunyikan, hanya ikon tampil dengan tooltip
    Note over N: Judul berubah dari "Bank Soal" → "Pramuka CAT — Bank Soal"
    Note over L: Main content: lg:ml-64 → lg:ml-20 (offset ikut menyesuaikan)
```

## 9. Alur Memuat Statistik Dashboard Admin

```mermaid
sequenceDiagram
    participant A as Admin
    participant F as Frontend (DashboardPage)
    participant B as Backend API
    participant DB as Postgres

    A->>F: Buka halaman /dashboard
    F->>F: setLoading(true), render skeleton/spinner
    F->>B: GET /admin/dashboard/stats
    B->>DB: GetTotalParticipants
    B->>DB: GetTotalQuestions
    B->>DB: GetTotalActiveEvents
    B->>DB: GetTotalCompletedExams
    B->>DB: GetRecentActivities (LIMIT 5)
    DB-->>B: Semua data statistik
    B-->>F: { stats: { total_participants, total_questions, active_events, completed_exams }, activities: [...] }
    F->>F: setData(res.data), setLoading(false)
    F->>A: Render 4 stat cards + aktivitas terkini + panel aksi cepat
```
