# 🔍 Gap Analysis Report: Pramuka CAT — Dokumen vs Implementasi

> **Tanggal Audit:** 20 Mei 2026  
> **Cakupan:** PRD, ERD, Sequence Diagrams, Implementation Decisions vs seluruh kode sumber

---

## Executive Summary

Proyek PramukaCAT memiliki fondasi backend yang **cukup matang** untuk fitur admin, namun terdapat **gap signifikan** di beberapa area kritis. Temuan utama:

1. 🔴 **Runtime Bug** — Context key mismatch yang menyebabkan PANIC di semua handler protected
2. 🔴 **Arsitektur menyimpang** — Redis untuk ujian (fitur inti PRD) tidak diimplementasikan sama sekali
3. 🔴 **Frontend peserta kosong** — 0% fitur peserta (ujian, enrollment, hasil) diimplementasikan
4. 🟡 **Fitur-fitur PRD belum lengkap** — Revoke approval, randomisasi soal, auto-resume, photo upload

---

## 🗄️ A. Database & SQL (ERD vs Migrasi)

### A.1. Tabel — ✅ Semua Ada

Seluruh 8 tabel dari ERD sudah dibuat di migrasi:

| Tabel ERD | File Migrasi | Status |
|---|---|---|
| `users` | [000001_init_schema.up.sql](file:///home/aliube/Workspace/Prd/PramukaCAT/backend/sql/migrations/000001_init_schema.up.sql) | ✅ |
| `sessions` | [000002_create_sessions.up.sql](file:///home/aliube/Workspace/Prd/PramukaCAT/backend/sql/migrations/000002_create_sessions.up.sql) | ✅ |
| `categories` | 000001_init_schema.up.sql | ✅ |
| `questions` | 000001_init_schema.up.sql | ✅ |
| `events` | 000001_init_schema.up.sql | ✅ |
| `event_questions` | 000001_init_schema.up.sql | ✅ |
| `user_event_approvals` | 000001_init_schema.up.sql | ✅ |
| `user_answers` | 000001_init_schema.up.sql | ✅ |

### A.2. Kolom — ⚠️ Ada Gap

| # | Severity | Gap | Detail |
|---|---|---|---|
| 1 | ⚠️ Medium | `updated_at` ada di migrasi tapi **tidak ada di ERD** | Kolom `users.updated_at` ada di `000001_init_schema.up.sql` L11, tapi ERD hanya mendefinisikan `created_at` dan `deleted_at` |
| 2 | ⚠️ Low | Timezone inkonsisten pada `deleted_at` | `deleted_at` di migration 000003 menggunakan `TIMESTAMP NULL` (tanpa timezone), sementara kolom lain menggunakan `TIMESTAMP WITH TIME ZONE` |
| 3 | ⚠️ Low | Tidak ada CHECK constraint untuk ENUM | ERD menspesifikasikan `role` sebagai "ENUM: admin, peserta" dan `status` sebagai "ENUM: pending, approved, revoked", tapi migrasi hanya menggunakan `VARCHAR(50)` tanpa constraint |

### A.3. Query SQL — 🔴 Ada Gap Kritis

Dari 38 query yang ada di [query.sql](file:///home/aliube/Workspace/Prd/PramukaCAT/backend/sql/query.sql), berikut query yang **seharusnya ada** menurut PRD tapi **belum dibuat**:

| # | Severity | Query yang Hilang | Referensi PRD |
|---|---|---|---|
| 1 | 🔴 Critical | **`RevokeUserEvent`** — set `status = 'revoked'` | PRD §3.3.3: "Admin memiliki fitur pembatalan (Revoke/Batal) persetujuan" |
| 2 | 🔴 Critical | **`StartExam` / `SetStartedAt`** — update `started_at` saat peserta mulai ujian | PRD §3.2.4: tracking waktu mulai ujian per peserta |
| 3 | 🟡 Medium | **`ListQuestionsByCategory`** — filter soal berdasarkan `category_id` | PRD §3.3.4: Admin bisa filter bank soal by kategori |
| 4 | 🟡 Medium | **`GetApprovalById`** — get by `approval_id` langsung | PRD §3.3.6: Review jawaban via `GET /admin/exams/approvals/:approval_id/answers` |
| 5 | 🟡 Medium | **`DeleteSession` / `ListSessionsByUser`** — kelola sesi aktif | Manajemen sesi yang lengkap |
| 6 | 🟡 Medium | **`ListUsersByRole`** — filter user by role | PRD §3.1: Membedakan admin dan peserta |
| 7 | ⚠️ Observe | **`UpdateUser` tidak meng-update `updated_at`** | query.sql L27-30 tidak menyentuh kolom `updated_at` |

> [!NOTE]
> **sqlcgen ↔ query.sql** sepenuhnya konsisten (38/38 method ter-generate). Model structs juga cocok dengan migrasi.

---

## 🔧 B. Backend Architecture (Go Code)

### B.1. Domain Structs — ✅ Sebagian Besar Cocok

| Struct | Cocok dengan ERD? | Catatan |
|---|---|---|
| `User` | ✅ | Tapi tidak ada field `DeletedAt` dan `UpdatedAt` di domain (soft-delete ditangani di SQL) |
| `Category` | ✅ | |
| `Question` | ✅ | |
| `Event` | ✅ | |
| `UserApproval` / `EventParticipant` | ✅ | |
| `UserAnswerDetail` | ✅ | |
| `Session` / Auth DTOs | ✅ | |
| `ParticipantQuestion` | ✅ | Sengaja menghilangkan `CorrectAnswer` (anti-cheat) |

### B.2. Ports & Interfaces — 🔴 Gap Kritis

| Port | Repository | Service | Cache | Status |
|---|---|---|---|---|
| Auth | ✅ | ✅ | ✅ `AuthCache` | ✅ Lengkap |
| User | ✅ | ✅ | N/A | ✅ Lengkap |
| Category | ✅ | ✅ | N/A | ✅ Lengkap |
| Question | ✅ | ✅ | N/A | ✅ Lengkap |
| Event | ✅ | ✅ | N/A | ✅ Lengkap |
| Exam | ✅ | ✅ | 🔴 **TIDAK ADA** | 🔴 **`ExamCache` tidak ada!** |

> [!CAUTION]
> **`ExamCache` Interface Tidak Ada** — PRD dan implementation-decisions.md **menegaskan** Redis sebagai penyimpan jawaban real-time ujian. Tapi kode tidak memiliki interface `ExamCache` sama sekali. Seluruh jawaban masuk langsung ke PostgreSQL, **bertentangan dengan arsitektur yang didokumentasikan.**

> [!WARNING]
> **`AuthRepository` melanggar Hexagonal Architecture** — Interface `ports.AuthRepository` mengembalikan tipe `sqlcgen.User` dan `sqlcgen.Session` (tipe adapter layer) alih-alih tipe domain. Port core seharusnya tidak bergantung pada tipe adapter.

### B.3. Services — Business Logic

| Service | Fitur | Status | Detail |
|---|---|---|---|
| **Auth** | Login, Refresh, Logout | ✅ | Dual token, session blocking, semua ada |
| **User** | CRUD + soft-delete | ✅ | |
| **User** | **Photo upload** | 🔴 **MISSING** | PRD: "mengunggah foto profil" — kode hanya menerima URL string, tidak ada multipart/form-data handler |
| **Category** | Full CRUD | ✅ | |
| **Question** | CRUD + weight + category | ✅ | |
| **Event** | CRUD + distribusi soal (manual+random) | ✅ | |
| **Event** | Export Excel & PDF | ✅ | Lengkap dengan styling |
| **Event** | **Revoke Approval** | 🔴 **MISSING** | PRD §3.3.3 wajib ada, tapi tidak diimplementasikan |
| **Exam** | Enroll, Start, Submit Answer, Finish | ⚠️ Partial | |
| **Exam** | **Jawaban via Redis (real-time)** | 🔴 **MISSING** | Jawaban langsung ke PostgreSQL, bukan Redis |
| **Exam** | **Randomisasi soal (Fisher-Yates)** | 🔴 **MISSING** | `StartExam` mengembalikan soal urut dari DB, tidak diacak |
| **Exam** | **Auto-Resume** | 🔴 **MISSING** | Tanpa Redis cache, tidak ada mekanisme resume |
| **Exam** | **`started_at` tracking** | 🔴 **MISSING** | `StartExam` tidak pernah set `started_at` di approval record |
| **Exam** | Auto-Bobot scoring formula | ✅ | `(score / totalWeight) * 100` benar |
| **Exam** | Passing grade check | ✅ | |

### B.4. Handlers & Routing — 🔴 Ada Bug Kritis

#### Bug Runtime yang Menyebabkan PANIC:

> [!CAUTION]
> **Context Key Mismatch** — Middleware menyimpan `c.Set("authorization_payload", *TokenPayload)`, tapi handler membaca menggunakan `c.Get("user_id")` dan `c.Get("session_id")` yang **tidak pernah di-set**! Ini menyebabkan **nil type assertion PANIC** di runtime untuk **SEMUA handler protected**.
>
> File terdampak:
> - [auth_handler.go](file:///home/aliube/Workspace/Prd/PramukaCAT/backend/internal/adapters/handler/auth_handler.go) L46
> - [exam_handler.go](file:///home/aliube/Workspace/Prd/PramukaCAT/backend/internal/adapters/handler/exam_handler.go) L39
> - [auth_middleware.go](file:///home/aliube/Workspace/Prd/PramukaCAT/backend/internal/adapters/middleware/auth_middleware.go) L53

#### Logout Route Tidak Terdaftar:

> [!WARNING]
> `AuthHandler.RegisterProtectedRoutes()` **tidak pernah dipanggil** di [main.go](file:///home/aliube/Workspace/Prd/PramukaCAT/backend/cmd/api/main.go). Endpoint `POST /protected/auth/logout` tidak bisa diakses sama sekali.

#### Endpoint Path Mismatch (Sequence Diagram vs Kode):

| Sequence Diagram | Kode Aktual | Masalah |
|---|---|---|
| `POST /api/v1/events/{id}/enroll` | `POST /api/v1/protected/exams/enroll` | Path berbeda |
| `POST /api/v1/exams/{id}/start` | `GET /api/v1/protected/exams/:id/start` | **GET vs POST** |
| `PUT /api/v1/exams/{id}/answer` | `POST /api/v1/protected/exams/:id/submit-answer` | **PUT vs POST**, path beda |
| `POST /api/v1/exams/{id}/submit` | `POST /api/v1/protected/exams/:id/finish` | Path beda (submit vs finish) |
| `GET /api/v1/admin/approvals` | `GET /api/v1/admin/events/:id/participants` | Nested under events |

### B.5. Middleware — ✅ Lengkap

| Middleware | Status |
|---|---|
| RequireAuth (JWT + Redis session check) | ✅ |
| RequireRole (RBAC) | ✅ |
| TraceErrorMiddleware (OTEL) | ✅ |

---

## 🖥️ C. Frontend (Next.js)

### C.1. Fitur Admin — ✅ Hampir Lengkap

| Fitur Admin | Status | Detail |
|---|---|---|
| Login | ✅ | Form lengkap dengan validasi Zod |
| Manajemen User (CRUD + soft-delete) | ✅ | Table dengan search, pagination, soft-delete visual |
| Manajemen Admin (tambah admin baru) | ✅ | Via UserFormModal dengan role selector |
| Bank Soal (CRUD + kategori + bobot) | ✅ | QuestionFormModal + CategoryManagerModal |
| Event Setup (distribusi soal manual + random) | ✅ | EventDetailDrawer dengan 2 tab |
| Approval Peserta | ⚠️ Partial | Approve ✅, tapi **Revoke ❌ MISSING** |
| Laporan & Review Jawaban | ✅ | AnswerReviewDrawer + export URL |
| Export Excel/PDF | ✅ | URL builder ada |

### C.2. Fitur Peserta — 🔴 SELURUHNYA MISSING

> [!CAUTION]
> **Seluruh fitur peserta yang merupakan tujuan utama aplikasi (Computer Assisted Test) belum diimplementasikan sama sekali di frontend.**

| Fitur Peserta (PRD) | Status | Detail |
|---|---|---|
| **Registrasi** | 🔴 MISSING | Tidak ada halaman `/register`, tidak ada service function |
| **Manajemen Profil + foto** | 🔴 MISSING | Route `/dashboard/profile` direferensikan di Navbar tapi **tidak ada `page.tsx`** → dead link |
| **Dashboard Peserta** (event + status approval) | 🔴 MISSING | Dashboard saat ini menampilkan **data hardcoded** (248 peserta, 1432 soal) dan hanya berorientasi admin |
| **Enrollment Event** (ikut ujian) | 🔴 MISSING | Zero referensi "enroll" di frontend, tidak ada service function |
| **Halaman Ujian** (soal, timer, A/B/C/D) | 🔴 MISSING | Tidak ada exam-taking page, countdown timer, question navigation |
| **Auto-Submit (waktu habis)** | 🔴 MISSING | Tidak ada logika auto-submit |
| **Auto-Resume (reconnect)** | 🔴 MISSING | Tidak ada logika auto-resume |
| **Hasil Ujian** (skor + LULUS/TIDAK) | 🔴 MISSING | Results page yang ada hanya untuk admin review, bukan peserta |

### C.3. Teknikal Frontend

| Aspek | Status | Detail |
|---|---|---|
| AuthContext (dual token) | ✅ | Access token in-memory, refresh di localStorage, silent refresh |
| HTTP Client (auto-refresh) | ✅ | Axios interceptor dengan request queue, anti-infinite loop |
| Missing API services | 🔴 | `enroll()`, `startExam()`, `submitAnswer()`, `finishExam()` tidak ada |
| Dead links di UI | 🔴 | `/dashboard/profile` dan `/dashboard/settings` tidak punya page |
| Dashboard hardcoded | ⚠️ | Stats dan recent activity bukan dari API |
| Sidebar user info hardcoded | ⚠️ | "Admin Pramuka" / "admin@pramuka.id" bukan user login aktual |
| Export auth token | ⚠️ | `window.open()` tidak menyertakan Bearer token |

---

## 🐳 D. Infrastruktur & DevOps

### D.1. Docker — ✅ Sesuai Dokumen

| Aspek | Status | Detail |
|---|---|---|
| Multi-stage build Dockerfile | ✅ | Builder (golang:alpine) → Final (alpine:latest) |
| Docker Compose services | ✅ | postgres, redis, migrate, api, jaeger — semua ada |
| depends_on + healthcheck | ✅ | API menunggu postgres healthy + migrate completed + redis healthy |
| Jaeger OTLP gRPC (port 4317) | ✅ | `COLLECTOR_OTLP_ENABLED=true` |

### D.2. Graceful Shutdown — ✅ Sesuai Dokumen

Implementasi di main.go: SIGTERM/SIGINT handling dengan 10-detik timeout. ✅

### D.3. Health Check — ✅ Sesuai Dokumen

`GET /health` mengecek koneksi PostgreSQL & Redis, return 200/503. ✅

### D.4. Observability & Monitoring — ✅ Sesuai Dokumen & Ekstra

| Aspek | Status |
|---|---|
| OTEL SDK (bukan deprecated jaeger-client-go) | ✅ |
| OTLP gRPC exporter | ✅ |
| `otelecho` middleware | ✅ |
| Jaeger UI di docker-compose (port 16686) | ✅ |
| Prometheus + Grafana (Dashboard metrik khusus CPU/RAM/Aplikasi) | ✅ |

### D.5. Makefile — ✅ Semua Perintah Ada

`up`, `down`, `infra-up`, `infra-down`, `run`, `migrate-up`, `migrate-down`, `seed`, `clear-seed`, `reset-db`, `test`, `sqlc`, `swagger`, `build`, `docker-build` — semua ada.

### D.6. Testing — 🟡 Gap Signifikan

| Aspek | Status | Detail |
|---|---|---|
| Unit test | ⚠️ Partial | Hanya `auth_service_test.go` (3 test case). **5 service lain tidak ada test** |
| Integration test folder | 🔴 MISSING | PRD mewajibkan `tests/integration/`, tapi folder **tidak ada** |
| testcontainers-go | 🔴 MISSING | Tidak ada di `go.mod` (PRD merekomendasikan) |
| Mock files | ⚠️ Partial | Hanya `AuthRepository` dan `AuthCache` yang punya mock. **10 interface lain tidak ada mock** |

### D.7. Env Variables — ⚠️ Kecil

`.env.example` tidak memiliki `JWT_ACCESS_SECRET` dan `JWT_REFRESH_SECRET` (padahal docker-compose memerlukannya).

---

## 📊 Ringkasan Prioritas Gap

### 🔴 Critical — Harus Diperbaiki Segera (App Crash / Core Feature Missing)

| # | Gap | Layer | Impact |
|---|---|---|---|
| 1 | **Context key mismatch** → PANIC runtime di semua handler protected | Backend | App crash saat digunakan |
| 2 | **Logout route tidak terdaftar** di main.go | Backend | Endpoint unreachable |
| 3 | **Redis untuk ujian TIDAK ADA** — jawaban langsung ke PostgreSQL | Backend | Menyimpang dari arsitektur PRD |
| 4 | **Seluruh fitur peserta frontend** (ujian, enrollment, hasil) = 0% | Frontend | Tujuan utama app tidak ada |
| 5 | **`started_at` tidak pernah di-set** saat peserta mulai ujian | Backend+SQL | Timer validation tidak berjalan |
| 6 | **Randomisasi soal tidak ada** (Fisher-Yates) | Backend | Peserta bisa curang |

### 🟠 Major — Fitur PRD Wajib Tapi Belum Ada

| # | Gap | Layer |
|---|---|---|
| 7 | Revoke Approval (admin batalkan persetujuan peserta) | Backend+Frontend+SQL |
| 8 | Registrasi peserta (self-register) | Backend+Frontend |
| 9 | Profile management + photo upload | Backend+Frontend |
| 10 | Auto-Resume (reconnect saat ujian) | Backend+Frontend |
| 11 | Dead links: `/dashboard/profile`, `/dashboard/settings` | Frontend |
| 12 | Query `RevokeUserEvent` dan `StartExam/SetStartedAt` | SQL |

### 🟡 Medium — Kualitas & Completeness

| # | Gap | Layer |
|---|---|---|
| 13 | Dashboard peserta menampilkan data hardcoded | Frontend |
| 14 | Sidebar menampilkan user hardcoded bukan user login | Frontend |
| 15 | Export download tanpa auth token | Frontend |
| 16 | AuthRepository port leaks sqlcgen types (violasi hex arch) | Backend |
| 17 | Endpoint paths berbeda dari sequence diagram | Backend |
| 18 | Missing unit tests (5 services tanpa test) | Testing |
| 19 | Missing integration tests (folder + testcontainers) | Testing |
| 20 | Missing mocks (10 interfaces tanpa mock) | Testing |
| 21 | Missing queries: `ListQuestionsByCategory`, `GetApprovalById`, `ListUsersByRole` | SQL |

### 🟢 Low — Minor / Observasi

| # | Gap | Layer |
|---|---|---|
| 22 | `updated_at` ada di migrasi tapi tidak di ERD | Docs/SQL |
| 23 | `deleted_at` timezone inkonsisten | SQL |
| 24 | Tidak ada CHECK constraint untuk ENUM fields | SQL |
| 25 | `UpdateUser` tidak update kolom `updated_at` | SQL |
| 26 | `.env.example` tidak punya JWT secret vars | Config |

---

## 📈 Statistik Keseluruhan

```
┌───────────────┬────────────┬─────────────────────────────┐
│ Area          │ Completion │ Catatan                     │
├───────────────┼────────────┼─────────────────────────────┤
│ Database/SQL  │ ~85%       │ Tabel lengkap, query gap    │
│ Backend Core  │ ~70%       │ Struktur bagus, Redis gap   │
│ Backend Infra │ ~95%       │ Docker/OTEL/Health OK       │
│ Frontend Admin│ ~90%       │ Hampir lengkap              │
│ Frontend Psrt │ ~5%        │ Hanya login yang bisa       │
│ Testing       │ ~15%       │ Hanya 1 unit test file      │
└───────────────┴────────────┴─────────────────────────────┘
```
