import { useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import { Home, PenLine, MessageCircle, Menu, LayoutGrid, Settings, Coins } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SIDEBAR_GROUPS, projectPath } from '@/routes'
import { mainProject } from '@/data/mock'
import { cn } from '@/lib/utils'

/**
 * Bottom nav mobile — Beranda, Tulis, Narra, Lainnya (sheet nav penuh).
 * BUKAN sidebar yang dikecilkan (design.md §18.2).
 */
export function MobileNav() {
  const { projectId } = useParams()
  const pid = projectId ?? mainProject.id
  const [open, setOpen] = useState(false)

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors',
      isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800',
    )

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line-200 bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Navigasi utama"
    >
      <NavLink to={projectPath(pid, 'beranda')} end className={itemClass}>
        <Home className="h-5 w-5" aria-hidden="true" />
        Beranda
      </NavLink>
      <NavLink to={projectPath(pid, 'tulis', 'bab-1')} className={itemClass}>
        <PenLine className="h-5 w-5" aria-hidden="true" />
        Tulis
      </NavLink>
      <NavLink to={projectPath(pid, 'narra')} className={itemClass}>
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        Narra
      </NavLink>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-ink-500 transition-colors hover:text-ink-800"
            aria-label="Buka semua menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            Lainnya
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle className="font-editorial text-lg">Semua menu</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5 pb-6">
            {SIDEBAR_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-300">
                  {group.label}
                </p>
                <ul className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const to =
                      item.key === 'tulis' || item.key === 'tutupBab' || item.key === 'publish'
                        ? projectPath(pid, item.key, 'bab-1')
                        : projectPath(pid, item.key)
                    return (
                      <li key={item.key}>
                        <NavLink
                          to={to}
                          end={item.key === 'beranda'}
                          onClick={() => setOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              'flex min-h-[44px] items-center rounded-md border px-3 text-sm font-semibold transition-colors',
                              isActive
                                ? 'border-brand-200 bg-brand-50 text-brand-700'
                                : 'border-line-200 bg-surface text-ink-700 hover:bg-surface-soft',
                            )
                          }
                        >
                          {item.label}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            <div className="border-t border-line-100 pt-4">
              <ul className="grid grid-cols-2 gap-2">
                <li>
                  <Link
                    to="/app/proyek"
                    onClick={() => setOpen(false)}
                    className="flex min-h-[44px] items-center gap-2 rounded-md border border-line-200 bg-surface px-3 text-sm font-semibold text-ink-700"
                  >
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                    Semua proyek
                  </Link>
                </li>
                <li>
                  <Link
                    to="/app/kredit"
                    onClick={() => setOpen(false)}
                    className="flex min-h-[44px] items-center gap-2 rounded-md border border-line-200 bg-surface px-3 text-sm font-semibold text-ink-700"
                  >
                    <Coins className="h-4 w-4" aria-hidden="true" />
                    Kredit
                  </Link>
                </li>
                <li>
                  <Link
                    to="/app/pengaturan"
                    onClick={() => setOpen(false)}
                    className="flex min-h-[44px] items-center gap-2 rounded-md border border-line-200 bg-surface px-3 text-sm font-semibold text-ink-700"
                  >
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    Pengaturan
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
