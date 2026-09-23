import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { densityOptions, type Density } from '@katran/tokens'
import { KatranContext, type Theme } from './useKatran'
import { LiveRegion, type LiveRegionHandle } from './LiveRegion'
import s from './Provider.module.css'

export type KatranProviderProps = {
  children: ReactNode
  /** Управляемые значения. Если заданы — внутреннее состояние не используется. */
  theme?: Theme
  density?: Density
  defaultTheme?: Theme
  defaultDensity?: Density
  /** Ключ localStorage; без него ничего не сохраняется. */
  storageKey?: string
}

const isDensity = (v: unknown): v is Density => densityOptions.includes(v as Density)
const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark' || v === 'system'

function read<T>(key: string | undefined, name: string, ok: (v: unknown) => v is T): T | undefined {
  if (!key) return undefined
  try {
    const raw = localStorage.getItem(`${key}:${name}`)
    if (raw == null) return undefined
    const v = name === 'density' ? Number(raw) : raw
    return ok(v) ? v : undefined
  } catch { return undefined }
}
function write(key: string | undefined, name: string, v: string | number) {
  if (!key) return
  try { localStorage.setItem(`${key}:${name}`, String(v)) } catch { /* приватный режим — молча */ }
}

/** Плотность по умолчанию: 1.25 на широких мониторах (эталон: 2K при 100 % мелко). */
function autoDensity(): Density {
  return typeof screen !== 'undefined' && screen.width >= 2200 ? 1.25 : 1
}

export function KatranProvider(p: KatranProviderProps) {
  const [themeS, setThemeS] = useState<Theme>(() => read(p.storageKey, 'theme', isTheme) ?? p.defaultTheme ?? 'system')
  const [densityS, setDensityS] = useState<Density>(() => read(p.storageKey, 'density', isDensity) ?? p.defaultDensity ?? autoDensity())
  const live = useRef<LiveRegionHandle>(null)

  const setTheme = useCallback((t: Theme) => { setThemeS(t); write(p.storageKey, 'theme', t) }, [p.storageKey])
  const setDensity = useCallback((d: Density) => { setDensityS(d); write(p.storageKey, 'density', d) }, [p.storageKey])
  const announce = useCallback((t: string) => live.current?.announce(t), [])

  // Синхронизация управляемой темы с внутренним состоянием — во время рендера
  // (паттерн React «adjusting state during render»), а не в useEffect: setState
  // в теле эффекта запрещён правилом react-hooks/set-state-in-effect. Нужно на
  // случай перехода provider из управляемого режима в неуправляемый — тогда
  // внутреннее состояние не должно откатиться к устаревшему значению.
  const [prevPropTheme, setPrevPropTheme] = useState(p.theme)
  if (p.theme !== prevPropTheme) {
    setPrevPropTheme(p.theme)
    if (p.theme) setThemeS(p.theme)
  }

  const theme = p.theme ?? themeS
  const density = p.density ?? densityS

  const value = useMemo(() => ({ theme, density, setTheme, setDensity, announce }), [theme, density, setTheme, setDensity, announce])

  return (
    <KatranContext.Provider value={value}>
      <div
        className={s.root}
        data-theme={theme === 'system' ? undefined : theme}
        style={{ '--k-density': String(density) } as React.CSSProperties}
      >
        {p.children}
        <LiveRegion ref={live} />
      </div>
    </KatranContext.Provider>
  )
}
