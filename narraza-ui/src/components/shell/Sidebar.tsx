import { NavLink, Link, useParams } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, LayoutGrid } from 'lucide-react'
import { LogoMark } from '@/components/narraza/Logo'
import { SIDEBAR_GROUPS, PROJECT_ROUTES, projectPath, type ProjectRouteKey } from '@/routes'
import { mainProject } from '@/data/mock'
import { cn } from '@/lib/utils'

const STAGE_LABEL: Record<string, string> = {
  fondasi: 'Fondasi',
  karakter: 'Karakter',
  rencana: 'Rencana Bab',
  menulis: 'Menulis',
  pemeriksaan: 'Pemeriksaan',
  publikasi: 'Publikasi',
}

/**
 * Sidebar desktop (240px, collapsible) — navigasi proyek aktif.
 * Di mobile komponen ini disembunyikan; navigasi pindah ke bottom nav.
 */
export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { projectId } = useParams()
  const pid = projectId ?? mainProject.id

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line-200 bg-surface transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[68px]' : 'w-60',
      )}
      aria-label="Navigasi proyek"
    >
      {/* Header logo */}
      <div className={cn('flex h-16 items-center border-b border-line-100 px-4', collapsed && 'justify-center px-2')}>
        <Link to="/" className="flex items-center gap-2 text-brand-600" aria-label="Narraza — kembali ke beranda">
          <LogoMark className="h-7 w-7 shrink-0" />
          {!collapsed && (
            <span className="font-editorial text-lg font-bold text-ink-950">Narraza</span>
          )}
        </Link>
      </div>

      {/* Ringkasan proyek */}
      <div className={cn('border-b border-line-100 p-4', collapsed && 'px-2')}>
        {collapsed ? (
          <div
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 font-editorial text-sm font-bold text-brand-700"
            title={mainProject.judul}
          >
            RH
          </div>
        ) : (
          <div className="rounded-lg border border-line-200 bg-canvas p-3">
            <Link
              to={projectPath(pid, 'beranda')}
              className="block truncate text-sm font-bold text-ink-950 hover:text-brand-700"
            >
              {mainProject.judul}
            </Link>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-pill bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                {STAGE_LABEL[mainProject.stage]}
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-ink-500">
                {mainProject.kesiapanFondasi}% siap
              </span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-pill bg-line-100"
              role="progressbar"
              aria-valuenow={mainProject.kesiapanFondasi}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Kesiapan Fondasi ${mainProject.kesiapanFondasi} persen`}
            >
              <div
                className="h-full rounded-pill bg-brand-500"
                style={{ width: `${mainProject.kesiapanFondasi}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Nav grup */}
      <nav className="flex-1 overflow-y-auto p-3" aria-label="Tahapan produksi cerita">
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <p className="mb-1.5 px-2 text-[11px] font-bold uppercase tracking-wider text-ink-300">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = (SIDEBAR_ICONS as Record<ProjectRouteKey, typeof LayoutGrid>)[item.key]
                const to =
                  item.key === 'tulis' || item.key === 'tutupBab' || item.key === 'publish'
                    ? projectPath(pid, item.key, 'bab-1')
                    : projectPath(pid, item.key)
                return (
                  <li key={item.key}>
                    <NavLink
                      to={to}
                      end={item.key === 'beranda'}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors',
                          collapsed && 'justify-center px-0',
                          isActive
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-ink-700 hover:bg-surface-soft hover:text-ink-950',
                        )
                      }
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-line-100 p-3">
        <Link
          to="/app/proyek"
          className={cn(
            'flex min-h-[44px] items-center gap-3 rounded-md px-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-surface-soft',
            collapsed && 'justify-center px-0',
          )}
          title={collapsed ? 'Semua proyek' : undefined}
        >
          <LayoutGrid className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          {!collapsed && 'Semua proyek'}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-ink-500 transition-colors hover:bg-surface-soft',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden="true" />
              Sembunyikan
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

// Peta ikon per rute (diambil dari routes.ts agar konsisten)
const SIDEBAR_ICONS = Object.fromEntries(
  Object.entries(PROJECT_ROUTES).map(([k, v]) => [k, v.meta.icon]),
) as Record<ProjectRouteKey, typeof LayoutGrid>
