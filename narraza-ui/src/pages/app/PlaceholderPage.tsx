import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/narraza/PageHeader'
import { EmptyState } from '@/components/narraza/EmptyState'
import { ErrorState } from '@/components/narraza/ErrorState'
import { useSim } from '@/context/sim'
import type { RouteMeta } from '@/routes'

/**
 * PlaceholderPage — kerangka halaman untuk rute yang belum dibangun.
 * Navigasi sudah berfungsi ujung-ke-ujung; agent berikutnya mengganti
 * komponen ini dengan halaman asli memakai mock data bersama.
 *
 * Sim state dihormati: 'empty' menampilkan empty state khusus,
 * 'error' menampilkan ErrorState.
 */
export default function PlaceholderPage({
  meta,
  akanAda,
  emptyTitle,
  emptyBody,
}: {
  meta: RouteMeta
  /** Daftar singkat apa yang akan tampil di halaman ini */
  akanAda?: string[]
  emptyTitle?: string
  emptyBody?: string
}) {
  const { sim } = useSim()
  const Icon = meta.icon

  if (sim === 'error') {
    return (
      <ErrorState
        onRetry={() => window.location.reload()}
        body={`Halaman ${meta.title} belum berhasil dimuat. Kreditmu tidak dipotong. Coba lagi dalam beberapa saat.`}
      />
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader title={meta.title} description={meta.description} />

      {sim === 'empty' ? (
        <EmptyState
          icon={<Icon className="h-7 w-7" />}
          title={emptyTitle ?? `Belum ada apa pun di ${meta.title}`}
          body={
            emptyBody ??
            'Bagian ini akan terisi setelah kamu melangkah lebih jauh dalam proses ceritamu. Narra akan memandu langkah berikutnya.'
          }
          ctaLabel="Kembali ke Beranda Proyek"
          ctaHref="/app"
        />
      ) : (
        <div className="rounded-xl border border-dashed border-line-200 bg-surface px-6 py-12 sm:py-16">
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
              <Icon className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold text-ink-950">{meta.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{meta.description}</p>

            {akanAda && akanAda.length > 0 && (
              <div className="mt-6 rounded-lg border border-line-200 bg-canvas p-4 text-left">
                <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-ink-300">
                  <Construction className="h-4 w-4" aria-hidden="true" />
                  Akan hadir di halaman ini
                </p>
                <ul className="mt-3 space-y-2">
                  {akanAda.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-ink-700">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-6 text-xs text-ink-300">
              Halaman ini adalah kerangka prototipe — konten lengkapnya sedang dibangun.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
