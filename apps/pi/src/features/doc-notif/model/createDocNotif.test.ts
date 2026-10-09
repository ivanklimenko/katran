import { allSettled, createEffect, createStore, fork, type EventCallable } from 'effector'
import { ApiError, type NotifMessage, type ResendQuery } from '../../../shared/api'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { COPIED_TEXT, COPY_FAILED, RESEND_TEXT, createDocNotif } from './createDocNotif'

type Pending<P, R> = { params: P; ok: (r: R) => void; fail: (e: ApiError) => void }

/** Отложенный порт: вызовы копятся в calls, ответ каждого отпускается вручную (ok/fail). */
function deferred<P, R>() {
  const calls: Pending<P, R>[] = []
  const fx = createEffect<P, R, ApiError>((params) => new Promise<R>((ok, fail) => { calls.push({ params, ok, fail }) }))
  return { calls, fx }
}
const problem = (status: number, title: string, detail?: string) =>
  new ApiError(status, { type: 'urn:katran:x', title, status, ...(detail !== undefined ? { detail } : {}) }, detail !== undefined ? `${title}: ${detail}` : title)
const MSG: NotifMessage = { contentType: 'application/json', body: '{"a":1}' }
const tick = () => new Promise<void>((r) => setTimeout(r, 0))

function setup() {
  const { calls: resends, fx: resendFx } = deferred<ResendQuery, unknown>()
  const { calls: messages, fx: messageFx } = deferred<{ id: string; nid: string }, NotifMessage>()
  const lifecycle = createPageLifecycle()
  const notif = createDocNotif({ ports: { resendFx, messageFx }, lifecycle })
  const $resent = createStore<{ id: string; data: unknown }[]>([]).on(notif.resent, (l, x) => [...l, x])
  const $conflicts = createStore<{ id: string }[]>([]).on(notif.resendConflict, (l, x) => [...l, x])
  const scope = fork()
  // allSettled ждёт висящие эффекты scope — шаги не дожидаемся: события применяются синхронно
  const fire = <P>(unit: EventCallable<P>, params?: P) => { void allSettled(unit, { scope, params: params as P }) }
  return {
    notif, scope, lifecycle, resends, messages, fire,
    prompt: () => scope.getState(notif.$resendPrompt),
    busy: () => scope.getState(notif.$resendBusy),
    notice: () => scope.getState(notif.$notice),
    message: () => scope.getState(notif.$message),
    resent: () => scope.getState($resent),
    conflicts: () => scope.getState($conflicts),
  }
}
type T = ReturnType<typeof setup>

async function opened(t: T) { await allSettled(t.lifecycle.pageOpened, { scope: t.scope }) }

describe('createDocNotif: переотправка (спека 2e §3.3, §4 п. 10, г11)', () => {
  it('resendRequested без nid — Prompt «все»; с nid и n — одна', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.resendRequested, { docId: '1' })
    expect(t.prompt()).toEqual({ docId: '1', nid: null, n: null })
    t.fire(t.notif.resendResult, { docId: '1', ok: false })
    t.fire(t.notif.resendRequested, { docId: '1', nid: 'n2', n: 2 })
    expect(t.prompt()).toEqual({ docId: '1', nid: 'n2', n: 2 })
  })

  it('resendResult ok: false — Prompt закрыт, запроса нет', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.resendRequested, { docId: '1' })
    t.fire(t.notif.resendResult, { docId: '1', ok: false })
    expect(t.prompt()).toBeNull()
    expect(t.resends).toHaveLength(0)
    expect(t.busy()).toEqual({})
  })

  it('ok: true (все) — busy «*», resendFx({ id }); Prompt открыт до ответа', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.resendRequested, { docId: '1' })
    t.fire(t.notif.resendResult, { docId: '1', ok: true })
    expect(t.busy()).toEqual({ 1: '*' })
    expect(t.resends.map((c) => c.params)).toEqual([{ id: '1' }])
    expect('nid' in t.resends[0]!.params).toBe(false)
    expect(t.prompt()).toEqual({ docId: '1', nid: null, n: null })
  })

  it('ok: true (одна) — busy nid, resendFx({ id, nid })', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.resendRequested, { docId: '1', nid: 'n2', n: 2 })
    t.fire(t.notif.resendResult, { docId: '1', ok: true })
    expect(t.busy()).toEqual({ 1: 'n2' })
    expect(t.resends.map((c) => c.params)).toEqual([{ id: '1', nid: 'n2' }])
  })

  it('в полёте: ok: false и повторный ok игнорируются; второй resendRequested документа (любой nid) — игнор', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.resendRequested, { docId: '1', nid: 'n2', n: 2 })
    t.fire(t.notif.resendResult, { docId: '1', ok: true })
    t.fire(t.notif.resendResult, { docId: '1', ok: false })
    t.fire(t.notif.resendResult, { docId: '1', ok: true })
    expect(t.prompt()).toEqual({ docId: '1', nid: 'n2', n: 2 })
    t.fire(t.notif.resendRequested, { docId: '1' })
    t.fire(t.notif.resendRequested, { docId: '1', nid: 'n3', n: 3 })
    expect(t.prompt()).toEqual({ docId: '1', nid: 'n2', n: 2 })
    expect(t.resends).toHaveLength(1)
  })

  it('открытый Prompt не подменяется запросом другого документа', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.resendRequested, { docId: '1' })
    t.fire(t.notif.resendRequested, { docId: '2', nid: 'n1', n: 1 })
    expect(t.prompt()).toEqual({ docId: '1', nid: null, n: null })
  })

  it('успех — resent({ id, data }), объявление RESEND_TEXT, Prompt закрыт, busy снят', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.resendRequested, { docId: '1' })
    t.fire(t.notif.resendResult, { docId: '1', ok: true })
    t.resends[0]!.ok({ items: ['новая попытка'] })
    await tick()
    expect(t.resent()).toEqual([{ id: '1', data: { items: ['новая попытка'] } }])
    expect(t.notice()).toEqual({ count: 1, text: RESEND_TEXT })
    expect(t.prompt()).toBeNull()
    expect(t.busy()).toEqual({})
  })

  it('409 — resendConflict({ id }), объявление — текст Problem (detail), Prompt закрыт', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.resendRequested, { docId: '1' })
    t.fire(t.notif.resendResult, { docId: '1', ok: true })
    t.resends[0]!.fail(problem(409, 'Конфликт', 'Повторная переотправка — подождите'))
    await tick()
    expect(t.conflicts()).toEqual([{ id: '1' }])
    expect(t.notice()).toEqual({ count: 1, text: 'Повторная переотправка — подождите' })
    expect(t.prompt()).toBeNull()
    expect(t.busy()).toEqual({})
    expect(t.resent()).toEqual([])
  })

  it('5xx — объявление текста (без detail — message), Prompt закрыт, конфликта нет', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.resendRequested, { docId: '1' })
    t.fire(t.notif.resendResult, { docId: '1', ok: true })
    t.resends[0]!.fail(new ApiError(500, null, 'Ошибка запроса (статус 500)'))
    await tick()
    expect(t.notice()).toEqual({ count: 1, text: 'Ошибка запроса (статус 500)' })
    expect(t.conflicts()).toEqual([])
    expect(t.prompt()).toBeNull()
    expect(t.busy()).toEqual({})
  })

  it('на закрытом экране запрос игнорируется', async () => {
    const t = setup()
    t.fire(t.notif.resendRequested, { docId: '1' })
    expect(t.prompt()).toBeNull()
  })

  it('pageClosed — Prompt, busy сброшены; поздний ответ прошлого визита не выпускает resent и объявления', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.resendRequested, { docId: '1' })
    t.fire(t.notif.resendResult, { docId: '1', ok: true })
    t.fire(t.lifecycle.pageClosed)
    expect(t.prompt()).toBeNull()
    expect(t.busy()).toEqual({})
    t.fire(t.lifecycle.pageOpened)
    t.fire(t.notif.resendRequested, { docId: '1' })
    t.fire(t.notif.resendResult, { docId: '1', ok: true })
    t.resends[0]!.ok({ items: [] })
    await tick()
    expect(t.resent()).toEqual([])
    expect(t.notice().count).toBe(0)
    // busy нового визита старый ответ не снял
    expect(t.busy()).toEqual({ 1: '*' })
  })
})

describe('createDocNotif: исходное сообщение (спека 2e §3.3, §4 п. 11)', () => {
  it('openMessage — loading, затем ready с сообщением', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.openMessage, { docId: '1', nid: 'n2', n: 2 })
    expect(t.message()).toEqual({ docId: '1', nid: 'n2', n: 2, state: 'loading', message: null, error: null })
    expect(t.messages.map((c) => c.params)).toEqual([{ id: '1', nid: 'n2' }])
    t.messages[0]!.ok(MSG)
    await tick()
    expect(t.message()).toEqual({ docId: '1', nid: 'n2', n: 2, state: 'ready', message: MSG, error: null })
  })

  it('ошибка — error с текстом; retryMessage — запрос заново (loading → ready)', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.openMessage, { docId: '1', nid: 'n2', n: 2 })
    t.messages[0]!.fail(problem(500, 'Сбой', 'Сообщение недоступно'))
    await tick()
    expect(t.message()).toEqual({ docId: '1', nid: 'n2', n: 2, state: 'error', message: null, error: 'Сообщение недоступно' })
    t.fire(t.notif.retryMessage)
    expect(t.message()).toMatchObject({ state: 'loading', error: null })
    expect(t.messages.map((c) => c.params)).toEqual([{ id: '1', nid: 'n2' }, { id: '1', nid: 'n2' }])
    t.messages[1]!.ok(MSG)
    await tick()
    expect(t.message()).toMatchObject({ state: 'ready', message: MSG })
  })

  it('retryMessage без ошибки (загрузка, готово, окна нет) — без запроса', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.retryMessage)
    t.fire(t.notif.openMessage, { docId: '1', nid: 'n2', n: 2 })
    t.fire(t.notif.retryMessage)
    expect(t.messages).toHaveLength(1)
  })

  it('closeMessage — null; ответ для закрытого окна отброшен', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.openMessage, { docId: '1', nid: 'n2', n: 2 })
    t.fire(t.notif.closeMessage)
    expect(t.message()).toBeNull()
    t.messages[0]!.ok(MSG)
    await tick()
    expect(t.message()).toBeNull()
  })

  it('ответ окна другого nid отброшен; повторно открытое окно того же nid принимает только свой ответ', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.openMessage, { docId: '1', nid: 'n2', n: 2 })
    t.fire(t.notif.openMessage, { docId: '1', nid: 'n3', n: 3 })
    t.messages[0]!.ok(MSG)
    await tick()
    expect(t.message()).toMatchObject({ nid: 'n3', state: 'loading' })
    t.messages[1]!.fail(problem(500, 'Сбой', 'Нет сообщения'))
    await tick()
    expect(t.message()).toMatchObject({ nid: 'n3', state: 'error', error: 'Нет сообщения' })
    // закрыть и открыть то же окно: старый ответ (того же nid) не ложится в новое
    t.fire(t.notif.openMessage, { docId: '1', nid: 'n2', n: 2 })
    t.fire(t.notif.closeMessage)
    t.fire(t.notif.openMessage, { docId: '1', nid: 'n2', n: 2 })
    t.messages[2]!.fail(problem(500, 'Сбой', 'Старый'))
    await tick()
    expect(t.message()).toMatchObject({ nid: 'n2', state: 'loading' })
  })

  it('на закрытом экране окно не открывается; pageClosed закрывает окно, поздний ответ не ложится', async () => {
    const t = setup()
    t.fire(t.notif.openMessage, { docId: '1', nid: 'n2', n: 2 })
    expect(t.message()).toBeNull()
    await opened(t)
    t.fire(t.notif.openMessage, { docId: '1', nid: 'n2', n: 2 })
    t.fire(t.lifecycle.pageClosed)
    expect(t.message()).toBeNull()
    t.fire(t.lifecycle.pageOpened)
    t.messages[0]!.ok(MSG)
    await tick()
    expect(t.message()).toBeNull()
  })
})

describe('createDocNotif: объявления копирования', () => {
  it('copied(true) — COPIED_TEXT, copied(false) — COPY_FAILED; count растёт', async () => {
    const t = setup()
    await opened(t)
    t.fire(t.notif.copied, true)
    expect(t.notice()).toEqual({ count: 1, text: COPIED_TEXT })
    t.fire(t.notif.copied, false)
    expect(t.notice()).toEqual({ count: 2, text: COPY_FAILED })
  })

  it('тексты дословно (контракт 2e)', () => {
    expect(RESEND_TEXT).toBe('Нотификация переотправлена')
    expect(COPIED_TEXT).toBe('Скопировано')
    expect(COPY_FAILED).toBe('Не удалось скопировать — выделите текст')
  })
})
