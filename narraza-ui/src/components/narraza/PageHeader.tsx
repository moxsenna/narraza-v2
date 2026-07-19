import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * PageHeader — judul halaman, deskripsi, dan slot aksi.
 * Satu tindakan primer per layar (design.md §5.3).
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-2xl font-bold text-ink-950 sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
