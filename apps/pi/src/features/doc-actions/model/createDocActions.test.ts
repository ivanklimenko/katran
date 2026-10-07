import { allSettled, createEffect, fork } from 'effector'
import { vi } from 'vitest'
import { ApiError, type FileResponse, type PrintQuery } from '../../../shared/api'
import { configureDocLinks, defaultDocLink } from '../../../shared/lib/doc-link'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import {
  LINK_COPIED_TEXT, PRINT_BLOCKED_TEXT, closeWindowFx, createDocActions, revokeUrlsFx, saveFileFx, showInWindowFx, writeClipboardFx,
} from './createDocActions'

type Pending<P, R> = { params: P; ok: (r: R) => void; fail: (e: ApiError) => void }

/** Отложенный порт: вызовы копятся в calls, ответ каждого отпускается вручную (ok/fail). */
function deferred<P, R>() {
  const calls: Pending<P, R>[] = []
  const fx = createEffect<P, R, ApiError>((params) => new Promise<R>((ok, fail) => { calls.push({ params, ok, fail }) }))
  return { calls, fx }
}

const blob = (text: string) => new Blob([text])
const notFound = new ApiError(404, { type: 'urn:katran:not-found', title: 'Не найдено', status: 404, detail: 'Печатная форма недоступна' }, 'Не найдено: Печатная форма недоступна')
/** Окно-заглушка: только то, чего касается модель. */
const fakeWin = () => ({ closed: false, location: { href: '' }, close: vi.fn() }) as unknown as Window

/**
 * Порты — отложенные заглушки; побочные эффекты (буфер, файл, окно, освобождение URL) — заглушки fork handlers с журналом.
 * clipboard — поведение writeClipboardFx в тесте.
 */
function setup(o: { buildLink?: (gridId: string, id: string) => string; clipboard?: 'ok' | 'fail' } = {}) {
  const { calls: messages, fx: messageFx } = deferred<string, FileResponse>()
  const { calls: prints, fx: printFx } = deferred<PrintQuery, FileResponse>()
  const lifecycle = createPageLifecycle()
  const actions = createDocActions({
    gridId: 'fx-docs',
    ports: { messageFx, printFx },
    lifecycle,
    buildLink: o.buildLink,
    fallbackName: (id) => `N-${id}.txt`,
  })
  const log = { copied: [] as string[], saved: [] as { blob: Blob; name: string }[], shown: [] as { win: Window; blob: Blob }[], closed: [] as Window[], revoked: [] as string[][] }
  let n = 0
  const clip = { fail: o.clipboard === 'fail' }
  const scope = fork({
    handlers: [
      [writeClipboardFx, async (text: string) => { if (clip.fail) throw new Error('NotAllowedError'); log.copied.push(text) }],
      [saveFileFx, (p: { blob: Blob; name: string }) => { log.saved.push(p) }],
      [showInWindowFx, (p: { win: Window; blob: Blob }) => { log.shown.push(p); n += 1; return `blob:print-${n}` }],
      [closeWindowFx, (w: Window) => { log.closed.push(w) }],
      [revokeUrlsFx, (urls: string[]) => { log.revoked.push(urls) }],
    ],
  })
  const inFlight: Promise<unknown>[] = []
  return {
    actions, scope, messages, prints, lifecycle, log, clip,
    fire: (p: Promise<unknown>) => { inFlight.push(p) },
    settle: () => Promise.all(inFlight),
  }
}

describe('createDocActions (план 2d §3.3)', () => {
  it('refreshRequested(x) → refresh(x): охрану черновика решает страница', async () => {
    const { actions, scope } = setup()
    const got: string[] = []
    const unwatch = actions.refresh.watch((id) => { got.push(id) })
    await allSettled(actions.refreshRequested, { scope, params: 'x' })
    unwatch()
    expect(got).toEqual(['x'])
  })

  it('copyLink: успех буфера — ссылка buildLink(gridId, id) в буфере, объявление «Ссылка скопирована», запасного поля нет', async () => {
    const { actions, scope, log } = setup({ buildLink: (g, id) => `https://h/${g}/${id}` })
    await allSettled(actions.copyLink, { scope, params: 'x' })
    expect(log.copied).toEqual(['https://h/fx-docs/x'])
    expect(scope.getState(actions.$notice)).toEqual({ count: 1, text: LINK_COPIED_TEXT })
    expect(LINK_COPIED_TEXT).toBe('Ссылка скопирована')
    expect(scope.getState(actions.$linkFallback)).toBeNull()
    expect(scope.getState(actions.$pending)).toEqual({})
  })

  it('copyLink: отказ буфера — $linkFallback = ссылка, без объявления; closeLinkFallback → null', async () => {
    const { actions, scope } = setup({ buildLink: (g, id) => `https://h/${g}/${id}`, clipboard: 'fail' })
    await allSettled(actions.copyLink, { scope, params: 'x' })
    expect(scope.getState(actions.$linkFallback)).toBe('https://h/fx-docs/x')
    expect(scope.getState(actions.$linkFallbackDoc)).toBe('x')
    expect(scope.getState(actions.$notice).count).toBe(0)
    await allSettled(actions.closeLinkFallback, { scope })
    expect(scope.getState(actions.$linkFallback)).toBeNull()
    expect(scope.getState(actions.$linkFallbackDoc)).toBeNull()
  })

  it('copyLink: успешное копирование того же документа убирает его запасное поле, другого — не трогает', async () => {
    const t = setup({ buildLink: (g, id) => `https://h/${g}/${id}`, clipboard: 'fail' })
    await allSettled(t.actions.copyLink, { scope: t.scope, params: 'x' })
    expect(t.scope.getState(t.actions.$linkFallback)).toBe('https://h/fx-docs/x')
    t.clip.fail = false
    await allSettled(t.actions.copyLink, { scope: t.scope, params: 'y' })
    expect(t.scope.getState(t.actions.$linkFallback)).toBe('https://h/fx-docs/x')
    await allSettled(t.actions.copyLink, { scope: t.scope, params: 'x' })
    expect(t.scope.getState(t.actions.$linkFallback)).toBeNull()
    expect(t.scope.getState(t.actions.$notice)).toEqual({ count: 2, text: LINK_COPIED_TEXT })
  })

  it('copyLink без buildLink — buildDocLink: подмена configureDocLinks действует и на уже созданную модель', async () => {
    const { actions, scope, log } = setup()
    try {
      configureDocLinks({ build: (g, id) => `host:${g}:${id}` })
      await allSettled(actions.copyLink, { scope, params: 'a/b' })
    } finally {
      configureDocLinks({ build: defaultDocLink })
    }
    await allSettled(actions.copyLink, { scope, params: 'a/b' })
    expect(log.copied).toEqual(['host:fx-docs:a/b', defaultDocLink('fx-docs', 'a/b')])
  })

  it('writeClipboardFx без своей заглушки: нет navigator.clipboard — отказ, запасное поле', async () => {
    const lifecycle = createPageLifecycle()
    const { fx: messageFx } = deferred<string, FileResponse>()
    const { fx: printFx } = deferred<PrintQuery, FileResponse>()
    const actions = createDocActions({ gridId: 'fx-docs', ports: { messageFx, printFx }, lifecycle, buildLink: () => 'L', fallbackName: (id) => id })
    expect('clipboard' in navigator && navigator.clipboard !== undefined).toBe(false)
    const scope = fork()
    await allSettled(actions.copyLink, { scope, params: 'x' })
    expect(scope.getState(actions.$linkFallback)).toBe('L')
  })

  it('download: messageFx(id), $pending[id:down] в полёте, повтор в полёте — без второго запроса; файл с именем ответа', async () => {
    const t = setup()
    const { actions, scope, messages, log } = t
    t.fire(allSettled(actions.download, { scope, params: 'x' }))
    expect(messages.map((m) => m.params)).toEqual(['x'])
    expect(scope.getState(actions.$pending)).toEqual({ 'x:down': true })
    t.fire(allSettled(actions.download, { scope, params: 'x' }))
    expect(messages).toHaveLength(1)
    const b = blob('{1:F01}')
    messages[0]!.ok({ blob: b, name: 'MT103-812345.txt' })
    await t.settle()
    expect(log.saved).toEqual([{ blob: b, name: 'MT103-812345.txt' }])
    expect(scope.getState(actions.$pending)).toEqual({})
  })

  it('download: ответ без имени — fallbackName(id); ошибка — объявление detail Problem, файла нет', async () => {
    const t = setup()
    const { actions, scope, messages, log } = t
    t.fire(allSettled(actions.download, { scope, params: 'x' }))
    messages[0]!.ok({ blob: blob('a'), name: null })
    await t.settle()
    expect(log.saved.map((s) => s.name)).toEqual(['N-x.txt'])
    t.fire(allSettled(actions.download, { scope, params: 'y' }))
    messages[1]!.fail(new ApiError(500, { type: 'urn:katran:error', title: 'Ошибка', status: 500, detail: 'Сообщение не сформировано' }, 'Ошибка: Сообщение не сформировано'))
    await t.settle()
    expect(log.saved).toHaveLength(1)
    expect(scope.getState(actions.$notice)).toEqual({ count: 1, text: 'Сообщение не сформировано' })
    expect(scope.getState(actions.$pending)).toEqual({})
  })

  it('ошибка без Problem — объявление message ошибки', async () => {
    const t = setup()
    t.fire(allSettled(t.actions.download, { scope: t.scope, params: 'x' }))
    t.messages[0]!.fail(new ApiError(502, null, 'Ошибка запроса (статус 502)'))
    await t.settle()
    expect(t.scope.getState(t.actions.$notice).text).toBe('Ошибка запроса (статус 502)')
  })

  it('print: успех — PDF в открытом окне (showInWindowFx), $pending[id:print] до ответа, повтор в полёте закрывает лишнее окно без запроса', async () => {
    const t = setup()
    const { actions, scope, prints, log } = t
    const win = fakeWin()
    t.fire(allSettled(actions.print, { scope, params: { id: 'x', form: 'swift-form', win } }))
    expect(prints.map((p) => p.params)).toEqual([{ id: 'x', form: 'swift-form' }])
    expect(scope.getState(actions.$pending)).toEqual({ 'x:print': true })
    const extra = fakeWin()
    t.fire(allSettled(actions.print, { scope, params: { id: 'x', form: 'payment-order', win: extra } }))
    expect(prints).toHaveLength(1)
    expect(log.closed).toEqual([extra])
    const b = blob('%PDF')
    prints[0]!.ok({ blob: b, name: 'swift.pdf' })
    await t.settle()
    expect(log.shown).toEqual([{ win, blob: b }])
    expect(log.saved).toEqual([])
    expect(scope.getState(actions.$pending)).toEqual({})
    expect(scope.getState(actions.$notice).count).toBe(0)
  })

  it('print: win === null (вкладку заблокировали) — PDF скачан файлом, объявление PRINT_BLOCKED_TEXT', async () => {
    const t = setup()
    const { actions, scope, prints, log } = t
    t.fire(allSettled(actions.print, { scope, params: { id: 'x', form: 'swift-form', win: null } }))
    const b = blob('%PDF')
    prints[0]!.ok({ blob: b, name: null })
    await t.settle()
    expect(log.shown).toEqual([])
    expect(log.saved).toEqual([{ blob: b, name: 'swift-form-N-x.pdf' }])
    expect(PRINT_BLOCKED_TEXT).toBe('Браузер заблокировал вкладку — форма скачана')
    expect(scope.getState(actions.$notice)).toEqual({ count: 1, text: PRINT_BLOCKED_TEXT })
  })

  it('print: 404 — открытое окно закрыто, объявление detail Problem', async () => {
    const t = setup()
    const { actions, scope, prints, log } = t
    const win = fakeWin()
    t.fire(allSettled(actions.print, { scope, params: { id: 'x', form: 'collection-order', win } }))
    prints[0]!.fail(notFound)
    await t.settle()
    expect(log.closed).toEqual([win])
    expect(log.shown).toEqual([])
    expect(scope.getState(actions.$notice)).toEqual({ count: 1, text: 'Печатная форма недоступна' })
    expect(scope.getState(actions.$pending)).toEqual({})
  })

  it('pageClosed: blob URL печати освобождены, $pending и запасная ссылка сброшены', async () => {
    const t = setup({ clipboard: 'fail', buildLink: () => 'L' })
    const { actions, scope, prints, messages, log, lifecycle } = t
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(actions.copyLink, { scope, params: 'x' })
    t.fire(allSettled(actions.print, { scope, params: { id: 'x', form: 'swift-form', win: fakeWin() } }))
    prints[0]!.ok({ blob: blob('1'), name: null })
    t.fire(allSettled(actions.print, { scope, params: { id: 'y', form: 'swift-form', win: fakeWin() } }))
    prints[1]!.ok({ blob: blob('2'), name: null })
    await t.settle()
    t.fire(allSettled(actions.download, { scope, params: 'z' }))
    expect(scope.getState(actions.$pending)).toEqual({ 'z:down': true })
    // allSettled ждёт висящий download — уход с экрана запускаем без ожидания и смотрим сразу
    t.fire(allSettled(lifecycle.pageClosed, { scope }))
    expect(log.revoked).toEqual([['blob:print-1', 'blob:print-2']])
    expect(scope.getState(actions.$pending)).toEqual({})
    expect(scope.getState(actions.$linkFallback)).toBeNull()
    messages[0]!.ok({ blob: blob('m'), name: null })
    await t.settle()
    // освобождённые не освобождаются повторно
    await allSettled(lifecycle.pageClosed, { scope })
    expect(log.revoked).toEqual([['blob:print-1', 'blob:print-2']])
  })
})

describe('побочные эффекты doc-actions (настоящие обработчики)', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('saveFileFx: <a download=name href=blobURL>.click(), URL освобождается в следующем тике', async () => {
    vi.useFakeTimers()
    try {
      const create = vi.fn(() => 'blob:file-1')
      const revoke = vi.fn()
      Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
      const clicks: { href: string; download: string }[] = []
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        clicks.push({ href: this.getAttribute('href') ?? '', download: this.download })
      })
      const b = blob('x')
      await saveFileFx({ blob: b, name: 'MT103.txt' })
      expect(create).toHaveBeenCalledWith(b)
      expect(clicks).toEqual([{ href: 'blob:file-1', download: 'MT103.txt' }])
      expect(document.querySelector('a[download]')).toBeNull()
      expect(revoke).not.toHaveBeenCalled()
      vi.runAllTimers()
      expect(revoke).toHaveBeenCalledWith('blob:file-1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('showInWindowFx: win.location.href = blob URL, результат — URL; окно уже закрыто — URL не создаётся', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:print-x'), revokeObjectURL: vi.fn() })
    const win = fakeWin()
    expect(await showInWindowFx({ win, blob: blob('%PDF') })).toBe('blob:print-x')
    expect(win.location.href).toBe('blob:print-x')
    const gone = { ...fakeWin(), closed: true } as unknown as Window
    expect(await showInWindowFx({ win: gone, blob: blob('%PDF') })).toBeNull()
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('closeWindowFx закрывает окно; revokeUrlsFx освобождает каждый URL', async () => {
    const revoke = vi.fn()
    Object.assign(URL, { revokeObjectURL: revoke })
    const win = fakeWin()
    await closeWindowFx(win)
    expect(win.close).toHaveBeenCalled()
    await revokeUrlsFx(['blob:a', 'blob:b'])
    expect(revoke.mock.calls).toEqual([['blob:a'], ['blob:b']])
  })

  it('writeClipboardFx: navigator.clipboard.writeText(text); отказ API — отказ эффекта', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    try {
      await writeClipboardFx('L')
      expect(writeText).toHaveBeenCalledWith('L')
      writeText.mockRejectedValueOnce(new Error('NotAllowedError'))
      await expect(writeClipboardFx('L')).rejects.toThrow('NotAllowedError')
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })
})
