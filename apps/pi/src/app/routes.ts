import type { PageLifecycle } from '../shared/lib/lifecycle'
import { docLinkOpened as fxDocLink, lifecycle as fxDocs } from '../pages/fx-docs'
import { docLinkOpened as rubDocLink, lifecycle as rubDocs } from '../pages/rub-docs'

/** Hash-роутер стенда. Внутри вместо него — адаптер к роутеру хоста: на вход экрана pageOpened, на уход pageClosed. */
export type Route = 'fx-docs' | 'rub-docs'
export const routes: { id: Route; title: string }[] = [
  { id: 'fx-docs', title: 'Валютные документы' },
  { id: 'rub-docs', title: 'Рублёвые документы' },
]
/** Экран маршрута: жизненный цикл и вход по ссылке на документ (?doc=). */
const screens: Record<Route, { lifecycle: PageLifecycle; docLinkOpened: (id: string) => void }> = {
  'fx-docs': { lifecycle: fxDocs, docLinkOpened: fxDocLink },
  'rub-docs': { lifecycle: rubDocs, docLinkOpened: rubDocLink },
}

/** Маршрут — hash до «?»: хвост #/rub-docs?x не мешает (регуляторы стенда читаются из location.search, не из hash). */
export const parseRoute = (): Route => {
  const h = location.hash.replace(/^#\/?/, '').replace(/\?.*$/, '')
  return routes.find((r) => r.id === h)?.id ?? 'fx-docs'
}

/** Документ из ссылки — параметр doc хвоста hash (#/fx-docs?doc=a%2Fb → 'a/b'); нет или пуст — null. */
export const parseDocParam = (): string | null => {
  const q = location.hash.indexOf('?')
  if (q < 0) return null
  const doc = new URLSearchParams(location.hash.slice(q + 1)).get('doc')
  return doc === null || doc === '' ? null : doc
}

/**
 * Вход на экран — pageOpened, затем docLinkOpened, если в адресе есть ?doc= (спека 2d §3.6); doc из адреса не стирается.
 * На том же экране новая ссылка (вставили в адресную строку) открывает документ; тот же doc при смене прочего хвоста — нет.
 */
export function startRouting(onRoute: (r: Route) => void): () => void {
  let current: Route | null = null
  let linked: string | null = null
  const go = () => {
    const next = parseRoute()
    const doc = parseDocParam()
    if (next === current) {
      if (doc !== null && doc !== linked) screens[next].docLinkOpened(doc)
      linked = doc
      return
    }
    if (current) screens[current].lifecycle.pageClosed()
    current = next
    linked = doc
    screens[next].lifecycle.pageOpened()
    if (doc !== null) screens[next].docLinkOpened(doc)
    onRoute(next)
  }
  window.addEventListener('hashchange', go)
  go()
  return () => {
    window.removeEventListener('hashchange', go)
    if (current) screens[current].lifecycle.pageClosed()
    current = null
  }
}
