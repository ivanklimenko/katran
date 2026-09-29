import type { PageLifecycle } from '../shared/lib/lifecycle'
import { lifecycle as fxDocs } from '../pages/fx-docs'

/** Hash-роутер стенда. Внутри вместо него — адаптер к роутеру хоста: на вход экрана pageOpened, на уход pageClosed. */
export type Route = 'fx-docs'
export const routes: { id: Route; title: string }[] = [{ id: 'fx-docs', title: 'Валютные документы' }]
const lifecycles: Record<Route, PageLifecycle> = { 'fx-docs': fxDocs }

export const parseRoute = (): Route => {
  const h = location.hash.replace(/^#\/?/, '')
  return routes.find((r) => r.id === h)?.id ?? 'fx-docs'
}

export function startRouting(onRoute: (r: Route) => void): () => void {
  let current: Route | null = null
  const go = () => {
    const next = parseRoute()
    if (next === current) return
    if (current) lifecycles[current as Route].pageClosed()
    current = next
    lifecycles[next].pageOpened()
    onRoute(next)
  }
  window.addEventListener('hashchange', go)
  go()
  return () => {
    window.removeEventListener('hashchange', go)
    if (current) lifecycles[current].pageClosed()
    current = null
  }
}
