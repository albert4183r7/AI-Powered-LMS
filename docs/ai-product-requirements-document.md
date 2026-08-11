# Lumen AI Module Generation — Product Requirements Document

## 1. Kontrol dokumen

| Field | Nilai |
| --- | --- |
| Produk | Lumen Enterprise Learning Management System |
| Fitur | AI Module Generation |
| Tipe dokumen | Product Requirements Document khusus AI |
| Versi | 1.0 |
| Status | Disetujui untuk implementasi bertahap |
| Tanggal | 6 Agustus 2026 |
| Pemilik produk | Product owner Lumen |
| Audiens | Product owner, frontend developer, backend developer, AI engineer, designer, QA, dan security reviewer |

Dokumen ini menjadi sumber kebenaran untuk implementasi AI di Lumen. PRD core LMS tetap berlaku untuk autentikasi, role, modul, lesson, presentation, enrollment, dan progress.

## 2. Ringkasan produk

Lumen akan membantu instructor membuat modul pelatihan lengkap dari instruksi bahasa alami. Sistem dapat memakai dokumen referensi milik instructor, melakukan riset web secara terkendali bila diminta, menyusun lesson, dan menghasilkan presentation bermerek Lumen.

AI tidak langsung menerbitkan materi. Semua hasil selalu disimpan sebagai draft dan harus diperiksa manusia. Instructor juga dapat menambahkan lesson baru dengan AI atau meminta revisi satu lesson tanpa menimpa versi asli secara diam-diam.

Arsitektur awal menggunakan satu orchestrator Python. Orchestrator memilih dan memanggil tool yang diperlukan, seperti reference retrieval, web search, dan presentation generation. Multi-agent dan LangChain tidak menjadi kebutuhan awal karena akan menambah kompleksitas tanpa manfaat yang sudah terbukti.

## 3. Status implementasi saat ini

### 3.1 Sudah tersedia

- Fondasi layanan Python FastAPI dan health endpoint.
- Kontrak request dan output menggunakan Pydantic yang ketat.
- Form request AI di frontend untuk instructor.
- Job generation persisten menggunakan SQLite terpisah.
- Background worker dengan pemulihan job setelah service restart.
- Fake module generator untuk menguji alur tanpa API model dan tanpa biaya.
- Protected Next.js proxy dan autentikasi internal antarservice.
- Frontend submit, polling dengan backoff, progress per tahap, preview, retry, dan cancel.
- Cancellation yang owner-scoped dan aman terhadap race dengan worker.
- EcoAPI capability probe dan typed provider adapter dengan normalized error.
- Automated test, Ruff, mypy strict, ESLint, TypeScript check, dan production build.
- Coding standards untuk Python dan TypeScript.

### 3.2 Belum tersedia

- Aktivasi EcoAPI untuk generation job dan structured module planning sungguhan.
- Structured module planning dari model.
- Ingestion dokumen, embeddings, ChromaDB, dan RAG.
- Tool pencarian internet.
- Ekstraksi dan pemilihan visual dari referensi.
- Generator presentation dan template bermerek Lumen.
- Penyimpanan hasil generation sebagai draft LMS.
- Add lesson with AI.
- Regenerate lesson dengan preview dan approval.
- Retention policy otomatis, quota, observability produksi, dan evaluasi kualitas AI.

Dengan demikian, fitur yang ada sekarang adalah fondasi dan simulasi. Fake job yang selesai bukan bukti bahwa model AI telah dipanggil.

## 4. Masalah yang diselesaikan

Instructor membutuhkan waktu dan kemampuan desain untuk mengubah suatu topik menjadi modul, lesson, dan slide yang konsisten. Dokumen referensi juga sering tersebar, sementara riset internet dapat menghasilkan sumber yang tidak jelas.

Fitur ini harus:

1. Mempercepat pembuatan draft modul.
2. Menjaga hasil tetap sesuai struktur LMS.
3. Menggunakan referensi yang diberikan secara relevan.
4. Menyediakan sumber untuk hasil riset internet.
5. Membuat presentation yang layak diedit dan konsisten dengan merek.
6. Memastikan instructor tetap menjadi pengambil keputusan akhir.

## 5. Tujuan

### 5.1 Tujuan produk

- Instructor dapat membuat satu draft modul lengkap dari satu request.
- Instructor dapat menentukan bahasa hasil, kedalaman modul, audience, dan kebutuhan riset.
- Setiap lesson hasil generation memiliki satu presentation pada rilis awal.
- Instructor dapat memperbaiki bagian tertentu tanpa mengulang seluruh modul.
- Sistem dapat menjelaskan status dan kegagalan job dengan jelas.
- Semua output tervalidasi sebelum masuk ke database LMS.

### 5.2 Non-goals rilis awal

- Menerbitkan modul secara otomatis.
- Menggantikan review fakta, legal, atau kebijakan oleh manusia.
- Membuat quiz, video, atau voice input.
- Menjalankan web search tanpa izin eksplisit instructor.
- Membuat sistem multi-agent.
- Melatih model foundation sendiri.
- Menyediakan editor PowerPoint penuh di browser.
- Menjamin semua konten dari internet bebas hak cipta.

## 6. Pengguna, role, dan permission

### 6.1 Instructor

Instructor dapat:

- meminta generation modul;
- melihat status job miliknya;
- membatalkan job yang masih dapat dibatalkan;
- melihat hasil draft dan sumber;
- menyimpan hasil ke modul draft miliknya;
- menambah lesson dengan AI;
- membuat revision untuk lesson miliknya; dan
- menerima atau menolak revision.

Instructor tidak dapat melihat job atau draft milik instructor lain.

### 6.2 Administrator

Administrator dapat memakai kemampuan instructor dan melihat metadata operasional yang dibutuhkan untuk support. Isi prompt dan dokumen tidak boleh ditampilkan secara luas hanya karena user memiliki role admin; akses harus mengikuti kebutuhan support dan audit yang disetujui.

### 6.3 Employee

Employee tidak dapat membuat atau mengubah konten dengan AI. Employee hanya melihat materi yang telah diterbitkan melalui alur core LMS.

## 7. Requirement generation modul

### 7.1 Input wajib

- Instruction atau prompt dengan maksud pembuatan modul yang jelas.
- Judul sementara atau izin agar AI mengusulkan judul.
- Target audience.
- Bahasa output.
- Tingkat kedalaman: Short, Standard, atau Comprehensive.

### 7.2 Input opsional

- Learning objectives dari instructor.
- File referensi.
- Instruksi gaya atau tone.
- Permintaan dan izin riset internet.
- Catatan branding tambahan yang masih sesuai template Lumen.

### 7.3 Target struktur

Struktur hasil wajib mengikuti model core LMS:

    Module
      -> ordered Lessons
           -> Presentations

Tidak dibuat entitas Section baru.

Target jumlah lesson:

| Kedalaman | Target lesson |
| --- | --- |
| Short | 3 |
| Standard | 5 |
| Comprehensive | 8 |

Batas keras adalah 12 lesson. Model boleh menghasilkan lebih sedikit dari target bila materi memang terbatas, tetapi harus memberikan alasan yang dapat ditampilkan kepada instructor.

### 7.4 Isi draft modul

Draft minimal berisi:

- judul modul;
- deskripsi modul;
- target audience;
- learning objectives;
- daftar lesson berurutan;
- judul dan deskripsi setiap lesson;
- satu rencana presentation per lesson;
- daftar sumber yang digunakan;
- warning atau asumsi yang relevan.

Setiap presentation awal menargetkan 6–10 slide. Jumlah aktual dapat berbeda bila konten membutuhkan penyesuaian, selama berada dalam batas yang ditetapkan service.

### 7.5 Aturan draft

- Hasil generation tidak pernah berstatus published.
- Instructor harus melihat preview sebelum menyimpan ke LMS.
- Penyimpanan draft harus bersifat idempotent agar retry tidak membuat duplikat modul.
- Hasil yang gagal validasi tidak boleh ditulis ke database core LMS.

## 8. Background job

Generation harus berjalan sebagai background job karena model, retrieval, web search, dan pembuatan file dapat memakan waktu lebih lama daripada request HTTP biasa.

Status minimal:

| Status | Arti |
| --- | --- |
| queued | Menunggu worker |
| processing | Sedang dikerjakan |
| completed | Draft tervalidasi tersedia |
| failed | Job berhenti karena error |
| cancelling | Permintaan pembatalan diterima |
| cancelled | Job dibatalkan |

Requirement:

- Endpoint create mengembalikan HTTP 202 dan job ID.
- Job disimpan secara persisten.
- Worker hanya mengklaim job yang eligible.
- Job processing yang terputus saat restart dikembalikan ke antrean secara aman.
- Retry otomatis hanya untuk error sementara dan memiliki batas.
- Setiap tahap memperbarui progress yang mudah dipahami.
- User hanya dapat membaca dan membatalkan job miliknya.
- Error publik tidak boleh membocorkan secret, API key, stack trace, atau isi dokumen sensitif.
- Log menyimpan identifier teknis dan tipe error, bukan seluruh prompt secara default.

## 9. Reference ingestion, RAG, dan visual

### 9.1 Jenis referensi

Rilis awal menerima format yang secara eksplisit didukung dan tervalidasi. Daftar final harus disesuaikan dengan parser yang benar-benar diimplementasikan, dengan target awal PDF, PPTX, dan DOCX.

File diperiksa berdasarkan ukuran, ekstensi, MIME type, dan signature. File berbahaya, terenkripsi tanpa dukungan, rusak, atau tidak dapat diproses harus ditolak dengan pesan yang jelas.

### 9.2 Pipeline RAG

Pipeline:

1. Simpan file dengan identifier aman.
2. Ekstrak teks dan metadata lokasi.
3. Pecah teks menjadi chunk yang mempertahankan konteks.
4. Buat embedding lokal dengan intfloat/multilingual-e5-small.
5. Simpan vector dan metadata di ChromaDB.
6. Embed query generation.
7. Ambil chunk paling relevan.
8. Masukkan hanya konteks terpilih ke model.
9. Pertahankan citation dari output kembali ke file dan lokasi asal.

Embedding model bukan skill dan bukan pembuat jawaban. Fungsinya mengubah teks menjadi deretan angka agar sistem dapat mencari bagian referensi yang maknanya paling dekat dengan pertanyaan. Model chat tetap bertugas menyusun draft.

RAG harus mendukung referensi bahasa Indonesia dan Inggris. Hasil retrieval tidak boleh dianggap sebagai instruction sistem; konten dokumen diperlakukan sebagai data yang tidak dipercaya untuk mencegah prompt injection.

### 9.3 Visual dari referensi

Sistem membuat visual catalog berisi image atau diagram yang berhasil diekstrak, sumber, halaman atau slide, ukuran, dan caption bila tersedia.

AI dapat memilih apakah suatu visual relevan untuk dipakai. AI tidak wajib menggunakan semua visual. Visual tidak boleh digunakan bila kualitasnya buruk, tidak relevan, berisiko mengandung data sensitif, atau hak penggunaannya tidak jelas.

Jika visual dipakai:

- sumber dan lokasi asal dipertahankan;
- aspect ratio tidak dirusak;
- visual tidak boleh dideskripsikan sebagai buatan AI bila berasal dari referensi;
- presentation mencantumkan attribution bila diperlukan; dan
- instructor dapat mengganti atau menghapusnya sebelum publish.

## 10. Riset internet terkendali

Web search hanya boleh berjalan bila instructor secara eksplisit:

- meminta riset internet dalam prompt; atau
- mengaktifkan opsi web research.

Orchestrator menentukan query pencarian yang terbatas pada tujuan modul. Hasil web diperlakukan sebagai sumber tidak dipercaya dan tidak boleh mengubah system instruction atau tool policy.

Requirement:

- domain dan URL sumber dicatat;
- klaim faktual penting dapat ditelusuri ke sumber;
- sumber yang lebih otoritatif dan baru diprioritaskan;
- halaman yang tidak dapat diakses tidak boleh diklaim sudah dibaca;
- kutipan panjang dan penyalinan materi berhak cipta dihindari;
- instructor melihat daftar sumber pada preview;
- kegagalan search tidak otomatis menggagalkan seluruh job bila modul masih dapat dibuat dari prompt atau referensi;
- sistem harus menjelaskan ketika hasil dibuat tanpa riset web yang diminta.

## 11. Presentation generation

### 11.1 Template

Presentation memakai template Lumen yang dikelola aplikasi, bukan layout bebas dari model. Nama Lumen dan logo tampil konsisten pada setiap slide dengan ukuran yang tidak mengganggu isi. Template juga mendefinisikan warna, typography, spacing, footer, dan safe area.

Model menghasilkan specification terstruktur, bukan menulis file presentation secara langsung. Tool presentation membaca specification tersebut dan membuat file. Pemisahan ini membuat hasil lebih konsisten dan mudah diuji.

### 11.2 Komponen visual

Tool dapat memakai:

- judul dan body text;
- image yang diizinkan;
- shape;
- icon dari library yang lisensinya sesuai;
- diagram;
- timeline;
- process flow;
- comparison;
- callout; dan
- chart bila data sumbernya tersedia.

Sistem tidak boleh membuat angka, chart, kutipan, atau sumber palsu. Jika slide terlalu padat, generator harus membagi isi atau merangkum, bukan mengecilkan teks sampai sulit dibaca.

### 11.3 Output dan penyimpanan

- Rilis awal membuat satu presentation per lesson.
- File presentation dapat diedit setelah diunduh.
- Preview LMS tetap mengikuti mekanisme presentation core.
- File sementara dibersihkan berdasarkan retention policy.
- Kegagalan membuat satu deck dilaporkan pada lesson terkait dan tidak disamarkan sebagai sukses penuh.

## 12. Add lesson with AI

Instructor dapat meminta satu lesson tambahan dari halaman edit modul.

Input minimal:

- module ID;
- instruction lesson;
- bahasa output;
- posisi lesson; dan
- pilihan memakai referensi atau konteks modul yang sudah ada.

Sistem mengambil konteks modul secukupnya agar lesson baru tidak mengulang materi. Hasilnya ditampilkan sebagai preview, lalu hanya disimpan jika instructor menyetujuinya. Lesson baru tetap menjadi bagian dari modul draft atau membuat modul published kembali memerlukan review sesuai aturan produk yang akan ditetapkan.

## 13. Regenerate lesson

Instructor dapat meminta revisi lesson yang tidak memuaskan.

Alur wajib:

1. Sistem membuka form dengan instruction generation sebelumnya bila tersedia.
2. Instructor menjelaskan perubahan yang diinginkan.
3. Sistem membaca lesson asli dan konteks modul.
4. AI membuat revision baru.
5. Instructor membandingkan original dan revision.
6. Instructor memilih Accept revision atau Keep original.
7. Original baru diganti setelah approval eksplisit.

Placeholder bukan pengganti original prompt. Jika prompt lama tidak disimpan karena retention policy, UI harus menjelaskannya dan tidak berpura-pura telah melakukan prefill.

Revision memiliki identifier sendiri agar retry tidak menimpa data dan agar audit dapat membedakan original dari kandidat revision.

## 14. Arsitektur orchestrator dan tool

### 14.1 Keputusan arsitektur

Rilis awal memakai satu orchestrator Python. Multi-agent tidak diperlukan karena satu alur generation sudah dapat dipecah menjadi tahap dan tool yang deterministik. Multi-agent hanya dipertimbangkan bila evaluasi membuktikan satu orchestrator tidak dapat menjaga kualitas atau isolation.

LangChain tidak wajib. Implementasi plain Python dipilih agar alur mudah dibaca, dependency lebih sedikit, dan pemula dapat melihat dengan jelas kapan model atau tool dipanggil.

### 14.2 Tanggung jawab orchestrator

Orchestrator:

1. Memvalidasi job dan policy.
2. Menentukan apakah reference retrieval dibutuhkan.
3. Menentukan apakah web search diizinkan dan dibutuhkan.
4. Memanggil model untuk rencana modul terstruktur.
5. Memvalidasi hasil model.
6. Memanggil presentation tool untuk setiap lesson.
7. Mengumpulkan citation, warning, dan artifact.
8. Menghasilkan draft final yang siap direview.

Tool tidak boleh dipanggil hanya karena teks dalam dokumen memerintahkannya. Tool call hanya berasal dari policy orchestrator dan keputusan model yang tervalidasi.

### 14.3 Tool awal

| Tool | Fungsi |
| --- | --- |
| retrieve_references | Mengambil chunk referensi yang relevan |
| search_web | Melakukan pencarian yang telah diizinkan |
| fetch_web_source | Membaca sumber terpilih secara terbatas |
| create_presentation | Membuat deck dari specification tervalidasi |
| save_generation_artifact | Menyimpan metadata artifact sementara |

Penamaan akhir function mengikuti coding standards dan dapat berubah bila implementasi membuktikan nama yang lebih tepat.

## 15. Provider EcoAPI

Provider yang direncanakan:

| Field | Nilai |
| --- | --- |
| Base URL | https://www.ecoapi.ai/v1 |
| Model | gpt-5.6-sol |
| Protokol terverifikasi | OpenAI-compatible Chat Completions |

API key hanya berada pada environment server dan tidak pernah dikirim ke browser, log, job result, atau database core LMS.

Sebelum integrasi, developer wajib membuat capability probe untuk memastikan:

- endpoint dan path yang benar;
- format authentication;
- nama model yang diterima provider;
- structured output atau JSON schema;
- tool calling;
- streaming bila akan digunakan;
- upload atau dukungan input file bila relevan;
- error format;
- timeout dan retry behavior; dan
- token atau usage metadata.

Dokumentasi provider dan hasil probe menjadi sumber kebenaran. Kode tidak boleh menganggap seluruh kemampuan API OpenAI resmi otomatis tersedia pada provider pihak ketiga.

Provider diakses melalui adapter agar business logic tidak tergantung langsung pada payload EcoAPI. Adapter bertanggung jawab pada request mapping, timeout, error normalization, dan response parsing.

Capability probe 7 Agustus 2026 menemukan bahwa chat completion, tool calling,
streaming SSE, dan usage metadata bekerja. Model yang diuji menerima tetapi
mengabaikan `response_format` untuk JSON Schema dan JSON object. Karena itu hasil
Phase 7 tetap wajib divalidasi dengan Pydantic dan diperbaiki atau diulang secara
terbatas. Lihat `docs/ecoapi-capability-probe.md` untuk hasil lengkap.

## 16. Batas arsitektur

    Browser
      -> Next.js LMS
           -> protected AI proxy
                -> FastAPI AI service
                     -> provider and approved tools

Aturan batas:

- Browser tidak memanggil FastAPI atau EcoAPI secara langsung.
- Next.js memverifikasi session, role, ownership, dan CSRF policy.
- Next.js tetap menjadi satu-satunya service yang menulis data modul ke database core LMS.
- FastAPI mengelola job, orchestration, retrieval, dan artifact sementara.
- FastAPI tidak mempercayai role atau user ID dari body browser.
- Next.js dan FastAPI menggunakan internal authentication yang dapat dirotasi.
- Database job AI terpisah dari database core LMS.
- File reference dan artifact menggunakan identifier, bukan path mentah dari client.

## 17. API yang direncanakan

Nama route dapat disesuaikan saat implementation review, tetapi behavior berikut wajib tersedia.

### 17.1 Browser ke Next.js

| Method | Route | Tujuan |
| --- | --- | --- |
| POST | /api/ai/generations/modules | Membuat generation modul |
| GET | /api/ai/generations/:jobId | Membaca status dan hasil milik user |
| POST | /api/ai/generations/:jobId/cancel | Meminta pembatalan |
| POST | /api/ai/generations/:jobId/save | Menyimpan hasil sebagai draft LMS |
| POST | /api/courses/:courseId/ai-lessons | Membuat kandidat lesson |
| POST | /api/lessons/:lessonId/ai-revisions | Membuat kandidat revision |
| POST | /api/lessons/:lessonId/ai-revisions/:revisionId/accept | Menerima revision |

### 17.2 Next.js ke FastAPI

| Method | Route | Tujuan |
| --- | --- | --- |
| POST | /v1/generations/modules | Membuat job internal |
| GET | /v1/generations/:jobId | Membaca status internal |
| POST | /v1/generations/:jobId/cancel | Membatalkan job internal |
| POST | /v1/generations/lessons | Membuat kandidat lesson |
| POST | /v1/generations/lesson-revisions | Membuat kandidat revision |

Response error distandardisasi dengan code stabil, message aman untuk user, request ID, dan detail field validation bila relevan.

## 18. Data, penyimpanan, dan retention

Prompt tidak disimpan selamanya di database core hanya untuk kemudahan UI. Data dipisahkan berdasarkan kegunaannya:

| Data | Lokasi | Retention awal |
| --- | --- | --- |
| Job metadata dan status | AI job database | 30 hari |
| Prompt dan generation parameters | AI job database terenkripsi bila tersedia | 30 hari |
| Reference file sementara | Artifact storage | 7 hari setelah job selesai |
| Extracted text dan vector | ChromaDB per workspace atau user scope | 30 hari atau saat dihapus user |
| Generated artifact sementara | Artifact storage | 7 hari setelah disimpan atau job kedaluwarsa |
| Draft yang disetujui | Core LMS database dan uploads | Mengikuti retention core LMS |
| Operational log | Logging system | 30 hari tanpa prompt lengkap |

Angka retention adalah baseline dan harus dikonfirmasi sebelum production berdasarkan kebutuhan legal, privacy, dan biaya.

Agar Regenerate dapat melakukan prefill tanpa menyimpan prompt selamanya:

- prompt generation tersedia selama retention job;
- setelah draft disimpan, instructor dapat memilih menyimpan reusable generation instruction bersama metadata lesson; atau
- UI menjelaskan bahwa prompt lama sudah kedaluwarsa.

User dapat meminta penghapusan reference dan artifact miliknya sesuai policy. Penghapusan harus mencakup vector dan extracted content turunannya.

## 19. Security dan guardrails

### 19.1 Guardrail input

- Role dan ownership diverifikasi di server.
- Panjang prompt, jumlah lesson, jumlah file, ukuran file, dan jenis file dibatasi.
- File signature dan parser safety diperiksa.
- PII atau secret yang terdeteksi dapat memicu warning atau blocking sesuai policy.
- Reference content diperlakukan sebagai untrusted data.
- Web research membutuhkan opt-in.

### 19.2 Guardrail model dan tool

- System instruction tidak dapat diubah oleh prompt atau reference.
- Model hanya dapat memilih tool dari allowlist.
- Argument tool divalidasi dengan schema.
- URL memiliki protocol dan network policy yang aman.
- Tidak ada arbitrary code execution atau shell tool untuk model.
- Output model wajib lolos schema dan business-rule validation.
- Batas token, waktu, retry, lesson, slide, dan biaya diterapkan per job.

### 19.3 Guardrail output

- Semua hasil berstatus draft.
- Citation dan warning ditampilkan.
- Klaim yang tidak didukung ditandai untuk review.
- Konten kebencian, seksual eksplisit, instruksi berbahaya, atau pelanggaran policy ditangani sebelum penyimpanan.
- HTML atau rich text disanitasi.
- Nama file dan path dibuat server.
- Output tidak boleh memuat API key, internal prompt, stack trace, atau data user lain.

### 19.4 Audit dan privacy

- Audit event mencatat actor, action, job ID, waktu, dan hasil tanpa menyimpan seluruh konten sensitif di log.
- Akses support terhadap prompt atau reference harus dapat diaudit.
- Secret dikelola lewat environment atau secret manager.
- Internal service credential dapat dirotasi.
- Data setiap user atau tenant harus terisolasi.

## 20. UX state dan accessibility

Frontend wajib menyediakan:

- idle form;
- client validation;
- uploading references;
- submitting;
- queued;
- processing dengan nama tahap;
- completed preview;
- partial success dengan warning;
- failed dengan pesan yang dapat ditindaklanjuti;
- retry;
- cancelling;
- cancelled;
- expired; dan
- saved as draft.

Progress tidak boleh berupa persentase palsu. Bila durasi tahap tidak dapat diukur, tampilkan tahap aktif, misalnya Reading references atau Creating presentations.

Form dan progress:

- dapat digunakan dengan keyboard;
- memiliki label eksplisit;
- perubahan status diumumkan melalui live region yang sesuai;
- tidak mengandalkan warna saja;
- menjaga input user ketika validation gagal;
- meminta konfirmasi sebelum membuang draft atau menerima revision; dan
- responsif untuk viewport desktop dan tablet yang didukung LMS.

## 21. Non-functional requirements

### 21.1 Reliability

- Create request yang sama dengan idempotency key tidak membuat job duplikat.
- Worker restart tidak menghilangkan queued job.
- Retry provider memakai exponential backoff dan jitter untuk error sementara.
- Partial artifact tidak ditampilkan sebagai hasil lengkap.

### 21.2 Performance

- Create job merespons dalam 2 detik pada kondisi normal karena pekerjaan berjalan di background.
- Status polling tidak membebani service; interval memiliki backoff.
- Retrieval target awal selesai dalam 5 detik untuk collection berukuran wajar.
- Target waktu generation end-to-end ditetapkan setelah capability probe dan baseline test.

### 21.3 Maintainability

- Python memakai snake_case untuk module, function, dan variable; PascalCase untuk class dan Pydantic model.
- TypeScript memakai camelCase untuk function dan variable; PascalCase untuk React component dan type.
- Route, service, repository, provider adapter, dan tool dipisahkan berdasarkan tanggung jawab.
- Public function dan logika kompleks memiliki docstring atau komentar yang menjelaskan alasan, bukan mengulang sintaks.
- Seluruh perubahan mengikuti docs/coding-standards.md.

### 21.4 Observability

- Setiap request memiliki correlation ID.
- Metric minimal mencakup job count, queue time, processing time, success rate, failure type, retry count, provider latency, token usage bila tersedia, retrieval latency, dan presentation failure.
- Alert awal mencakup worker berhenti, failure rate tinggi, antrean menumpuk, dan provider authentication failure.

### 21.5 Testing

- Unit test untuk policy, validator, provider adapter, retrieval, dan presentation specification.
- Contract test antara Next.js dan FastAPI.
- Integration test menggunakan fake provider.
- End-to-end test untuk create, polling, preview, save draft, add lesson, dan revision approval.
- Evaluation dataset bahasa Indonesia dan Inggris untuk kualitas struktur, groundedness, citation, dan slide readability.

## 22. Acceptance criteria utama

1. Instructor dapat mengirim request dan menerima job ID tanpa browser mengetahui internal credential.
2. Employee mendapat HTTP 403 saat mencoba membuat generation.
3. Instructor tidak dapat membaca job instructor lain.
4. Job tetap ada dan dapat diproses setelah service restart.
5. Tanpa web opt-in, tidak ada web-search tool call.
6. Dengan referensi, citation hasil dapat ditelusuri kembali ke file dan lokasi sumber.
7. Instruction berbahaya di dalam referensi tidak dapat mengubah tool policy.
8. Hasil model yang tidak sesuai schema ditolak atau diperbaiki dalam retry terbatas.
9. Modul hasil generation selalu berstatus draft.
10. Struktur hasil tidak melebihi 12 lesson.
11. Setiap lesson awal memiliki satu deck yang valid atau failure lesson yang jelas.
12. Setiap slide memakai branding Lumen yang diwajibkan template.
13. Visual referensi yang dipakai mempertahankan source metadata.
14. Save retry dengan idempotency key tidak membuat modul duplikat.
15. Add lesson with AI tidak menyimpan hasil sebelum approval.
16. Regenerate lesson tidak mengubah original sebelum Accept revision.
17. UI menampilkan seluruh state penting dan dapat digunakan dengan keyboard.
18. API key tidak muncul di browser bundle, response, log, atau database core.
19. Prompt, vector, reference, dan artifact dibersihkan sesuai retention policy.
20. Quality gates pada coding standards lulus sebelum feature dinyatakan selesai.

## 23. Urutan implementasi wajib

Urutan berikut menjaga setiap tahap dapat diuji sebelum menambah kompleksitas.

| Fase | Deliverable | Status |
| --- | --- | --- |
| 0 | AI PRD dan coding standards | Selesai |
| 1 | FastAPI foundation dan schema | Selesai |
| 2 | Frontend request shell | Selesai |
| 3 | Persistent fake jobs dan worker | Selesai |
| 4 | Protected Next.js proxy dan internal authentication | Selesai |
| 5 | Frontend submit, polling, progress, retry, dan cancel | Selesai |
| 6 | EcoAPI capability probe dan provider adapter | Selesai |
| 7 | Real structured module planning | Berikutnya |
| 8 | Reference ingestion dan visual catalog | Belum mulai |
| 9 | Embeddings, ChromaDB, dan RAG | Belum mulai |
| 10 | Controlled web search dan citation | Belum mulai |
| 11 | Branded presentation template dan tool | Belum mulai |
| 12 | Save hasil sebagai draft LMS | Belum mulai |
| 13 | Add lesson with AI | Belum mulai |
| 14 | Regenerate lesson, comparison, dan approval | Belum mulai |
| 15 | Retention automation, quota, guardrails, observability, dan production QA | Belum mulai |

Satu fase hanya boleh dinyatakan selesai jika acceptance criteria fase tersebut, test, dan dokumentasi lulus. Ide dari fase berikutnya boleh dicatat, tetapi tidak diimplementasikan secara acak sebelum dependency-nya siap.

## 24. Success metrics

Metric awal berikut harus direvisi setelah pilot:

| Metric | Target awal |
| --- | --- |
| Job selesai tanpa error sistem | Minimal 95% |
| Draft lolos schema dan business rules | 100% |
| Instructor menyimpan draft setelah preview | Minimal 60% |
| Instructor menilai struktur draft berguna | Minimal 80% |
| Citation reference dapat dibuka dan cocok | Minimal 95% dari citation sampel |
| Web claim penting memiliki citation | Minimal 95% |
| Deck bebas overflow atau elemen terpotong | Minimal 98% slide pada evaluation set |
| Revision diterima tanpa generation ulang kedua | Minimal 70% |
| Cross-user data exposure | 0 kejadian |
| Secret exposure | 0 kejadian |

Cost per completed module, token usage, queue duration, dan waktu review instructor dicatat sebagai baseline sebelum target produksi ditetapkan.

## 25. Keputusan terbuka

Keputusan berikut tidak menghalangi fase 4, tetapi harus diselesaikan sebelum production:

1. Apakah Lumen akan menjadi single-company atau multi-tenant SaaS?
2. Berapa quota generation per instructor dan per tenant?
3. Apakah reference boleh disimpan untuk dipakai ulang lintas modul?
4. Apakah reusable generation instruction disimpan bersama lesson?
5. Provider web search apa yang disetujui?
6. Library icon dan sumber stock image apa yang lisensinya disetujui?
7. Apakah modul published harus kembali menjadi draft ketika lesson AI ditambahkan?
8. Siapa yang berwenang mengakses prompt atau reference untuk support?
9. Berapa retention final berdasarkan kebijakan perusahaan?
10. Apakah data boleh dikirim ke provider pihak ketiga untuk semua tenant?

## 26. Definition of done

Suatu requirement AI selesai hanya jika:

- behavior sesuai PRD dan acceptance criteria;
- permission dan ownership diverifikasi di server;
- output tervalidasi sebelum disimpan;
- loading, empty, success, partial, failure, retry, cancel, dan expired state yang relevan ditangani;
- security dan privacy review selesai;
- test otomatis penting lulus;
- evaluasi kualitas mencapai threshold yang disetujui;
- dokumentasi dan flowchart sesuai implementasi;
- retention dan cleanup bekerja; dan
- tidak ada claim bahwa AI sungguhan sudah terintegrasi bila alur masih memakai fake generator.
