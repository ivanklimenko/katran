import type { ReactNode } from 'react'
import { Button, useKatran, type Theme } from '@katran/ui'
import { densityOptions, type Density } from '@katran/tokens'
import { routes, type Route } from './router'
import s from './Shell.module.css'

const themes: { id: Theme; title: string }[] = [{ id: 'light', title: 'Светлая' }, { id: 'dark', title: 'Тёмная' }, { id: 'system', title: 'Системная' }]

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const k = useKatran()
  return (
    <div className={s.shell}>
      <aside className={s.side}>
        <div className={s.brand}>katran</div>
        <nav aria-label="Разделы">
          {routes.map((r) => (
            <a key={r.id} href={`#/${r.id}`} className={s.link} aria-current={r.id === route ? 'page' : undefined}>{r.title}</a>
          ))}
        </nav>
      </aside>
      <div className={s.main}>
        <header className={s.head}>
          <div className={s.group} role="group" aria-label="Тема">
            {themes.map((t) => <Button key={t.id} size="s" pressed={k.theme === t.id} onClick={() => k.setTheme(t.id)}>{t.title}</Button>)}
          </div>
          <div className={s.group} role="group" aria-label="Плотность">
            {densityOptions.map((d: Density) => <Button key={d} size="s" pressed={k.density === d} onClick={() => k.setDensity(d)}>{Math.round(d * 100)} %</Button>)}
          </div>
        </header>
        <main className={s.content}>{children}</main>
      </div>
    </div>
  )
}
