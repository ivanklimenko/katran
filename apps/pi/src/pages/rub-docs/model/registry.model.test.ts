import { allSettled, fork } from 'effector'
import { RUB_DETAIL_EXAMPLE, parseRubDocDetail, rubDocPorts, type RubDoc } from '../../../entities/rub-doc'
import { detail, lifecycle, registry } from './registry.model'

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
    await allSettled(detail.closeTop, { scope })
    await allSettled(registry.refreshRequested, { scope })
    expect(scope.getState(detail.$slots).a).toBeNull()
    await allSettled(lifecycle.pageClosed, { scope })
    await allSettled(lifecycle.pageOpened, { scope })
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'first' })
  })
})
