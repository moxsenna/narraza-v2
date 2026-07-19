import { Link } from 'react-router-dom'
import { Link2Off } from 'lucide-react'
import { AuthLayout } from './Login'

/**
 * `/masuk/error` — tautan kedaluwarsa atau sudah dipakai.
 * Nada: mengakui masalah dan memberi jalan keluar (design.md §7.4).
 */
export default function AuthErrorPage() {
  return (
    <AuthLayout>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning-50 text-warning-700" aria-hidden="true">
        <Link2Off className="h-7 w-7" />
      </div>
      <h1 className="mt-5 font-editorial text-2xl font-bold text-ink-950 sm:text-3xl">
        Tautan ini sudah tidak berlaku
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
        Tautan masuk hanya berlaku 15 menit dan tidak bisa dipakai dua kali. Tidak ada yang
        berubah dari akunmu—cukup minta tautan baru untuk masuk.
      </p>
      <Link
        to="/masuk"
        className="mt-8 inline-flex min-h-[48px] w-full items-center justify-center rounded-md bg-brand-600 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
      >
        Minta tautan baru
      </Link>
      <p className="mt-5 text-sm leading-relaxed text-ink-500">
        Sering terjadi? Coba buka tautan di perangkat yang sama dengan tempat kamu memintanya.
      </p>
    </AuthLayout>
  )
}
