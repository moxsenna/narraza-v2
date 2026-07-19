import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Loader2, MailCheck, RefreshCw } from 'lucide-react'
import { AuthLayout } from './Login'

/**
 * `/masuk/verifikasi` — dua tahap:
 * 1. "Tautan terkirim" (cek email)
 * 2. Tombol "Buka Narraza" mensimulasikan klik tautan di email → masuk.
 * Kirim ulang dengan cooldown 30 detik; maks. 3 tautan aktif (bahasa awam).
 */
export default function VerifyPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = (location.state as { email?: string } | null)?.email ?? 'email kamu'

  const [opening, setOpening] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [resendCount, setResendCount] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  const resend = () => {
    if (cooldown > 0) return
    setResendCount((c) => c + 1)
    setCooldown(30)
  }

  const openApp = () => {
    setOpening(true)
    window.setTimeout(() => navigate('/app'), 900)
  }

  return (
    <AuthLayout>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
        <MailCheck className="h-7 w-7" />
      </div>
      <h1 className="mt-5 font-editorial text-2xl font-bold text-ink-950 sm:text-3xl">
        Tautan masuk sudah dikirim
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
        Kami mengirim tautan masuk ke <span className="font-semibold text-ink-800">{email}</span>.
        Buka emailnya, lalu klik tautan di dalamnya. Tautan berlaku 15 menit.
      </p>

      {/* Simulasi klik tautan dari email */}
      <div className="mt-6 rounded-lg border border-line-200 bg-canvas p-4">
        <p className="text-sm font-semibold text-ink-800">Pratinjau prototipe</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-500">
          Di aplikasi sungguhan, kamu mengklik tautan di email. Di sini, tombol ini mensimulasikan
          langkah itu.
        </p>
        <button
          type="button"
          onClick={openApp}
          disabled={opening}
          className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {opening && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {opening ? 'Membuka Narraza…' : 'Buka Narraza'}
        </button>
      </div>

      <div className="mt-6 border-t border-line-100 pt-5">
        <p className="text-sm leading-relaxed text-ink-500">
          Belum menerima email? Periksa folder spam, atau kirim ulang tautannya.
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line-200 bg-surface px-4 text-sm font-semibold text-ink-800 transition-colors hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {cooldown > 0 ? `Kirim ulang dalam ${cooldown} detik` : 'Kirim ulang tautan'}
        </button>
        {resendCount > 0 && (
          <p role="status" className="mt-2 text-sm text-success-700">
            Tautan baru sudah dikirim.
          </p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-ink-300">
          Demi keamanan, kamu bisa memiliki paling banyak 3 tautan aktif sekaligus. Tautan lama
          tetap bisa dipakai sampai kedaluwarsa—meminta yang baru tidak membatalkan yang lama.
        </p>
        <p className="mt-4 text-sm">
          <Link to="/masuk" className="font-semibold text-brand-700 hover:text-brand-800">
            Gunakan email lain
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
