import { useState } from 'react'
import { FlaskConical, ChevronDown, ChevronUp } from 'lucide-react'
import { useSim } from '@/context/sim'
import type { SimState } from '@/types/story'
import { cn } from '@/lib/utils'

const SIM_OPTIONS: { id: SimState; label: string; desc: string }[] = [
  { id: 'normal', label: 'Normal', desc: 'Data contoh lengkap' },
  { id: 'empty', label: 'Kosong', desc: 'Seperti pengguna baru' },
  { id: 'error', label: 'Error', desc: 'Simulasi gagal memuat' },
  { id: 'kredit-menipis', label: 'Kredit menipis', desc: 'Saldo tersisa sedikit' },
]

/**
 * DevSimPanel — alat pratinjau prototipe untuk mengganti kondisi demo global.
 * Collapsible, diberi label jelas, tidak muncul di produksi nyata.
 */
export function DevSimPanel() {
  const { sim, setSim } = useSim()
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-20 right-4 z-40 w-64 lg:bottom-4" data-testid="dev-sim-panel">
      {open && (
        <div className="mb-2 rounded-lg border border-amber-500/40 bg-surface p-3 shadow-lg">
          <fieldset>
            <legend className="sr-only">Pilih kondisi simulasi</legend>
            <div className="space-y-1.5">
              {SIM_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={cn(
                    'flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-md border px-3 transition-colors',
                    sim === opt.id
                      ? 'border-brand-300 bg-brand-50'
                      : 'border-line-200 hover:bg-surface-soft',
                  )}
                >
                  <input
                    type="radio"
                    name="sim-state"
                    value={opt.id}
                    checked={sim === opt.id}
                    onChange={() => setSim(opt.id)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink-950">{opt.label}</span>
                    <span className="block text-xs text-ink-500">{opt.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-pill border px-4 text-xs font-bold shadow-md transition-colors',
          sim !== 'normal'
            ? 'border-amber-500 bg-amber-500 text-ink-950'
            : 'border-line-200 bg-surface text-ink-700 hover:bg-surface-soft',
        )}
      >
        <FlaskConical className="h-4 w-4" aria-hidden="true" />
        Simulasi kondisi{sim !== 'normal' ? `: ${SIM_OPTIONS.find((o) => o.id === sim)?.label}` : ''}
        {open ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
      <p className="mt-1 text-center text-[10px] font-medium text-ink-300">
        Alat pratinjau prototipe
      </p>
    </div>
  )
}
