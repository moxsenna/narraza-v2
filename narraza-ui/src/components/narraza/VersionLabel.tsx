import { Lock, PenLine, Sparkles, Wrench, CheckCircle2, CircleHelp } from 'lucide-react'
import type { VersionLabelKind } from '@/types/story'
import { cn } from '@/lib/utils'

/**
 * VersionLabel — label asal-usul konten (design.md §22.2).
 * Pengguna selalu tahu mana tulisan AI, editan sendiri, dan fakta terkunci.
 */
const LABEL_CONFIG: Record<
  VersionLabelKind,
  { text: string; icon: typeof PenLine; className: string }
> = {
  'dibuat-narra': {
    text: 'Dibuat Narra',
    icon: Sparkles,
    className: 'bg-brand-50 text-brand-700 border-brand-200',
  },
  'diedit-kamu': {
    text: 'Diedit kamu',
    icon: PenLine,
    className: 'bg-info-50 text-info-700 border-info-700/20',
  },
  'diperbaiki-narra': {
    text: 'Diperbaiki Narra',
    icon: Wrench,
    className: 'bg-brand-50 text-brand-700 border-brand-200',
  },
  'versi-diterima': {
    text: 'Versi diterima',
    icon: CheckCircle2,
    className: 'bg-success-50 text-success-700 border-success-700/20',
  },
  'fakta-usulan': {
    text: 'Fakta usulan',
    icon: CircleHelp,
    className: 'bg-warning-50 text-warning-700 border-warning-700/20',
  },
  'fakta-terkunci': {
    text: 'Fakta terkunci',
    icon: Lock,
    className: 'bg-surface-soft text-ink-800 border-line-200',
  },
}

export function VersionLabel({
  kind,
  className,
}: {
  kind: VersionLabelKind
  className?: string
}) {
  const config = LABEL_CONFIG[kind]
  const Icon = config.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.text}
    </span>
  )
}
