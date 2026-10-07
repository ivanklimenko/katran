import { act, screen, waitFor } from '@testing-library/react'
import { createEffect, createStore } from 'effector'
import { vi } from 'vitest'
import type { ApiError, FileResponse, PrintQuery } from '../../../shared/api'
import type { ActionsView, DetailAction } from '../../../shared/lib/detail'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { renderK } from '../../../shared/lib/test'
import { PRINT_PENDING_TEXT, createDocActions, type DocActions } from '../model/createDocActions'
import { useActionsOf } from './useActionsOf'

const act_ = (id: string, icon: DetailAction['icon']): DetailAction => ({ id, label: id, icon })
const REFRESH = act_('refresh', 'refresh')
const LINK = act_('link', 'link')
const DOWN = act_('down', 'download')
const ESID = act_('esid', 'doc')
const BAN = { ...act_('ban', 'ban'), danger: true }
const SWIFT = { label: 'Форма SWIFT', form: 'swift-form' }
const PRINT: DetailAction = { ...act_('print', 'print'), menu: [SWIFT] }

/** Окно-заглушка window.open: opener и document.title — то, что выставляет вид. */
const fakeWin = () => ({ opener: {} as unknown, closed: false, location: { href: '' }, close: vi.fn(), document: { title: '', body: { textContent: '' } } })

// UI-тесты apps/pi идут на глобальном scope: модель — новая в каждом тесте; порты — висящие, вызовы в журнале
function setup() {
  const prints: PrintQuery[] = []
  const messageFx = createEffect<string, FileResponse, ApiError>(() => new Promise<FileResponse>(() => undefined))
  const printFx = createEffect<PrintQuery, FileResponse, ApiError>((q) => { prints.push(q); return new Promise<FileResponse>(() => undefined) })
  const lifecycle = createPageLifecycle()
  const actions = createDocActions({ gridId: 'fx-docs', ports: { messageFx, printFx }, lifecycle, buildLink: () => 'L', fallbackName: createStore((id: string) => id) })
  const log = { refresh: [] as string[], link: [] as string[], down: [] as string[], print: [] as { id: string; form: string; win: Window | null }[] }
  const unwatch = [
    actions.refreshRequested.watch((id) => { log.refresh.push(id) }),
    actions.copyLink.watch((id) => { log.link.push(id) }),
    actions.download.watch((id) => { log.down.push(id) }),
    actions.print.watch((p) => { log.print.push(p) }),
  ]
  const ctx: Record<string, ActionsView> = {}
  function Probe({ a }: { a: DocActions }) {
    const of = useActionsOf(a)
    ctx.d1 = of('d1')
    ctx.d2 = of('d2')
    return null
  }
  renderK(<Probe a={actions} />)
  act(() => { lifecycle.pageOpened() })
  return { actions, ctx, log, prints, done: () => { unwatch.forEach((u) => { u() }) } }
}

describe('useActionsOf (план 2d §3.3)', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('run: refresh → refreshRequested(docId), link → copyLink, down → download', () => {
    const { ctx, log, done } = setup()
    act(() => { ctx.d1!.run(REFRESH) })
    act(() => { ctx.d2!.run(LINK) })
    act(() => { ctx.d1!.run(DOWN) })
    done()
    expect(log).toMatchObject({ refresh: ['d1'], link: ['d2'], down: ['d1'] })
    expect(ctx.d1!.pending('down')).toBe(true)
    expect(ctx.d2!.pending('down')).toBe(false)
  })

  it('run(print, form): window.open синхронно, opener = null, заголовок «Формируется…», затем print({ id, form, win })', () => {
    const { ctx, log, prints, done } = setup()
    const win = fakeWin()
    const open = vi.spyOn(window, 'open').mockImplementation(() => win as unknown as Window)
    // окно открыто к возврату из run, до любого await (жест пользователя ещё действует)
    let sync: unknown[][] = []
    act(() => { ctx.d1!.run(PRINT, SWIFT); sync = [...open.mock.calls] })
    expect(sync).toEqual([['', '_blank']])
    expect(win.opener).toBeNull()
    expect(win.document.title).toBe(PRINT_PENDING_TEXT)
    expect(PRINT_PENDING_TEXT).toBe('Формируется…')
    expect(win.document.body.textContent).toBe(PRINT_PENDING_TEXT)
    expect(log.print).toEqual([{ id: 'd1', form: 'swift-form', win }])
    expect(prints).toEqual([{ id: 'd1', form: 'swift-form' }])
    done()
  })

  it('run(print) при pending("print") — window.open не вызывается, запроса нет; без формы — тоже ничего', () => {
    const { ctx, log, prints, done } = setup()
    const open = vi.spyOn(window, 'open').mockImplementation(() => fakeWin() as unknown as Window)
    act(() => { ctx.d1!.run(PRINT, SWIFT) })
    expect(ctx.d1!.pending('print')).toBe(true)
    act(() => { ctx.d1!.run(PRINT, SWIFT) })
    act(() => { ctx.d2!.run(PRINT) })
    done()
    expect(open).toHaveBeenCalledTimes(1)
    expect(log.print).toHaveLength(1)
    expect(prints).toHaveLength(1)
  })

  it('run(print): window.open вернул null — print с win: null (модель скачает файл)', () => {
    const { ctx, log, done } = setup()
    vi.spyOn(window, 'open').mockImplementation(() => null)
    act(() => { ctx.d1!.run(PRINT, SWIFT) })
    done()
    expect(log.print).toEqual([{ id: 'd1', form: 'swift-form', win: null }])
  })

  it('run(esid), run(ban) — без действия (срез 2e)', () => {
    const { ctx, log, done } = setup()
    const open = vi.spyOn(window, 'open')
    act(() => { ctx.d1!.run(ESID) })
    act(() => { ctx.d1!.run(BAN) })
    done()
    expect(log).toEqual({ refresh: [], link: [], down: [], print: [] })
    expect(open).not.toHaveBeenCalled()
  })

  it('linkFallback — только у документа, чья ссылка не скопировалась; closeLinkFallback убирает', async () => {
    const { ctx, done } = setup()
    // в jsdom нет navigator.clipboard — запасной путь
    await act(async () => { ctx.d1!.run(LINK) })
    done()
    expect(ctx.d1!.linkFallback).toBe('L')
    expect(ctx.d2!.linkFallback).toBeNull()
    act(() => { ctx.d1!.closeLinkFallback() })
    expect(ctx.d1!.linkFallback).toBeNull()
  })

  it('рост $notice.count → announce(text); на монтировании объявления нет', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    try {
      const { ctx, done } = setup()
      expect(screen.getByRole('status')).toHaveTextContent('')
      await act(async () => { ctx.d1!.run(LINK) })
      done()
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Ссылка скопирована'))
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard')
    }
  })
})
