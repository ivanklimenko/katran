import type { PageLifecycle } from '../shared/lib/lifecycle'
import { docLinkOpened as fxDocLink, lifecycle as fxDocs } from '../pages/fx-docs'
import { docLinkOpened as rubDocLink, lifecycle as rubDocs } from '../pages/rub-docs'
import { docLinkOpened as nzrDocLink, lifecycle as nzrReport } from '../pages/nzr-report'

/** Hash-роутер стенда. Внутри вместо него — адаптер к роутеру хоста: на вход экрана pageOpened, на уход pageClosed. */
export type Route = 'fx-docs' | 'rub-docs' | 'nzr-report'
export const routes: { id: Route; title: string }[] = [
  { id: 'fx-docs', title: 'Валютные документы' },
  { id: 'rub-docs', title: 'Рублёвые документы' },
  { id: 'nzr-report', title: 'Отчёт НЗР' },
]
/** Экран маршрута: жизненный цикл и вход по ссылке на документ (?doc=). */
const screens: Record<Route, { lifecycle: PageLifecycle; docLinkOpened: (id: string) => void }> = {
  'fx-docs': { lifecycle: fxDocs, docLinkOpened: fxDocLink },
  'rub-docs': { lifecycle: rubDocs, docLinkOpened: rubDocLink },
  'nzr-report': { lifecycle: nzrReport, docLinkOpened: nzrDocLink },
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
 * На том же экране новая ссылка открывает документ; тот же doc при смене прочего хвоста — нет.
 * Явный повторный клик по ссылке на текущий URL снова открывает документ, не перезапуская экран.
 */
export function startRouting(onRoute: (r: Route) => void): () => void {
  let current: Route | null = null
  let linked: string | null = null
  const pendingLinks = new Set<number>()
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
  // При повторном клике по текущему URL hash не меняется и браузер не посылает hashchange.
  // Это новый явный запрос открыть документ, даже если после прошлой ссылки вручную открыли другой.
  const repeatLink = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download') || link.href !== location.href) return
    const target = link.getAttribute('target') ?? document.querySelector('base[target]')?.getAttribute('target') ?? ''
    if (target && target.toLowerCase() !== '_self') return
    const doc = parseDocParam()
    const route = current
    if (doc === null || route === null || parseRoute() !== route) return
    const href = location.href
    // Window или следующий listener на document ещё могут отменить переход. Микрозадача
    // между нативными listener недостаточна: ждём следующую задачу и проверяем решение снова.
    const timer = window.setTimeout(() => {
      pendingLinks.delete(timer)
      if (!event.defaultPrevented && current === route && location.href === href) screens[route].docLinkOpened(doc)
    }, 0)
    pendingLinks.add(timer)
  }
  document.addEventListener('click', repeatLink)
  window.addEventListener('hashchange', go)
  go()
  return () => {
    document.removeEventListener('click', repeatLink)
    for (const timer of pendingLinks) window.clearTimeout(timer)
    pendingLinks.clear()
    window.removeEventListener('hashchange', go)
    if (current) screens[current].lifecycle.pageClosed()
    current = null
  }
}
