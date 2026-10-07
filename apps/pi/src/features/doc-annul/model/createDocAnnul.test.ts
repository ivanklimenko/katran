import { allSettled, createEffect, createStore, fork, type Store } from 'effector'
import { ApiError, type AnnulDecisionQuery, type AnnulQuery, type AnnulRejectQuery } from '../../../shared/api'
import type { AnnulState, AnnulStatus } from '../../../shared/lib/detail'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { ANNUL_HINT, ANNUL_TEXT, annulOutcome, createDocAnnul, type AnnulPromptKind } from './createDocAnnul'

type Doc = { id: string; status: string; annul: AnnulState | null }
type Pending<P, R> = { params: P; ok: (r: R) => void; fail: (e: ApiError) => void }

const LABEL: Record<string, string> = { IN_PROGRESS: 'В работе', REJECTED: 'Отвергнут' }
const annulOf = (status: AnnulStatus): AnnulState => ({
  status, who: 'Кузнецов Д. А.', when: '2026-10-07T09:15:00', reason: 'Дубликат', by: null, at: null, rejectReason: null, canConfirm: false,
})
const doc = (id: string, status: AnnulStatus | null, docStatus = 'IN_PROGRESS'): Doc => ({ id, status: docStatus, annul: status === null ? null : annulOf(status) })
const problem = (status: number, title: string, message?: string) =>
  new ApiError(status, { type: 'urn:katran:x', title, status, ...(message !== undefined ? { errors: [{ path: 'reason', code: 'VALIDATION', message }] } : {}) }, title)

/** Отложенный порт: вызовы копятся в calls, ответ каждого отпускается вручную (ok/fail). */
function deferred<P, R>() {
  const calls: Pending<P, R>[] = []
  const fx = createEffect<P, R, ApiError>((params) => new Promise<R>((ok, fail) => { calls.push({ params, ok, fail }) }))
  return { calls, fx }
}

/** Порты — отложенные заглушки; журналы событий — сторами (allSettled ждёт висящие эффекты — шаги копятся в fire). */
function setup(blocked?: Store<Record<string, true>>) {
  const { calls: annuls, fx: annulFx } = deferred<AnnulQuery, void>()
  const { calls: confirms, fx: confirmAnnulFx } = deferred<AnnulDecisionQuery, void>()
  const { calls: rejects, fx: rejectAnnulFx } = deferred<AnnulRejectQuery, void>()
  const { calls: details, fx: detailFx } = deferred<string, Doc>()
  const lifecycle = createPageLifecycle()
  const annul = createDocAnnul<Doc>({
    ports: { annulFx, confirmAnnulFx, rejectAnnulFx, detailFx },
    lifecycle,
    blockedDocs: blocked,
    statusLabelOf: (d) => LABEL[d.status] ?? d.status,
  })
  const $annulled = createStore<{ id: string; detail: Doc; kind: AnnulPromptKind }[]>([]).on(annul.docAnnulled, (l, x) => [...l, x])
  const $refresh = createStore<{ id: string }[]>([]).on(annul.refreshNeeded, (l, x) => [...l, x])
  const scope = fork()
  const inFlight: Promise<unknown>[] = []
  return {
    annul, scope, lifecycle, annuls, confirms, rejects, details,
    fire: (p: Promise<unknown>) => { inFlight.push(p) },
    settle: () => Promise.all(inFlight),
    annulled: () => scope.getState($annulled),
    refresh: () => scope.getState($refresh),
    prompt: () => scope.getState(annul.$prompt),
    done: () => scope.getState(annul.$done),
  }
}
type T = ReturnType<typeof setup>

/**
 * Prompt аннулирования документа с причиной и отправить — команда повисает в порте. Шаги копятся в fire: allSettled ждёт все
 * висящие эффекты scope (команды других документов), а события применяются синхронно.
 */
async function sendAnnul(t: T, id = '1', reason = 'Дубликат') {
  const { annul, scope } = t
  t.fire(allSettled(annul.annulRequested, { scope, params: id }))
  t.fire(allSettled(annul.reasonChanged, { scope, params: { docId: id, reason } }))
  t.fire(allSettled(annul.promptResult, { scope, params: { docId: id, ok: true } }))
}
/** Дать ответ команде, затем — подождать вызова detailFx. */
async function accept(t: T, calls: Pending<unknown, void>[], k = 0) {
  calls[k]!.ok(undefined)
  await new Promise((r) => setTimeout(r, 0))
}

describe('annulOutcome и константы (спека 2e §3.3, г8)', () => {
  it('ANNUL_TEXT и ANNUL_HINT — дословно', () => {
    expect(ANNUL_TEXT.done).toBe('Документ аннулирован')
    expect(ANNUL_TEXT.pending).toBe('Запрос на аннулирование отправлен на утверждение')
    expect(ANNUL_TEXT.confirmed).toBe('Аннулирование утверждено')
    expect(ANNUL_TEXT.rejected).toBe('Аннулирование отклонено')
    expect(ANNUL_TEXT.unchanged('В работе')).toBe('Команда отправлена — документ пока в статусе «В работе»')
    expect(ANNUL_TEXT.refreshFailed).toBe('Команда отправлена — не удалось обновить данные')
    expect(ANNUL_TEXT.conflict).toBe('Документ изменили — данные обновлены')
    expect(ANNUL_HINT.locked('Иванова М. П.')).toBe('Документ заблокирован: Иванова М. П.')
    expect(ANNUL_HINT.pending).toBe('Запрос на аннулирование ожидает утверждения')
    expect(ANNUL_HINT.done).toBe('Документ аннулирован')
    expect(ANNUL_HINT.status('Обработан')).toBe('Аннулирование недоступно для документа в статусе «Обработан»')
    expect(ANNUL_HINT.busy).toBe('Завершите текущую операцию с документом')
  })

  it('таблица kind × annul.status (+ null)', () => {
    const u = 'Команда отправлена — документ пока в статусе «В работе»'
    const table: [AnnulPromptKind, AnnulStatus | null, string][] = [
      ['annul', null, u], ['annul', 'pending', 'Запрос на аннулирование отправлен на утверждение'], ['annul', 'done', 'Документ аннулирован'], ['annul', 'rejected', u],
      ['confirm', null, u], ['confirm', 'pending', u], ['confirm', 'done', 'Аннулирование утверждено'], ['confirm', 'rejected', u],
      ['reject', null, u], ['reject', 'pending', u], ['reject', 'done', u], ['reject', 'rejected', 'Аннулирование отклонено'],
    ]
    for (const [kind, status, text] of table) expect([kind, status, annulOutcome(kind, status === null ? null : annulOf(status), 'В работе')]).toEqual([kind, status, text])
  })
})

describe('createDocAnnul (спека 2e §3.3)', () => {
  it('annulRequested — Prompt; причина из пробелов — запроса нет', async () => {
    const t = setup()
    const { annul, scope } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await allSettled(annul.annulRequested, { scope, params: '1' })
    expect(t.prompt()).toEqual({ '1': { kind: 'annul', when: null, reason: '', busy: false, error: null } })
    expect(scope.getState(annul.$busyDocs)).toEqual({ '1': true })
    await allSettled(annul.reasonChanged, { scope, params: { docId: '1', reason: '  ' } })
    expect(t.prompt()['1']?.reason).toBe('  ')
    await allSettled(annul.promptResult, { scope, params: { docId: '1', ok: true } })
    expect(t.annuls).toHaveLength(0)
    expect(t.prompt()['1']).toMatchObject({ busy: false, reason: '  ' })
  })

  it('экран закрыт — Prompt не открывается', async () => {
    const t = setup()
    await allSettled(t.annul.annulRequested, { scope: t.scope, params: '1' })
    expect(t.prompt()).toEqual({})
  })

  it('команда принята → detailFx (Prompt busy) → docAnnulled со свежей деталью, Prompt снят; итог по свежим данным', async () => {
    const cases: [Doc, string][] = [
      [doc('1', 'done', 'REJECTED'), 'Документ аннулирован'],
      [doc('1', 'pending'), 'Запрос на аннулирование отправлен на утверждение'],
      [doc('1', null), 'Команда отправлена — документ пока в статусе «В работе»'],
    ]
    for (const [fresh, text] of cases) {
      const t = setup()
      await allSettled(t.lifecycle.pageOpened, { scope: t.scope })
      await sendAnnul(t, '1', '  Дубликат  ')
      expect(t.annuls.map((c) => c.params)).toEqual([{ id: '1', reason: 'Дубликат' }])
      expect(t.prompt()['1']).toMatchObject({ busy: true, error: null })
      await accept(t, t.annuls)
      expect(t.details.map((c) => c.params)).toEqual(['1'])
      // пока идёт перезапрос — Prompt занят, отмена не действует
      expect(t.prompt()['1']?.busy).toBe(true)
      t.fire(allSettled(t.annul.promptResult, { scope: t.scope, params: { docId: '1', ok: false } }))
      expect(t.prompt()['1']?.busy).toBe(true)
      t.details[0]!.ok(fresh)
      await t.settle()
      expect(t.annulled()).toEqual([{ id: '1', detail: fresh, kind: 'annul' }])
      expect(t.prompt()).toEqual({})
      expect(t.done()).toEqual({ count: 1, text })
      expect(t.refresh()).toEqual([])
    }
  })

  it('перезапрос детали упал после принятой команды — Prompt снят, refreshNeeded, «не удалось обновить данные»', async () => {
    const t = setup()
    await allSettled(t.lifecycle.pageOpened, { scope: t.scope })
    await sendAnnul(t)
    await accept(t, t.annuls)
    t.details[0]!.fail(problem(500, 'Сбой сервера'))
    await t.settle()
    expect(t.prompt()).toEqual({})
    expect(t.refresh()).toEqual([{ id: '1' }])
    expect(t.done()).toEqual({ count: 1, text: ANNUL_TEXT.refreshFailed })
    expect(t.annulled()).toEqual([])
  })

  it('утвердить: запрос { id, when }, затем detailFx; done — «Аннулирование утверждено»; итог не наступил — unchanged', async () => {
    const t = setup()
    const { annul, scope } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await allSettled(annul.confirmRequested, { scope, params: { docId: '1', when: 'w1' } })
    expect(t.prompt()).toEqual({ '1': { kind: 'confirm', when: 'w1', reason: '', busy: false, error: null } })
    // утверждение без причины
    t.fire(allSettled(annul.promptResult, { scope, params: { docId: '1', ok: true } }))
    expect(t.confirms.map((c) => c.params)).toEqual([{ id: '1', when: 'w1' }])
    await accept(t, t.confirms)
    t.details[0]!.ok(doc('1', 'done', 'REJECTED'))
    await t.settle()
    expect(t.annulled()).toEqual([{ id: '1', detail: doc('1', 'done', 'REJECTED'), kind: 'confirm' }])
    expect(t.done()).toEqual({ count: 1, text: 'Аннулирование утверждено' })

    await allSettled(annul.confirmRequested, { scope, params: { docId: '1', when: 'w2' } })
    t.fire(allSettled(annul.promptResult, { scope, params: { docId: '1', ok: true } }))
    await accept(t, t.confirms, 1)
    t.details[1]!.ok(doc('1', 'pending'))
    await t.settle()
    expect(t.done()).toEqual({ count: 2, text: 'Команда отправлена — документ пока в статусе «В работе»' })
  })

  it('отклонить: причина обязательна, запрос { id, when, reason }; rejected — «Аннулирование отклонено»', async () => {
    const t = setup()
    const { annul, scope } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await allSettled(annul.rejectRequested, { scope, params: { docId: '1', when: 'w1' } })
    expect(t.prompt()['1']).toEqual({ kind: 'reject', when: 'w1', reason: '', busy: false, error: null })
    await allSettled(annul.promptResult, { scope, params: { docId: '1', ok: true } })
    expect(t.rejects).toHaveLength(0)
    await allSettled(annul.reasonChanged, { scope, params: { docId: '1', reason: ' Не дубликат ' } })
    t.fire(allSettled(annul.promptResult, { scope, params: { docId: '1', ok: true } }))
    expect(t.rejects.map((c) => c.params)).toEqual([{ id: '1', when: 'w1', reason: 'Не дубликат' }])
    expect(t.confirms).toHaveLength(0)
    await accept(t, t.rejects)
    const fresh: Doc = { ...doc('1', 'rejected'), status: 'IN_PROGRESS' }
    t.details[0]!.ok(fresh)
    await t.settle()
    expect(t.annulled()).toEqual([{ id: '1', detail: fresh, kind: 'reject' }])
    expect(t.done()).toEqual({ count: 1, text: 'Аннулирование отклонено' })
  })

  it('400 — error из errors[0].message, busy снят, Prompt открыт; 403 и 5xx — текст ошибки; повтор снимает ошибку', async () => {
    const t = setup()
    const { annul, scope } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await sendAnnul(t)
    t.annuls[0]!.fail(problem(400, 'Аннулирование отклонено', 'Причина — от 1 до 140 знаков'))
    await t.settle()
    expect(t.prompt()['1']).toEqual({ kind: 'annul', when: null, reason: 'Дубликат', busy: false, error: 'Причина — от 1 до 140 знаков' })
    // правка причины снимает ошибку
    await allSettled(annul.reasonChanged, { scope, params: { docId: '1', reason: 'Дубль' } })
    expect(t.prompt()['1']?.error).toBeNull()
    t.fire(allSettled(annul.promptResult, { scope, params: { docId: '1', ok: true } }))
    expect(t.prompt()['1']).toMatchObject({ busy: true, error: null })
    t.annuls[1]!.fail(problem(403, 'Документ заблокирован другим пользователем'))
    await t.settle()
    expect(t.prompt()['1']).toMatchObject({ busy: false, error: 'Документ заблокирован другим пользователем' })
    t.fire(allSettled(annul.promptResult, { scope, params: { docId: '1', ok: true } }))
    t.annuls[2]!.fail(problem(500, 'Сбой сервера'))
    await t.settle()
    expect(t.prompt()['1']).toMatchObject({ busy: false, error: 'Сбой сервера' })
    // отказ без текста — запасной текст, не пустая строка
    t.fire(allSettled(annul.promptResult, { scope, params: { docId: '1', ok: true } }))
    t.annuls[3]!.fail(new ApiError(500, null, ''))
    await t.settle()
    expect(t.prompt()['1']?.error).toBe('Не удалось выполнить действие')
    expect(t.details).toHaveLength(0)
    expect(t.done().count).toBe(0)
    expect(t.refresh()).toEqual([])
  })

  it('409 — Prompt снят, refreshNeeded, «Документ изменили — данные обновлены»; detailFx не вызывается', async () => {
    const t = setup()
    const { annul, scope } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await allSettled(annul.confirmRequested, { scope, params: { docId: '1', when: 'w1' } })
    t.fire(allSettled(annul.promptResult, { scope, params: { docId: '1', ok: true } }))
    t.confirms[0]!.fail(problem(409, 'Документ изменили'))
    await t.settle()
    expect(t.prompt()).toEqual({})
    expect(t.refresh()).toEqual([{ id: '1' }])
    expect(t.done()).toEqual({ count: 1, text: ANNUL_TEXT.conflict })
    expect(t.details).toHaveLength(0)
    expect(t.annulled()).toEqual([])
  })

  it('promptResult(false): при busy — игнор, без busy — Prompt закрыт; причина при busy не меняется', async () => {
    const t = setup()
    const { annul, scope } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await allSettled(annul.annulRequested, { scope, params: '1' })
    await allSettled(annul.promptResult, { scope, params: { docId: '1', ok: false } })
    expect(t.prompt()).toEqual({})
    expect(scope.getState(annul.$busyDocs)).toEqual({})
    await sendAnnul(t)
    t.fire(allSettled(annul.promptResult, { scope, params: { docId: '1', ok: false } }))
    t.fire(allSettled(annul.reasonChanged, { scope, params: { docId: '1', reason: 'x' } }))
    // повтор при busy — второго запроса нет
    t.fire(allSettled(annul.promptResult, { scope, params: { docId: '1', ok: true } }))
    expect(t.prompt()['1']).toMatchObject({ busy: true, reason: 'Дубликат' })
    expect(t.annuls).toHaveLength(1)
    t.annuls[0]!.fail(problem(500, 'Сбой'))
    await t.settle()
  })

  it('второй запрос того же документа при открытом Prompt — игнор; другой документ — свой Prompt', async () => {
    const t = setup()
    const { annul, scope } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await allSettled(annul.annulRequested, { scope, params: '1' })
    await allSettled(annul.reasonChanged, { scope, params: { docId: '1', reason: 'R' } })
    await allSettled(annul.annulRequested, { scope, params: '1' })
    await allSettled(annul.confirmRequested, { scope, params: { docId: '1', when: 'w' } })
    await allSettled(annul.rejectRequested, { scope, params: { docId: '1', when: 'w' } })
    expect(t.prompt()['1']).toEqual({ kind: 'annul', when: null, reason: 'R', busy: false, error: null })
    await allSettled(annul.confirmRequested, { scope, params: { docId: '2', when: 'w' } })
    expect(Object.keys(t.prompt()).sort()).toEqual(['1', '2'])
    expect(scope.getState(annul.$busyDocs)).toEqual({ '1': true, '2': true })
    // причина и итог чужого документа его Prompt не трогают
    await allSettled(annul.reasonChanged, { scope, params: { docId: '2', reason: 'x' } })
    expect(t.prompt()['1']?.reason).toBe('R')
  })

  it('документ в blockedDocs — запросы игнорируются; другой документ — нет (Review Focus 2)', async () => {
    const $blocked = createStore<Record<string, true>>({ '1': true })
    const t = setup($blocked)
    const { annul, scope } = t
    expect(scope.getState(annul.$blockedDocs)).toEqual({ '1': true })
    await allSettled(t.lifecycle.pageOpened, { scope })
    await allSettled(annul.annulRequested, { scope, params: '1' })
    await allSettled(annul.confirmRequested, { scope, params: { docId: '1', when: 'w' } })
    await allSettled(annul.rejectRequested, { scope, params: { docId: '1', when: 'w' } })
    expect(t.prompt()).toEqual({})
    await allSettled(annul.annulRequested, { scope, params: '2' })
    expect(Object.keys(t.prompt())).toEqual(['2'])
  })

  it('без blockedDocs — $blockedDocs пуст, блокировки нет', async () => {
    const t = setup()
    expect(t.scope.getState(t.annul.$blockedDocs)).toEqual({})
  })

  it('поздний ответ после pageClosed того же визита: docAnnulled выпущен, $prompt и $done не меняются (Review Focus 1)', async () => {
    const t = setup()
    const { scope } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await sendAnnul(t, '1')
    await sendAnnul(t, '2')
    await sendAnnul(t, '3')
    // '1' — команда принята, перезапрос в полёте; '2' и '3' — команды в полёте
    await accept(t, t.annuls, 0)
    t.fire(allSettled(t.lifecycle.pageClosed, { scope }))
    expect(t.prompt()).toEqual({})
    t.details[0]!.ok(doc('1', 'done', 'REJECTED'))
    t.annuls[1]!.ok(undefined)
    t.annuls[2]!.fail(problem(409, 'Документ изменили'))
    await new Promise((r) => setTimeout(r, 0))
    // команда '2' того же визита принята после ухода — деталь перезапрашивается (для кэша), Prompt не всплывает
    expect(t.details.map((c) => c.params)).toEqual(['1', '2'])
    t.details[1]!.fail(problem(500, 'Сбой'))
    await t.settle()
    expect(t.annulled()).toEqual([{ id: '1', detail: doc('1', 'done', 'REJECTED'), kind: 'annul' }])
    expect(t.prompt()).toEqual({})
    expect(t.done()).toEqual({ count: 0, text: '' })
    expect(t.refresh()).toEqual([])
  })

  it('ответ прошлого визита после возврата на экран — отброшен', async () => {
    const t = setup()
    const { annul, scope } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await sendAnnul(t, '1')
    await sendAnnul(t, '2')
    await accept(t, t.annuls, 0)
    t.fire(allSettled(t.lifecycle.pageClosed, { scope }))
    t.fire(allSettled(t.lifecycle.pageOpened, { scope }))
    // новый визит: новый Prompt того же документа
    t.fire(allSettled(annul.rejectRequested, { scope, params: { docId: '1', when: 'w' } }))
    expect(t.prompt()['1']?.kind).toBe('reject')
    t.details[0]!.ok(doc('1', 'done', 'REJECTED'))
    t.annuls[1]!.ok(undefined)
    await t.settle()
    // перезапроса по команде прошлого визита нет; деталь прошлого визита — не в кэш; Prompt нового визита на месте
    expect(t.details).toHaveLength(1)
    expect(t.annulled()).toEqual([])
    expect(t.prompt()['1']?.kind).toBe('reject')
    expect(t.done().count).toBe(0)
  })
})
