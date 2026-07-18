# Narraza v2 - Product Requirements Document (Rilis 1)

**Versi:** 1.0  
**Tanggal:** 19 Juli 2026  
**Status:** Baseline untuk implementation planning  
**Sumber:** Design Specification S1-S10 (LOCKED) dan Verification Matrix

> **Tagline:** Build long fiction without losing the plot.

## 1. Ringkasan Eksekutif

Narraza adalah aplikasi SaaS untuk membantu penulis fiksi serial dan novel panjang mengembangkan cerita secara terstruktur tanpa kehilangan kontinuitas, kontrol kreatif, atau kepercayaan terhadap hasil AI.

Narraza tidak menjanjikan novel sekali klik. Produk memandu penulis dari ide, fondasi, karakter, outline, penulisan adegan, pengecekan konsistensi, sampai penerimaan hasil sebagai cerita resmi. Penulis tetap menjadi pengambil keputusan.

## 2. Problem Statement

Penulis membutuhkan bantuan AI untuk mempercepat proses kreatif, tetapi tidak dapat mempercayai tool yang melupakan fakta, menyimpang dari rencana, membocorkan rahasia cerita, menagih tanpa hasil yang jelas, atau mengubah naskah resmi tanpa persetujuan.

Pain utama:

- continuity loss;
- reveal leak;
- prose generik dan tidak patuh beat;
- outline disobedience;
- output AI langsung dianggap canon;
- async job dan kredit tidak transparan;
- kebocoran detail internal ke UI.

## 3. Visi dan Prinsip

**Visi:** menjadi production OS bagi penulis fiksi panjang: tempat ide berkembang menjadi cerita resmi melalui struktur, kontinuitas, dan keputusan penulis yang dapat diaudit.

Prinsip:

1. Penulis adalah pengambil keputusan terakhir.
2. Status dan kredit harus jujur.
3. Rahasia penulis tidak otomatis masuk ke writer model.
4. Konteks AI dibuat melalui allowlist per task.
5. Kegagalan dapat dipulihkan tanpa side effect ganda.
6. Advanced mode memberi kontrol produk, bukan raw prompt/model internals.
7. Arsitektur sederhana diprioritaskan pada rilis 1.

## 4. Sasaran Rilis 1

- Alur utuh login sampai satu accepted prose beat.
- Intake, tiga konsep, fondasi, karakter, outline 10 bab, beat writing.
- Guided dan Advanced mode.
- Validation, repair, proposal-before-canon, dan user-edited proposal.
- Job async yang pulih setelah refresh.
- CreditQuote, reservation, settlement/release/closing.
- Publish package non-canon.
- VPS deployment yang dapat diuji, dimigrasi, di-backup, dan direstore.

## 5. Bukan Sasaran Rilis 1

Payment, KBM export, voice lock, draft import, collaboration, BYOK, raw prompt editor, model ID picker, full admin, Redis/BullMQ, streaming token UI, branching timeline, dan multi-season planner penuh.

## 6. Pengguna Sasaran

- Penulis serial pemula yang membutuhkan Guided mode.
- Penulis serial aktif yang membutuhkan struktur dan continuity checks.
- Plotter/editor mandiri yang membutuhkan foundation, outline, reveal, dan proposal diff Advanced.

## 7. Alur End-to-End

1. Request dan confirm magic link dua tahap.
2. Buat project dan lihat next action dari backend progress reducer.
3. Intake rough idea.
4. Pilih satu dari tiga concept alternatives.
5. Edit, confirm, dan lock foundation.
6. Bangun karakter dan outline 10 bab.
7. Request beat write menggunakan CreditQuote.
8. Pantau public job phase dan recovery setelah refresh.
9. Review candidate, validation findings, dan sanitized operation diff.
10. Edit working draft atau request repair.
11. Accept proposal untuk menerapkan change set atomik dan bump canon sekali.
12. Generate/accept publish artifact tanpa mengubah canon.

## 8. Kebutuhan Fungsional Inti

### Authentication

- Custom email magic link two-step dengan Auth.js database sessions.
- Maksimal tiga challenge aktif per identifier; issue baru tidak merevoke semua.
- Active-user guard dan tenant-scoped ownership pada seluruh use case.
- IDOR menghasilkan NOT_FOUND.

### Project dan Planning

- Dashboard memuat project intake/setup.
- ProjectProgressView menjadi sumber tunggal stage, blockers, next actions, counts.
- Concept accept menghasilkan foundation draft; confirm dan lock terpisah.
- Outline create/update strict; downstream accepted prose memblokir upsert biasa.
- Reveal truth adalah author_private, bukan otomatis writer-visible.

### Writing

- Web tidak memanggil LLM; AI action membuat asynchronous job.
- Writer menerima writer_safe packet saja.
- AI menghasilkan 1-3 candidates.
- ProseWorkingDraft mutable dengan autosave CAS; ProseVersion immutable.
- Snapshot draft memeriksa revision dan content hash.

### Validation dan Repair

- ValidationReport terikat proseVersionId, proseContentHash, dan policy version.
- Deterministic blockers tidak dapat dihapus oleh AI findings.
- Repair menerima sanitized directives dan melakukan full re-extraction.
- Prose-derived fact/state/belief/disclosure membutuhkan UTF-16 evidence + content hash.

### Proposal dan Canon

- Proposal source: ai | user | system.
- Model output tidak pernah menjadi CanonicalChangeOperation langsung.
- IDs, revisions, risk, keys, sequences, dan prose.accept ditentukan sistem.
- All references fully resolved sebelum proposal persist.
- Acceptance memverifikasi ownership, status, dependency, report, hash, revisions, dan artifact linkage.
- Satu change set menaikkan canonical version tepat satu kali.
- Unrelated global version bump tidak membatalkan proposal; validity berbasis dependencies.

### Jobs dan Reliability

- PostgreSQL SKIP LOCKED + lease/fence.
- WorkflowInvocation memilih satu attempt winner dengan CAS.
- Late attempt mencatat usage/cost tetapi tidak mengganti winner.
- Execution retry terpisah dari provider attempts.
- Cancel, reclaim, shutdown, dan manual retry memiliki jalur deterministik.
- Manual retry membuat job baru; terminal job immutable.

### Credit

- CreditQuote server-frozen dan terikat exact workflowPlanHash/dependency hash.
- Reserve sebelum provider call; settle per attempt; release dengan dedupe.
- Unknown attempt membuat reservation closing, bukan full release.
- UI menampilkan available, held active, dan reconciling.

### UI

- Modern SaaS shell, mobile bottom nav, bahasa Indonesia.
- Guided wizard dan Advanced controls tanpa service_restricted data.
- PublicProposalView hanya sanitized diff dan server-derived actions.
- Job phase tanpa persentase palsu.
- Accessibility: keyboard, focus ring, tap target >=44px, reduced motion.

## 9. Nonfungsional

- Next.js modular monolith + Postgres 16 + Prisma 5.
- apps/web, worker-gen, worker-outbox; packages/core/application/ai/db/shared.
- Architecture boundaries enforced by dependency tests.
- Per-process least-privilege secrets.
- Private RSC no-store; no restricted logs/analytics.
- At-least-once jobs/outbox dengan idempotency dan fencing.
- Operational timestamps menggunakan PostgreSQL clock.
- Health/readiness internal-only.
- Immutable CI artifact + checksum + manifest.
- Migration empty + N-1; expand/backfill/contract.
- Backup DB + artifacts, RPO <=24h, RTO <=4h, restore drill.

## 10. Metrik Keberhasilan

Measurement:

- project -> concept accepted;
- concept accepted -> foundation locked;
- foundation locked -> first accepted beat;
- median time to first official beat;
- eligible proposal acceptance rate;
- repair rate;
- job completion/recovery reliability.

Zero-defect guardrails:

- 0 service_restricted leak ke client;
- 0 provider call tanpa reservation;
- 0 credit mismatch header/settings;
- 0 canon double-bump;
- 0 cross-beat accepted prose pointer;
- 0 duplicate selected attempt per invocation.

## 11. Definition of Done

Rilis 1 selesai ketika:

- full Guided vertical slice hijau;
- user-edited prose proposal berfungsi;
- job recovery dan credit closing berfungsi;
- IDOR dan leak tests hijau;
- unit, integration, contract, E2E, architecture, migration, deploy tests hijau;
- immutable release artifact dan checksum tervalidasi;
- readiness + web->DB->worker->mock-job->outbox smoke hijau;
- runbook, env docs, migration metadata, verification matrix, dan restore drill tersedia.

## 12. Milestone M0-M8

- **M0:** scaffold, Prisma baseline, auth, empty shell.
- **M1:** domain core dan schema critical.
- **M2:** ports, UnitOfWork, project/foundation user-origin.
- **M3:** jobs, workers, outbox, credit reservation/exposure.
- **M4:** AI workflow plan, mock provider, write/judge/repair contracts.
- **M5:** proposal accept, progress reducer, working draft/write room.
- **M6:** Guided UI polish dan Playwright vertical slice.
- **M7:** staging hardening, real email, sandbox AI, security/restore rehearsal.
- **M8:** production deploy dan DoD.

## 13. Approval Gate

Setelah PRD ini disetujui, langkah berikutnya adalah writing-plans untuk M0-M8. Coding produk belum dimulai sampai implementation plan selesai direview.
