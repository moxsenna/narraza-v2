import { Link } from 'react-router-dom'
import { Coins } from 'lucide-react'
import { useSim } from '@/context/sim'
import { creditSummary } from '@/data/mock'
import { cn } from '@/lib/utils'

/**
 * CreditPill — saldo kredit di topbar. Tabular-nums, tautan ke /app/kredit.
 * Berubah gaya warning saat sim state kredit-menipis.
 */
export function CreditPill({ className }: { className?: string }) {
  const { sim } = useSim()
  const menipis = sim === 'kredit-menipis'
  const jumlah = menipis ? 640 : creditSummary.tersedia

  return (
    <Link
      to="/app/kredit"
      className={cn(
        'inline-flex min-h-[36px] items-center gap-1.5 rounded-pill border px-3 text-sm font-semibold tabular-nums transition-colors',
        menipis
          ? 'border-warning-700/30 bg-warning-50 text-warning-700 hover:bg-warning-50/70'
          : 'border-line-200 bg-surface text-ink-800 hover:bg-surface-soft',
        className,
      )}
      aria-label={`Saldo ${jumlah.toLocaleString('id-ID')} kredit. Buka halaman kredit.`}
    >
      <Coins className="h-4 w-4" aria-hidden="true" />
      {jumlah.toLocaleString('id-ID')} kredit
    </Link>
  )
}
