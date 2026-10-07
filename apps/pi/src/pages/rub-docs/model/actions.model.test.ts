import { allSettled, fork } from 'effector'
import { RUB_DETAIL_EXAMPLE, parseRubDocDetail, rubDocPorts, type RubDoc } from '../../../entities/rub-doc'
import { saveFileFx } from '../../../features/doc-actions'
import type { FileResponse } from '../../../shared/api'
import { docActions, rubActionPorts } from './actions.model'
import { detail, lifecycle, registry } from './registry.model'

const doc = parseRubDocDetail(RUB_DETAIL_EXAMPLE, 'ответ')

function page(rows: RubDoc[] = []) {
  const calls = { detail: [] as string[], search: 0 }
  const saved: string[] = []
  const scope = fork({
    handlers: [
      [rubDocPorts.detailFx, async (id: string) => { calls.detail.push(id); return { ...doc, id, docNumber: '9051' } }],
      [rubDocPorts.searchFx, async () => { calls.search += 1; return { rows, total: rows.length } }],
      [rubDocPorts.facetsFx, async () => []],
      [rubDocPorts.filterMetaFx, async () => ({ fields: [] })],
      [rubActionPorts.messageFx, async (): Promise<FileResponse> => ({ blob: new Blob(['<ED101/>']), name: null })],
      [saveFileFx, ({ name }: { name: string }) => { saved.push(name) }],
    ],
  })
  return { scope, calls, saved }
}

describe('страница rub-docs: «Обновить» (модели правки нет — сразу)', () => {
  it('refreshRequested → refreshDoc (деталь заново) и реестр заново', async () => {
    const { scope, calls } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(registry.openRequested, { scope, params: { id: 'r1', secondary: false } })
    expect(calls).toEqual({ detail: ['r1'], search: 1 })
    await allSettled(docActions.refreshRequested, { scope, params: 'r1' })
    expect(calls).toEqual({ detail: ['r1', 'r1'], search: 2 })
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'r1', state: 'ready' })
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('запасное имя сообщения: номер из строки реестра, иначе из детали, иначе id; расширение .xml', async () => {
    const { scope, saved } = page([{ id: 'r1', docNumber: '417' } as unknown as RubDoc])
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(docActions.download, { scope, params: 'r1' })
    await allSettled(registry.openRequested, { scope, params: { id: 'r2', secondary: true } })
    await allSettled(docActions.download, { scope, params: 'r2' })
    await allSettled(docActions.download, { scope, params: 'nope' })
    expect(saved).toEqual(['417.xml', '9051.xml', 'nope.xml'])
    await allSettled(lifecycle.pageClosed, { scope })
  })
})
