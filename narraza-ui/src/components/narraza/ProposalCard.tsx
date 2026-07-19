import { useState, type ReactNode } from 'react'
import { Check, Pencil, X, AlertTriangle } from 'lucide-react'
import { VersionLabel } from './VersionLabel'
import { ConfirmDialog } from './ConfirmDialog'
import { cn } from '@/lib/utils'

/**
 * ProposalCard — kartu Usulan Narra (design.md §15.7).
 * Struktur: label → isi → dampak → risiko → Terima / Ubah / Tolak.
 * Usulan berisiko tinggi meminta konfirmasi dengan konsekuensi sebelum diterima.
 */
export function ProposalCard({
  isi,
  dampak,
  risiko,
  kategori,
  onTerima,
  onUbah,
  onTolak,
  className,
  footer,
}: {
  isi: string
  dampak?: string
  risiko?: 'tinggi' | 'sedang' | 'rendah'
  kategori?: string
  onTerima?: () => void
  onUbah?: () => void
  onTolak?: () => void
  className?: string
  footer?: ReactNode
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const highRisk = risiko === 'tinggi'

  const handleTerima = () => {
    if (highRisk) setConfirmOpen(true)
    else onTerima?.()
  }

  return (
    <article
      className={cn(
        'rounded-lg border bg-surface p-5 shadow-sm',
        highRisk ? 'border-warning-700/30' : 'border-line-200',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <VersionLabel kind="fakta-usulan" />
        {kategori && (
          <span className="rounded-pill bg-surface-soft px-2.5 py-0.5 text-xs font-medium text-ink-500">
            {kategori}
          </span>
        )}
        {risiko && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold',
              highRisk
                ? 'bg-warning-50 text-warning-700'
                : risiko === 'sedang'
                  ? 'bg-info-50 text-info-700'
                  : 'bg-surface-soft text-ink-500',
            )}
          >
            {highRisk && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
            Risiko {risiko}
          </span>
        )}
      </div>

      <p className="mt-3 text-[15px] font-semibold leading-relaxed text-ink-950">“{isi}”</p>

      {dampak && (
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          <span className="font-semibold text-ink-700">Dampak: </span>
          {dampak}
        </p>
      )}

      {highRisk && (
        <p className="mt-3 rounded-md bg-warning-50 px-3 py-2 text-sm leading-relaxed text-warning-700">
          Usulan ini menyentuh rahasia besar keluarga. Keputusanmu akan mengikat arah banyak bab
          berikutnya—tinjau baik-baik sebelum dikunci.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleTerima}
          className={cn(
            'inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors',
            highRisk
              ? 'border border-warning-700/30 bg-warning-50 text-warning-700 hover:bg-warning-50/70'
              : 'bg-brand-600 text-white hover:bg-brand-700',
          )}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {highRisk ? 'Tinjau lalu terima' : 'Terima'}
        </button>
        <button
          type="button"
          onClick={onUbah}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-line-200 bg-surface px-4 text-sm font-semibold text-ink-800 transition-colors hover:bg-surface-soft"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Ubah
        </button>
        <button
          type="button"
          onClick={onTolak}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-4 text-sm font-semibold text-ink-500 transition-colors hover:text-danger-700"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Tolak
        </button>
      </div>

      {footer}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          onTerima?.()
        }}
        title="Kunci fakta berisiko tinggi?"
        consequence={`Fakta “${isi}” akan menjadi bagian dari Cerita Resmi dan memengaruhi motivasi tokoh, timeline, serta arah konflik. Kamu masih bisa mengubahnya nanti, tetapi bab yang sudah ditulis mungkin perlu ditinjau ulang.`}
        confirmLabel="Kunci sebagai fakta"
      />
    </article>
  )
}
