import { cn } from '@/lib/utils'

function Bar({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-line-100', className)} aria-hidden="true" />
}

/** Skeleton halaman umum: header + beberapa kartu. */
export function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Memuat halaman">
      <div className="space-y-2">
        <Bar className="h-8 w-64" />
        <Bar className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-line-200 bg-surface p-5">
            <Bar className="h-5 w-2/3" />
            <Bar className="mt-3 h-4 w-full" />
            <Bar className="mt-2 h-4 w-5/6" />
            <Bar className="mt-4 h-9 w-28" />
          </div>
        ))}
      </div>
      <span className="sr-only">Sedang memuat…</span>
    </div>
  )
}

/** Skeleton daftar baris (aktivitas, fakta, dll). */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Memuat daftar">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-line-200 bg-surface p-4">
          <Bar className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bar className="h-4 w-3/4" />
            <Bar className="h-3 w-1/2" />
          </div>
        </div>
      ))}
      <span className="sr-only">Sedang memuat…</span>
    </div>
  )
}

/** Skeleton paragraf prosa. */
export function ProseSkeleton({ paragraphs = 5 }: { paragraphs?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Memuat tulisan">
      {Array.from({ length: paragraphs }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-4/5" />
        </div>
      ))}
      <span className="sr-only">Sedang memuat…</span>
    </div>
  )
}
