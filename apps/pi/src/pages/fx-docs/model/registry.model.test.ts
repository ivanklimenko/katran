import { allSettled, fork, type Scope } from 'effector'
import { FX_DETAIL_EXAMPLE, FX_TABS, currentOf, fxDocPorts, fxEditPorts, parseFxDocDetail, type FxDoc, type FxDocDetail } from '../../../entities/fx-doc'
import { CONFLICT_TEXT } from '../../../features/doc-edit'
import { requestFx, toApiError, type EditQuery, type HttpRequest, type TabQuery } from '../../../shared/api'
import { fxDetailDomain } from '../ui/detailDomain'
import { docEdit } from './edit.model'
import { detail, FX_LOCAL_TABS, lifecycle, registry } from './registry.model'

describe('страница fx-docs: реестр → деталка (спека 2a §4.4)', () => {
  it('openRequested открывает деталку, secondary — рядом; уход с экрана закрывает оба', async () => {
    const doc = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
    const scope = fork({
      handlers: [
        [fxDocPorts.detailFx, async (id: string) => ({ ...doc, id })],
        [fxDocPorts.searchFx, async () => ({ rows: [], total: 0 })],
        [fxDocPorts.facetsFx, async () => []],
        [fxDocPorts.filterMetaFx, async () => ({ fields: [] })],
      ],
    })
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(registry.openRequested, { scope, params: { id: 'u1', secondary: false } })
    await allSettled(registry.openRequested, { scope, params: { id: 'u2', secondary: true } })
    expect(scope.getState(detail.$marks)).toEqual({ u1: 'a', u2: 'b' })
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u1', state: 'ready' })
    await allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(detail.$slots)).toEqual({ a: null, b: null })
  })
  it('В-Д4: первая запись первого ответа реестра открывается в A; закрытая не всплывает до ухода с экрана', async () => {
    const doc = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
    const row = { id: 'first' } as unknown as FxDoc
    const scope = fork({
      handlers: [
        [fxDocPorts.detailFx, async (id: string) => ({ ...doc, id })],
        [fxDocPorts.searchFx, async () => ({ rows: [row], total: 1 })],
        [fxDocPorts.facetsFx, async () => []],
        [fxDocPorts.filterMetaFx, async () => ({ fields: [] })],
      ],
    })
    await allSettled(lifecycle.pageOpened, { scope })
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'first', state: 'ready' })
    // открытие не пользователем (R10): drawer фокус не забирает
    expect(scope.getState(detail.$quiet)).toEqual({ first: true })
    await allSettled(detail.closeTop, { scope })
    await allSettled(registry.refreshRequested, { scope })
    expect(scope.getState(detail.$slots).a).toBeNull()
    await allSettled(lifecycle.pageClosed, { scope })
    await allSettled(lifecycle.pageOpened, { scope })
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'first' })
  })
})

describe('страница fx-docs: вкладки деталки (спека 2b §3.4)', () => {
  it('нелокальная вкладка грузится портом при выборе; «Доп. поля» — локальная, без запроса', async () => {
    const doc = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
    const asked: TabQuery[] = []
    const scope = fork({
      handlers: [
        [fxDocPorts.detailFx, async (id: string) => ({ ...doc, id })],
        [fxDocPorts.tabFx, async (q: TabQuery) => { asked.push(q); return [] }],
        [fxDocPorts.searchFx, async () => ({ rows: [], total: 0 })],
        [fxDocPorts.facetsFx, async () => []],
        [fxDocPorts.filterMetaFx, async () => ({ fields: [] })],
      ],
    })
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(registry.openRequested, { scope, params: { id: 'u1', secondary: false } })
    await allSettled(detail.setTab, { scope, params: { slot: 'a', tab: 'extra' } })
    await allSettled(detail.setTab, { scope, params: { slot: 'a', tab: 'statuses' } })
    expect(asked).toEqual([{ id: 'u1', tab: 'statuses' }])
    expect(scope.getState(detail.$slots).a).toMatchObject({ tab: 'statuses', tabView: { state: 'ready', data: [] } })
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('каждая вкладка FX_TABS — «Общие» (ConfigForm), локальная с локальным видом или нелокальная с видом remote', () => {
    const views = fxDetailDomain.tabViews ?? {}
    expect(Object.keys(views).sort()).toEqual(FX_TABS.map((t) => t.id).filter((id) => id !== 'main').sort())
    expect(FX_LOCAL_TABS).toContain('main')
    for (const t of FX_TABS.filter((x) => x.id !== 'main')) {
      expect(views[t.id]?.kind, t.id).toBe(FX_LOCAL_TABS.includes(t.id) ? 'local' : 'remote')
    }
  })

  it('порт вкладок знает ровно нелокальные вкладки валюты: остальные — отказ до запроса (parseTab, Task 10)', async () => {
    const urls: string[] = []
    const scope = fork({ handlers: [[requestFx, async (req: HttpRequest) => { urls.push(req.url); return {} }]] })
    for (const t of FX_TABS) await allSettled(fxDocPorts.tabFx, { scope, params: { id: 'u1', tab: t.id } })
    expect(urls).toEqual(FX_TABS.filter((t) => !FX_LOCAL_TABS.includes(t.id)).map((t) => `/grids/fx-docs/documents/u1/tabs/${t.id}`))
    const foreign = await allSettled(fxDocPorts.tabFx, { scope, params: { id: 'u1', tab: 'ed244' } })
    expect(foreign.status).toBe('fail')
    expect(urls).toHaveLength(FX_TABS.length - FX_LOCAL_TABS.length)
  })
})

describe('страница fx-docs: правка деталки (план 2c, Task 12)', () => {
  const doc = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
  /** Экран со счётчиками запросов детали и реестра; saveEditFx — свой обработчик. */
  function page(save: (q: EditQuery) => Promise<FxDocDetail>, load: (id: string, n: number) => FxDocDetail = (id) => ({ ...doc, id })) {
    const calls = { detail: [] as string[], search: 0 }
    const scope = fork({
      handlers: [
        [fxDocPorts.detailFx, async (id: string) => { calls.detail.push(id); return load(id, calls.detail.length) }],
        [fxDocPorts.searchFx, async () => { calls.search += 1; return { rows: [], total: 0 } }],
        [fxDocPorts.facetsFx, async () => []],
        [fxDocPorts.filterMetaFx, async () => ({ fields: [] })],
        [fxEditPorts.saveEditFx, save],
      ],
    })
    return { scope, calls }
  }
  const openDoc = (scope: Scope, id: string, secondary = false) => allSettled(registry.openRequested, { scope, params: { id, secondary } })
  /** Редактор 20 исх документа id с черновиком draft (грязный). */
  async function dirty(scope: Scope, id: string, draft = 'NEWREF') {
    await allSettled(docEdit.model.open, { scope, params: { key: `${id}:refOut`, initial: currentOf(doc, 'refOut') } })
    await allSettled(docEdit.model.change, { scope, params: { key: `${id}:refOut`, draft } })
  }

  it('правка: сохранение кладёт деталь ответа в кэш без запроса детали и перезапрашивает реестр', async () => {
    const answer: FxDocDetail = { ...doc, id: 'u1', refOut: 'NEWREF' }
    const asked: EditQuery[] = []
    const { scope, calls } = page(async (q) => { asked.push(q); return answer })
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    expect(calls).toEqual({ detail: ['u1'], search: 1 })
    await dirty(scope, 'u1', 'newref')
    await allSettled(docEdit.model.save, { scope })
    expect(asked).toEqual([{ id: 'u1', target: 'refOut', was: '', now: 'NEWREF' }])
    expect(calls).toEqual({ detail: ['u1'], search: 2 })
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u1', state: 'ready', data: answer })
    expect(scope.getState(docEdit.model.$editing)).toBeNull()
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('грязный черновик в A: open другого документа из реестра — Prompt discard; false — A прежний; true — A новый', async () => {
    const { scope } = page(async () => doc)
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await dirty(scope, 'u1')
    await openDoc(scope, 'u2')
    expect(scope.getState(docEdit.model.$confirm)).toEqual({ kind: 'discard', key: 'u1:refOut' })
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u1' })
    await allSettled(docEdit.model.confirmResult, { scope, params: false })
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u1' })
    expect(scope.getState(docEdit.model.$editing)).toMatchObject({ key: 'u1:refOut' })
    expect(scope.getState(docEdit.model.$drafts)['u1:refOut']).toBe('NEWREF')
    await openDoc(scope, 'u2')
    await allSettled(docEdit.model.confirmResult, { scope, params: true })
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u2', state: 'ready' })
    expect(scope.getState(docEdit.model.$editing)).toBeNull()
    expect(scope.getState(docEdit.model.$confirm)).toBeNull()
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('черновик в B: закрытие A без вопроса, B сдвигается в A, редактор B открыт', async () => {
    const { scope } = page(async () => doc)
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await openDoc(scope, 'u2', true)
    await dirty(scope, 'u2')
    await allSettled(detail.close, { scope, params: 'a' })
    expect(scope.getState(docEdit.model.$confirm)).toBeNull()
    expect(scope.getState(detail.$slots)).toMatchObject({ a: { id: 'u2' }, b: null })
    expect(scope.getState(docEdit.model.$editing)).toMatchObject({ key: 'u2:refOut' })
    expect(scope.getState(docEdit.model.$drafts)['u2:refOut']).toBe('NEWREF')
    // уход из документа с черновиком — тот же вопрос, что при замене (Esc → closeTop)
    await allSettled(detail.closeTop, { scope })
    expect(scope.getState(docEdit.model.$confirm)).toEqual({ kind: 'discard', key: 'u2:refOut' })
    await allSettled(docEdit.model.confirmResult, { scope, params: true })
    expect(scope.getState(detail.$slots)).toEqual({ a: null, b: null })
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('409: деталь перезапрошена, редактор открыт с CONFLICT_TEXT', async () => {
    const { scope, calls } = page(async () => { throw toApiError(409, { type: 'urn:katran:edit-conflict', title: 'Документ изменили', status: 409 }) })
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await dirty(scope, 'u1')
    await allSettled(docEdit.model.save, { scope })
    expect(calls).toEqual({ detail: ['u1', 'u1'], search: 1 })
    expect(scope.getState(docEdit.model.$editing)).toMatchObject({ key: 'u1:refOut' })
    expect(scope.getState(docEdit.model.$drafts)['u1:refOut']).toBe('NEWREF')
    expect(scope.getState(docEdit.model.$saveError)).toBe(CONFLICT_TEXT)
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u1', state: 'ready' })
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('уход во время сохранения — без Prompt; ответ после ухода — деталь в кэше (без запроса при повторном открытии) и перезапрос реестра', async () => {
    const answer: FxDocDetail = { ...doc, id: 'u1', refOut: 'NEWREF' }
    let release: () => void = () => {}
    const { scope, calls } = page(() => new Promise<FxDocDetail>((ok) => { release = () => ok(answer) }))
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await dirty(scope, 'u1')
    const saving = allSettled(docEdit.model.save, { scope })
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(scope.getState(docEdit.model.$saving)).toBe(true)
    const closing = allSettled(detail.closeTop, { scope })
    expect(scope.getState(docEdit.model.$confirm)).toBeNull()
    expect(scope.getState(detail.$slots)).toEqual({ a: null, b: null })
    expect(scope.getState(docEdit.model.$editing)).toBeNull()
    release()
    await saving; await closing
    expect(calls).toEqual({ detail: ['u1'], search: 2 })
    await openDoc(scope, 'u1')
    expect(calls.detail).toEqual(['u1'])
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u1', state: 'ready', data: answer })
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('409, а перезапрошенный документ заблокирован — редактор закрыт (только просмотр, Д66), Prompt при уходе не нужен', async () => {
    const locked = { who: 'Иванова М. П.', since: '2026-09-23T09:00:00' }
    const { scope, calls } = page(
      async () => { throw toApiError(409, { type: 'urn:katran:edit-conflict', title: 'Документ изменили', status: 409 }) },
      (id, n) => ({ ...doc, id, lock: n > 1 ? locked : null }),
    )
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await dirty(scope, 'u1')
    await allSettled(docEdit.model.save, { scope })
    expect(calls.detail).toEqual(['u1', 'u1'])
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u1', state: 'ready', data: { lock: locked } })
    expect(scope.getState(docEdit.model.$editing)).toBeNull()
    await allSettled(detail.closeTop, { scope })
    expect(scope.getState(docEdit.model.$confirm)).toBeNull()
    expect(scope.getState(detail.$slots)).toEqual({ a: null, b: null })
    await allSettled(lifecycle.pageClosed, { scope })
  })
})
