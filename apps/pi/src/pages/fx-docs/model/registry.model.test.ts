import { allSettled, fork } from 'effector'
import { FX_DETAIL_EXAMPLE, FX_TABS, fxDocPorts, parseFxDocDetail, type FxDoc } from '../../../entities/fx-doc'
import { requestFx, type HttpRequest, type TabQuery } from '../../../shared/api'
import { fxDetailDomain } from '../ui/detailDomain'
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
