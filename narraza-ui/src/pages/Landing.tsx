import { Link } from 'react-router-dom'
import {
  ArrowRight,
  MessageCircle,
  BookOpen,
  Map,
  PenLine,
  ShieldCheck,
  Send,
  Lock,
  CircleHelp,
  Check,
  Lightbulb,
  FileText,
  Compass,
  Feather,
  Coins,
  EyeOff,
} from 'lucide-react'
import { LogoWordmark, LogoMark } from '@/components/narraza/Logo'
import { StatusChip } from '@/components/narraza/StatusChip'
import { VersionLabel } from '@/components/narraza/VersionLabel'
import { NarraChatBubble } from '@/components/narraza/NarraChatBubble'
import { tiers } from '@/data/mock'

/**
 * Landing `/` — 7 bagian sesuai design.md §16.1.
 * Hangat, editorial, whitespace lega; rose sebagai aksen terarah.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <PublicNav />
      <main>
        <Hero />
        <ProblemSection />
        <HowItWorks />
        <FlowExample />
        <ForWho />
        <TrustSection />
        <PricingSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}

// ---------------- Nav publik ----------------

function PublicNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line-100 bg-canvas/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Narraza — beranda">
          <LogoWordmark />
        </Link>
        <nav className="hidden items-center gap-6 md:flex" aria-label="Navigasi utama">
          <a href="#cara-kerja" className="text-sm font-semibold text-ink-700 hover:text-brand-700">
            Cara kerja
          </a>
          <a href="#untuk-siapa" className="text-sm font-semibold text-ink-700 hover:text-brand-700">
            Untuk siapa
          </a>
          <a href="#harga" className="text-sm font-semibold text-ink-700 hover:text-brand-700">
            Harga
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/masuk"
            className="inline-flex min-h-[44px] items-center rounded-md px-4 text-sm font-semibold text-ink-800 transition-colors hover:bg-surface-soft"
          >
            Masuk
          </Link>
          <Link
            to="/masuk"
            className="inline-flex min-h-[44px] items-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Mulai dari ide
          </Link>
        </div>
      </div>
    </header>
  )
}

// ---------------- 1. Hero ----------------

function Hero() {
  return (
    <section className="hero-gradient">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-pill border border-brand-200 bg-white/70 px-3.5 py-1.5 text-[13px] font-semibold text-brand-700">
            <LogoMark className="h-4 w-4" />
            Ruang produksi cerita serial untuk penulis Indonesia
          </p>
          <h1 className="mt-6 font-editorial text-4xl font-bold leading-[1.12] text-ink-950 text-balance sm:text-5xl lg:text-[56px]">
            Tulis serial panjang tanpa kehilangan arah.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-700">
            Ceritakan idemu ke Narra. Narraza membantu menyusun fondasi, merencanakan bab,
            menjaga rahasia, dan memoles tulisanmu untuk pembaca mobile.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/masuk"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-brand-600 px-6 text-base font-semibold text-white shadow-md transition-colors hover:bg-brand-700"
            >
              Mulai dari ide
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/masuk"
              className="inline-flex min-h-[48px] items-center justify-center rounded-md border border-line-200 bg-surface px-6 text-base font-semibold text-ink-800 shadow-sm transition-colors hover:bg-surface-soft"
            >
              Lanjutkan draft
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-500">
            Kamu tidak perlu tahu istilah menulis. Ceritakan saja kisah yang ingin kamu buat.
          </p>
        </div>
      </div>
    </section>
  )
}

// ---------------- 2. Masalah pengguna ----------------

const MASALAH: { sebelum: string; sesudah: string }[] = [
  { sebelum: 'Aku tidak tahu mulai dari mana.', sesudah: 'Aku punya langkah pertama yang jelas.' },
  { sebelum: 'Ideku berantakan.', sesudah: 'Ideku mulai berbentuk.' },
  { sebelum: 'AI selalu lupa cerita sebelumnya.', sesudah: 'Cerita ini punya fondasi dan catatan yang dijaga.' },
  { sebelum: 'Aku takut tulisanku jelek.', sesudah: 'Aku bisa memperbaikinya bertahap.' },
  { sebelum: 'Cerita ini akan cepat habis.', sesudah: 'Aku punya arah untuk membuatnya berkembang.' },
  { sebelum: 'Aku capek mengedit hasil AI.', sesudah: 'Aku mendapat bantuan yang lebih terarah dan mudah ditinjau.' },
]

function ProblemSection() {
  return (
    <section className="border-y border-line-100 bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="font-editorial text-3xl font-bold text-ink-950 sm:text-4xl">
            Dari cemas dan bingung, menuju mampu dan terkendali.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-500">
            Penulis tidak hanya butuh fitur. Mereka mencari perubahan perasaan saat membangun
            cerita panjang.
          </p>
        </div>
        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {MASALAH.map((m, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-lg border border-line-200 bg-canvas p-5 sm:flex-row sm:items-center sm:gap-4"
            >
              <p className="flex-1 text-[15px] italic leading-relaxed text-ink-500">“{m.sebelum}”</p>
              <ArrowRight className="hidden h-5 w-5 shrink-0 text-brand-500 sm:block" aria-hidden="true" />
              <p className="flex-1 text-[15px] font-semibold leading-relaxed text-ink-950">
                “{m.sesudah}”
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------- 3. Cara kerja ----------------

const LANGKAH = [
  {
    icon: MessageCircle,
    nama: 'Ngobrol',
    teks: 'Ceritakan ide seadanya. Narra menggali lewat percakapan ringan, bukan formulir teknis.',
  },
  {
    icon: BookOpen,
    nama: 'Fondasi',
    teks: 'Obrolanmu dirapikan menjadi Fondasi Cerita: premis, tokoh, konflik, dan arah ending.',
  },
  {
    icon: Map,
    nama: 'Rencana',
    teks: 'Susun rencana bab dengan arahan adegan, open loop, dan kemenangan kecil di tiap bab.',
  },
  {
    icon: PenLine,
    nama: 'Tulis',
    teks: 'Tulis adegan satu per satu. Narra mengusulkan versi, kamu yang memutuskan.',
  },
  {
    icon: ShieldCheck,
    nama: 'Cek',
    teks: 'Cek Cerita memeriksa kesambungan, pengetahuan tokoh, dan menjaga rahasia tetap aman.',
  },
  {
    icon: Send,
    nama: 'Publish',
    teks: 'Dapatkan paket publish: judul, teaser, caption, dan pratinjau tampilan di HP pembaca.',
  },
]

function HowItWorks() {
  return (
    <section id="cara-kerja" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="font-editorial text-3xl font-bold text-ink-950 sm:text-4xl">
            Ngobrol di depan, struktur di belakang.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-500">
            Kamu cukup bercakap santai. Narraza merapikan sisanya menjadi fondasi, rencana,
            dan bab yang terus bergerak.
          </p>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANGKAH.map((l, i) => (
            <li
              key={l.nama}
              className="relative rounded-lg border border-line-200 bg-surface p-6 shadow-sm"
            >
              <span className="absolute right-5 top-5 font-editorial text-4xl font-bold text-line-200" aria-hidden="true">
                {i + 1}
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-50 text-brand-600" aria-hidden="true">
                <l.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink-950">{l.nama}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{l.teks}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ---------------- 4. Contoh alur ide → bab ----------------

function FlowExample() {
  return (
    <section className="border-y border-line-100 bg-surface-soft">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="font-editorial text-3xl font-bold text-ink-950 sm:text-4xl">
            Seperti apa rasanya? Ini contoh nyatanya.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-500">
            Dari satu kalimat ide, menjadi adegan yang siap kamu tinjau.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {/* Chat */}
          <div className="rounded-lg border border-line-200 bg-surface p-5 shadow-sm">
            <p className="mb-4 text-[13px] font-bold uppercase tracking-wider text-ink-300">
              1 · Kamu bercerita
            </p>
            <div className="space-y-3">
              <NarraChatBubble dari="kamu" waktu="09.12">
                Aku punya ide tentang istri yang pulang ke rumah mertua, tapi suaminya berubah dingin.
              </NarraChatBubble>
              <NarraChatBubble dari="narra" waktu="09.13">
                Ide yang kuat. Biar konfliknya bisa panjang, kita butuh satu rahasia yang dipegang
                suaminya. Aku bantu susun tiga pilihan arah.
              </NarraChatBubble>
            </div>
          </div>

          {/* Usulan */}
          <div className="rounded-lg border border-line-200 bg-surface p-5 shadow-sm">
            <p className="mb-4 text-[13px] font-bold uppercase tracking-wider text-ink-300">
              2 · Narra mengusulkan
            </p>
            <div className="rounded-md border border-line-200 bg-canvas p-4">
              <VersionLabel kind="fakta-usulan" />
              <p className="mt-3 text-[15px] font-semibold leading-relaxed text-ink-950">
                “Brama menandatangani surat perjanjian pisah harta tanpa sepengetahuan Laras.”
              </p>
              <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-500">
                <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-plum-600" aria-hidden="true" />
                Dijadwalkan terbuka penuh di Bab 25—tidak bocor di bab-bab awal.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusChip status="rahasia-ditahan" />
              <StatusChip status="open-loop" />
            </div>
          </div>

          {/* Hasil */}
          <div className="rounded-lg border border-line-200 bg-surface p-5 shadow-sm">
            <p className="mb-4 text-[13px] font-bold uppercase tracking-wider text-ink-300">
              3 · Kamu meninjau hasil
            </p>
            <div className="rounded-md border border-line-200 bg-canvas p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-ink-950">Bab 1 · Adegan 1</p>
                <VersionLabel kind="versi-diterima" />
              </div>
              <p className="mt-3 font-editorial text-[15px] leading-relaxed text-ink-700">
                “Dua tahun. Dua koper. Satu kabar duka yang masih tersimpan rapi di saku
                jaketnya…”
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-success-700">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span className="font-semibold">Cerita nyambung, rahasia tetap aman.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------- 5. Untuk siapa ----------------

const PERSONA = [
  {
    icon: Lightbulb,
    judul: 'Aku belum punya ide',
    teks: 'Mulai dari obrolan santai. Narra membantu menemukan premis dari rasa atau pengalaman yang kamu bawa.',
  },
  {
    icon: Compass,
    judul: 'Aku punya ide kasar',
    teks: 'Idemu dibentuk menjadi fondasi dan rencana bab—tanpa harus paham struktur cerita formal.',
  },
  {
    icon: FileText,
    judul: 'Aku sudah punya draft',
    teks: 'Bawa naskahmu. Narraza membantu merapikan, menjaga kesambungan, dan melanjutkan bab berikutnya.',
  },
  {
    icon: Feather,
    judul: 'Aku penulis berpengalaman',
    teks: 'Butuh kontrol lebih? Mode Kreator dan Mahir membuka pengaturan fondasi, jadwal rahasia, dan bahan aman untuk AI.',
  },
]

function ForWho() {
  return (
    <section id="untuk-siapa" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="font-editorial text-3xl font-bold text-ink-950 sm:text-4xl">
            Mulai dari mana pun kamu berada.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-500">
            Ide ceritamu tidak harus rapi dulu.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERSONA.map((p) => (
            <div key={p.judul} className="rounded-lg border border-line-200 bg-surface p-6 shadow-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-brand-50 text-brand-600" aria-hidden="true">
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-bold text-ink-950">“{p.judul}”</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{p.teks}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------- 6. Trust ----------------

function TrustSection() {
  return (
    <section className="border-y border-line-100 bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-editorial text-3xl font-bold text-ink-950 sm:text-4xl">
              AI boleh membantu. Keputusan cerita tetap milikmu.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-500">
              Narraza membantu menjaga cerita, bukan mengambil alih. Setiap usulan penting
              berhenti dulu di tanganmu sebelum menjadi bagian Cerita Resmi.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Setiap tulisan AI diberi label jelas: Dibuat Narra, Diedit kamu, atau Versi diterima.',
                'Fakta penting hanya menjadi Fakta yang Dikunci setelah kamu setujui.',
                'Rahasia cerita tidak otomatis dibuka ke adegan—jadwalnya kamu yang atur.',
                'Narraza membantu menjaga konsistensi, bukan menjamin tidak pernah salah. Peninjauan akhir tetap di tanganmu.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink-700">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-success-700" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Ilustrasi usulan vs terkunci */}
          <div className="space-y-4">
            <div className="rounded-lg border border-warning-700/20 bg-warning-50 p-5">
              <div className="flex items-center gap-2">
                <CircleHelp className="h-5 w-5 text-warning-700" aria-hidden="true" />
                <p className="text-sm font-bold text-warning-700">Usulan Narra — menunggu keputusanmu</p>
              </div>
              <p className="mt-3 text-[15px] font-semibold text-ink-950">
                “Ratri pernah mengusir ibu kandung Laras dari rumah itu.”
              </p>
              <p className="mt-1.5 text-sm text-ink-700">
                Berisiko tinggi: mengubah motivasi tokoh dan arah konflik. Tinjau sebelum dikunci.
              </p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-md border border-warning-700/30 bg-white px-3 py-1.5 text-xs font-semibold text-warning-700">
                  Tinjau dulu
                </span>
                <span className="rounded-md px-3 py-1.5 text-xs font-semibold text-ink-500">Tolak</span>
              </div>
            </div>
            <div className="flex justify-center" aria-hidden="true">
              <ArrowRight className="h-5 w-5 rotate-90 text-ink-300" />
            </div>
            <div className="rounded-lg border border-line-200 bg-surface p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-ink-800" aria-hidden="true" />
                <p className="text-sm font-bold text-ink-950">Fakta yang Dikunci — menjadi acuan</p>
              </div>
              <p className="mt-3 text-[15px] font-semibold text-ink-950">
                “Brama menandatangani surat perjanjian pisah harta tanpa sepengetahuan Laras.”
              </p>
              <p className="mt-1.5 text-sm text-ink-500">
                Semua adegan berikutnya mengikuti fakta ini. Rahasianya terbuka penuh di Bab 25.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------- 7. Harga / kredit ----------------

function PricingSection() {
  return (
    <section id="harga" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="font-editorial text-3xl font-bold text-ink-950 sm:text-4xl">
            Bayar per proses, bukan per janji.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-500">
            Narraza memakai sistem kredit: setiap proses menyebutkan kebutuhan kreditnya sebelum
            dijalankan, dan kreditmu dikembalikan bila proses gagal. Pilih mode kualitas yang
            sesuai dengan tahap ceritamu.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.id}
              className={
                t.aktif
                  ? 'relative rounded-lg border-2 border-brand-600 bg-surface p-6 shadow-md'
                  : 'rounded-lg border border-line-200 bg-surface p-6 shadow-sm'
              }
            >
              {t.aktif && (
                <span className="absolute -top-3 left-6 rounded-pill bg-brand-600 px-3 py-0.5 text-xs font-bold text-white">
                  Paling seimbang
                </span>
              )}
              <h3 className="text-lg font-bold text-ink-950">{t.nama}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{t.deskripsi}</p>
              <ul className="mt-4 space-y-2">
                {t.ciri.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-sm text-ink-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-line-200 bg-surface-soft p-5 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-brand-600" aria-hidden="true">
            <Coins className="h-5 w-5" />
          </span>
          <p className="text-[15px] leading-relaxed text-ink-700">
            <span className="font-semibold text-ink-950">Pembayaran segera hadir.</span>{' '}
            Saat ini kamu bisa mencoba seluruh alur dengan kredit awal gratis. Kami akan
            mengumumkan harga kredit sebelum fitur pembayaran dibuka—tanpa biaya tersembunyi.
          </p>
        </div>
      </div>
    </section>
  )
}

// ---------------- 8. CTA akhir + footer ----------------

function FinalCta() {
  return (
    <section className="hero-gradient border-t border-line-100">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h2 className="font-editorial text-3xl font-bold text-ink-950 text-balance sm:text-4xl">
          Cerita panjang, tetap terarah.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-ink-700">
          Cerita pertamamu belum dimulai. Pilih cara mulai yang paling nyaman—dari ide kosong,
          premis kasar, atau draft yang sudah ada.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/masuk"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-brand-600 px-6 text-base font-semibold text-white shadow-md transition-colors hover:bg-brand-700"
          >
            Mulai dari ide
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            to="/masuk"
            className="inline-flex min-h-[48px] items-center justify-center rounded-md border border-line-200 bg-surface px-6 text-base font-semibold text-ink-800 shadow-sm transition-colors hover:bg-surface-soft"
          >
            Lanjutkan draft
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line-200 bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <LogoWordmark />
            <p className="mt-3 text-sm leading-relaxed text-ink-500">
              Ruang produksi cerita serial berbantuan AI untuk penulis Indonesia. Sistemnya
              menjaga fakta dan rahasia; cerita, pilihan, dan suara akhirnya tetap milik penulis.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-8 sm:grid-cols-3" aria-label="Tautan footer">
            <div>
              <p className="text-[13px] font-bold uppercase tracking-wider text-ink-300">Produk</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a href="#cara-kerja" className="text-ink-700 hover:text-brand-700">Cara kerja</a></li>
                <li><a href="#untuk-siapa" className="text-ink-700 hover:text-brand-700">Untuk siapa</a></li>
                <li><a href="#harga" className="text-ink-700 hover:text-brand-700">Harga</a></li>
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-bold uppercase tracking-wider text-ink-300">Mulai</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link to="/masuk" className="text-ink-700 hover:text-brand-700">Masuk</Link></li>
                <li><Link to="/masuk" className="text-ink-700 hover:text-brand-700">Mulai dari ide</Link></li>
                <li><Link to="/masuk" className="text-ink-700 hover:text-brand-700">Lanjutkan draft</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-bold uppercase tracking-wider text-ink-300">Bantuan</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><span className="text-ink-500">Pusat bantuan (segera)</span></li>
                <li><span className="text-ink-500">Komunitas penulis (segera)</span></li>
              </ul>
            </div>
          </nav>
        </div>
        <p className="mt-10 border-t border-line-100 pt-6 text-xs text-ink-300">
          © 2026 Narraza. Prototipe interaktif — data di dalamnya adalah contoh, bukan cerita sungguhan.
        </p>
      </div>
    </footer>
  )
}
