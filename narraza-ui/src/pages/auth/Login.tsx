import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { LogoWordmark } from '@/components/narraza/Logo'

/**
 * `/masuk` — minta tautan masuk (passwordless magic link).
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    if (!valid) {
      setError('Tulis alamat email yang lengkap, misalnya nama@email.com.')
      return
    }
    setLoading(true)
    // Simulasi permintaan tautan
    window.setTimeout(() => {
      navigate('/masuk/verifikasi', { state: { email: email.trim() } })
    }, 900)
  }

  return (
    <AuthLayout>
      <h1 className="font-editorial text-2xl font-bold text-ink-950 sm:text-3xl">
        Masuk ke Narraza
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
        Narraza tidak memakai kata sandi. Kami mengirim tautan masuk ke emailmu—cukup klik
        tautannya dan kamu langsung masuk dengan aman.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-ink-800">
            Alamat email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" aria-hidden="true" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? 'email-error' : undefined}
              className="min-h-[48px] w-full rounded-md border border-line-200 bg-surface pl-10 pr-4 text-base text-ink-950 placeholder:text-ink-300 focus:border-brand-300"
            />
          </div>
          {error && (
            <p id="email-error" role="alert" className="mt-1.5 text-sm font-medium text-danger-700">
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {loading ? 'Mengirim tautan…' : 'Kirim tautan masuk'}
        </button>
      </form>

      <p className="mt-6 text-sm leading-relaxed text-ink-500">
        Baru di Narraza? Tidak perlu mendaftar terpisah—tautan pertama otomatis membuat akunmu.
      </p>
    </AuthLayout>
  )
}

/** Layout bersama untuk halaman auth. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line-100">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Kembali ke beranda Narraza">
            <LogoWordmark />
          </Link>
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Beranda
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md rounded-xl border border-line-200 bg-surface p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
