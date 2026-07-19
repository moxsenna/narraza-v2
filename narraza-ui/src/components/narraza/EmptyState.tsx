import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * EmptyState — slot ilustrasi, judul, isi, CTA (design.md §16.2, §26).
 */
export function EmptyState({
  icon,
  title,
  body,
  ctaLabel,
  ctaHref,
  onCta,
  secondary,
  className,
}: {
  icon?: ReactNode
  title: string
  body: string
  ctaLabel?: string
  ctaHref?: string
  onCta?: () => void
  secondary?: ReactNode
  className?: string
}) {
  const cta = ctaLabel ? (
    ctaHref ? (
      <Link
        to={ctaHref}
        className="inline-flex min-h-[44px] items-center rounded-md bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
      >
        {ctaLabel}
      </Link>
    ) : (
      <button
        type="button"
        onClick={onCta}
        className="inline-flex min-h-[44px] items-center rounded-md bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
      >
        {ctaLabel}
      </button>
    )
  ) : null

  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border border-dashed border-line-200 bg-surface px-6 py-12 text-center sm:py-16',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-bold text-ink-950">{title}</h2>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed text-ink-500">{body}</p>
      {(cta || secondary) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {cta}
          {secondary}
        </div>
      )}
    </div>
  )
}
