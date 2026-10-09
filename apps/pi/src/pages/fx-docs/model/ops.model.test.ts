import { allSettled, fork, type Scope } from 'effector'
import { FX_DETAIL_EXAMPLE, currentOf, fxAnnulPorts, fxDocPorts, parseFxDocDetail, type FxDocDetail } from '../../../entities/fx-doc'
import { TRAIL_EXAMPLES, TRAIL_PARSERS } from '../../../entities/doc-trail'
import { ApiError, ratesFx, type Balances, type Rates, type TabQuery } from '../../../shared/api'
import { docAnnul } from './annul.model'
import { docEdit } from './edit.model'
import { balances, fxBalancesFx, rates } from './lookups.model'
import { docNotif, fxNotifPorts } from './notif.model'
import { detail, lifecycle, registry } from './registry.model'

// пример детали — с ожидающим аннулированием (только просмотр, fxViewOnly); для правки — документ без аннулирования
const doc = { ...parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ'), annul: null }
const RATES: Rates = { cb: { rate: '92.5', date: '2026-10-01', rub: '925000.00' }, deal: null }
const BALANCES: Balances = { asOf: '2026-10-01T10:00:00Z', items: [] }
const conflict = () => new ApiError(409, { type: 'urn:katran:x', title: 'Конфликт', status: 409 }, 'Конфликт')

type Opts = { annul?: () => Promise<void>; resend?: () => Promise<unknown> }
/** Экран со счётчиками запросов детали, вкладок и реестра; свежая деталь после команды — docNumber 777. */
function page(opts: Opts = {}) {
  const calls = { detail: [] as string[], tabs: [] as string[], search: 0 }
  const scope = fork({
    handlers: [
      [fxDocPorts.detailFx, async (id: string) => { calls.detail.push(id); return { ...doc, id } }],
      [fxDocPorts.tabFx, async ({ id, tab }: TabQuery) => { calls.tabs.push(`${id}:${tab}`); return { rows: ['старая'] } }],
      [fxDocPorts.searchFx, async () => { calls.search += 1; return { rows: [], total: 0 } }],
      [fxDocPorts.facetsFx, async () => []],
      [fxDocPorts.filterMetaFx, async () => ({ fields: [] })],
      [fxAnnulPorts.annulFx, opts.annul ?? (async () => undefined)],
      [fxAnnulPorts.detailFx, async (id: string): Promise<FxDocDetail> => ({ ...doc, id, docNumber: 777 })],
      [ratesFx, async () => RATES],
      [fxBalancesFx, async () => BALANCES],
      [fxNotifPorts.resendFx, opts.resend ?? (async () => TRAIL_EXAMPLES.notif)],
    ],
  })
  return { scope, calls }
}
const openDoc = (scope: Scope, id: string, secondary = false) => allSettled(registry.openRequested, { scope, params: { id, secondary } })
async function lookupsLoaded(scope: Scope, ...ids: string[]) {
  for (const id of ids) {
    await allSettled(rates.load, { scope, params: id })
    await allSettled(balances.load, { scope, params: id })
  }
}
const lookupIds = (scope: Scope) => ({ rates: Object.keys(scope.getState(rates.$data)), balances: Object.keys(scope.getState(balances.$data)) })
async function annul(scope: Scope, id: string) {
  await allSettled(docAnnul.annulRequested, { scope, params: id })
  await allSettled(docAnnul.reasonChanged, { scope, params: { docId: id, reason: 'Ошибка в реквизитах' } })
  await allSettled(docAnnul.promptResult, { scope, params: { docId: id, ok: true } })
}

describe('страница fx-docs: аннулирование ↔ деталка, реестр, справочные запросы (спека 2e §3.6)', () => {
  it('docAnnulled — свежая деталь в кэш без запроса детали, реестр заново, курсы и остатки документа сброшены; другого — нет', async () => {
    const { scope, calls } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await openDoc(scope, 'u2', true)
    await lookupsLoaded(scope, 'u1', 'u2')
    expect(calls).toMatchObject({ detail: ['u1', 'u2'], search: 1 })
    await annul(scope, 'u1')
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u1', state: 'ready', data: { docNumber: 777 } })
    expect(calls).toMatchObject({ detail: ['u1', 'u2'], search: 2 })
    expect(lookupIds(scope)).toEqual({ rates: ['u2'], balances: ['u2'] })
    expect(scope.getState(docAnnul.$prompt)).toEqual({})
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('refreshNeeded (409 команды) — деталь документа и реестр заново, справочные запросы документа сброшены', async () => {
    const { scope, calls } = page({ annul: async () => { throw conflict() } })
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await lookupsLoaded(scope, 'u1')
    await annul(scope, 'u1')
    expect(calls).toMatchObject({ detail: ['u1', 'u1'], search: 2 })
    expect(lookupIds(scope)).toEqual({ rates: [], balances: [] })
    expect(scope.getState(docAnnul.$prompt)).toEqual({})
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('detail.refreshDoc и replaceDetail документа — reset его справочных запросов', async () => {
    const { scope } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await lookupsLoaded(scope, 'u1', 'u2')
    await allSettled(detail.refreshDoc, { scope, params: 'u1' })
    expect(lookupIds(scope)).toEqual({ rates: ['u2'], balances: ['u2'] })
    await allSettled(detail.replaceDetail, { scope, params: { id: 'u2', detail: { ...doc, id: 'u2' } } })
    expect(lookupIds(scope)).toEqual({ rates: [], balances: [] })
    await allSettled(lifecycle.pageClosed, { scope })
  })
})

describe('страница fx-docs: нотификации ↔ деталка (спека 2e §3.6)', () => {
  it('resent — ответ переотправки разобран парсером вкладки и лежит в её кэше без её запроса', async () => {
    const { scope, calls } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await allSettled(detail.setTab, { scope, params: { slot: 'a', tab: 'notif' } })
    expect(scope.getState(detail.$slots).a?.tabView).toMatchObject({ state: 'ready', data: { rows: ['старая'] } })
    await allSettled(docNotif.resendRequested, { scope, params: { docId: 'u1' } })
    await allSettled(docNotif.resendResult, { scope, params: { docId: 'u1', ok: true } })
    // сырое тело — как ответ GET вкладки: вид вкладки получает разобранный массив, а не объект ответа
    expect(scope.getState(detail.$slots).a?.tabView).toEqual({ state: 'ready', data: TRAIL_PARSERS.notif(TRAIL_EXAMPLES.notif, 'ответ'), error: null })
    expect(calls).toMatchObject({ detail: ['u1'], tabs: ['u1:notif'] })
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('resent с телом не по контракту — в кэш не кладётся, «Обновить» документа (вкладка перезапрошена)', async () => {
    const { scope, calls } = page({ resend: async () => ({ notifications: 'нет' }) })
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await allSettled(detail.setTab, { scope, params: { slot: 'a', tab: 'notif' } })
    await allSettled(docNotif.resendRequested, { scope, params: { docId: 'u1' } })
    await allSettled(docNotif.resendResult, { scope, params: { docId: 'u1', ok: true } })
    expect(calls).toMatchObject({ detail: ['u1', 'u1'], tabs: ['u1:notif', 'u1:notif'] })
    expect(scope.getState(detail.$slots).a?.tabView).toMatchObject({ state: 'ready', data: { rows: ['старая'] } })
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('resendConflict (409) — «Обновить» документа: деталь и активная вкладка заново', async () => {
    const { scope, calls } = page({ resend: async () => { throw conflict() } })
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await allSettled(detail.setTab, { scope, params: { slot: 'a', tab: 'notif' } })
    await allSettled(docNotif.resendRequested, { scope, params: { docId: 'u1', nid: 'n1', n: 1 } })
    await allSettled(docNotif.resendResult, { scope, params: { docId: 'u1', ok: true } })
    expect(calls).toMatchObject({ detail: ['u1', 'u1'], tabs: ['u1:notif', 'u1:notif'] })
    await allSettled(lifecycle.pageClosed, { scope })
  })
})

describe('страница fx-docs: взаимная блокировка аннулирования и правки (Review Focus 2)', () => {
  it('открыт редактор документа — его annulRequested игнорируется; другой документ аннулировать можно', async () => {
    const { scope } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await openDoc(scope, 'u2', true)
    await allSettled(docEdit.model.open, { scope, params: { key: 'u1:refOut', initial: currentOf(doc, 'refOut') } })
    expect(scope.getState(docAnnul.$blockedDocs)).toEqual({ u1: true })
    await allSettled(docAnnul.annulRequested, { scope, params: 'u1' })
    expect(scope.getState(docAnnul.$prompt)).toEqual({})
    await allSettled(docAnnul.annulRequested, { scope, params: 'u2' })
    expect(Object.keys(scope.getState(docAnnul.$prompt))).toEqual(['u2'])
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('открыт Prompt аннулирования документа — правка его заблокирована (open вида, решения); правка другого — нет', async () => {
    const { scope } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await openDoc(scope, 'u2', true)
    await allSettled(docAnnul.annulRequested, { scope, params: 'u1' })
    // $blockedDocs правки — то, по чему useEditContexts не даёт open, revert и canDecide (тест вида — features/doc-edit)
    expect(scope.getState(docEdit.$blockedDocs)).toEqual({ u1: true })
    await allSettled(docEdit.confirmRequested, { scope, params: { docId: 'u1', target: 'field:57', when: 't1' } })
    expect(scope.getState(docEdit.$decision)).toEqual({})
    await allSettled(docEdit.confirmRequested, { scope, params: { docId: 'u2', target: 'field:57', when: 't2' } })
    expect(Object.keys(scope.getState(docEdit.$decision))).toEqual(['u2'])
    // Prompt закрыт — блокировка снята
    await allSettled(docAnnul.promptResult, { scope, params: { docId: 'u1', ok: false } })
    expect(scope.getState(docEdit.$blockedDocs)).toEqual({})
    await allSettled(lifecycle.pageClosed, { scope })
  })
})

describe('страница fx-docs: только просмотр при аннулировании снаружи (fxViewOnly, спека 2e §1.3)', () => {
  const pendingAnnul = {
    status: 'pending' as const, who: 'Петров А. С.', when: '2026-10-01T10:00:00', reason: 'Дубль',
    by: null, at: null, rejectReason: null, canConfirm: false,
  }

  it.each(['pending', 'done'] as const)('открыт грязный редактор, деталь пришла с annul: %s — редактор закрыт, документ не занят', async (status) => {
    const { scope } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await allSettled(docEdit.model.open, { scope, params: { key: 'u1:refOut', initial: currentOf(doc, 'refOut') } })
    await allSettled(docEdit.model.change, { scope, params: { key: 'u1:refOut', draft: 'ДРУГОЙ-20' } })
    expect(scope.getState(docEdit.model.$editing)).not.toBeNull()
    await allSettled(detail.replaceDetail, { scope, params: { id: 'u1', detail: { ...doc, id: 'u1', annul: { ...pendingAnnul, status } } } })
    expect(scope.getState(docEdit.model.$editing)).toBeNull()
    expect(scope.getState(docEdit.$busyDocs)).toEqual({})
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('аннулирование отклонено — правка разрешена, редактор остаётся', async () => {
    const { scope } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await allSettled(docEdit.model.open, { scope, params: { key: 'u1:refOut', initial: currentOf(doc, 'refOut') } })
    await allSettled(detail.replaceDetail, { scope, params: { id: 'u1', detail: { ...doc, id: 'u1', annul: { ...pendingAnnul, status: 'rejected' } } } })
    expect(scope.getState(docEdit.model.$editing)).toMatchObject({ key: 'u1:refOut' })
    await allSettled(lifecycle.pageClosed, { scope })
  })
})

describe('страница fx-docs: Prompt аннулирования документа, ушедшего из слотов (R12)', () => {
  it('открытый Prompt снимается, когда документ ушёл из слотов; Prompt оставшегося — жив', async () => {
    const { scope } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await openDoc(scope, 'u2', true)
    await allSettled(docAnnul.annulRequested, { scope, params: 'u1' })
    await allSettled(docAnnul.annulRequested, { scope, params: 'u2' })
    await allSettled(detail.close, { scope, params: 'a' })
    expect(Object.keys(scope.getState(docAnnul.$prompt))).toEqual(['u2'])
    await openDoc(scope, 'u3')
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'u3' })
    expect(scope.getState(docAnnul.$prompt)).toEqual({})
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('Prompt в полёте (busy) уходом документа не снимается — его снимет ответ', async () => {
    let release: () => void = () => {}
    const { scope } = page({ annul: () => new Promise<void>((ok) => { release = ok }) })
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'u1')
    await allSettled(docAnnul.annulRequested, { scope, params: 'u1' })
    await allSettled(docAnnul.reasonChanged, { scope, params: { docId: 'u1', reason: 'Дубль' } })
    const going = allSettled(docAnnul.promptResult, { scope, params: { docId: 'u1', ok: true } })
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(scope.getState(docAnnul.$prompt).u1).toMatchObject({ busy: true })
    const closing = allSettled(detail.closeTop, { scope })
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(scope.getState(detail.$slots).a).toBeNull()
    expect(scope.getState(docAnnul.$prompt).u1).toMatchObject({ busy: true })
    release()
    await going; await closing
    expect(scope.getState(docAnnul.$prompt)).toEqual({})
    await allSettled(lifecycle.pageClosed, { scope })
  })
})
