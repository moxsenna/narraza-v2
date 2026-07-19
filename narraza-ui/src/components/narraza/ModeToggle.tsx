import { useMode } from '@/context/mode'
import type { Mode } from '@/types/story'
import { cn } from '@/lib/utils'

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'pemula', label: 'Pemula', hint: 'Tampilan paling sederhana' },
  { id: 'kreator', label: 'Kreator', hint: 'Kontrol tambahan' },
  { id: 'mahir', label: 'Mahir', hint: 'Kontrol produk lanjutan' },
]

/**
 * ModeToggle — segmented control mode di topbar.
 */
export function ModeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useMode()
  return (
    <div
      role="radiogroup"
      aria-label="Mode tampilan"
      className={cn('inline-flex rounded-pill border border-line-200 bg-surface p-0.5', className)}
    >
      {MODES.map((m) => (
        <button
          key={m.id}
          role="radio"
          aria-checked={mode === m.id}
          title={m.hint}
          onClick={() => setMode(m.id)}
          className={cn(
            'min-h-[32px] rounded-pill px-3 text-[13px] font-semibold transition-colors',
            mode === m.id
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
