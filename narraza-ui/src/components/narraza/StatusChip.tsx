import type { LucideIcon } from 'lucide-react'
import {
  CheckCircle2,
  CircleAlert,
  Lock,
  EyeOff,
  Link2,
  Sparkle,
  Unlock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * StatusChip — status dengan ikon + teks (tidak mengandalkan warna saja).
 */
export type StatusKind =
  | 'siap'
  | 'perlu-ditinjau'
  | 'fakta-terkunci'
  | 'rahasia-ditahan'
  | 'open-loop'
  | 'kemenangan-kecil'
  | 'potensi-unlock'

const STATUS_CONFIG: Record<
  StatusKind,
  { label: string; icon: LucideIcon; className: string }
> = {
  'siap': {
    label: 'Siap',
    icon: CheckCircle2,
    className: 'bg-success-50 text-success-700 border-success-700/20',
  },
  'perlu-ditinjau': {
    label: 'Perlu ditinjau',
    icon: CircleAlert,
    className: 'bg-warning-50 text-warning-700 border-warning-700/20',
  },
  'fakta-terkunci': {
    label: 'Fakta terkunci',
    icon: Lock,
    className: 'bg-surface-soft text-ink-800 border-line-200',
  },
  'rahasia-ditahan': {
    label: 'Rahasia ditahan',
    icon: EyeOff,
    className: 'bg-plum-600/10 text-plum-600 border-plum-600/20',
  },
  'open-loop': {
    label: 'Open loop',
    icon: Link2,
    className: 'bg-info-50 text-info-700 border-info-700/20',
  },
  'kemenangan-kecil': {
    label: 'Kemenangan kecil',
    icon: Sparkle,
    className: 'bg-amber-500/15 text-ink-800 border-amber-500/30',
  },
  'potensi-unlock': {
    label: 'Potensi unlock',
    icon: Unlock,
    className: 'bg-brand-50 text-brand-700 border-brand-200',
  },
}

export function StatusChip({
  status,
  label,
  className,
}: {
  status: StatusKind
  label?: string
  className?: string
}) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <span
      className={cn(
        'inline-flex min-h-[28px] items-center gap-1.5 rounded-pill border px-3 py-0.5 text-[13px] font-semibold leading-none',
        config.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label ?? config.label}
    </span>
  )
}
