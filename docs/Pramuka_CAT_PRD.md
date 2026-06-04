# Product Requirements Document (PRD): Pramuka CAT (Computer Assisted Test)

> [!WARNING]
> **Status Implementasi:** Dokumen ini memuat _blueprint_ fitur ideal. Saat ini masih terdapat beberapa fitur (terutama fitur esensial Peserta) yang **belum diimplementasikan** secara penuh pada basis kode *frontend* maupun *backend*. 
> Silakan merujuk ke dokumen **[GAP_ANALYSIS.md](GAP_ANALYSIS.md)** untuk melihat rincian persentase kelengkapan dan fitur apa saja yang saat ini masih *missing*.
## 1. Pendahuluan
Aplikasi Pramuka CAT adalah platform ujian berbasis komputer yang dirancang khusus untuk kegiatan kepramukaan. Aplikasi ini memfasilitasi pelaksanaan ujian teori secara digital, terstruktur, dan efisien, menggantikan metode ujian tertulis konvensional.

## 2. Tujuan
- Menyediakan platform ujian digital yang objektif dan transparan.
- Mempermudah panitia/admin dalam mengelola bank soal, jadwal kegiatan ujian, dan validasi peserta.
- Mempercepat proses rekapitulasi penilaian karena hasil langsung diketahui sesaat setelah ujian selesai.

## 3. Spesifikasi Kebutuhan Pengguna (User Requirements)

### 3.1. Hak Akses (Role)
Aplikasi memiliki 3 jenis peran utama:
1. **Super Admin:** Pengelola sistem tingkat atas yang memiliki akses penuh ke seluruh fitur, termasuk manajemen akun admin/panitia.
2. **Admin / Panitia:** Mengelola sistem ujian, bank soal, jadwal event, dan peserta.
3. **Peserta (Anggota Pramuka):** Mengikuti ujian sesuai jadwal yang telah ditentukan dan disetujui.

### 3.2. Fitur Peserta (Anggota Pramuka)
1. **Registrasi & Login:** Peserta dapat mendaftar akun baru menggunakan identitas pramuka (di mana `Nomor Peserta` digunakan sebagai `username` untuk *login*) dan melakukan login ke dalam sistem.
2. **Manajemen Profil:** Peserta dapat melihat dan melengkapi profil, termasuk mengunggah foto profil.
3. **Dashboard Peserta:** Menampilkan daftar sesi/jadwal ujian yang tersedia dan status persetujuan (approval) ujian mereka.
4. **Pelaksanaan Ujian:**
   - Peserta hanya bisa mengakses dan memulai ujian jika statusnya sudah **disetujui (Approved)** oleh Admin.
   - Soal disajikan dalam bentuk **Pilihan Ganda (A, B, C, D)** dan berbasis teks.
   - Urutan soal yang ditampilkan harus **diacak (random)** untuk setiap peserta guna meminimalisir potensi kecurangan.
   - **Sistem Timer / Waktu Pengerjaan:** Terdapat _countdown timer_ di layar peserta sesuai durasi event (misal: 60 menit). Saat waktu habis, sistem akan secara otomatis menyimpan jawaban dan mengakhiri ujian (_Auto-Submit_).
   - **Fitur Auto-Resume (Toleransi Putus Koneksi):** Jika peserta terputus (disconnect) atau browser tertutup, jawaban tersimpan secara _real-time_. Peserta dapat _login_ kembali dan melanjutkan ujian dari soal terakhir dengan sisa waktu yang disesuaikan.
5. **Hasil Ujian:** 
   - Nilai akhir langsung muncul di layar sesaat setelah peserta menekan tombol selesai/submit ujian.
   - Sistem membandingkan nilai peserta dengan **Passing Grade (Batas Lulus)** event tersebut, sehingga menampilkan status **"LULUS"** atau **"TIDAK LULUS"**.
   - Peserta dapat melihat **Waktu Mulai** dan **Waktu Selesai** (timestamp `started_at` dan `completed_at`) pengerjaan mereka sebagai bukti transparansi.
6. **Notifikasi Pintar & Auto-Cleanup:**
   - Peserta menerima pemberitahuan otomatis jika pendaftarannya disetujui atau dibatalkan oleh Admin.
   - Peserta dapat mengatur preferensi penerimaan notifikasi Email di halaman Pengaturan Akun.
   - **Pembersihan Otomatis:** Notifikasi yang berkaitan dengan jadwal ujian tertentu akan otomatis terhapus dari kotak masuk (*inbox*) peserta apabila jadwal ujian tersebut telah kedaluwarsa atau berakhir.

### 3.3. Fitur Admin & Super Admin
1. **Manajemen Admin (Khusus Super Admin):** Super Admin dapat mendaftarkan, mengubah, atau menghapus akun admin/panitia dari dalam sistem.
2. **Manajemen Peserta (CRUD User):**
   - Melihat daftar seluruh anggota pramuka yang terdaftar (List User).
   - Menambah, mengubah, atau menghapus data peserta (menggunakan metode **Soft-Delete** untuk menjaga integritas riwayat ujian masa lalu).
3. **Approval Peserta Ujian:**
   - Admin dapat memvalidasi dan menyetujui (Approve) peserta agar bisa mengikuti event ujian tertentu.
   - Admin memiliki fitur pembatalan (Revoke/Batal) persetujuan, sehingga peserta tersebut terkunci dan tidak bisa mengerjakan soal.
   - Admin juga dapat mengeluarkan/menghapus (Delete) peserta dari pendaftaran event tersebut.
   - **Notifikasi Otomatis:** Setiap kali Admin mengubah status peserta (Approve, Revoke, atau Delete), sistem akan mengirimkan **Notifikasi Dalam Aplikasi** beserta **Email Pemberitahuan** kepada peserta secara asinkron (*background task*) agar peserta senantiasa terinformasi mengenai status pendaftaran mereka tanpa perlu mengecek dashboard secara berulang.
   - Admin dimudahkan dengan antarmuka manajemen peserta *full-page* berskala besar yang dilengkapi fitur pencarian (*Search*) berdasarkan "Nama" atau "Nomor Peserta" (`username`), serta *Pagination* terintegrasi langsung ke *backend* (*server-side pagination*).
4. **Manajemen Soal (Bank Soal - CRUD):**
   - Membuat, membaca, mengubah, dan menghapus soal berbasis teks. Manajemen Bank Soal ini didukung dengan fitur pencarian dan filter *real-time*.
   - **Pemrosesan Data Massal (Bulk Import):** Admin dapat mengunggah ratusan soal ujian sekaligus melalui _file_ Excel untuk menghemat waktu pendataan.
   - Menentukan opsi jawaban A, B, C, D dan mengatur mana yang menjadi kunci jawaban.
   - **Validasi Duplikasi Soal:** Sistem mencegah masuknya soal dengan teks yang sama (mengabaikan perbedaan huruf kapital dan variasi penomoran seperti "1.", "2)", dsb) serta mencegah opsi jawaban yang duplikat dalam satu soal. Pengecekan hanya dilakukan terhadap soal dari **kategori yang masih aktif** — soal dari kategori yang sudah dihapus (diarsipkan) tidak ikut diperiksa sehingga tidak memblokir input soal baru.
   - **Kategori Materi Soal (Tagging):** Admin dapat mengelompokkan soal berdasarkan kategori (contoh: Pengetahuan Umum Kepramukaan/PUPK, Sandi, Tali-temali, Sejarah).
   - **Pengarsipan Otomatis:** Soal yang terkait dengan kategori yang dihapus secara otomatis tidak ditampilkan di Bank Soal dan tidak diikutsertakan dalam pengacakan soal Event baru. Data soal tetap tersimpan di database untuk menjaga integritas riwayat ujian peserta.
   - **Sistem Bobot Soal (Manual \& Auto):** Admin dapat mengatur bobot spesifik untuk setiap soal (misal: soal mudah berbobot 10, soal sulit berbobot 20). Jika Admin tidak melakukan _setup_ bobot secara manual, sistem akan otomatis menerapkan **Auto-Bobot** di mana setiap soal yang diujikan memiliki bobot yang sama rata sehingga total nilai sempurna mengacu pada skala standar (contoh: 10 soal, masing-masing otomatis berbobot 10 agar total skor 100).
5. **Manajemen Kategori Soal:**
   - Admin dapat membuat, mengubah, dan menghapus kategori soal.
   - **Validasi Nama Unik:** Tidak boleh ada dua kategori aktif dengan nama yang sama (tidak peka huruf kapital).
   - **Soft Delete:** Kategori yang dihapus tidak benar-benar dihilangkan dari database, melainkan ditandai (`deleted_at`) sehingga soal-soal lamanya tetap tersimpan untuk keperluan riwayat ujian. Kategori yang sudah dihapus tidak tampil di daftar maupun _dropdown_ pemilihan kategori soal.
6. **Manajemen Jadwal/Sesi (Event Setup):**
   - Membuat jadwal pelaksanaan ujian (Event diterbitkan).
   - **Pemilihan Soal (Distribusi):** Admin dapat mengambil sebagian soal dari Bank Soal untuk dimasukkan ke Event. Misalnya, dari 1000 soal yang ada, Admin bisa memilih 200 soal spesifik secara manual, atau mengatur agar sistem menarik jumlah soal tertentu secara acak (contoh: "Ambil 100 soal acak dari kategori Sandi").
   - Mengatur parameter waktu kapan event ujian dimulai dan ditutup.
   - Menentukan **Passing Grade (Batas Lulus)** untuk event tersebut.
   - **Visualisasi Event Selesai:** Jika waktu event telah kedaluwarsa atau ujian dinyatakan selesai, sistem secara otomatis meredupkan tampilan (*dimming/grayscale*) pada card atau konten ujian tersebut. Fitur untuk mengedit soal (tambah/hapus) dan mengelola status peserta (Approve/Revoke) akan di-*disable* (dinonaktifkan) guna mencegah manipulasi data pasca-ujian.
7. **Laporan & Review Jawaban (Monitoring & Export):**
   - Melihat daftar riwayat nilai dari semua peserta yang telah selesai mengerjakan. **Semua tampilan daftar (list) pada panel admin diurutkan secara *descending* (terbaru di atas) secara default.**
   - Melihat rincian ujian per peserta: meninjau soal-soal apa saja yang dikerjakan peserta, apa jawaban yang dipilih peserta, dan mencocokkannya dengan kunci jawaban (via endpoint `GET /admin/exams/approvals/:approval_id/answers`).
   - **Export Laporan (Excel & PDF):** Mengunduh rekap nilai seluruh peserta pada suatu event dalam format **Excel (.xlsx)** atau **PDF** untuk keperluan pelaporan kegiatan Gugus Depan/Kwartir (via endpoint `GET /admin/events/:id/export?format=excel` atau `?format=pdf`). Ekspor dilakukan dengan perantara *HTTP Client* yang tersertifikasi *Bearer Token* secara otomatis.
8. **Dashboard Admin (Statistik Sistem):**
   - Halaman *Dashboard* Admin menampilkan **4 kartu statistik** secara *real-time* memanfaatkan aliran **Server-Sent Events (SSE)** dari Backend: jumlah total peserta terdaftar, total soal dalam bank soal, jumlah event yang sedang aktif, dan total ujian yang sudah diselesaikan. Angka ini akan otomatis diperbarui setiap kali ada perubahan di _server_.
   - Terdapat panel **Aktivitas Terkini** yang memperlihatkan 5 log aktivitas terakhir (enroll, approval, atau penyelesaian ujian) beserta waktu relatif ("Baru saja", "X menit lalu", dst).
   - Panel **Aksi Cepat** menyediakan pintasan langsung ke aksi-aksi yang paling sering dilakukan Admin (buat soal, buat event, tambah peserta, approval peserta).
9. **Command Palette (Panel Perintah Cepat):**
   - Admin/Super Admin dapat membuka panel perintah (`Ctrl+K` / `Cmd+K` atau klik tombol Cari di Navbar) untuk navigasi cepat ke seluruh halaman atau memicu aksi tanpa harus mengklik menu satu per satu.
   - Daftar perintah difilter berdasarkan peran (`role`) pengguna yang sedang login.
   - Mendukung navigasi keyboard penuh: tombol `↑`/`↓` untuk berpindah pilihan, `Enter` untuk memilih, `ESC` untuk menutup.
   - Terdapat dua jenis perintah: **Navigasi** (berpindah halaman) dan **Aksi Cepat** (membuka modal buat soal/event/peserta langsung).
10. **Pemantauan Sistem (Monitoring Jobs, Observability & Alerting):**
    - Terdapat halaman panel khusus untuk memantau status antrean pemrosesan di latar belakang (*background jobs*) seperti proses pengiriman email masal atau *auto-submit* massal.
    - **Global Error Alert:** Apabila terdapat antrean tugas yang gagal berulang kali hingga batas maksimal percobaan (*permanent failure*), sistem akan otomatis membunyikan alarm darurat dengan mengirimkan pemberitahuan ke **Lonceng Notifikasi** dan **Email** ke semua Admin / Super Admin agar perbaikan bisa segera dilakukan tanpa perlu menatap panel *monitoring* secara konstan.
    - **Visual Monitoring (Grafana + Prometheus):** Aplikasi menyediakan dashboard Grafana komprehensif bagi Admin / tim Infrastruktur untuk memantau kesehatan server. Menampilkan metrik krusial seperti penggunaan **CPU**, ketersediaan **RAM**, serta metrik operasional secara *real-time* seperti "Total Percobaan Login" dan "Jumlah Ujian Aktif Saat Ini". Ini memastikan infrastruktur tetap terjaga stabil selama *event* berskala besar.

---

### 3.4. Fitur Shell / Antarmuka Utama (UI Shell)
- **Sidebar Collapsible:** Pada tampilan *desktop*, Admin dapat mengecilkan sidebar menjadi mode ikon saja (lebar 80px) untuk memaksimalkan area kerja, atau memperluasnya kembali (lebar 256px). Transisi berjalan mulus selama 300ms.
- **Navigasi Mobile:** Sidebar tampil sebagai *drawer* panel yang dapat dibuka via tombol hamburger di Navbar, dan ditutup dengan tombol X atau mengklik area backdrop gelap.
- **Judul Halaman Dinamis di Navbar:** Navbar menampilkan judul halaman aktif sesuai rute. Saat sidebar di-*expand*: hanya judul halaman yang tampil (mis: `"Bank Soal"`). Saat sidebar di-*collapse*: format berubah menjadi `"Pramuka CAT — Bank Soal"` untuk tetap memberikan konteks identitas aplikasi.
- **Sistem Notifikasi Toast:** Semua aksi yang berhasil atau gagal (membuat soal, event, peserta, dsb) memberikan umpan balik berupa notifikasi *toast* di pojok kanan bawah layar yang hilang otomatis setelah 4 detik. Toast berwarna hijau untuk sukses dan merah untuk gagal.
- **Quick Action Modals:** Modal isian cepat untuk membuat soal/event/peserta baru, dapat dipicu dari panel Aksi Cepat di Dashboard maupun dari Command Palette, tanpa harus berpindah halaman terlebih dahulu.

---

## 4. Kebutuhan Pengujian Sistem (Testing Requirements)
Untuk menjamin stabilitas aplikasi dan akurasi logika penilaian (scoring), sistem diwajibkan untuk mengimplementasikan pengujian otomatis (_Automated Testing_):
1. **Unit Test:** Menguji secara mandiri fungsi-fungsi inti secara terisolasi. Fokus pada logika kalkulasi bobot soal, mekanisme pengacakan soal, dan konversi batas waktu (timer).
2. **Integration Test:** Menguji integrasi alur keseluruhan dari _Backend_ ke _Database_ (PostgreSQL) dan _Cache_ (Redis). Tujuannya memastikan _endpoint HTTP_, _middleware_ (Auth), dan _query_ database (SQLC) bekerja sinkron. Pengujian dijalankan di dalam skema database pengujian terpisah (`pramukacat_test`).
3. **Load Testing:** Menggunakan **Grafana k6** untuk menyimulasikan ratusan pengguna virtual secara serentak guna memastikan _Rate Limiter_, _Caching_, dan arsitektur database sanggup menangani lonjakan lalu lintas ujian berskala besar.

**Struktur Folder Pengujian (Go Backend):**
```text
backend/
├── internal/
│   └── core/services/     # Unit Tests diletakkan bersebelahan dengan file yang diuji
│       ├── exam_service.go
│       └── exam_service_test.go
├── tests/                 # Folder terpisah khusus untuk Integration Tests
│   ├── integration/
│   │   ├── auth_flow_test.go
│   │   ├── exam_flow_test.go
│   │   └── setup_test.go  # Inisialisasi mock database/Redis untuk testing
```

---

## 5. Keputusan Teknis (Technical Decisions)
Untuk detail arsitektur, teknologi yang akan digunakan (_Tech Stack_), dan mekanisme sistem di belakang layar, silakan merujuk ke dokumen **[Implementation Decisions](docs/implementation-decisions.md)**.
