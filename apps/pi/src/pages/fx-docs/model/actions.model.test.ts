import { allSettled, fork, type Scope } from 'effector'
import { FX_DETAIL_EXAMPLE, currentOf, fxDocPorts, fxEditPorts, parseFxDocDetail, type FxDoc, type FxDocDetail } from '../../../entities/fx-doc'
import { DISCARD_VIEW } from '../../../features/doc-edit'
import { saveFileFx } from '../../../features/doc-actions'
import type { FileResponse } from '../../../shared/api'
import { docActions, fxActionPorts } from './actions.model'
import { docEdit } from './edit.model'
import { detail, lifecycle, registry } from './registry.model'

const doc = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
const row = (id: string, docNumber: number) => ({ id, docNumber }) as unknown as FxDoc

/** Экран со счётчиками запросов детали и реестра; строки реестра — rows. */
function page(rows: FxDoc[] = [], load: (id: string) => FxDocDetail = (id) => ({ ...doc, id })) {
  const calls = { detail: [] as string[], search: 0 }
  const saved: { name: string }[] = []
  const scope = fork({
    handlers: [
      [fxDocPorts.detailFx, async (id: string) => { calls.detail.push(id); return load(id) }],
      [fxDocPorts.searchFx, async () => { calls.search += 1; return { rows, total: rows.length } }],
      [fxDocPorts.facetsFx, async () => []],
      [fxDocPorts.filterMetaFx, async () => ({ fields: [] })],
      [fxActionPorts.messageFx, async (): Promise<FileResponse> => ({ blob: new Blob(['MT']), name: null })],
      [saveFileFx, ({ name }: { name: string }) => { saved.push({ name }) }],
    ],
  })
  return { scope, calls, saved }
}
const openDoc = (scope: Scope, id: string, secondary = false) => allSettled(registry.openRequested, { scope, params: { id, secondary } })
async function dirty(scope: Scope, id: string) {
  await allSettled(docEdit.model.open, { scope, params: { key: `${id}:refOut`, initial: currentOf(doc, 'refOut') } })
  await allSettled(docEdit.model.change, { scope, params: { key: `${id}:refOut`, draft: 'NEWREF' } })
}

describe('страница fx-docs: «Обновить» с охраной черновика (план 2d, R16)', () => {
  it('без черновика — сразу refreshDoc (деталь заново) и реестр заново', async () => {
    const { scope, calls } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    expect(calls).toEqual({ detail: ['u1'], search: 1 })
    await allSettled(docActions.refreshRequested, { scope, params: 'u1' })
    expect(calls).toEqual({ detail: ['u1', 'u1'], search: 2 })
    expect(scope.getState(docEdit.model.$confirm)).toBeNull()
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('грязный черновик — Prompt «Отменить правку?»; «Продолжить» — ничего; «Отменить правку» — редактор закрыт и обновление', async () => {
    const { scope, calls } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await dirty(scope, 'u1')
    await allSettled(docActions.refreshRequested, { scope, params: 'u1' })
    expect(scope.getState(docEdit.model.$confirm)).toEqual({ kind: 'discard', key: 'u1:refOut' })
    expect(DISCARD_VIEW.title).toBe('Отменить правку?')
    expect(calls).toEqual({ detail: ['u1'], search: 1 })
    await allSettled(docEdit.model.confirmResult, { scope, params: false })
    expect(calls).toEqual({ detail: ['u1'], search: 1 })
    expect(scope.getState(docEdit.model.$editing)).toMatchObject({ key: 'u1:refOut' })

    await allSettled(docActions.refreshRequested, { scope, params: 'u1' })
    await allSettled(docEdit.model.confirmResult, { scope, params: true })
    expect(calls).toEqual({ detail: ['u1', 'u1'], search: 2 })
    expect(scope.getState(docEdit.model.$editing)).toBeNull()
    // документ остаётся открытым: refresh — не уход из детали
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u1', state: 'ready' })
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('черновик другого документа «Обновить» не держит', async () => {
    const { scope, calls } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await openDoc(scope, 'u2', true)
    await dirty(scope, 'u2')
    await allSettled(docActions.refreshRequested, { scope, params: 'u1' })
    expect(scope.getState(docEdit.model.$confirm)).toBeNull()
    expect(calls).toEqual({ detail: ['u1', 'u2', 'u1'], search: 2 })
    expect(scope.getState(docEdit.model.$drafts)['u2:refOut']).toBe('NEWREF')
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('leave модели правки: close/open — в detail.leave, как в 2c; refresh слоты не трогает', async () => {
    const { scope } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await openDoc(scope, 'u2', true)
    await allSettled(docEdit.model.requestLeave, { scope, params: { scope: 'u2:', next: { kind: 'refresh', id: 'u2' } } })
    expect(scope.getState(detail.$slots)).toMatchObject({ a: { id: 'u1' }, b: { id: 'u2' } })
    await allSettled(docEdit.model.requestLeave, { scope, params: { scope: 'u2:', next: { kind: 'close', slot: 'b' } } })
    expect(scope.getState(detail.$slots)).toMatchObject({ a: { id: 'u1' }, b: null })
    await allSettled(lifecycle.pageClosed, { scope })
  })
})

describe('страница fx-docs: запасное имя файла сообщения', () => {
  it('номер из строки реестра; нет строки — из детали; нет ни того, ни другого — id', async () => {
    const { scope, saved } = page([row('u1', 417)], (id) => ({ ...doc, id, docNumber: 905 }))
    await allSettled(lifecycle.pageOpened, { scope })
    await allSettled(docActions.download, { scope, params: 'u1' })
    await openDoc(scope, 'u2', true)
    await allSettled(docActions.download, { scope, params: 'u2' })
    await allSettled(docActions.download, { scope, params: 'nope' })
    expect(saved).toEqual([{ name: '417.txt' }, { name: '905.txt' }, { name: 'nope.txt' }])
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('номера — в своём скоупе: соседний скоуп со своим реестром и его уход с экрана имя не меняют (fork-safe, R18)', async () => {
    const one = page([row('u1', 417)])
    const two = page([row('u1', 555)])
    await allSettled(lifecycle.pageOpened, { scope: one.scope })
    await allSettled(lifecycle.pageOpened, { scope: two.scope })
    await allSettled(lifecycle.pageClosed, { scope: two.scope })
    await allSettled(docActions.download, { scope: one.scope, params: 'u1' })
    expect(one.saved).toEqual([{ name: '417.txt' }])
    await allSettled(lifecycle.pageClosed, { scope: one.scope })
  })
})

describe('страница fx-docs: решение документа, ушедшего из слотов (R12)', () => {
  it('открытое решение снимается, когда документ ушёл из слотов (закрыт, заменён); решение оставшегося — живо', async () => {
    const { scope } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await openDoc(scope, 'u2', true)
    await allSettled(docEdit.confirmRequested, { scope, params: { docId: 'u1', target: 'field:57', when: 't1' } })
    await allSettled(docEdit.rejectRequested, { scope, params: { docId: 'u2', target: 'field:57', when: 't2' } })
    expect(Object.keys(scope.getState(docEdit.$decision)).sort()).toEqual(['u1', 'u2'])
    await allSettled(detail.close, { scope, params: 'a' })
    expect(Object.keys(scope.getState(docEdit.$decision))).toEqual(['u2'])
    // u2 сдвинут в A; в A открыли другой документ — u2 ушёл
    await openDoc(scope, 'u3')
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u3' })
    expect(scope.getState(docEdit.$decision)).toEqual({})
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('решение в полёте (busy) уходом документа не снимается — его снимет ответ', async () => {
    let release: () => void = () => {}
    const busy = fork({
      handlers: [
        [fxDocPorts.detailFx, async (id: string) => ({ ...doc, id })],
        [fxDocPorts.searchFx, async () => ({ rows: [], total: 0 })],
        [fxDocPorts.facetsFx, async () => []],
        [fxDocPorts.filterMetaFx, async () => ({ fields: [] })],
        [fxEditPorts.confirmEditFx, () => new Promise<FxDocDetail>((ok) => { release = () => ok({ ...doc, id: 'u1' }) })],
      ],
    })
    await allSettled(lifecycle.pageOpened, { scope: busy })
    await openDoc(busy, 'u1')
    await allSettled(docEdit.confirmRequested, { scope: busy, params: { docId: 'u1', target: 'field:57', when: 't1' } })
    const going = allSettled(docEdit.decisionResult, { scope: busy, params: { docId: 'u1', ok: true } })
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(busy.getState(docEdit.$decision).u1).toMatchObject({ busy: true })
    const closing = allSettled(detail.closeTop, { scope: busy })
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(busy.getState(detail.$slots).a).toBeNull()
    expect(busy.getState(docEdit.$decision).u1).toMatchObject({ busy: true })
    release()
    await going; await closing
    expect(busy.getState(docEdit.$decision)).toEqual({})
    await allSettled(lifecycle.pageClosed, { scope: busy })
  })
})
