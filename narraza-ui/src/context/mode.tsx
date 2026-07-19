import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Mode } from '@/types/story'

/**
 * ModeProvider — progressive disclosure.
 * pemula (default): pengalaman utama, istilah paling sederhana.
 * kreator: kontrol tambahan (statistik, perbandingan).
 * mahir: kontrol produk lanjutan (bahan aman untuk AI, label operasi usulan).
 */
interface ModeContextValue {
  mode: Mode
  setMode: (mode: Mode) => void
}

const ModeContext = createContext<ModeContextValue | null>(null)

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('pemula')
  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext)
  if (!ctx) throw new Error('useMode harus dipakai di dalam ModeProvider')
  return ctx
}
