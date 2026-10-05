import { allSettled, fork } from 'effector'
import { RUB_DETAIL_EXAMPLE, RUB_TABS, parseRubDocDetail, rubDocPorts, type RubDoc } from '../../../entities/rub-doc'
import { requestFx, type HttpRequest, type TabQuery } from '../../../shared/api'
import { rubDetailDomain } from '../ui/detailDomain'
import { detail, lifecycle, registry, RUB_LOCAL_TABS } from './registry.model'

describe('страница rub-docs: реестр → деталка (спека 2a §4.4)', () => {
  it('openRequested открывает деталку; уход с экрана закрывает', async () => {
    const doc = parseRubDocDetail(RUB_DETAIL_EXAMPLE, 'ответ')
    const scope = fork({
      handlers: [
        [rubDocPorts.detailFx, async (id: string) => ({ ...doc, id })],
        [rubDocPorts.searchFx, async () => ({ rows: [], total: 0 })],
        [rubDocPorts.facetsFx, async () => []],
        [rubDocPorts.filterMetaFx, async () => ({ fields: [] })],
      ],
    })
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(registry.openRequested, { scope, params: { id: 'r1', secondary: false } })
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'r1', state: 'ready' })
    await allSettled(lifecycle.pageClosed, { scope })
    expect(scope.getState(detail.$marks)).toEqual({})
  })
  it('В-Д4: первая запись первого ответа реестра открывается в A; закрытая не всплывает до ухода с экрана', async () => {
    const doc = parseRubDocDetail(RUB_DETAIL_EXAMPLE, 'ответ')
    const row = { id: 'first' } as unknown as RubDoc
    const scope = fork({
      handlers: [
        [rubDocPorts.detailFx, async (id: string) => ({ ...doc, id })],
        [rubDocPorts.searchFx, async () => ({ rows: [row], total: 1 })],
        [rubDocPorts.facetsFx, async () => []],
        [rubDocPorts.filterMetaFx, async () => ({ fields: [] })],
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

describe('страница rub-docs: вкладки деталки (спека 2b §3.4)', () => {
  it('нелокальная вкладка грузится портом при выборе', async () => {
    const doc = parseRubDocDetail(RUB_DETAIL_EXAMPLE, 'ответ')
    const asked: TabQuery[] = []
    const scope = fork({
      handlers: [
        [rubDocPorts.detailFx, async (id: string) => ({ ...doc, id })],
        [rubDocPorts.tabFx, async (q: TabQuery) => { asked.push(q); return [] }],
        [rubDocPorts.searchFx, async () => ({ rows: [], total: 0 })],
        [rubDocPorts.facetsFx, async () => []],
        [rubDocPorts.filterMetaFx, async () => ({ fields: [] })],
      ],
    })
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(registry.openRequested, { scope, params: { id: 'r1', secondary: false } })
    await allSettled(detail.setTab, { scope, params: { slot: 'a', tab: 'ed244' } })
    expect(asked).toEqual([{ id: 'r1', tab: 'ed244' }])
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('каждая вкладка RUB_TABS кроме «Общих» — вид remote; локальна только main', () => {
    const views = rubDetailDomain.tabViews ?? {}
    expect(RUB_LOCAL_TABS).toEqual(['main'])
    expect(Object.keys(views).sort()).toEqual(RUB_TABS.map((t) => t.id).filter((id) => id !== 'main').sort())
    for (const t of RUB_TABS.filter((x) => x.id !== 'main')) expect(views[t.id]?.kind, t.id).toBe('remote')
  })

  it('порт вкладок знает ровно нелокальные вкладки рубля: source и extra — отказ до запроса', async () => {
    const urls: string[] = []
    const scope = fork({ handlers: [[requestFx, async (req: HttpRequest) => { urls.push(req.url); return {} }]] })
    for (const t of RUB_TABS) await allSettled(rubDocPorts.tabFx, { scope, params: { id: 'r1', tab: t.id } })
    expect(urls).toEqual(RUB_TABS.filter((t) => !RUB_LOCAL_TABS.includes(t.id)).map((t) => `/grids/rub-docs/documents/r1/tabs/${t.id}`))
    for (const tab of ['source', 'extra']) {
      expect((await allSettled(rubDocPorts.tabFx, { scope, params: { id: 'r1', tab } })).status).toBe('fail')
    }
    expect(urls).toHaveLength(RUB_TABS.length - RUB_LOCAL_TABS.length)
  })
})
