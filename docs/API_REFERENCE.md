# 📚 Dokumentasi API - Pramuka CAT

Referensi ini menyediakan gambaran umum tentang endpoint API yang tersedia di aplikasi Pramuka CAT.

> **💡 Tips:** Untuk pengujian interaktif, silakan akses **Swagger UI** di `http://localhost:8080/swagger/index.html` saat server backend berjalan.

---

## 🔒 Autentikasi (`/api/v1/auth`)

Semua request yang membutuhkan autentikasi harus menyertakan header `Authorization: Bearer <token>`.

| Method | Endpoint | Deskripsi | Auth Required |
|:---:|---|---|:---:|
| `POST` | `/api/v1/auth/login` | Login peserta / admin | ❌ |
| `POST` | `/api/v1/auth/register` | Pendaftaran akun baru | ❌ |
| `POST` | `/api/v1/auth/refresh` | Refresh JWT Token | ✅ |
| `POST` | `/api/v1/auth/logout` | Logout dan hapus sesi | ✅ |

---

## 📅 Ujian / Events (`/api/v1/events`)

Manajemen ujian dan acara (Khusus Admin).

| Method | Endpoint | Deskripsi | Auth Required |
|:---:|---|---|:---:|
| `GET` | `/api/v1/events` | Mendapatkan daftar ujian | ✅ (Admin) |
| `POST` | `/api/v1/events` | Membuat ujian baru | ✅ (Admin) |
| `GET` | `/api/v1/events/:id` | Detail spesifik ujian | ✅ (Admin) |
| `PUT` | `/api/v1/events/:id` | Update ujian | ✅ (Admin) |
| `DELETE`| `/api/v1/events/:id` | Menghapus ujian | ✅ (Admin) |

---

## 👤 Profil & Peserta (`/api/v1/protected`)

Endpoint untuk peserta.

| Method | Endpoint | Deskripsi | Auth Required |
|:---:|---|---|:---:|
| `GET` | `/api/v1/protected/profile` | Mendapatkan profil peserta saat ini | ✅ |
| `GET` | `/api/v1/protected/exams/upcoming` | Daftar ujian yang akan datang / aktif | ✅ |

---

## 🛠️ Utilitas & Sistem

| Method | Endpoint | Deskripsi | Auth Required |
|:---:|---|---|:---:|
| `GET` | `/health` | Pengecekan status server | ❌ |
| `GET` | `/metrics` | Ekspor metrik untuk Prometheus | ❌ |
| `POST`| `/api/v1/upload/image` | Upload gambar (soal/profil) | ✅ |

---

*Catatan: Struktur payload JSON (Request/Response) secara detail dapat dilihat langsung melalui antarmuka Swagger.*
