import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * MobilePreviewFrame — bingkai HP untuk pratinjau baca (design.md §17.2).
 */
export function MobilePreviewFrame({
  children,
  title,
  className,
}: {
  children: ReactNode
  title?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[320px] rounded-[36px] border-[10px] border-ink-950 bg-ink-950 shadow-lg',
        className,
      )}
      aria-label={title ? `Pratinjau di HP: ${title}` : 'Pratinjau di HP'}
    >
      <div className="overflow-hidden rounded-[26px] bg-canvas">
        {/* status bar tiruan */}
        <div className="flex items-center justify-between bg-canvas px-5 pb-1 pt-3" aria-hidden="true">
          <span className="text-[11px] font-semibold text-ink-800">20.26</span>
          <span className="h-4 w-16 rounded-pill bg-ink-950/90" />
          <span className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-ink-800" />
            <span className="h-2 w-2 rounded-full bg-ink-800" />
            <span className="h-2 w-2 rounded-full bg-ink-300" />
          </span>
        </div>
        <div className="max-h-[520px] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
