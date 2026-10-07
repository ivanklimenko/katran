import { allSettled, createEffect, createStore, fork } from 'effector'
import { ApiError, type AccountItem, type AccountsQuery, type DecisionQuery, type EditQuery, type RejectQuery, type EditValue } from '../../../shared/api'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { CONFLICT_TEXT, DECISION_TEXT, REJECT_MAX, createDocEdit, editKey, editScope } from './createDocEdit'

type Doc = { id: string; rev: number }
type Pending<P, R> = { params: P; ok: (r: R) => void; fail: (e: ApiError) => void }

const lines = (...l: string[]): EditValue => ({ lines: l })
const upper = (v: EditValue): EditValue => (typeof v === 'string' ? v.trim().toUpperCase() : { lines: v.lines.map((l) => l.trim().toUpperCase()) })
const same = (a: EditValue, b: EditValue) => JSON.stringify(a) === JSON.stringify(b)
const ACC: AccountItem[] = [{ account: '40702840000000000001', ccy: 'USD', kind: 'Текущий' }]

/** Отложенный порт: вызовы копятся в calls, ответ каждого отпускается вручную (ok/fail). */
function deferred<P, R>() {
  const calls: Pending<P, R>[] = []
  const fx = createEffect<P, R, ApiError>((params) => new Promise<R>((ok, fail) => { calls.push({ params, ok, fail }) }))
  return { calls, fx }
}

/** Порты — отложенные заглушки: ответы отпускаются вручную; журналы событий — сторами (allSettled ждёт висящие эффекты — шаги копятся в fire). */
function setup() {
  const { calls: saves, fx: saveEditFx } = deferred<EditQuery, Doc>()
  const { calls: loads, fx: accountsFx } = deferred<AccountsQuery, AccountItem[]>()
  const { calls: confirms, fx: confirmEditFx } = deferred<DecisionQuery, Doc>()
  const { calls: rejects, fx: rejectEditFx } = deferred<RejectQuery, Doc>()
  const lifecycle = createPageLifecycle()
  const edit = createDocEdit<Doc>({
    ports: { saveEditFx, accountsFx, confirmEditFx, rejectEditFx },
    validate: (_t, v) => (typeof v === 'string' && v.includes('!') ? 'Недопустимый символ' : null),
    normalize: (_t, v) => upper(v),
    same,
    confirmTargets: ['valueDate'],
    lifecycle,
  })
  const $edited = createStore<{ id: string; detail: Doc }[]>([]).on(edit.docEdited, (l, x) => [...l, x])
  const $conflicts = createStore<{ id: string }[]>([]).on(edit.conflict, (l, x) => [...l, x])
  const scope = fork()
  const inFlight: Promise<unknown>[] = []
  return {
    edit, scope, saves, loads, confirms, rejects, lifecycle,
    fire: (p: Promise<unknown>) => { inFlight.push(p) },
    settle: () => Promise.all(inFlight),
    edited: () => scope.getState($edited),
    conflicts: () => scope.getState($conflicts),
  }
}

/** Открыть поле 57 документа u1, поправить черновик и сохранить — запрос повисает в порте. */
async function saveField(t: ReturnType<typeof setup>) {
  const { edit, scope, fire } = t
  await allSettled(edit.model.open, { scope, params: { key: 'u1:field:57', initial: lines('bank ag') } })
  await allSettled(edit.model.change, { scope, params: { key: 'u1:field:57', draft: lines('Bank AG', 'Zurich') } })
  fire(allSettled(edit.model.save, { scope }))
}

describe('createDocEdit (план 2c §3.2)', () => {
  it('сохранение: запрос порта { id, target, was, now }, docEdited с деталью ответа, $savedCount + 1', async () => {
    const t = setup()
    expect(editKey('u1', 'field:57')).toBe('u1:field:57')
    expect(editScope('u1')).toBe('u1:')
    const { edit, scope, saves } = t
    await allSettled(edit.model.open, { scope, params: { key: 'u1:field:57', initial: lines('bank ag') } })
    // только что открытый редактор чист: initial модели — нормализованное текущее
    expect(scope.getState(edit.model.$dirty)).toBe(false)
    await allSettled(edit.model.change, { scope, params: { key: 'u1:field:57', draft: lines('Bank AG', 'Zurich') } })
    t.fire(allSettled(edit.model.save, { scope }))
    // was — текущее как пришло с бека (бек сверяет его со своим), now — нормализованный черновик
    expect(saves.map((s) => s.params)).toEqual([{ id: 'u1', target: 'field:57', was: lines('bank ag'), now: lines('BANK AG', 'ZURICH') }])
    saves[0]!.ok({ id: 'u1', rev: 2 })
    await t.settle()
    expect(t.edited()).toEqual([{ id: 'u1', detail: { id: 'u1', rev: 2 } }])
    expect(scope.getState(edit.$savedCount)).toBe(1)
    expect(scope.getState(edit.model.$editing)).toBeNull()
  })

  it('was — текущее принятого моделью open: повторный open того же ключа и отклонённый Prompt его не подменяют', async () => {
    const t = setup()
    const { edit, scope, saves } = t
    await allSettled(edit.model.open, { scope, params: { key: 'u1:field:57', initial: lines('bank ag') } })
    // ключ уже открыт — модель open игнорирует; was остаётся от принятого открытия
    await allSettled(edit.model.open, { scope, params: { key: 'u1:field:57', initial: lines('bank ag 2') } })
    await allSettled(edit.model.change, { scope, params: { key: 'u1:field:57', draft: lines('Bank AG', 'Zurich') } })
    // грязный черновик: open другого ключа — Prompt; отказ — открытие не принято
    await allSettled(edit.model.open, { scope, params: { key: 'u1:refOut', initial: 'ref1' } })
    await allSettled(edit.model.confirmResult, { scope, params: false })
    t.fire(allSettled(edit.model.save, { scope }))
    expect(saves[0]?.params).toEqual({ id: 'u1', target: 'field:57', was: lines('bank ag'), now: lines('BANK AG', 'ZURICH') })
    saves[0]!.ok({ id: 'u1', rev: 2 })
    await t.settle()
    // открытие после «Отменить правку» в Prompt принимается — was этого открытия
    await allSettled(edit.model.open, { scope, params: { key: 'u1:field:57', initial: lines('bank ag') } })
    await allSettled(edit.model.change, { scope, params: { key: 'u1:field:57', draft: lines('X') } })
    await allSettled(edit.model.open, { scope, params: { key: 'u1:refOut', initial: 'ref 1 ' } })
    await allSettled(edit.model.confirmResult, { scope, params: true })
    await allSettled(edit.model.change, { scope, params: { key: 'u1:refOut', draft: 'ref2' } })
    t.fire(allSettled(edit.model.save, { scope }))
    expect(saves[1]?.params).toEqual({ id: 'u1', target: 'refOut', was: 'ref 1 ', now: 'REF2' })
    saves[1]!.ok({ id: 'u1', rev: 3 })
    await t.settle()
  })

  it('open при открытом Prompt модель игнорирует — was остаётся от открытия, ждущего ответа Prompt', async () => {
    const t = setup()
    const { edit, scope, saves } = t
    await allSettled(edit.model.open, { scope, params: { key: 'u1:field:57', initial: lines('bank ag') } })
    await allSettled(edit.model.change, { scope, params: { key: 'u1:field:57', draft: lines('X') } })
    await allSettled(edit.model.open, { scope, params: { key: 'u1:refOut', initial: 'ref 1 ' } })
    // Prompt «Отменить правку?» открыт — этот open модель игнорирует
    await allSettled(edit.model.open, { scope, params: { key: 'u1:field:70', initial: lines('payment') } })
    await allSettled(edit.model.confirmResult, { scope, params: true })
    expect(scope.getState(edit.model.$editing)?.key).toBe('u1:refOut')
    await allSettled(edit.model.change, { scope, params: { key: 'u1:refOut', draft: 'ref2' } })
    t.fire(allSettled(edit.model.save, { scope }))
    expect(saves[0]?.params).toEqual({ id: 'u1', target: 'refOut', was: 'ref 1 ', now: 'REF2' })
    saves[0]!.ok({ id: 'u1', rev: 2 })
    await t.settle()
  })

  it('↺ (submit): was — текущее как пришло, now — нормализованное исходное', async () => {
    const t = setup()
    const { edit, scope, saves } = t
    t.fire(allSettled(edit.model.submit, { scope, params: { key: 'u1:field:70', initial: lines('payment ok'), draft: lines('invoice 1') } }))
    expect(saves.map((s) => s.params)).toEqual([{ id: 'u1', target: 'field:70', was: lines('payment ok'), now: lines('INVOICE 1') }])
    saves[0]!.ok({ id: 'u1', rev: 2 })
    await t.settle()
    expect(t.edited()).toHaveLength(1)
  })

  it('отказ без своего редактора (↺, уход во время сохранения) — $unsaved «Изменения не сохранены: …»; отказ открытого редактора — строкой у него', async () => {
    const t = setup()
    const { edit, scope, saves } = t
    const bad = (message: string) => new ApiError(400, { type: 'urn:katran:validation', title: 'Правка отклонена', status: 400, errors: [{ path: 'now', code: 'VALIDATION', message }] }, message)
    // ↺ — редактора нет
    t.fire(allSettled(edit.model.submit, { scope, params: { key: 'u1:refOut', initial: 'ref1', draft: '' } }))
    saves[0]!.fail(bad('Референс не может быть пустым'))
    await t.settle()
    expect(scope.getState(edit.$unsaved)).toEqual({ count: 1, text: 'Изменения не сохранены: Референс не может быть пустым' })
    // отказ открытого редактора того же ключа — только $saveError
    await saveField(t)
    saves[1]!.fail(bad('Строка 2: недопустимый символ'))
    await t.settle()
    expect(scope.getState(edit.model.$saveError)).toBe('Строка 2: недопустимый символ')
    expect(scope.getState(edit.$unsaved).count).toBe(1)
    // уход во время сохранения: редактор закрыт — отказ объявляется (409 — текстом конфликта)
    t.fire(allSettled(edit.model.save, { scope }))
    t.fire(allSettled(edit.model.requestLeave, { scope, params: { scope: 'u1:', next: { kind: 'close', slot: 'a' } } }))
    expect(scope.getState(edit.model.$editing)).toBeNull()
    saves[2]!.fail(new ApiError(409, { type: 'urn:katran:edit-conflict', title: 'Документ изменили', status: 409 }, 'Документ изменили'))
    await t.settle()
    expect(scope.getState(edit.$unsaved)).toEqual({ count: 2, text: 'Изменения не сохранены: Документ изменили — откройте заново' })
  })

  it('409 → $saveError CONFLICT_TEXT, conflict { id }, редактор и черновик на месте', async () => {
    const t = setup()
    const { edit, scope, saves } = t
    await saveField(t)
    saves[0]!.fail(new ApiError(409, { type: 'urn:katran:edit-conflict', title: 'Документ изменили', status: 409 }, 'Документ изменили'))
    await t.settle()
    expect(CONFLICT_TEXT).toBe('Документ изменили — откройте заново')
    expect(scope.getState(edit.model.$saveError)).toBe('Документ изменили — откройте заново')
    expect(t.conflicts()).toEqual([{ id: 'u1' }])
    expect(scope.getState(edit.model.$editing)?.key).toBe('u1:field:57')
    expect(scope.getState(edit.model.$drafts)['u1:field:57']).toEqual(lines('Bank AG', 'Zurich'))
    expect(t.edited()).toEqual([])
  })

  it('400 VALIDATION — текст первой ошибки problem.errors', async () => {
    const t = setup()
    const { edit, scope, saves } = t
    await saveField(t)
    saves[0]!.fail(new ApiError(400, {
      type: 'urn:katran:validation', title: 'Правка отклонена', status: 400,
      errors: [{ path: 'now', code: 'VALIDATION', message: 'Строка 2: недопустимый символ' }, { path: 'now', code: 'VALIDATION', message: 'вторая' }],
    }, 'Правка отклонена: Строка 2: недопустимый символ'))
    await t.settle()
    expect(scope.getState(edit.model.$saveError)).toBe('Строка 2: недопустимый символ')
    expect(t.conflicts()).toEqual([])
  })

  it('400 с пустым текстом ошибки — не пустая строка', async () => {
    const t = setup()
    const { edit, scope, saves } = t
    await saveField(t)
    saves[0]!.fail(new ApiError(400, { type: 'urn:katran:validation', title: 'Правка отклонена', status: 400, errors: [{ path: 'now', code: 'VALIDATION', message: '' }] }, ''))
    await t.settle()
    expect(scope.getState(edit.model.$saveError)).toBe('Не удалось сохранить изменения')
  })

  it('valueDate — Prompt commit перед запросом; refOut — без', async () => {
    const t = setup()
    const { edit, scope, saves } = t
    await allSettled(edit.model.open, { scope, params: { key: 'u1:valueDate', initial: '2026-10-06' } })
    await allSettled(edit.model.change, { scope, params: { key: 'u1:valueDate', draft: '2026-10-07' } })
    await allSettled(edit.model.save, { scope })
    expect(scope.getState(edit.model.$confirm)).toEqual({ kind: 'commit', key: 'u1:valueDate' })
    expect(saves).toHaveLength(0)
    t.fire(allSettled(edit.model.confirmResult, { scope, params: true }))
    expect(saves.map((s) => s.params)).toEqual([{ id: 'u1', target: 'valueDate', was: '2026-10-06', now: '2026-10-07' }])
    saves[0]!.ok({ id: 'u1', rev: 2 })
    await t.settle()

    await allSettled(edit.model.open, { scope, params: { key: 'u1:refOut', initial: 'ref1' } })
    await allSettled(edit.model.change, { scope, params: { key: 'u1:refOut', draft: 'ref2' } })
    t.fire(allSettled(edit.model.save, { scope }))
    expect(scope.getState(edit.model.$confirm)).toBeNull()
    expect(saves[1]?.params).toEqual({ id: 'u1', target: 'refOut', was: 'ref1', now: 'REF2' })
    saves[1]!.ok({ id: 'u1', rev: 3 })
    await t.settle()
  })

  it('открытие правки accKt грузит счета один раз; ошибка — повтор loadAccounts', async () => {
    const t = setup()
    const { edit, scope, loads } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    t.fire(allSettled(edit.model.open, { scope, params: { key: 'u1:accKt', initial: '40702840000000000009' } }))
    expect(loads.map((l) => l.params)).toEqual([{ id: 'u1', side: 'kt' }])
    expect(scope.getState(edit.$accounts)).toEqual({ 'u1:kt': { state: 'loading', items: [], error: null } })
    // грузится — повтор без запроса
    t.fire(allSettled(edit.loadAccounts, { scope, params: { id: 'u1', side: 'kt' } }))
    expect(loads).toHaveLength(1)
    loads[0]!.fail(new ApiError(500, null, 'Сбой сервера'))
    await t.settle()
    expect(scope.getState(edit.$accounts)['u1:kt']).toEqual({ state: 'error', items: [], error: 'Сбой сервера' })

    t.fire(allSettled(edit.loadAccounts, { scope, params: { id: 'u1', side: 'kt' } }))
    expect(loads).toHaveLength(2)
    expect(scope.getState(edit.$accounts)['u1:kt']?.state).toBe('loading')
    loads[1]!.ok(ACC)
    await t.settle()
    expect(scope.getState(edit.$accounts)['u1:kt']).toEqual({ state: 'ready', items: ACC, error: null })

    // готовый — без запроса: повторное открытие правки и loadAccounts
    await allSettled(edit.model.cancel, { scope })
    await allSettled(edit.model.open, { scope, params: { key: 'u1:accKt', initial: '40702840000000000009' } })
    await allSettled(edit.loadAccounts, { scope, params: { id: 'u1', side: 'kt' } })
    expect(loads).toHaveLength(2)
    // другие цели счета не грузят
    await allSettled(edit.model.cancel, { scope })
    await allSettled(edit.model.open, { scope, params: { key: 'u1:refOut', initial: 'REF' } })
    expect(loads).toHaveLength(2)
  })

  it('счета не грузятся, пока экран закрыт', async () => {
    const t = setup()
    const { edit, scope, loads } = t
    await allSettled(edit.loadAccounts, { scope, params: { id: 'u1', side: 'kt' } })
    await allSettled(edit.model.open, { scope, params: { key: 'u1:accDt', initial: '30110840700000001842' } })
    expect(loads).toHaveLength(0)
    expect(scope.getState(edit.$accounts)).toEqual({})
  })

  it('ответ счетов после ухода с экрана не пишется; pageClosed — reset модели и счетов', async () => {
    const t = setup()
    const { edit, scope, loads } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    t.fire(allSettled(edit.model.open, { scope, params: { key: 'u1:accDt', initial: '30110840700000001842' } }))
    expect(loads.map((l) => l.params)).toEqual([{ id: 'u1', side: 'dt' }])
    t.fire(allSettled(edit.model.change, { scope, params: { key: 'u1:accDt', draft: '30114840900000000517' } }))

    t.fire(allSettled(t.lifecycle.pageClosed, { scope }))
    expect(scope.getState(edit.model.$editing)).toBeNull()
    expect(scope.getState(edit.model.$drafts)).toEqual({})
    expect(scope.getState(edit.$accounts)).toEqual({})
    // ответ прошлого визита — после возврата на экран тоже не пишется
    t.fire(allSettled(t.lifecycle.pageOpened, { scope }))
    loads[0]!.ok(ACC)
    await t.settle()
    expect(scope.getState(edit.$accounts)).toEqual({})
  })
})

/** Экран открыт (решения принимаются только на открытом экране); запрос решения по полю 57 документа u1. */
async function ask(t: ReturnType<typeof setup>, kind: 'confirm' | 'reject', docId = 'u1') {
  const { edit, scope } = t
  const q = { docId, target: 'field:57', when: '2026-09-23T10:42:00' }
  await allSettled(kind === 'confirm' ? edit.confirmRequested : edit.rejectRequested, { scope, params: q })
}
const problem = (status: number, title: string, message?: string) =>
  new ApiError(status, { type: 'urn:katran:x', title, status, ...(message !== undefined ? { errors: [{ path: 'reason', code: 'VALIDATION', message }] } : {}) }, title)

describe('createDocEdit: вторая рука (план 2d §3.3)', () => {
  it('константы контракта', () => {
    expect(REJECT_MAX).toBe(140)
    expect(DECISION_TEXT).toEqual({ confirmed: 'Правка утверждена', rejected: 'Правка отклонена', conflict: 'Правку уже обработали — данные обновлены' })
  })

  it('утвердить: Prompt → запрос { id, target, when }, busy; успех — решение снято, docEdited, $decided «Правка утверждена»', async () => {
    const t = setup()
    const { edit, scope, confirms } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await ask(t, 'confirm')
    expect(scope.getState(edit.$decision)).toEqual({ u1: { kind: 'confirm', target: 'field:57', when: '2026-09-23T10:42:00', reason: '', busy: false, error: null } })
    expect(confirms).toHaveLength(0)
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } }))
    expect(confirms.map((c) => c.params)).toEqual([{ id: 'u1', target: 'field:57', when: '2026-09-23T10:42:00' }])
    expect(scope.getState(edit.$decision).u1?.busy).toBe(true)
    // повтор при busy — второго запроса нет
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } }))
    expect(confirms).toHaveLength(1)
    confirms[0]!.ok({ id: 'u1', rev: 5 })
    await t.settle()
    expect(scope.getState(edit.$decision)).toEqual({})
    expect(t.edited()).toEqual([{ id: 'u1', detail: { id: 'u1', rev: 5 } }])
    expect(scope.getState(edit.$decided)).toEqual({ count: 1, text: 'Правка утверждена' })
    // решение — не сохранение: «Изменения сохранены» не объявляется
    expect(scope.getState(edit.$savedCount)).toBe(0)
  })

  it('отклонить: причина уходит после trim; успех — «Правка отклонена»', async () => {
    const t = setup()
    const { edit, scope, rejects, confirms } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await ask(t, 'reject')
    expect(scope.getState(edit.$decision).u1?.kind).toBe('reject')
    await allSettled(edit.reasonChanged, { scope, params: { docId: 'u1', text: '  BIC  ' } })
    expect(scope.getState(edit.$decision).u1?.reason).toBe('  BIC  ')
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } }))
    expect(rejects.map((r) => r.params)).toEqual([{ id: 'u1', target: 'field:57', when: '2026-09-23T10:42:00', reason: 'BIC' }])
    expect(confirms).toHaveLength(0)
    rejects[0]!.ok({ id: 'u1', rev: 6 })
    await t.settle()
    expect(scope.getState(edit.$decision)).toEqual({})
    expect(t.edited()).toEqual([{ id: 'u1', detail: { id: 'u1', rev: 6 } }])
    expect(scope.getState(edit.$decided)).toEqual({ count: 1, text: 'Правка отклонена' })
  })

  it('причина из пробелов — запроса нет, Prompt на месте', async () => {
    const t = setup()
    const { edit, scope, rejects } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await ask(t, 'reject')
    await allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } })
    await allSettled(edit.reasonChanged, { scope, params: { docId: 'u1', text: '   ' } })
    await allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } })
    expect(rejects).toHaveLength(0)
    expect(scope.getState(edit.$decision).u1).toMatchObject({ kind: 'reject', reason: '   ', busy: false })
  })

  it('403 — текст ошибки в решении, busy снят, Prompt остаётся; 400 — первая ошибка problem.errors', async () => {
    const t = setup()
    const { edit, scope, confirms, rejects } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await ask(t, 'confirm')
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } }))
    confirms[0]!.fail(problem(403, 'Свою правку утверждает другой сотрудник'))
    await t.settle()
    expect(scope.getState(edit.$decision).u1).toEqual({
      kind: 'confirm', target: 'field:57', when: '2026-09-23T10:42:00', reason: '', busy: false, error: 'Свою правку утверждает другой сотрудник',
    })
    expect(scope.getState(edit.$decided).count).toBe(0)
    expect(t.conflicts()).toEqual([])
    // ошибку можно повторить: новый запрос — ошибка снята на время полёта
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } }))
    expect(confirms).toHaveLength(2)
    expect(scope.getState(edit.$decision).u1).toMatchObject({ busy: true, error: null })
    confirms[1]!.fail(problem(500, 'Сбой сервера'))
    await t.settle()
    expect(scope.getState(edit.$decision).u1?.error).toBe('Сбой сервера')

    await allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: false } })
    await ask(t, 'reject')
    await allSettled(edit.reasonChanged, { scope, params: { docId: 'u1', text: 'x' } })
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } }))
    rejects[0]!.fail(problem(400, 'Правка не принята', 'Причина длиннее 140 символов'))
    await t.settle()
    expect(scope.getState(edit.$decision).u1?.error).toBe('Причина длиннее 140 символов')
  })

  it('отказ решения без текста — запасной текст, не пустая строка', async () => {
    const t = setup()
    const { edit, scope, confirms } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await ask(t, 'confirm')
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } }))
    confirms[0]!.fail(new ApiError(400, { type: 'urn:katran:validation', title: 'Правка не принята', status: 400, errors: [{ path: 'when', code: 'VALIDATION', message: '' }] }, ''))
    await t.settle()
    expect(scope.getState(edit.$decision).u1).toMatchObject({ busy: false, error: 'Не удалось выполнить действие' })
  })

  it('409 — решение снято, conflict { id }, $decided «Правку уже обработали — данные обновлены»', async () => {
    const t = setup()
    const { edit, scope, confirms } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await ask(t, 'confirm')
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } }))
    confirms[0]!.fail(problem(409, 'Документ изменили'))
    await t.settle()
    expect(scope.getState(edit.$decision)).toEqual({})
    expect(t.conflicts()).toEqual([{ id: 'u1' }])
    expect(scope.getState(edit.$decided)).toEqual({ count: 1, text: 'Правку уже обработали — данные обновлены' })
    expect(t.edited()).toEqual([])
  })

  it('отмена: при busy игнорируется, без busy — решение снято', async () => {
    const t = setup()
    const { edit, scope, confirms } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await ask(t, 'confirm')
    await allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: false } })
    expect(scope.getState(edit.$decision)).toEqual({})
    await ask(t, 'confirm')
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } }))
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: false } }))
    // причина при busy не меняется: в полёте уже та, что ушла
    t.fire(allSettled(edit.reasonChanged, { scope, params: { docId: 'u1', text: 'x' } }))
    expect(scope.getState(edit.$decision).u1).toMatchObject({ busy: true, reason: '' })
    confirms[0]!.ok({ id: 'u1', rev: 2 })
    await t.settle()
  })

  it('одна операция над документом: открытый редактор документа или сохранение в полёте — запрос решения игнорируется; другой документ — работает', async () => {
    const t = setup()
    const { edit, scope, saves } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await allSettled(edit.model.open, { scope, params: { key: 'u1:refOut', initial: 'ref1' } })
    await ask(t, 'confirm')
    await ask(t, 'reject')
    expect(scope.getState(edit.$decision)).toEqual({})
    await ask(t, 'confirm', 'u2')
    expect(Object.keys(scope.getState(edit.$decision))).toEqual(['u2'])
    await allSettled(edit.decisionResult, { scope, params: { docId: 'u2', ok: false } })
    // сохранение в полёте (редактор уже закрыт уходом) — решение не начинается ни в каком документе
    await allSettled(edit.model.change, { scope, params: { key: 'u1:refOut', draft: 'ref2' } })
    t.fire(allSettled(edit.model.save, { scope }))
    t.fire(allSettled(edit.model.requestLeave, { scope, params: { scope: 'u1:', next: { kind: 'close', slot: 'a' } } }))
    expect(scope.getState(edit.model.$editing)).toBeNull()
    expect(scope.getState(edit.model.$saving)).toBe(true)
    // allSettled ждёт висящее сохранение — шаги копятся в fire
    t.fire(ask(t, 'confirm'))
    t.fire(ask(t, 'confirm', 'u2'))
    expect(scope.getState(edit.$decision)).toEqual({})
    saves[0]!.ok({ id: 'u1', rev: 2 })
    await t.settle()
    // решение уже открыто — второй запрос по документу его не подменяет
    await ask(t, 'confirm')
    await ask(t, 'reject')
    expect(scope.getState(edit.$decision).u1?.kind).toBe('confirm')
  })

  it('экран закрыт — решение не начинается', async () => {
    const t = setup()
    await ask(t, 'confirm')
    expect(t.scope.getState(t.edit.$decision)).toEqual({})
  })

  it('поздний ответ решения после pageClosed: $decision пуст, $decided не растёт; docEdited выпускается (кэш фильтрует закрытый экран сам)', async () => {
    const t = setup()
    const { edit, scope, confirms, rejects } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await ask(t, 'confirm')
    await ask(t, 'reject', 'u2')
    await allSettled(edit.reasonChanged, { scope, params: { docId: 'u2', text: 'BIC' } })
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } }))
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u2', ok: true } }))
    t.fire(allSettled(t.lifecycle.pageClosed, { scope }))
    expect(scope.getState(edit.$decision)).toEqual({})
    confirms[0]!.ok({ id: 'u1', rev: 7 })
    rejects[0]!.fail(problem(409, 'Документ изменили'))
    await t.settle()
    expect(scope.getState(edit.$decision)).toEqual({})
    expect(scope.getState(edit.$decided)).toEqual({ count: 0, text: '' })
    expect(t.edited()).toEqual([{ id: 'u1', detail: { id: 'u1', rev: 7 } }])
    expect(t.conflicts()).toEqual([])
  })

  it('ответ решения прошлого визита после возврата на экран — не принимается', async () => {
    const t = setup()
    const { edit, scope, confirms } = t
    await allSettled(t.lifecycle.pageOpened, { scope })
    await ask(t, 'confirm')
    t.fire(allSettled(edit.decisionResult, { scope, params: { docId: 'u1', ok: true } }))
    t.fire(allSettled(t.lifecycle.pageClosed, { scope }))
    t.fire(allSettled(t.lifecycle.pageOpened, { scope }))
    t.fire(ask(t, 'reject'))
    expect(scope.getState(edit.$decision).u1?.kind).toBe('reject')
    confirms[0]!.ok({ id: 'u1', rev: 7 })
    await t.settle()
    // новое решение нового визита не снято чужим ответом; деталь прошлого визита — не в кэш
    expect(scope.getState(edit.$decision).u1?.kind).toBe('reject')
    expect(scope.getState(edit.$decided).count).toBe(0)
    expect(t.edited()).toEqual([])
  })
})
