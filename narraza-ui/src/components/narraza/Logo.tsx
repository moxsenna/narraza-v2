import { cn } from '@/lib/utils'

/**
 * Logo Narraza — huruf N dari dua lipatan halaman (design.md §8).
 * Tidak memakai robot/sparkle/pena generik.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('h-8 w-8', className)}
    >
      {/* Lipatan halaman kiri */}
      <path
        d="M6 5.5C6 4.67 6.67 4 7.5 4h5.2c.47 0 .92.21 1.22.57l12 14.4c.17.2.08.53-.17.53h-3.25a1.5 1.5 0 0 1-1.22-.63L9.5 4.9A1.5 1.5 0 0 0 8.28 4.4L6 5.5Z"
        fill="currentColor"
        opacity="0.55"
      />
      {/* Batang kiri N */}
      <path d="M6 5a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 10 5v22.5a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 6 27.5V5Z" fill="currentColor" />
      {/* Batang kanan N + ujung penanda buku */}
      <path d="M22 5a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 26 5v19.2l-1.72 2.06a.6.6 0 0 1-.92 0L21.6 24.2A1.5 1.5 0 0 1 22 23V5Z" fill="currentColor" />
      {/* Diagonal N sebagai jalur cerita */}
      <path d="M9.5 4.6a1.2 1.2 0 0 1 .92.44l12.8 15.36a1.2 1.2 0 0 1-.92 1.96h-1.1a1.2 1.2 0 0 1-.92-.44L7.48 6.56a1.2 1.2 0 0 1 .92-1.96h1.1Z" fill="currentColor" />
    </svg>
  )
}

export function LogoWordmark({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="text-brand-600">
        <LogoMark className="h-7 w-7" />
      </span>
      <span
        className={cn(
          'font-editorial text-xl font-bold tracking-tight',
          dark ? 'text-white' : 'text-ink-950',
        )}
      >
        Narraza
      </span>
    </span>
  )
}
