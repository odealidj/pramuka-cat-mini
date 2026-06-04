# Implementation Decisions: Pramuka CAT

> [!WARNING]
> **Status Implementasi:** Dokumen ini memuat _blueprint_ teknis ideal. Terdapat beberapa deviasi dan celah (*gap*) dalam implementasi saat ini, seperti fitur Redis Cache untuk ujian peserta yang belum direalisasikan.
> Silakan merujuk ke dokumen **[GAP_ANALYSIS.md](GAP_ANALYSIS.md)** untuk daftar lengkap deviasi teknis.
Dokumen ini memuat keputusan-keputusan teknis utama yang akan digunakan sebagai landasan dalam pengembangan aplikasi Pramuka CAT (Computer Assisted Test).

## 1. Arsitektur Sistem
Aplikasi akan menggunakan arsitektur **Client-Server** berbasis web (Web Application) untuk memudahkan akses peserta dari berbagai perangkat (laptop/smartphone) melalui browser tanpa perlu menginstal aplikasi khusus.

## 2. Pilihan Teknologi (Tech Stack) Rekomendasi

### 2.1. Frontend (Antarmuka Pengguna)
- **Framework:** React.js / Next.js
- **Alasan:** Modern, sangat reaktif untuk antarmuka ujian (seperti perpindahan soal tanpa reload), dan memiliki ekosistem yang luas. Next.js sangat baik untuk SEO dan routing yang terstruktur.
- **Styling:** Tailwind CSS (untuk desain yang rapi, _responsive_, dan pengerjaan cepat).

### 2.2. Backend (Server & API)
- **Bahasa / Framework:** Go (Golang) menggunakan framework **Echo**.
- **Alasan:** Go sangat ringan, kinerjanya sangat cepat, dan tangguh dengan _concurrency_ (Goroutines). **Echo** dipilih sebagai _best practice_ karena menyajikan _router_ HTTP berkinerja tinggi, manajemen _middleware_ yang elegan, dan sangat solid untuk membangun REST API berskala besar secara terstruktur.

### 2.3. Database Utama (RDBMS) & Database Interaction
- **Database:** PostgreSQL
- **Database Tool:** **sqlc** (Sebagai pengganti ORM konvensional)
- **Alasan:** Karena aplikasi ini melibatkan relasi data yang kuat, _Relational Database_ wajib digunakan. Untuk interaksi ke PostgreSQL, proyek ini secara eksplisit tidak menggunakan ORM (seperti GORM) demi performa maksimal, melainkan menggunakan **sqlc**. Sqlc akan membaca _raw SQL queries_ dan mengompilasinya menjadi kode Go yang _type-safe_, memastikan *query* dieksekusi dengan kecepatan super tinggi tanpa adanya _overhead_ eksekusi khas ORM.

### 2.4. Temporary Storage, Caching, & Message Broker
- **Sistem:** Redis
- **Alasan:** Sangat krusial untuk fitur **Auto-Resume** dan penyimpanan jawaban sementara secara _real-time_. Setiap kali peserta menjawab 1 soal, jawaban disimpan cepat di Redis sebelum disinkronisasikan secara *bulk* ke PostgreSQL saat _Submit_ atau waktu habis. Ini akan mengurangi beban *query* ke database utama. Selain itu, Redis digunakan sebagai *Message Broker* oleh antrean asinkron (menggunakan **Asynq**).

### 2.5. Framework Pengujian (Testing Stack)
- **Unit Testing:** Go standard library `testing` dipadukan dengan **`github.com/stretchr/testify`** (untuk *assertions* dan *mocking*).
- **Integration Testing:** Membangun lingkungan basis data terisolasi (`pramukacat_test`) khusus untuk menguji integrasi REST API, SQLC, dan fungsionalitas Redis.
- **Load Testing:** **Grafana k6** dipilih untuk menyimulasikan ribuan pengguna virtual (Virtual Users) secara konkuren demi membuktikan ketangguhan sistem di tingkat produksi (*production-grade*).

## 3. Mekanisme Inti (Core Mechanisms)

### 3.1. Autentikasi dan Keamanan (Stateful JWT)
- Menggunakan strategi **Dual Token (Access & Refresh Token)** untuk mengamankan proses login secara _Enterprise-grade_.
- **Access Token:** Berumur pendek (misal: 15 menit), divalidasi dengan sangat cepat melalui pengecekan Session ID di **Redis**.
- **Refresh Token:** Berumur panjang, disimpan permanen di tabel `sessions` pada **PostgreSQL**. Memungkinkan pencabutan akses jarak jauh secara instan (Revoke) dengan mengeset `is_blocked = true`.
- **Mencegah Multi-Login:** Peserta tidak bisa login di dua perangkat berbeda secara bersamaan karena pembatasan _active session_ tunggal di DB.

### 3.2. Role-Based Access Control (RBAC)
- **Arsitektur Kolom Tunggal:** Tidak ada tabel `roles` atau `permissions` yang terpisah demi menjaga kesederhanaan dan kecepatan _query_. Peran pengguna ("super_admin", "admin", "peserta") disimpan langsung dalam kolom `role` (VARCHAR) di tabel `users`.
- Saat otentikasi berhasil, nilai `role` ini akan disematkan secara kriptografis ke dalam **Claims JWT**.
- Middleware **RequireRole** (`CheckAdmin` dan `CheckSuperAdmin`) di lapisan HTTP (Echo) akan membaca peran langsung dari JWT tanpa membebani database dengan *query* tambahan, menjadikannya arsitektur yang sangat efisien untuk sistem CAT ini. `super_admin` memiliki privilese tambahan untuk mengelola seluruh data termasuk data panitia/admin.

### 3.3. Penanganan Timer dan Waktu Habis
- Timer berjalan secara mandiri di sisi _client_ (browser).
- Namun, **Backend tetap melakukan validasi akhir**. Saat sesi event dimulai, server mencatat _Start Time_. Jika peserta mengirim jawaban setelah _Start Time + Durasi + Toleransi Keterlambatan_ habis, sistem server akan menolak jawaban tambahan tersebut. Ini mencegah kecurangan memanipulasi _timer_ di browser.

### 3.3. Pengacakan Soal (Randomization)
- Pengacakan soal tidak dilakukan di sisi frontend (untuk menghindari peserta mengintip _source_ soal yang tersembunyi).
- Saat peserta menekan "Mulai Ujian", Backend akan melakukan penarikan soal (sesuai distribusi), mengacaknya (algoritma _Fisher-Yates_ atau fungsi `RANDOM()` SQL yang di-cache), dan menyimpannya sebagai "Paket Soal Peserta X" di database/Redis. 

### 3.4. Standarisasi API Response, Pagination & Search
- Seluruh endpoint API mematuhi standar JSON tunggal (melalui package `pkg/response`) yang memuat properti mutlak: `success`, `code`, `message`, `data`, `meta`, dan `errors`.
- Meta pagination (`page`, `limit`, `total_records`, dll) diotomatisasi pada lapisan handler untuk setiap request berjenis koleksi/daftar.
- Fitur pencarian (*Search*) diimplementasikan langsung pada *query database* dengan klausul `ILIKE` yang tidak peka kapital, dan ditangani di sisi *backend* untuk meringankan beban memori *frontend* pada data besar.

### 3.5. Penilaian Otomatis (Auto-Bobot) & Skala Nilai
- Backend menghitung skor akhir menggunakan pendekatan matematis proporsional yang berskala maksimum 100 secara default.
- Rumus: `(Total Bobot Jawaban Benar / Total Bobot Seluruh Soal) * 100`.
- Pendekatan ini memungkinkan *Auto-Bobot* (ketika semua soal berbobot default 1) sekaligus mendukung perhitungan berkeadilan jika Admin mengatur bobot sulit/mudah (manual) untuk masing-masing soal.

### 3.6. Manajemen Penyimpanan File (Foto Profil)
- Mengingat aplikasi akan di-hosting pada layanan shared hosting/VPS standar (seperti Hostinger), penyimpanan file media (seperti foto profil peserta) menggunakan pendekatan **Local Storage**.
- File diunggah ke *endpoint* khusus (`POST /api/v1/users/me/photo`) dan disimpan pada direktori `/uploads` pada server Backend. File kemudian di-*serve* secara statis untuk dibaca oleh Frontend.

### 3.7. Alur Registrasi
- Pendaftaran (*Self-Registration*) diizinkan untuk calon peserta melalui rute publik. Secara *default*, peran yang diberikan adalah `peserta`.
- Peserta yang mendaftar dan melengkapi data tidak bisa langsung mengikuti event ujian sampai mereka di-_approve_ oleh admin pada halaman partisipan event.

### 3.8. Soft Delete pada Kategori, Soal, dan Event
Ini adalah keputusan arsitektur data yang paling kritikal untuk menjaga **integritas riwayat ujian**.

#### Permasalahan
Jika entitas dihapus secara permanen (*hard delete*), soal-soal yang terikat padanya dan riwayat ujian yang melibatkan entitas tersebut akan rusak integritasnya.

#### Keputusan: Soft Delete Berbasis `deleted_at` + Unique Partial Index
- Kolom `deleted_at TIMESTAMP WITH TIME ZONE` ditambahkan ke tabel **`categories`**, **`questions`**, dan **`events`**.
- Aksi "Hapus" pada ketiga entitas tersebut **tidak menjalankan `DELETE FROM`**, melainkan `UPDATE SET deleted_at = NOW()`. Ini adalah *soft delete*.
- **Unique Partial Index** dipasang di level database untuk `categories` dan `users`:
  ```sql
  CREATE UNIQUE INDEX categories_name_unique_idx ON categories (name) WHERE deleted_at IS NULL;
  CREATE UNIQUE INDEX users_username_unique_idx ON users (username) WHERE deleted_at IS NULL;
  ```
  Hasilnya: dua entitas aktif tidak bisa bernama/ber-username sama, namun entitas yang sudah dihapus boleh memiliki nilai yang sama (memungkinkan pembuatan ulang di kemudian hari).
- Validasi nama unik juga dilakukan di lapisan *Service* (Go) untuk menghasilkan pesan *error* yang informatif (HTTP 400) alih-alih membiarkan *error* database mentah (HTTP 500) muncul ke pengguna.

#### Konsekuensi Pengarsipan Otomatis Soal
Semua *query* yang melibatkan soal melakukan `JOIN categories c ON q.category_id = c.id WHERE c.deleted_at IS NULL`. Dampaknya:
1. **Bank Soal (ListQuestions):** Soal dari kategori yang dihapus otomatis tidak muncul di daftar Bank Soal.
2. **Validasi Duplikasi (CheckDuplicateQuestion):** Soal dari kategori yang dihapus tidak ikut dicek, sehingga soal baru dengan teks yang sama bisa ditambahkan ke kategori aktif.
3. **Pengacakan Event (AddRandomEventQuestions):** Soal dari kategori yang dihapus tidak bisa tertarik secara acak ke dalam Event ujian baru.
4. **Integritas Riwayat Terjaga:** Data soal dan jawaban peserta dari ujian masa lalu tetap utuh di database, karena tidak ada data yang benar-benar dihapus.

### 3.9. Dashboard Statistics API Endpoint & Real-Time SSE
- Endpoint `GET /admin/dashboard/stats` menyediakan agregasi data statistik sistem.
- Response mencakup 4 metrik utama: `total_participants`, `total_questions`, `active_events`, `completed_exams`.
- Juga menyertakan array `activities` berisi 5 log aktivitas terbaru.
- **Server-Sent Events (SSE):** Terdapat endpoint khusus `/admin/dashboard/stream` yang mengimplementasikan protokol **SSE**. *Backend* akan memancarkan (*emit*) aliran data JSON ke browser *admin* setiap kali ada perubahan data (seperti pendaftaran baru atau selesainya ujian). Hal ini memastikan bahwa dasbor diperbarui secara *real-time* tanpa perlu intervensi manual (me-*refresh* halaman) dengan beban *resource* yang jauh lebih ringan daripada *WebSockets*.

### 3.10. Pola Global Layout (Global Shell Pattern)
- `(dashboard)/layout.tsx` bertindak sebagai **Global Shell** yang bertanggung jawab atas state dan komponen yang bersifat lintas-halaman.
- **State yang dikelola di Layout:** `isCollapsed` (sidebar desktop), `isSidebarOpen` (mobile drawer), `quickAction` (modal aksi cepat aktif), dan `toasts` (antrian notifikasi).
- **Singleton UI di Layout:** Komponen `<CommandPalette>`, `<QuickActionModals>`, dan `<ToastContainer>` di-render satu kali di layout, bukan di masing-masing halaman. Ini mencegah *re-mounting* komponen saat navigasi antar halaman dan memastikan toast tetap tampil meskipun halaman berpindah.

### 3.11. Pola Komunikasi Lintas-Komponen via CustomEvent
- Untuk menghindari *prop drilling* yang dalam, komunikasi antara komponen yang tidak memiliki relasi langsung menggunakan mekanisme **CustomEvent** bawaan browser — bukan React Context API.
- `'openCommandPalette'` — di-dispatch oleh Navbar, di-listen oleh CommandPalette (membuka panel).
- `'triggerQuickAction'` — di-dispatch oleh CommandPalette dengan `detail: 'question'|'event'|'user'`, di-listen oleh DashboardLayout untuk membuka modal yang sesuai.
- Pendekatan ini dipilih karena lebih ringan dari Context API untuk komunikasi satu-arah yang jarang terjadi (tidak perlu *re-render* seluruh tree).

### 3.12. CommandPalette sebagai Komponen Mandiri (Self-Contained)
- `CommandPalette` tidak menerima props dari luar dan tidak mengekspos state ke parent. Ia sepenuhnya mengelola siklus hidupnya sendiri.
- Dibuka via CustomEvent `'openCommandPalette'` (dari Navbar) atau shortcut keyboard `Ctrl+K`/`Cmd+K` (event listener internal).
- Mengembalikan `null` (bukan di-unmount) saat tertutup untuk menghindari biaya re-registrasi event listener dan menjaga state internal.

### 3.13. Asynchronous Task, Background Jobs & Notifikasi Email
- Sistem mengimplementasikan pola asinkron menggunakan *package* **`hibiken/asynq`** (berbasis Redis) untuk tugas-tugas berat di *background* agar tidak memblokir laju _request_ HTTP utama.
- Pengiriman ini dikelola melalui antrian tugas (*task queue*). Ketika ada perubahan krusial (misal: pendaftaran otomatis, pembersihan sesi kedaluwarsa, atau pengiriman email massal), backend akan men-_distribute_ pesan tersebut ke *worker* di _background_.
- *Worker* memproses pengiriman email melalui protokol SMTP secara mandiri, lengkap dengan mekanisme *retry* dan *Global Error Handling* jika terjadi kegagalan sistemik berulang kali, memastikan antarmuka frontend tetap responsif seketika tanpa perlu menunggu proses jaringan _handshake_ ke _server email_ selesai.

### 3.14. Data Seeding & Pemrosesan Data Massal (Bulk Import)
- Untuk mempermudah proses inisiasi (baik di fase _development_ maupun bagi panitia nyata), sistem menyediakan kapabilitas **Bulk Import Excel**.
- **Excel Stream Parsing:** Proses ekstraksi data dari *file* `.xlsx` (menggunakan pustaka `excelize/v2`) dilakukan secara *streaming* sehingga ramah memori (menghindari ancaman *Out of Memory* saat file yang diunggah berisi ribuan baris data soal).
- **Bulk Insert (SQLC):** Penyimpanan ke dalam *database* PostgreSQL menggunakan operasi penyisipan massal (*Bulk Insert* / `COPY`), menggantikan metode `INSERT` yang berulang-ulang (*looping*). Pendekatan ini berhasil memangkas drastis latensi pemrosesan dan antrean I/O *database*.

## 4. Infrastruktur dan Deployment
- Aplikasi akan di-containerisasi menggunakan **Docker** agar mudah dideploy di berbagai server (VPS atau Cloud).
- **Dockerfile (Multi-Stage Build):** Backend Go menggunakan pola *multi-stage build*. Tahap pertama (`Builder`) mengompilasi *binary* menggunakan image Go Alpine. Tahap kedua (`Final`) hanya menyalin *binary* ke image Alpine murni yang sangat ringan, tanpa *source code* sisa.
- **Docker Compose:** Orkestrasi seluruh layanan (`postgres`, `redis`, `migrate`, `api`) dengan urutan *startup* yang ditegaskan via `depends_on` + `healthcheck`. Service `api` baru akan menyala setelah migrasi database selesai dijalankan.
- **Makefile:** Disediakan sebagai antarmuka perintah DevOps yang terpadu. Perintah utama:
  - `make infra-up` / `make infra-down` — Menyalakan/mematikan HANYA infrastruktur (Postgres, Redis, Migrate) untuk sesi *debugging* lokal.
  - `make up` / `make down` — Menjalankan/menghentikan seluruh sistem termasuk Backend API.
  - `make run` — Menjalankan API Go langsung di host (untuk mode *debug*).
  - `make seed` / `make clear-seed` — Memasukkan atau membersihkan data simulasi.
  - `make reset-db` — Reset penuh database (migrate-down → migrate-up → seed).
- Menggunakan NGINX sebagai _Reverse Proxy_ dan pengelola sertifikat HTTPS (SSL) agar transmisi data ujian aman.

### 4.1. Graceful Shutdown
- Backend API mengimplementasikan *graceful shutdown* standar industri. Saat menerima sinyal `SIGTERM` atau `SIGINT` (dari Docker, Kubernetes, atau Ctrl+C), server tidak langsung mati.
- Server berhenti menerima *request* baru, tetapi menunggu hingga seluruh *request* yang sedang diproses selesai (dengan batas waktu maksimal **10 detik**) sebelum benar-benar menutup koneksi.
- Ini memastikan tidak ada data peserta yang hilang di tengah proses *submit* ujian akibat *deployment* atau *restart* server.

### 4.2. Health Check Endpoint
- Tersedia endpoint `GET /health` yang melakukan pengecekan koneksi aktif (*liveness & readiness probe*) ke PostgreSQL dan Redis setiap kali dipanggil.
- Mengembalikan HTTP **200** jika semua komponen sehat, dan HTTP **503 Service Unavailable** jika salah satu komponen terputus, lengkap dengan detail komponen mana yang bermasalah.
- Endpoint ini sangat krusial untuk integrasi dengan *load balancer* dan sistem monitoring di *production* (Kubernetes, AWS ALB, dsb).

### 4.3. Distributed Tracing — Jaeger + OpenTelemetry
- Sistem menggunakan **OpenTelemetry (OTEL) SDK** sebagai standar instrumentasi yang *vendor-neutral*, dengan **Jaeger** sebagai backend visualisasi trace.
- `jaeger-client-go` tidak digunakan karena sudah *deprecated* sejak 2022. Standar resmi penggantinya adalah OTEL SDK.
- **Alur pengiriman trace:** `Go App → OTLP Exporter (gRPC) → Jaeger Collector → Jaeger UI`
- **Mengapa gRPC untuk transport OTLP?** OTLP mendukung dua protokol transport: gRPC (port 4317) dan HTTP (port 4318). gRPC dipilih karena menggunakan format *binary/protobuf* yang lebih efisien dan latensi lebih rendah dibandingkan HTTP/JSON. Ini bukan arsitektur gRPC microservice — melainkan hanya *kabel* internal pengiriman data telemetri.
- **`otelecho` middleware** dipasang di Echo untuk menciptakan **span otomatis pada setiap HTTP request** tanpa perlu mengubah satu handler pun. Setiap span berisi: method, URL, status code, latency, dan error.
- **Jaeger UI** tersedia di `http://localhost:16686` untuk visualisasi dan analisis trace.

### 4.4. Server Monitoring & Metrics — Prometheus + Grafana
- Untuk *production-readiness*, selain melakukan *distributed tracing* (penelusuran *request*), sistem juga mengimplementasikan pemantauan performa menyeluruh menggunakan **Prometheus** dan **Grafana**.
- **Prometheus** berperan sebagai *time-series database* yang melakukan *pull/scraping* pada data metrik sistem (seperti CPU, RAM) dan metrik aplikasi bawaan.
- **Custom Business Metrics:** Backend Go menggunakan *client library* Prometheus untuk memaparkan (*expose*) indikator operasional, seperti jumlah percobaan pengguna untuk *login* (`LoginsTotal`) maupun total peserta yang *online* sedang melangsungkan ujian (*Gauge* `ActiveParticipants`).
- **Grafana Dashboard** dikonfigurasi menggunakan *Provisioning* yang secara otomatis terhubung dengan *datasource* Prometheus dan menyiapkan sebuah *Dashboard Monitoring* khusus untuk memvisualisasikan data telemetri ini. Dasbor ini bisa diakses pada port `3000`.

## 5. Struktur Direktori Proyek
Mengingat frontend dan backend menggunakan teknologi yang berbeda (Next.js dan Go), struktur direktori utama akan memisahkan keduanya secara jelas:

```text
PramukaCAT/
├── frontend/                 # Aplikasi Next.js (React)
│   ├── src/
│   │   ├── app/              # App Router (Pages, Layouts, Routing)
│   │   │   └── (dashboard)/ # Route group: layout.tsx (Global Shell), halaman admin
│   │   ├── components/       # Reusable UI components (Tombol, Modal, Card)
│   │   │   ├── layout/       # Shell components: Navbar, Sidebar, CommandPalette
│   │   │   ├── dashboard/    # Dashboard-specific: QuickActionModals
│   │   │   └── ui/           # Generic UI: Toast, Modal, Spinner, Pagination
│   │   ├── contexts/         # React Context providers (AuthContext)
│   │   ├── hooks/            # Custom React hooks (useTimer, useAuth)
│   │   ├── services/         # Fungsi fetcher HTTP ke Backend API
│   │   ├── types/            # Semua TypeScript types (auth.ts — monolitik, satu file)
│   │   └── lib/              # Konfigurasi helper (constants, axios instance)
│   ├── public/               # Asset statis (Logo Pramuka, Icons)
│   ├── package.json          # Dependency frontend
│   └── tailwind.config.ts    # Konfigurasi Tailwind CSS
│
├── backend/                  # Aplikasi Go (REST API dengan Echo Framework)
│   ├── cmd/
│   │   ├── api/              # Entry point aplikasi (main.go - Graceful Shutdown, Health Check, Routing)
│   │   ├── seeder/           # Script pengisian data simulasi (seed)
│   │   └── clear_seed/       # Script pembersihan data simulasi
│   ├── internal/             # Kode aplikasi privat (Berdasarkan Hexagonal Architecture / Ports and Adapters)
│   │   ├── core/             # Core Business Logic (Tidak bergantung pada framework eksternal)
│   │   │   ├── domain/       # Structs, Entities, dan Business Rules
│   │   │   ├── ports/        # Interfaces (Inbound & Outbound Ports)
│   │   │   └── services/     # Implementasi Usecase (Inbound Ports)
│   │   ├── adapters/         # Infrastruktur dan Komunikasi Luar (Bergantung pada framework)
│   │   │   ├── handler/      # Inbound Adapter: Echo HTTP handlers/controllers
│   │   │   └── repository/   # Outbound Adapter: Implementasi Outbound Ports (Postgres/Redis)
│   │   │       └── sqlcgen/  # Package kode Go hasil generate otomatis dari SQLC
│   │   └── middleware/       # Echo custom middleware (JWT Auth, RBAC Role)
│   ├── pkg/                  # Utilities eksternal/publik (Bisa di-share antar project)
│   │   ├── database/         # Konfigurasi koneksi Postgres & Redis
│   │   ├── response/         # Standar format JSON response (success & error)
│   │   ├── tracer/           # Inisialisasi OpenTelemetry TracerProvider untuk Jaeger
│   │   └── utils/            # Utilities (hashing password, dsb)
│   ├── sql/                  # Folder terkait database (Migrasi & SQLC)
│   │   ├── migrations/       # Folder file migrasi versi DB (.up.sql & .down.sql)
│   │   ├── schema.sql        # Skema tabel database (DDL) untuk referensi SQLC
│   │   └── query.sql         # Raw SQL queries (DML) untuk SQLC
│   ├── sqlc.yaml             # Konfigurasi generator SQLC
│   ├── tests/                # Folder terpisah khusus Integration Tests
│   │   └── integration/      # Test integrasi DB, Redis, dan Endpoint API
│   ├── Dockerfile            # Multi-Stage Build untuk production image
│   ├── go.mod                # Dependency manager Go
│   └── .env.example          # Template environment variables
│
├── docs/                     # Dokumentasi Sistem
│   ├── Pramuka_CAT_PRD.md
│   ├── implementation-decisions.md
│   ├── sequence-diagrams.md
│   └── database-erd.md
│
├── docker-compose.yml        # Orchestration untuk Local Development (Postgres, Redis, Migrate, API, Jaeger)
├── Makefile                  # Perintah DevOps: infra-up/down, up/down, seed, clear-seed, reset-db, build, test, swagger
└── README.md                 # Petunjuk instalasi utama
```
