import type { LucideIcon } from 'lucide-react'
import {
  Home,
  MessageCircle,
  BookOpen,
  Users,
  Map,
  EyeOff,
  ScrollText,
  PenLine,
  BookCheck,
  ShieldCheck,
  Send,
  Settings,
  Coins,
  LayoutGrid,
  PlusCircle,
  FileUp,
  Lightbulb,
} from 'lucide-react'

/**
 * Metadata rute aplikasi — dipakai bersama oleh sidebar, breadcrumb,
 * dan halaman placeholder. Agent berikutnya mengganti komponen placeholder
 * dengan halaman asli tanpa mengubah struktur nav ini.
 */

export interface RouteMeta {
  /** Judul halaman (plain language) */
  title: string
  /** Deskripsi untuk PageHeader / EmptyState placeholder */
  description: string
  icon: LucideIcon
}

/** Rute relatif proyek: gunakan helper projectPath(projectId, key). */
export const PROJECT_ROUTES = {
  beranda: {
    path: '',
    meta: {
      title: 'Beranda Proyek',
      description: 'Posisi ceritamu sekarang, langkah berikutnya, dan kemajuan terbaru.',
      icon: Home,
    },
  },
  narra: {
    path: 'narra',
    meta: {
      title: 'Chat Narra',
      description: 'Ceritakan ide, minta usulan, dan diskusikan arah cerita bersama Narra.',
      icon: MessageCircle,
    },
  },
  konsep: {
    path: 'konsep',
    meta: {
      title: 'Konsep Cerita',
      description: 'Tiga arah cerita hasil obrolanmu dengan Narra—pilih satu untuk dijadikan fondasi.',
      icon: Lightbulb,
    },
  },
  fondasi: {
    path: 'fondasi',
    meta: {
      title: 'Fondasi Cerita',
      description: 'Premis, janji pembaca, tokoh, konflik, dan arah ending yang menjadi acuan penulisan.',
      icon: BookOpen,
    },
  },
  karakter: {
    path: 'karakter',
    meta: {
      title: 'Karakter',
      description: 'Tujuan, luka batin, gaya bicara, relasi, dan pengetahuan setiap tokoh.',
      icon: Users,
    },
  },
  fakta: {
    path: 'fakta',
    meta: {
      title: 'Fakta yang Dikunci',
      description: 'Fakta cerita yang sudah dikunci, usulan yang menunggu keputusanmu, dan riwayat perubahannya.',
      icon: ScrollText,
    },
  },
  outline: {
    path: 'outline',
    meta: {
      title: 'Rencana Bab',
      description: 'Susunan bab, arahan adegan, open loop, dan kemenangan kecil per bab.',
      icon: Map,
    },
  },
  rahasia: {
    path: 'rahasia',
    meta: {
      title: 'Jadwal Rahasia',
      description: 'Kapan setiap rahasia dibuka—dan siapa saja yang sudah boleh tahu.',
      icon: EyeOff,
    },
  },
  tulis: {
    path: 'tulis/:chapterId',
    meta: {
      title: 'Ruang Tulis',
      description: 'Tulis adegan, bandingkan versi, dan minta perbaikan—kamu yang memutuskan versi akhir.',
      icon: PenLine,
    },
  },
  cek: {
    path: 'cek',
    meta: {
      title: 'Cek Cerita',
      description: 'Pemeriksaan otomatis: cerita nyambung, rahasia aman, dan pengetahuan tokoh sesuai.',
      icon: ShieldCheck,
    },
  },
  tutupBab: {
    path: 'tutup-bab/:chapterId',
    meta: {
      title: 'Tutup Bab',
      description: 'Tinjau Perubahan Setelah Bab sebelum bab ini menjadi bagian Cerita Resmi.',
      icon: BookCheck,
    },
  },
  publish: {
    path: 'publish/:chapterId',
    meta: {
      title: 'Paket Publish',
      description: 'Judul, teaser, caption, dan pratinjau HP yang siap disalin untuk bab ini.',
      icon: Send,
    },
  },
} as const satisfies Record<string, { path: string; meta: RouteMeta }>

export type ProjectRouteKey = keyof typeof PROJECT_ROUTES

export function projectPath(projectId: string, key: ProjectRouteKey, chapterId?: string): string {
  let p = `/app/p/${projectId}`
  const sub = PROJECT_ROUTES[key].path
  if (sub) p += `/${sub}`
  if (chapterId) p = p.replace(':chapterId', chapterId)
  return p
}

/** Grup sidebar (design.md shell: tahapan produksi) */
export interface NavGroup {
  label: string
  items: { key: ProjectRouteKey; label: string }[]
}

export const SIDEBAR_GROUPS: NavGroup[] = [
  {
    label: 'Persiapan',
    items: [
      { key: 'beranda', label: 'Beranda Proyek' },
      { key: 'narra', label: 'Chat Narra' },
      { key: 'fondasi', label: 'Fondasi Cerita' },
      { key: 'karakter', label: 'Karakter' },
    ],
  },
  {
    label: 'Perencanaan',
    items: [
      { key: 'outline', label: 'Rencana Bab' },
      { key: 'rahasia', label: 'Jadwal Rahasia' },
      { key: 'fakta', label: 'Fakta' },
    ],
  },
  {
    label: 'Penulisan',
    items: [
      { key: 'tulis', label: 'Ruang Tulis' },
      { key: 'tutupBab', label: 'Tutup Bab' },
    ],
  },
  {
    label: 'Pemeriksaan',
    items: [{ key: 'cek', label: 'Cek Cerita' }],
  },
  {
    label: 'Publikasi',
    items: [{ key: 'publish', label: 'Paket Publish' }],
  },
]

/** Metadata halaman non-proyek */
export const APP_ROUTES = {
  dashboard: {
    title: 'Semua Proyek',
    description: 'Semua cerita yang sedang kamu bangun, langkah berikutnya, dan penggunaan kredit ringkas.',
    icon: LayoutGrid,
  },
  baru: {
    title: 'Mulai Proyek Baru',
    description: 'Pilih cara mulai yang paling nyaman: dari ide kosong, premis kasar, atau draft yang sudah ada.',
    icon: PlusCircle,
  },
  import: {
    title: 'Impor Draft',
    description: 'Bawa naskah yang sudah ada ke Narraza untuk dirapikan dan dilanjutkan.',
    icon: FileUp,
  },
  pengaturan: {
    title: 'Pengaturan',
    description: 'Profil, preferensi menulis, dan pengelolaan akunmu.',
    icon: Settings,
  },
  kredit: {
    title: 'Kredit',
    description: 'Saldo tersedia, dana tertahan untuk proses berjalan, dan riwayat pemakaian kreditmu.',
    icon: Coins,
  },
} as const satisfies Record<string, RouteMeta>
