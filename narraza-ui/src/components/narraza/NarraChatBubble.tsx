import { cn } from '@/lib/utils'

/**
 * NarraChatBubble — gelembung percakapan dengan Narra (design.md §15.6).
 * Bubble Narra: brand-50/100 + monogram "N". Bubble pengguna: putih, kanan.
 */
export function NarraChatBubble({
  dari,
  children,
  waktu,
  className,
}: {
  dari: 'narra' | 'kamu'
  children: React.ReactNode
  waktu?: string
  className?: string
}) {
  const isNarra = dari === 'narra'
  return (
    <div className={cn('flex gap-2.5', isNarra ? 'items-start' : 'flex-row-reverse items-start', className)}>
      {isNarra && (
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white"
          aria-hidden="true"
        >
          N
        </span>
      )}
      <div className={cn('max-w-[80%]', isNarra ? '' : 'text-right')}>
        {isNarra && (
          <span className="mb-1 block text-xs font-semibold text-brand-700">Narra</span>
        )}
        <div
          className={cn(
            'inline-block rounded-lg px-4 py-3 text-left text-[15px] leading-relaxed',
            isNarra
              ? 'rounded-tl-sm bg-brand-50 text-ink-800'
              : 'rounded-tr-sm border border-line-200 bg-surface text-ink-800 shadow-sm',
          )}
        >
          {children}
        </div>
        {waktu && (
          <span className="mt-1 block text-xs text-ink-300">{waktu}</span>
        )}
      </div>
    </div>
  )
}
