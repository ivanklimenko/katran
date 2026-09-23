import { createContext, useContext } from 'react'
import type { Density } from '@katran/tokens'

export type Theme = 'light' | 'dark' | 'system'
export type KatranContextValue = {
  theme: Theme
  density: Density
  setTheme: (t: Theme) => void
  setDensity: (d: Density) => void
  /** Сообщение для скринридера (role=status). */
  announce: (text: string) => void
  /** Корневой узел провайдера — цель портала для Popover/Menu. */
  portalRoot: HTMLElement | null
}

export const KatranContext = createContext<KatranContextValue | null>(null)

export function useKatran(): KatranContextValue {
  const v = useContext(KatranContext)
  if (!v) throw new Error('useKatran: компонент должен быть внутри <KatranProvider>')
  return v
}
