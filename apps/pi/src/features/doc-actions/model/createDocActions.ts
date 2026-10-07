import { attach, createEffect, createEvent, createStore, sample, type Event, type EventCallable, type Store } from 'effector'
import type { ActionPorts, ApiError, PrintQuery } from '../../../shared/api'
import { buildDocLink } from '../../../shared/lib/doc-link'
import type { PageLifecycle } from '../../../shared/lib/lifecycle'

export const PRINT_PENDING_TEXT = 'Формируется…'
export const PRINT_BLOCKED_TEXT = 'Браузер заблокировал вкладку — форма скачана'
export const LINK_COPIED_TEXT = 'Ссылка скопирована'
/** Отказ без текста (ни detail Problem, ни message) — на практике не встречается: ApiError всегда с message. */
export const ACTION_FAILED_TEXT = 'Действие не выполнено'

export type DocActionsConfig = {
  gridId: string
  ports: ActionPorts
  lifecycle: PageLifecycle
  /** Ссылка на документ; по умолчанию buildDocLink (defaultDocLink или подмена хоста configureDocLinks). */
  buildLink?: ((gridId: string, id: string) => string) | undefined
  /** Номер документа для запасного имени файла: '<номер>.txt' | '<номер>.xml'. */
  fallbackName: (id: string) => string
}

export type PrintCall = { id: string; form: string; win: Window | null }

export type DocActions = {
  /** Из вида; страница решает: охрана правки или сразу refresh. */
  refreshRequested: EventCallable<string>
  /** Выполнить обновление: страница → detail.refreshDoc + registry.refreshRequested. */
  refresh: Event<string>
  copyLink: EventCallable<string>
  download: EventCallable<string>
  /** win — окно, открытое видом синхронно в обработчике клика; null — браузер его заблокировал. */
  print: EventCallable<PrintCall>
  /** Действия в полёте: ключ `${id}:${actionId}`, actionId — 'link' | 'down' | 'print'; повтор в полёте игнорируется. */
  $pending: Store<Record<string, true>>
  /** Буфер обмена недоступен (нет API или отказ) — ссылка для ручного копирования. */
  $linkFallback: Store<string | null>
  /** Документ, чья ссылка в $linkFallback: вид показывает поле только в его drawer. */
  $linkFallbackDoc: Store<string | null>
  closeLinkFallback: EventCallable<void>
  /** Объявления: count растёт, text — LINK_COPIED_TEXT, PRINT_BLOCKED_TEXT или текст ошибки (detail Problem, иначе message). */
  $notice: Store<{ count: number; text: string }>
}

export type SaveFileQuery = { blob: Blob; name: string }
export type ShowInWindowQuery = { win: Window; blob: Blob }

export const pendingKey = (id: string, actionId: string): string => `${id}:${actionId}`

// Побочные эффекты — эффектами уровня модуля: тесты и стенды подменяют их через fork({ handlers }).

/** Записать текст в буфер обмена; нет Clipboard API (не https, старый браузер) или отказ — отказ эффекта. */
export const writeClipboardFx = createEffect<string, void, Error>(async (text) => {
  const clip = navigator.clipboard as Clipboard | undefined
  if (clip === undefined || typeof clip.writeText !== 'function') throw new Error('Буфер обмена недоступен')
  await clip.writeText(text)
})

/** Скачать файл: <a href=blobURL download=name>.click(); URL освобождается в следующем тике (загрузка уже начата). */
export const saveFileFx = createEffect<SaveFileQuery, void>(({ blob, name }) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => { URL.revokeObjectURL(url) }, 0)
})

/** Показать файл в окне печати: win.location.href = blobURL; результат — URL (живёт, пока жив экран). Окно уже закрыли — null. */
export const showInWindowFx = createEffect<ShowInWindowQuery, string | null>(({ win, blob }) => {
  if (win.closed) return null
  const url = URL.createObjectURL(blob)
  win.location.href = url
  return url
})

export const closeWindowFx = createEffect<Window, void>((win) => {
  if (!win.closed) win.close()
})

export const revokeUrlsFx = createEffect<string[], void>((urls) => {
  urls.forEach((u) => { URL.revokeObjectURL(u) })
})

/** Текст отказа для объявления (спека 2d §3.3): detail Problem, иначе message. */
const errorText = (e: ApiError): string => e.problem?.detail || e.message || ACTION_FAILED_TEXT

const add = (p: Record<string, true>, k: string): Record<string, true> => ({ ...p, [k]: true })
const without = (p: Record<string, true>, k: string): Record<string, true> => {
  if (!(k in p)) return p
  const next: Record<string, true> = {}
  Object.keys(p).forEach((x) => { if (x !== k) next[x] = true })
  return next
}

/** Имя PDF, если бек не прислал Content-Disposition: '<форма>-<номер>.pdf' (номер — fallbackName без расширения). */
const pdfName = (form: string, fallback: string): string => `${form}-${fallback.replace(/\.[^.]+$/, '')}.pdf`

/**
 * Действия лейна документа (план 2d §3.3): Обновить (событие для страницы), ссылка в буфер с запасным полем, скачать
 * сообщение, печатная форма во вкладке. Окно печати открывает вид синхронно в обработчике клика (иначе его заблокирует
 * браузер) и передаёт в print; модель кладёт в него PDF, при ошибке закрывает, при блокировке скачивает файл.
 * Blob URL печати освобождаются при уходе с экрана; запасная ссылка и $pending сбрасываются.
 */
export function createDocActions(cfg: DocActionsConfig): DocActions {
  const { gridId, ports, lifecycle, fallbackName } = cfg
  const build = cfg.buildLink ?? buildDocLink

  const refreshRequested = createEvent<string>()
  const copyLink = createEvent<string>()
  const download = createEvent<string>()
  const print = createEvent<PrintCall>()
  const closeLinkFallback = createEvent<void>()
  const noticed = createEvent<string>()
  const linkStarted = createEvent<{ id: string; url: string }>()
  const downloadStarted = createEvent<string>()
  const printStarted = createEvent<PrintCall>()
  const urlsReleased = createEvent<string[]>()

  const refresh = refreshRequested.map((id) => id)

  const copyFx = attach({ effect: writeClipboardFx, mapParams: ({ url }: { id: string; url: string }) => url })
  const messageFx = attach({ effect: ports.messageFx })
  const printFx = attach({ effect: ports.printFx, mapParams: ({ id, form }: PrintCall): PrintQuery => ({ id, form }) })
  const showFx = attach({ effect: showInWindowFx })

  const $pending = createStore<Record<string, true>>({})
    .on(linkStarted, (p, { id }) => add(p, pendingKey(id, 'link')))
    .on(copyFx.finally, (p, { params }) => without(p, pendingKey(params.id, 'link')))
    .on(downloadStarted, (p, id) => add(p, pendingKey(id, 'down')))
    .on(messageFx.finally, (p, { params }) => without(p, pendingKey(params, 'down')))
    .on(printStarted, (p, { id }) => add(p, pendingKey(id, 'print')))
    .on(printFx.finally, (p, { params }) => without(p, pendingKey(params.id, 'print')))
    .reset(lifecycle.pageClosed)
  const $fallback = createStore<{ docId: string; url: string } | null>(null)
    .on(copyFx.fail, (_, { params }) => ({ docId: params.id, url: params.url }))
    // скопировалось — поле этого документа больше не нужно; поле другого документа остаётся
    .on(copyFx.done, (f, { params }) => (f !== null && f.docId === params.id ? null : f))
    .reset(closeLinkFallback, lifecycle.pageClosed)
  const $notice = createStore({ count: 0, text: '' }).on(noticed, (n, text) => ({ count: n.count + 1, text }))
  const $printUrls = createStore<string[]>([])
    .on(showFx.doneData, (l, url) => (url === null ? l : [...l, url]))
    .on(urlsReleased, () => [])

  // Ссылка
  sample({
    clock: copyLink, source: $pending, filter: (p, id) => !p[pendingKey(id, 'link')],
    fn: (_, id) => ({ id, url: build(gridId, id) }), target: linkStarted,
  })
  sample({ clock: linkStarted, target: copyFx })
  sample({ clock: copyFx.done, fn: () => LINK_COPIED_TEXT, target: noticed })

  // Скачать сообщение
  sample({ clock: download, source: $pending, filter: (p, id) => !p[pendingKey(id, 'down')], fn: (_, id) => id, target: downloadStarted })
  sample({ clock: downloadStarted, target: messageFx })
  sample({ clock: messageFx.done, fn: ({ params, result }) => ({ blob: result.blob, name: result.name ?? fallbackName(params) }), target: saveFileFx })
  sample({ clock: messageFx.failData, fn: errorText, target: noticed })

  // Печать
  // одно чтение $pending на клик: printStarted тут же меняет $pending, второе чтение увидело бы уже свою же отметку
  const printed = sample({ clock: print, source: $pending, fn: (p, c) => ({ c, busy: Boolean(p[pendingKey(c.id, 'print')]) }) })
  sample({ clock: printed, filter: ({ busy }) => !busy, fn: ({ c }) => c, target: printStarted })
  // повтор в полёте: вид окно не открывает, но если открыл — лишнюю вкладку не оставляем
  sample({ clock: printed, filter: ({ busy, c }) => busy && c.win !== null, fn: ({ c }) => c.win as Window, target: closeWindowFx })
  sample({ clock: printStarted, target: printFx })
  sample({
    clock: printFx.done, filter: ({ params }) => params.win !== null,
    fn: ({ params, result }) => ({ win: params.win as Window, blob: result.blob }), target: showFx,
  })
  const blocked = sample({ clock: printFx.done, filter: ({ params }) => params.win === null })
  sample({ clock: blocked, fn: ({ params, result }) => ({ blob: result.blob, name: result.name ?? pdfName(params.form, fallbackName(params.id)) }), target: saveFileFx })
  sample({ clock: blocked, fn: () => PRINT_BLOCKED_TEXT, target: noticed })
  sample({ clock: printFx.fail, filter: ({ params }) => params.win !== null, fn: ({ params }) => params.win as Window, target: closeWindowFx })
  sample({ clock: printFx.failData, fn: errorText, target: noticed })

  // Уход с экрана: URL печати освобождаются (спека 2d §3.3); открытые вкладки PDF к этому времени уже загрузили
  sample({ clock: lifecycle.pageClosed, source: $printUrls, filter: (l) => l.length > 0, target: [urlsReleased, revokeUrlsFx] })

  return {
    refreshRequested, refresh, copyLink, download, print, $pending,
    $linkFallback: $fallback.map((f) => f?.url ?? null),
    $linkFallbackDoc: $fallback.map((f) => f?.docId ?? null),
    closeLinkFallback, $notice,
  }
}
