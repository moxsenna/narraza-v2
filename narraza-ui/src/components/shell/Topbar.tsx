import { Link } from 'react-router-dom'
import { ChevronDown, LogOut, Settings, Coins, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ModeToggle } from '@/components/narraza/ModeToggle'
import { CreditPill } from '@/components/narraza/CreditPill'

/**
 * Topbar — judul halaman, mode toggle, badge tier, pill kredit, menu avatar.
 */
export function Topbar({ title, breadcrumb }: { title: string; breadcrumb?: string[] }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line-200 bg-canvas/90 px-4 backdrop-blur-sm sm:px-6">
      {/* Judul / breadcrumb */}
      <div className="min-w-0 flex-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="hidden sm:block">
            <ol className="flex items-center gap-1.5 text-xs text-ink-500">
              {breadcrumb.map((crumb, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  <span className={i === breadcrumb.length - 1 ? 'font-semibold text-ink-800' : ''}>
                    {crumb}
                  </span>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <p className="truncate text-sm font-bold text-ink-950 sm:text-[15px]" aria-hidden={!!breadcrumb}>
          {title}
        </p>
      </div>

      {/* Mode toggle — disembunyikan di layar sangat kecil */}
      <ModeToggle className="hidden md:inline-flex" />

      {/* Badge tier */}
      <span
        className="hidden rounded-pill border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 sm:inline-flex"
        title="Mode kualitas aktif: Seimbang"
      >
        Seimbang
      </span>

      <CreditPill className="hidden sm:inline-flex" />

      {/* Avatar menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-pill border border-line-200 bg-surface px-2 text-sm font-semibold text-ink-800 transition-colors hover:bg-surface-soft"
            aria-label="Menu akun Laras Penulis"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              LP
            </span>
            <ChevronDown className="hidden h-4 w-4 text-ink-500 sm:block" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="flex items-center gap-2 text-sm font-bold text-ink-950">
              <User className="h-4 w-4 text-ink-500" aria-hidden="true" />
              Laras Penulis
            </p>
            <p className="mt-0.5 pl-6 text-xs text-ink-500">laras@contoh.id</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/app/kredit" className="flex cursor-pointer items-center gap-2">
              <Coins className="h-4 w-4" aria-hidden="true" />
              Kredit & riwayat
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/app/pengaturan" className="flex cursor-pointer items-center gap-2">
              <Settings className="h-4 w-4" aria-hidden="true" />
              Pengaturan
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/" className="flex cursor-pointer items-center gap-2">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Keluar (simulasi)
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
