import { allSettled, createEffect, createStore, fork } from 'effector'
import { createEditModel, type EditFailed, type EditModelConfig, type EditSaved, type SaveQuery } from './createEditModel'

type D = { lines: string[] }
type Call = { q: SaveQuery<D>; ok: (r: string) => void; fail: (e: Error) => void; done: boolean }

/** Дать эффектам и их done/fail пройти через очередь микрозадач. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0))

const A: D = { lines: ['A'] }
const B: D = { lines: ['B'] }
const C: D = { lines: ['C'] }

/**
 * Модель на отложенном saveFx: ответы отпускаются вручную по ключу (resolve / reject), журналы saved / failed / leave — сторами.
 * allSettled ждёт все эффекты scope, поэтому шаги при висящем запросе идут через fire (промис копится и ожидается в settle после ответа).
 */
const setup = (over: Partial<EditModelConfig<D, string, Error>> = {}) => {
  const calls: Call[] = []
  const saveFx = createEffect<SaveQuery<D>, string, Error>((q) => new Promise<string>((ok, fail) => { calls.push({ q, ok, fail, done: false }) }))
  const m = createEditModel<D, string, string>({
    saveFx,
    validate: (_k, d) => (d.lines.some((l) => /[А-я]/.test(l)) ? 'кириллица' : null),
    normalize: (_k, d) => {
      const lines = d.lines.map((l) => l.trim().toUpperCase())
      while (lines.length && !lines[lines.length - 1]) lines.pop()
      return { lines }
    },
    confirmSave: (k) => k.endsWith(':vd'),
    ...over,
  })
  const $saved = createStore<EditSaved<string>[]>([]).on(m.saved, (l, x) => [...l, x])
  const $failed = createStore<EditFailed<Error>[]>([]).on(m.failed, (l, x) => [...l, x])
  const $leaves = createStore<string[]>([]).on(m.leave, (l, x) => [...l, x])
  const scope = fork()
  const inFlight: Promise<unknown>[] = []
  const take = (key: string) => {
    const c = calls.find((x) => x.q.key === key && !x.done)
    if (!c) throw new Error(`нет запроса по ключу ${key}`)
    c.done = true
    return c
  }
  return {
    m, scope, calls,
    open: (key: string, initial: D) => allSettled(m.open, { scope, params: { key, initial } }),
    change: (key: string, draft: D) => allSettled(m.change, { scope, params: { key, draft } }),
    /** Шаг без ожидания: его промис закроется только вместе с висящим запросом. */
    fire: (p: Promise<unknown>) => { inFlight.push(p) },
    settle: () => Promise.all(inFlight),
    resolve: (key: string, r: string) => take(key).ok(r),
    reject: (key: string, e: Error) => take(key).fail(e),
    saved: () => scope.getState($saved),
    failed: () => scope.getState($failed),
    leaves: () => scope.getState($leaves),
  }
}

describe('createEditModel (спека 2c §2.2)', () => {
  it('open: черновик = initial, один редактор; тот же ключ — без изменений', async () => {
    const { m, scope, open, change } = setup()
    expect(scope.getState(m.$editing)).toBeNull()
    await open('d1:57', A)
    expect(scope.getState(m.$editing)).toEqual({ key: 'd1:57', initial: A })
    expect(scope.getState(m.$drafts)).toEqual({ 'd1:57': A })
    await change('d1:57', B)
    await open('d1:57', C)
    await change('d2:59', C)   // change не открытого ключа — игнор
    expect(scope.getState(m.$editing)).toEqual({ key: 'd1:57', initial: A })
    expect(scope.getState(m.$drafts)).toEqual({ 'd1:57': B })
    expect(scope.getState(m.$confirm)).toBeNull()
  })

  it('open другого ключа при чистом черновике заменяет редактор, черновик прежнего удаляется', async () => {
    const { m, scope, open } = setup()
    await open('d1:57', A)
    await open('d1:59', C)
    expect(scope.getState(m.$editing)).toEqual({ key: 'd1:59', initial: C })
    expect(scope.getState(m.$drafts)).toEqual({ 'd1:59': C })
    expect(scope.getState(m.$confirm)).toBeNull()
  })

  it('open другого ключа при грязном — $confirm discard; false — остаёмся, true — новый редактор', async () => {
    const { m, scope, open, change } = setup()
    await open('d1:57', { lines: ['A'] }); await change('d1:57', { lines: ['B'] }); await open('d1:59', { lines: [] })
    expect(scope.getState(m.$confirm)).toEqual({ kind: 'discard', key: 'd1:57' })
    expect(scope.getState(m.$editing)?.key).toBe('d1:57')
    await allSettled(m.confirmResult, { scope, params: false })
    expect(scope.getState(m.$editing)?.key).toBe('d1:57'); expect(scope.getState(m.$confirm)).toBeNull()
    expect(scope.getState(m.$drafts)).toEqual({ 'd1:57': { lines: ['B'] } })
    await open('d1:59', { lines: [] }); await allSettled(m.confirmResult, { scope, params: true })
    expect(scope.getState(m.$editing)?.key).toBe('d1:59'); expect(scope.getState(m.$drafts)).not.toHaveProperty('d1:57')
    expect(scope.getState(m.$confirm)).toBeNull()
  })

  it('$errors и $dirty по validate/normalize: « a » против ["A"] — не грязный', async () => {
    const { m, scope, open, change } = setup()
    expect(scope.getState(m.$dirty)).toBe(false)
    await open('d1:57', A)
    expect(scope.getState(m.$dirty)).toBe(false)
    await change('d1:57', { lines: [' a ', ''] })
    expect(scope.getState(m.$dirty)).toBe(false)
    expect(scope.getState(m.$errors)).toEqual({})
    await change('d1:57', { lines: ['Ж'] })
    expect(scope.getState(m.$dirty)).toBe(true)
    expect(scope.getState(m.$errors)).toEqual({ 'd1:57': 'кириллица' })
  })

  it('$dirty и «стало = текущее» сравниваются same из конфига, а не JSON.stringify', async () => {
    type V = { opt?: string; lines: string[] }
    const calls: SaveQuery<V>[] = []
    const saveFx = createEffect<SaveQuery<V>, string, Error>(async (q) => { calls.push(q); return 'ok' })
    const m = createEditModel<V, string>({
      saveFx,
      validate: () => null,
      // ключи в другом порядке, чем у исходного: JSON.stringify дал бы ложную «грязь»
      normalize: (_k, v) => ({ lines: v.lines, ...(v.opt ? { opt: v.opt } : {}) }),
      same: (a, b) => (a.opt ?? '') === (b.opt ?? '') && a.lines.join('\n') === b.lines.join('\n'),
    })
    const scope = fork()
    const initial: V = { opt: 'A', lines: ['X'] }
    await allSettled(m.open, { scope, params: { key: 'd1:57', initial } })
    expect(scope.getState(m.$dirty)).toBe(false)
    await allSettled(m.save, { scope })
    expect(calls).toEqual([])
    expect(scope.getState(m.$editing)).toBeNull()
  })

  it('save с ошибкой — запроса нет', async () => {
    const { m, scope, calls, open, change } = setup()
    await open('d1:57', A); await change('d1:57', { lines: ['Ж'] })
    await allSettled(m.save, { scope })
    expect(calls).toHaveLength(0)
    expect(scope.getState(m.$saving)).toBe(false)
    expect(scope.getState(m.$editing)?.key).toBe('d1:57')
  })

  it('save: стало = текущее после normalize — редактор закрыт без запроса', async () => {
    const { m, scope, calls, open, change } = setup()
    await open('d1:57', { lines: ['ABC'] }); await change('d1:57', { lines: [' abc ', ''] })
    await allSettled(m.save, { scope })
    expect(scope.getState(m.$editing)).toBeNull()
    expect(scope.getState(m.$drafts)).toEqual({})
    expect(calls).toHaveLength(0)
  })

  it('save: запрос с нормализованным черновиком и initial; успех — saved, редактор закрыт', async () => {
    const { m, scope, calls, open, change, resolve, saved } = setup()
    await open('d1:57', A); await change('d1:57', { lines: [' x ', ''] })
    const p = allSettled(m.save, { scope })
    await flush()
    expect(scope.getState(m.$saving)).toBe(true)
    expect(calls.map((c) => c.q)).toEqual([{ key: 'd1:57', draft: { lines: ['X'] }, initial: A }])
    resolve('d1:57', 'ok')
    await p
    expect(saved()).toEqual([{ key: 'd1:57', result: 'ok' }])
    expect(scope.getState(m.$editing)).toBeNull()
    expect(scope.getState(m.$drafts)).toEqual({})
    expect(scope.getState(m.$saving)).toBe(false)
  })

  it('во время сохранения открытого редактора: cancel, open другого ключа, повторный save и submit — игнор', async () => {
    const { m, scope, calls, open, change, fire, settle, resolve } = setup()
    await open('d1:57', A); await change('d1:57', B)
    fire(allSettled(m.save, { scope }))
    await flush()
    fire(allSettled(m.cancel, { scope }))
    fire(allSettled(m.open, { scope, params: { key: 'd2:59', initial: C } }))
    fire(allSettled(m.save, { scope }))
    fire(allSettled(m.submit, { scope, params: { key: 'd2:59', initial: C, draft: A } }))
    await flush()
    expect(calls).toHaveLength(1)
    expect(scope.getState(m.$editing)).toEqual({ key: 'd1:57', initial: A })
    expect(scope.getState(m.$drafts)).toEqual({ 'd1:57': B })
    expect(scope.getState(m.$confirm)).toBeNull()
    resolve('d1:57', 'ok')
    await settle()
    expect(calls).toHaveLength(1)
    expect(scope.getState(m.$editing)).toBeNull()
  })

  it('отказ: $saveError = errorText, редактор и черновик на месте, failed; change сбрасывает ошибку', async () => {
    const { m, scope, open, change, reject, failed } = setup({ errorText: (e) => `Ошибка: ${e.message}` })
    await open('d1:57', A); await change('d1:57', B)
    const p = allSettled(m.save, { scope })
    await flush()
    const err = new Error('500')
    reject('d1:57', err)
    await p
    expect(scope.getState(m.$saveError)).toBe('Ошибка: 500')
    expect(scope.getState(m.$editing)).toEqual({ key: 'd1:57', initial: A })
    expect(scope.getState(m.$drafts)).toEqual({ 'd1:57': B })
    expect(scope.getState(m.$saving)).toBe(false)
    expect(failed()).toEqual([{ key: 'd1:57', error: err }])
    await change('d1:57', C)
    expect(scope.getState(m.$saveError)).toBeNull()
  })

  it('confirmSave: save ставит $confirm commit, запрос только после confirmResult(true); false — остаёмся с черновиком', async () => {
    const { m, scope, calls, open, change, resolve, saved } = setup()
    await open('d1:vd', A); await change('d1:vd', B)
    await allSettled(m.save, { scope })
    expect(scope.getState(m.$confirm)).toEqual({ kind: 'commit', key: 'd1:vd' })
    expect(calls).toHaveLength(0)
    await allSettled(m.confirmResult, { scope, params: false })
    expect(scope.getState(m.$confirm)).toBeNull()
    expect(scope.getState(m.$editing)?.key).toBe('d1:vd')
    expect(scope.getState(m.$drafts)).toEqual({ 'd1:vd': B })
    expect(calls).toHaveLength(0)
    await allSettled(m.save, { scope })
    const p = allSettled(m.confirmResult, { scope, params: true })
    await flush()
    expect(scope.getState(m.$confirm)).toBeNull()
    expect(calls.map((c) => c.q)).toEqual([{ key: 'd1:vd', draft: B, initial: A }])
    resolve('d1:vd', 'ok')
    await p
    expect(saved()).toEqual([{ key: 'd1:vd', result: 'ok' }])
    expect(scope.getState(m.$editing)).toBeNull()
  })

  it('submit: запрос без редактора и без confirm; игнор при same', async () => {
    const { m, scope, calls, resolve, saved } = setup()
    await allSettled(m.submit, { scope, params: { key: 'd1:vd', initial: A, draft: { lines: [' a '] } } })
    expect(calls).toHaveLength(0)
    const p = allSettled(m.submit, { scope, params: { key: 'd1:vd', initial: B, draft: { lines: [' a '] } } })
    await flush()
    expect(scope.getState(m.$confirm)).toBeNull()
    expect(scope.getState(m.$editing)).toBeNull()
    expect(scope.getState(m.$saving)).toBe(true)
    expect(calls.map((c) => c.q)).toEqual([{ key: 'd1:vd', draft: A, initial: B }])
    resolve('d1:vd', 'back')
    await p
    expect(saved()).toEqual([{ key: 'd1:vd', result: 'back' }])
    expect(scope.getState(m.$saving)).toBe(false)
  })

  it('поздний ответ: редактор ушёл на другой ключ — saved есть, чужой редактор и ошибка не тронуты', async () => {
    // Review Focus 1; шаги при висящем запросе — через fire (allSettled ждёт все эффекты scope)
    const { m, scope, open, change, fire, settle, resolve, saved, leaves } = setup()
    await open('d1:57', A); await change('d1:57', B); const p = allSettled(m.save, { scope })
    await flush()
    fire(allSettled(m.requestLeave, { scope, params: { scope: 'd1:', next: 'close-a' } }))   // сохранение в полёте — уход без вопроса
    expect(scope.getState(m.$confirm)).toBeNull()
    expect(scope.getState(m.$editing)).toBeNull()
    fire(allSettled(m.open, { scope, params: { key: 'd2:59', initial: C } }))   // редактор d1 закрыт уходом — open не блокируется летящим запросом d1
    expect(scope.getState(m.$editing)?.key).toBe('d2:59')
    resolve('d1:57', 'deal')   // ответ пришёл после ухода
    await p; await settle()
    expect(saved()).toEqual([{ key: 'd1:57', result: 'deal' }])
    expect(scope.getState(m.$editing)?.key).toBe('d2:59'); expect(scope.getState(m.$saveError)).toBeNull()
    expect(scope.getState(m.$drafts)).toEqual({ 'd2:59': C })
    expect(scope.getState(m.$saving)).toBe(false)
    expect(leaves()).toEqual(['close-a'])
  })

  it('поздний отказ после reset — ни failed, ни $saveError; $saving false', async () => {
    const { m, scope, open, change, fire, settle, reject, failed } = setup()
    await open('d1:57', A); await change('d1:57', B)
    fire(allSettled(m.save, { scope }))
    await flush()
    fire(allSettled(m.reset, { scope }))
    expect(scope.getState(m.$saving)).toBe(false)
    fire(allSettled(m.open, { scope, params: { key: 'd1:57', initial: A } }))   // новый визит, тот же ключ
    reject('d1:57', new Error('500'))
    await settle()
    expect(failed()).toEqual([])
    expect(scope.getState(m.$saveError)).toBeNull()
    expect(scope.getState(m.$saving)).toBe(false)
    expect(scope.getState(m.$editing)).toEqual({ key: 'd1:57', initial: A })
  })

  it('requestLeave: ключ вне scope — leave сразу; в scope без грязи — редактор закрыт и leave', async () => {
    const { m, scope, open, change, leaves } = setup()
    await allSettled(m.requestLeave, { scope, params: { scope: 'd1:', next: 'no-editor' } })
    expect(leaves()).toEqual(['no-editor'])
    await open('d2:59', A); await change('d2:59', B)
    await allSettled(m.requestLeave, { scope, params: { scope: 'd1:', next: 'other' } })
    expect(leaves()).toEqual(['no-editor', 'other'])
    expect(scope.getState(m.$editing)?.key).toBe('d2:59')
    expect(scope.getState(m.$drafts)).toEqual({ 'd2:59': B })
    await change('d2:59', { lines: [' a '] })   // после normalize = initial — не грязный
    await allSettled(m.requestLeave, { scope, params: { scope: 'd2:', next: 'clean' } })
    expect(leaves()).toEqual(['no-editor', 'other', 'clean'])
    expect(scope.getState(m.$editing)).toBeNull()
    expect(scope.getState(m.$drafts)).toEqual({})
  })

  it('requestLeave: в scope с грязным — $confirm discard; false — ничего; true — редактор закрыт и leave(next); повтор при открытом confirm — игнор', async () => {
    // Review Focus 4
    const { m, scope, open, change, leaves } = setup()
    await open('d1:57', A); await change('d1:57', B)
    await allSettled(m.requestLeave, { scope, params: { scope: 'd1:', next: 'first' } })
    expect(scope.getState(m.$confirm)).toEqual({ kind: 'discard', key: 'd1:57' })
    expect(leaves()).toEqual([])
    await allSettled(m.confirmResult, { scope, params: false })
    expect(scope.getState(m.$confirm)).toBeNull()
    expect(scope.getState(m.$editing)?.key).toBe('d1:57')
    expect(scope.getState(m.$drafts)).toEqual({ 'd1:57': B })
    expect(leaves()).toEqual([])
    await allSettled(m.requestLeave, { scope, params: { scope: 'd1:', next: 'second' } })
    await allSettled(m.requestLeave, { scope, params: { scope: 'd2:', next: 'ignored' } })   // confirm открыт — игнор
    expect(scope.getState(m.$confirm)).toEqual({ kind: 'discard', key: 'd1:57' })
    await allSettled(m.confirmResult, { scope, params: true })
    expect(leaves()).toEqual(['second'])
    expect(scope.getState(m.$confirm)).toBeNull()
    expect(scope.getState(m.$editing)).toBeNull()
    expect(scope.getState(m.$drafts)).toEqual({})
  })

  it('reset: всё к начальному', async () => {
    const { m, scope, open, change, reject } = setup()
    await open('d1:57', A); await change('d1:57', B)
    const p = allSettled(m.save, { scope })
    await flush()
    reject('d1:57', new Error('500'))
    await p
    await change('d1:57', { lines: ['Ж'] })
    await allSettled(m.requestLeave, { scope, params: { scope: 'd1:', next: 'x' } })
    expect(scope.getState(m.$confirm)).not.toBeNull()
    await allSettled(m.reset, { scope })
    expect(scope.getState(m.$editing)).toBeNull()
    expect(scope.getState(m.$drafts)).toEqual({})
    expect(scope.getState(m.$errors)).toEqual({})
    expect(scope.getState(m.$dirty)).toBe(false)
    expect(scope.getState(m.$saving)).toBe(false)
    expect(scope.getState(m.$saveError)).toBeNull()
    expect(scope.getState(m.$confirm)).toBeNull()
    // ожидавший ответа уход сброшен: confirmResult после reset ничего не делает
    await allSettled(m.confirmResult, { scope, params: true })
    expect(scope.getState(m.$editing)).toBeNull()
  })
})
