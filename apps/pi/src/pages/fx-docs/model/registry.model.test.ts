import { allSettled, fork } from 'effector'
import { FX_DETAIL_EXAMPLE, fxDocPorts, parseFxDocDetail, type FxDoc } from '../../../entities/fx-doc'
import { detail, lifecycle, registry } from './registry.model'

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
