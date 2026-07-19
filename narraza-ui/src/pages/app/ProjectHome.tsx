import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Users,
  Map,
  PenLine,
  ShieldCheck,
  Send,
  Check,
  AlertTriangle,
  ScrollText,
  EyeOff,
  CircleHelp,
  Activity as ActivityIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/narraza/PageHeader'
import { EmptyState } from '@/components/narraza/EmptyState'
import { ErrorState } from '@/components/narraza/ErrorState'
import { useSim } from '@/context/sim'
import { activities, getProjectProgress, mainProject } from '@/data/mock'
import { projectPath } from '@/routes'
import { cn } from '@/lib/utils'
import type { ProjectStage } from '@/types/story'

const STAGES: { id: ProjectStage; label: string; icon: typeof BookOpen }[] = [
  { id: 'fondasi', label: 'Fondasi', icon: BookOpen },
  { id: 'karakter', label: 'Karakter', icon: Users },
  { id: 'rencana', label: 'Rencana Bab', icon: Map },
  { id: 'menulis', label: 'Menulis', icon: PenLine },
  { id: 'pemeriksaan', label: 'Pemeriksaan', icon: ShieldCheck },
  { id: 'publikasi', label: 'Publikasi', icon: Send },
]

/**
 * `/app/p/:projectId` — Beranda Proyek: hub kemajuan nyata.
 * Stepper tahap, kartu next-action (dari progress reducer mock),
 * daftar hambatan, hitungan, dan aktivitas terbaru.
 */
export default function ProjectHomePage() {
  const { sim } = useSim()

  if (sim === 'error') {
    return (
      <ErrorState
        title="Beranda proyek belum berhasil dimuat"
        body="Kemajuan ceritamu tersimpan aman dan kreditmu tidak dipotong. Coba muat ulang dalam beberapa saat."
        onRetry={() => window.location.reload()}
      />
    )
  }

  if (sim === 'empty') {
    return (
      <EmptyState
        icon={<BookOpen className="h-7 w-7" />}
        title="Cerita pertamamu belum dimulai"
        body="Pilih cara mulai yang paling nyaman—dari ide kosong, premis kasar, atau draft yang sudah ada. Narra akan memandumu langkah demi langkah."
        ctaLabel="Mulai proyek baru"
        ctaHref="/app/proyek/baru"
      />
    )
  }

  const progress = getProjectProgress(mainProject)
  const currentStageIndex = STAGES.findIndex((s) => s.id === progress.stage)

  return (
    <div className="space-y-8">
      <PageHeader
        title={mainProject.judul}
        description={mainProject.deskripsi}
        actions={
          <Link
            to={projectPath(mainProject.id, 'narra')}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line-200 bg-surface px-4 text-sm font-semibold text-ink-800 shadow-sm transition-colors hover:bg-surface-soft"
          >
            Ngobrol dengan Narra
          </Link>
        }
      />

      {/* Stepper tahap */}
      <nav aria-label="Tahap produksi cerita" className="rounded-lg border border-line-200 bg-surface p-5 shadow-sm">
        <ol className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-0">
          {STAGES.map((stage, i) => {
            const selesai = progress.tahapSelesai.includes(stage.id)
            const aktif = i === currentStageIndex
            const Icon = stage.icon
            return (
              <li key={stage.id} className="flex flex-1 items-center">
                <div
                  className={cn(
                    'flex min-h-[44px] flex-1 items-center gap-2.5 rounded-md px-3 py-2',
                    aktif && 'bg-brand-50',
                  )}
                  aria-current={aktif ? 'step' : undefined}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                      selesai
                        ? 'border-success-700/30 bg-success-50 text-success-700'
                        : aktif
                          ? 'border-brand-300 bg-surface text-brand-700'
                          : 'border-line-200 bg-surface-soft text-ink-300',
                    )}
                    aria-hidden="true"
                  >
                    {selesai ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      aktif ? 'text-brand-700' : selesai ? 'text-ink-800' : 'text-ink-300',
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <span className="hidden h-px w-4 shrink-0 bg-line-200 sm:block" aria-hidden="true" />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Kolom utama */}
        <div className="space-y-6 lg:col-span-2">
          {/* Next action */}
          <section aria-labelledby="next-action" className="rounded-lg border-2 border-brand-600/60 bg-surface p-6 shadow-md">
            <p className="text-[13px] font-bold uppercase tracking-wider text-brand-700">
              Langkah berikutnya
            </p>
            <h2 id="next-action" className="mt-2 text-xl font-bold text-ink-950">
              {progress.nextAction.label}
            </h2>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-500">
              {progress.nextAction.alasan}
            </p>
            <Link
              to={progress.nextAction.href}
              className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-md bg-brand-600 px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              {progress.nextAction.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>

          {/* Hambatan */}
          <section aria-labelledby="blockers" className="rounded-lg border border-warning-700/20 bg-warning-50 p-6">
            <h2 id="blockers" className="flex items-center gap-2 text-base font-bold text-ink-950">
              <AlertTriangle className="h-5 w-5 text-warning-700" aria-hidden="true" />
              Perlu perhatianmu ({progress.blockers.length})
            </h2>
            <ul className="mt-4 space-y-2.5">
              {progress.blockers.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-ink-700">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-warning-700" aria-hidden="true" />
                  {b}
                </li>
              ))}
            </ul>
          </section>

          {/* Aktivitas */}
          <section aria-labelledby="activity" className="rounded-lg border border-line-200 bg-surface p-6 shadow-sm">
            <h2 id="activity" className="flex items-center gap-2 text-base font-bold text-ink-950">
              <ActivityIcon className="h-5 w-5 text-ink-500" aria-hidden="true" />
              Aktivitas terbaru
            </h2>
            <ol className="mt-4 space-y-4">
              {activities.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-300" aria-hidden="true" />
                  <div>
                    <p className="text-[15px] leading-relaxed text-ink-800">{a.teks}</p>
                    <p className="mt-0.5 text-xs text-ink-300">{a.waktu}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Kolom samping: hitungan */}
        <div className="space-y-4">
          <section aria-labelledby="counts" className="rounded-lg border border-line-200 bg-surface p-5 shadow-sm">
            <h2 id="counts" className="text-base font-bold text-ink-950">Kemajuan cerita</h2>
            <dl className="mt-4 space-y-4">
              <CountRow
                icon={<Map className="h-4 w-4" aria-hidden="true" />}
                label="Bab terencana"
                value={`${progress.counts.babTerencana} dari ${mainProject.targetBab}`}
                href={projectPath(mainProject.id, 'outline')}
              />
              <CountRow
                icon={<PenLine className="h-4 w-4" aria-hidden="true" />}
                label="Bab tertulis"
                value={`${progress.counts.babTertulis}`}
                href={projectPath(mainProject.id, 'tulis', 'bab-1')}
              />
              <CountRow
                icon={<ScrollText className="h-4 w-4" aria-hidden="true" />}
                label="Fakta terkunci"
                value={`${progress.counts.faktaTerkunci}`}
                href={projectPath(mainProject.id, 'fakta')}
              />
              <CountRow
                icon={<CircleHelp className="h-4 w-4" aria-hidden="true" />}
                label="Usulan menunggu"
                value={`${progress.counts.usulanMenunggu}`}
                href={projectPath(mainProject.id, 'fakta')}
                highlight={progress.counts.usulanMenunggu > 0}
              />
              <CountRow
                icon={<EyeOff className="h-4 w-4" aria-hidden="true" />}
                label="Rahasia ditahan"
                value={`${progress.counts.rahasiaDitahan}`}
                href={projectPath(mainProject.id, 'rahasia')}
              />
            </dl>
          </section>

          {/* Kesiapan fondasi */}
          <section aria-labelledby="readiness" className="rounded-lg border border-line-200 bg-surface p-5 shadow-sm">
            <h2 id="readiness" className="text-base font-bold text-ink-950">Kesiapan Fondasi</h2>
            <p className="mt-1 text-sm text-ink-500">
              {mainProject.kesiapanFondasi}% siap. Arah ending dan panggilan antartokoh masih perlu
              ditinjau sebelum rencana bab dikunci.
            </p>
            <div
              className="mt-3 h-2 overflow-hidden rounded-pill bg-line-100"
              role="progressbar"
              aria-valuenow={mainProject.kesiapanFondasi}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Kesiapan Fondasi ${mainProject.kesiapanFondasi} persen`}
            >
              <div className="h-full rounded-pill bg-brand-500" style={{ width: `${mainProject.kesiapanFondasi}%` }} />
            </div>
            <Link
              to={projectPath(mainProject.id, 'fondasi')}
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              Tinjau fondasi
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  )
}

function CountRow({
  icon,
  label,
  value,
  href,
  highlight = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  href: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-sm text-ink-500">
        <span className="text-ink-300">{icon}</span>
        {label}
      </dt>
      <dd>
        <Link
          to={href}
          className={cn(
            'inline-flex min-h-[32px] items-center rounded-sm px-1 text-sm font-bold tabular-nums hover:text-brand-700',
            highlight ? 'text-warning-700' : 'text-ink-950',
          )}
        >
          {value}
        </Link>
      </dd>
    </div>
  )
}
