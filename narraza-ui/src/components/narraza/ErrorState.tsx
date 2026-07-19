import { RefreshCw, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * ErrorState — mengakui masalah dan memberi jalan keluar (design.md §7.4 Error).
 */
export function ErrorState({
  title = 'Ada yang tidak beres',
  body = 'Halaman ini belum berhasil dimuat. Kreditmu tidak dipotong. Coba lagi dalam beberapa saat.',
  onRetry,
  className,
}: {
  title?: string
  body?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center rounded-xl border border-danger-700/20 bg-danger-50 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-danger-700" aria-hidden="true">
        <TriangleAlert className="h-7 w-7" />
      </div>
      <h2 className="text-lg font-bold text-ink-950">{title}</h2>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-700">{body}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line-200 bg-surface px-5 text-sm font-semibold text-ink-800 shadow-sm transition-colors hover:bg-surface-soft"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Coba lagi
        </button>
      )}
    </div>
  )
}
