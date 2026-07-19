import { createContext, useContext, useState, type ReactNode } from 'react'
import type { SimState } from '@/types/story'

/**
 * SimProvider — state demo global untuk panel "Simulasi kondisi".
 * Hanya alat pratinjau prototipe; halaman boleh membacanya untuk
 * menampilkan varian empty / error / kredit-menipis.
 */
interface SimContextValue {
  sim: SimState
  setSim: (sim: SimState) => void
}

const SimContext = createContext<SimContextValue | null>(null)

export function SimProvider({ children }: { children: ReactNode }) {
  const [sim, setSim] = useState<SimState>('normal')
  return <SimContext.Provider value={{ sim, setSim }}>{children}</SimContext.Provider>
}

export function useSim(): SimContextValue {
  const ctx = useContext(SimContext)
  if (!ctx) throw new Error('useSim harus dipakai di dalam SimProvider')
  return ctx
}
