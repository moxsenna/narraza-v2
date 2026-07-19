/**
 * Narraza v2 — tipe domain cerita (mock prototype).
 *
 * Istilah mengikuti glossary UI (design.md §6.3 / spec §13):
 * Foundation → Fondasi Cerita, Beat → Adegan, Proposal → Usulan Narra,
 * Validator → Cek Cerita, Reveal schedule → Jadwal Rahasia, Canon → Cerita Resmi.
 * JANGAN menampilkan istilah internal teknis ke pengguna.
 */

// ---------- Mode & simulasi ----------
export type Mode = 'pemula' | 'kreator' | 'mahir'
export type SimState = 'normal' | 'empty' | 'error' | 'kredit-menipis'

// ---------- Proyek ----------
export type ProjectStage =
  | 'fondasi'
  | 'karakter'
  | 'rencana'
  | 'menulis'
  | 'pemeriksaan'
  | 'publikasi'

export interface Project {
  id: string
  judul: string
  genre: string
  deskripsi: string
  stage: ProjectStage
  /** Persen Kesiapan Fondasi (0–100) */
  kesiapanFondasi: number
  babTerencana: number
  babTertulis: number
  targetBab: number
  faktaTerkunci: number
  usulanMenunggu: number
  diperbarui: string
  warnaAksen: 'rose' | 'plum' | 'amber'
}

export interface NextAction {
  label: string
  alasan: string
  href: string
}

export interface ProjectProgress {
  stage: ProjectStage
  tahapSelesai: ProjectStage[]
  nextAction: NextAction
  blockers: string[]
  counts: {
    babTerencana: number
    babTertulis: number
    faktaTerkunci: number
    usulanMenunggu: number
    rahasiaDitahan: number
  }
}

// ---------- Fondasi Cerita ----------
export interface CallRule {
  dari: string
  kepada: string
  panggilan: string
  catatan?: string
}

export interface FoundationChecklistItem {
  label: string
  selesai: boolean
  catatan?: string
}

export interface Foundation {
  judulKerja: string
  genre: string
  targetPembaca: string
  premis: string
  janjiPembaca: string
  tone: string
  targetBab: number
  arahEnding: string
  tokohUtama: string
  konflikUtama: string
  rahasiaUtama: string
  aturanPanggilan: CallRule[]
  batasanKonten: string[]
  preferensiGaya: string[]
  status: 'draft' | 'terkunci'
  kesiapan: number
  checklist: FoundationChecklistItem[]
}

// ---------- Karakter ----------
export interface CharacterRelation {
  targetId: string
  jenis: string
  catatan: string
}

export interface CharacterChapterChange {
  bab: number
  ringkasan: string
}

export interface Character {
  id: string
  nama: string
  peran: string
  tujuan: string
  lukaBatin: string
  ketakutan: string
  konflikInternal: string
  sifatDominan: string[]
  gayaBicara: string
  aturanPanggilan: string
  relasi: CharacterRelation[]
  rahasiaDiketahui: string[]
  rahasiaDicurigai: string[]
  keyakinanSalah: string
  statusEmosional: string
  lokasiTerakhir: string
  perubahanPerBab: CharacterChapterChange[]
}

// ---------- Fakta ----------
export type FactStatus =
  | 'confirmed'
  | 'proposed'
  | 'rejected'
  | 'deprecated'
  | 'contradicted'

export interface Fact {
  id: string
  isi: string
  kategori: string
  status: FactStatus
  sumber: 'narra' | 'kamu' | 'sistem'
  risiko?: 'tinggi' | 'sedang' | 'rendah'
  dampak?: string
  babTerkait?: number
  catatan?: string
}

// ---------- Rencana Bab (outline) ----------
export type ChapterStatus =
  | 'terencana'
  | 'sedang-ditulis'
  | 'perlu-ditinjau'
  | 'diterima'

export interface ChapterOutline {
  id: string
  nomor: number
  judul: string
  ringkasan: string
  fungsiBab: string
  arahEmosi: string
  janjiBab: string
  openingHook: string
  openLoop: string[]
  kemenanganKecil: string
  breadcrumb: string
  rahasiaDitahan: string[]
  forbiddenReveal: string[]
  endingHook: string
  status: ChapterStatus
}

// ---------- Jadwal Rahasia ----------
export interface RevealEntry {
  id: string
  rahasia: string
  pemegang: string[]
  rencanaBabTerbuka: number
  status: 'ditahan' | 'terjadwal' | 'terbuka'
  catatan: string
}

// ---------- Konsep ----------
export interface Concept {
  id: string
  judul: string
  premis: string
  hook: string
  perbedaanUtama: string
  status: 'dipilih' | 'alternatif'
}

// ---------- Chat Narra ----------
export interface ChatMessage {
  id: string
  dari: 'narra' | 'kamu'
  teks: string
  waktu: string
  quickReplies?: string[]
}

// ---------- Prosa ----------
export type VersionLabelKind =
  | 'dibuat-narra'
  | 'diedit-kamu'
  | 'diperbaiki-narra'
  | 'versi-diterima'
  | 'fakta-usulan'
  | 'fakta-terkunci'

export interface ProseVersion {
  id: string
  label: VersionLabelKind
  judul: string
  cuplikan: string
  isi: string
}

// ---------- Cek Cerita ----------
export type FindingLevel = 'lolos' | 'peringatan' | 'penghambat'

export interface ValidatorFinding {
  id: string
  level: FindingLevel
  judul: string
  detail: string
  area?: string
}

// ---------- Perubahan Setelah Bab ----------
export interface ChapterDelta {
  bab: number
  faktaBaru: string[]
  perubahanTokoh: string[]
  rahasiaBerubah: string[]
  openLoopBaru: string[]
  openLoopTertutup: string[]
}

// ---------- Paket Publish ----------
export interface PublishPackage {
  judul: string
  teaser: string
  caption: string
  commentBait: string
  tags: string[]
  sinopsis: string
}

// ---------- Kredit ----------
export type CreditEntryKind = 'grant' | 'reserve' | 'settle' | 'release' | 'refund'

export interface CreditEntry {
  id: string
  tanggal: string
  jenis: CreditEntryKind
  jumlah: number
  saldoSetelah: number
  keterangan: string
}

export interface CreditSummary {
  tersedia: number
  tertahan: number
  rekonsiliasi: number
}

// ---------- Aktivitas ----------
export interface Activity {
  id: string
  waktu: string
  teks: string
  jenis: 'fondasi' | 'karakter' | 'rencana' | 'tulis' | 'cek' | 'fakta' | 'publish'
}

// ---------- Tier kualitas ----------
export interface Tier {
  id: string
  nama: string
  deskripsi: string
  ciri: string[]
  aktif: boolean
}
