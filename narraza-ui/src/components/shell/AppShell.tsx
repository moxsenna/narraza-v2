import { useState } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileNav } from './MobileNav'
import { DevSimPanel } from './DevSimPanel'
import { PROJECT_ROUTES, APP_ROUTES } from '@/routes'
import { mainProject } from '@/data/mock'
import { cn } from '@/lib/utils'

/**
 * AppShell — area setelah login.
 * Desktop: sidebar 240px (collapsible) + topbar.
 * Mobile: top bar + bottom nav (BUKAN sidebar dikecilkan).
 */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { projectId } = useParams()

  const { title, breadcrumb } = resolveHeader(location.pathname, projectId)

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[68px]' : 'lg:pl-60')}>
        <Topbar title={title} breadcrumb={breadcrumb} />
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          <Outlet />
        </main>
      </div>
      <MobileNav />
      <DevSimPanel />
    </div>
  )
}

function resolveHeader(pathname: string, projectId?: string): { title: string; breadcrumb?: string[] } {
  // Halaman proyek
  if (projectId) {
    const base = `/app/p/${projectId}`
    const sub = pathname.slice(base.length).replace(/^\//, '')
    for (const value of Object.values(PROJECT_ROUTES)) {
      const pattern = value.path.replace(':chapterId', '[^/]+')
      const regex = new RegExp(`^${pattern}$`)
      if (sub === '' && value.path === '') {
        return { title: value.meta.title, breadcrumb: [mainProject.judul, value.meta.title] }
      }
      if (value.path !== '' && regex.test(sub)) {
        return { title: value.meta.title, breadcrumb: [mainProject.judul, value.meta.title] }
      }
    }
    return { title: mainProject.judul, breadcrumb: [mainProject.judul] }
  }
  // Halaman non-proyek
  if (pathname.startsWith('/app/proyek/baru')) return { title: APP_ROUTES.baru.title }
  if (pathname.startsWith('/app/proyek/import')) return { title: APP_ROUTES.import.title }
  if (pathname.startsWith('/app/proyek')) return { title: APP_ROUTES.dashboard.title }
  if (pathname.startsWith('/app/pengaturan')) return { title: APP_ROUTES.pengaturan.title }
  if (pathname.startsWith('/app/kredit')) return { title: APP_ROUTES.kredit.title }
  return { title: 'Narraza' }
}
