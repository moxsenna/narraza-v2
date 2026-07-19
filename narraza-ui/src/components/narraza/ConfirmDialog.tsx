import { useEffect, useRef } from 'react'
import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * ConfirmDialog — konfirmasi dengan konsekuensi yang jelas (design.md §22.3).
 * Label tombol spesifik ("Kunci fondasi"), bukan "Lanjutkan".
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  consequence,
  confirmLabel,
  cancelLabel = 'Batal',
  destructive = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  /** Penjelasan konsekuensi yang wajib dibaca pengguna */
  consequence: string
  /** Label spesifik, mis. "Kunci fondasi" — bukan "Lanjutkan" */
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 p-4 sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="w-full max-w-md rounded-xl bg-surface p-6 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              destructive ? 'bg-danger-50 text-danger-700' : 'bg-warning-50 text-warning-700',
            )}
            aria-hidden="true"
          >
            <TriangleAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 id="confirm-title" className="text-lg font-bold text-ink-950">
              {title}
            </h2>
            <p id="confirm-desc" className="mt-1.5 text-[15px] leading-relaxed text-ink-700">
              {consequence}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-line-200 bg-surface px-5 text-sm font-semibold text-ink-800 transition-colors hover:bg-surface-soft"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'inline-flex min-h-[44px] items-center justify-center rounded-md px-5 text-sm font-semibold text-white transition-colors',
              destructive ? 'bg-danger-700 hover:bg-danger-700/90' : 'bg-brand-600 hover:bg-brand-700',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
