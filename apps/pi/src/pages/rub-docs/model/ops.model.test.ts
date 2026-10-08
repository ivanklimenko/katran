import { allSettled, fork, type Scope } from 'effector'
import { RUB_DETAIL_EXAMPLE, parseRubDocDetail, rubAnnulPorts, rubDocPorts, type RubDocDetail } from '../../../entities/rub-doc'
import { TRAIL_EXAMPLES, TRAIL_PARSERS } from '../../../entities/doc-trail'
import { ApiError, type Balances, type TabQuery } from '../../../shared/api'
import { docAnnul } from './annul.model'
import { balances, rubBalancesFx } from './lookups.model'
import { docNotif, rubNotifPorts } from './notif.model'
import { detail, lifecycle, registry } from './registry.model'

const doc = parseRubDocDetail(RUB_DETAIL_EXAMPLE, 'ответ')
const BALANCES: Balances = { asOf: '2026-10-01T10:00:00Z', items: [] }
const conflict = () => new ApiError(409, { type: 'urn:katran:x', title: 'Конфликт', status: 409 }, 'Конфликт')

type Opts = { annul?: () => Promise<void>; resend?: () => Promise<unknown> }
/** Экран со счётчиками запросов детали, вкладок и реестра; свежая деталь после команды — docNumber '777'. */
function page(opts: Opts = {}) {
  const calls = { detail: [] as string[], tabs: [] as string[], search: 0 }
  const scope = fork({
    handlers: [
      [rubDocPorts.detailFx, async (id: string) => { calls.detail.push(id); return { ...doc, id } }],
      [rubDocPorts.tabFx, async ({ id, tab }: TabQuery) => { calls.tabs.push(`${id}:${tab}`); return { rows: ['старая'] } }],
      [rubDocPorts.searchFx, async () => { calls.search += 1; return { rows: [], total: 0 } }],
      [rubDocPorts.facetsFx, async () => []],
      [rubDocPorts.filterMetaFx, async () => ({ fields: [] })],
      [rubAnnulPorts.annulFx, opts.annul ?? (async () => undefined)],
      [rubAnnulPorts.detailFx, async (id: string): Promise<RubDocDetail> => ({ ...doc, id, docNumber: '777' })],
      [rubBalancesFx, async () => BALANCES],
      [rubNotifPorts.resendFx, opts.resend ?? (async () => TRAIL_EXAMPLES.notif)],
    ],
  })
  return { scope, calls }
}
const openDoc = (scope: Scope, id: string, secondary = false) => allSettled(registry.openRequested, { scope, params: { id, secondary } })
const balanceIds = (scope: Scope) => Object.keys(scope.getState(balances.$data))
async function annul(scope: Scope, id: string) {
  await allSettled(docAnnul.annulRequested, { scope, params: id })
  await allSettled(docAnnul.reasonChanged, { scope, params: { docId: id, reason: 'Ошибка в реквизитах' } })
  await allSettled(docAnnul.promptResult, { scope, params: { docId: id, ok: true } })
}

describe('страница rub-docs: аннулирование ↔ деталка, реестр, остатки (спека 2e §3.6)', () => {
  it('docAnnulled — свежая деталь в кэш без запроса детали, реестр заново, остатки документа сброшены; другого — нет', async () => {
    const { scope, calls } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'r1')
    await openDoc(scope, 'r2', true)
    await allSettled(balances.load, { scope, params: 'r1' })
    await allSettled(balances.load, { scope, params: 'r2' })
    await annul(scope, 'r1')
    expect(scope.getState(detail.$slots).a).toMatchObject({ id: 'r1', state: 'ready', data: { docNumber: '777' } })
    expect(calls).toMatchObject({ detail: ['r1', 'r2'], search: 2 })
    expect(balanceIds(scope)).toEqual(['r2'])
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('refreshNeeded (409 команды) — деталь документа и реестр заново, остатки документа сброшены', async () => {
    const { scope, calls } = page({ annul: async () => { throw conflict() } })
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'r1')
    await allSettled(balances.load, { scope, params: 'r1' })
    await annul(scope, 'r1')
    expect(calls).toMatchObject({ detail: ['r1', 'r1'], search: 2 })
    expect(balanceIds(scope)).toEqual([])
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('detail.refreshDoc и replaceDetail документа — reset его остатков', async () => {
    const { scope } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'r1')
    await allSettled(balances.load, { scope, params: 'r1' })
    await allSettled(balances.load, { scope, params: 'r2' })
    await allSettled(detail.refreshDoc, { scope, params: 'r1' })
    expect(balanceIds(scope)).toEqual(['r2'])
    await allSettled(detail.replaceDetail, { scope, params: { id: 'r2', detail: { ...doc, id: 'r2' } } })
    expect(balanceIds(scope)).toEqual([])
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('без правки аннулирование не блокируется: $blockedDocs пуст', async () => {
    const { scope } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'r1')
    await allSettled(docAnnul.annulRequested, { scope, params: 'r1' })
    expect(scope.getState(docAnnul.$blockedDocs)).toEqual({})
    expect(Object.keys(scope.getState(docAnnul.$prompt))).toEqual(['r1'])
    await allSettled(lifecycle.pageClosed, { scope })
  })
})

describe('страница rub-docs: нотификации ↔ деталка (спека 2e §3.6)', () => {
  it('resent — ответ переотправки разобран парсером вкладки и лежит в её кэше без её запроса', async () => {
    const { scope, calls } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'r1')
    await allSettled(detail.setTab, { scope, params: { slot: 'a', tab: 'notif' } })
    expect(scope.getState(detail.$slots).a?.tabView).toMatchObject({ state: 'ready', data: { rows: ['старая'] } })
    await allSettled(docNotif.resendRequested, { scope, params: { docId: 'r1' } })
    await allSettled(docNotif.resendResult, { scope, params: { docId: 'r1', ok: true } })
    // сырое тело — как ответ GET вкладки: вид вкладки получает разобранный массив, а не объект ответа
    expect(scope.getState(detail.$slots).a?.tabView).toEqual({ state: 'ready', data: TRAIL_PARSERS.notif(TRAIL_EXAMPLES.notif, 'ответ'), error: null })
    expect(calls).toMatchObject({ detail: ['r1'], tabs: ['r1:notif'] })
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('resent с телом не по контракту — в кэш не кладётся, «Обновить» документа (вкладка перезапрошена)', async () => {
    const { scope, calls } = page({ resend: async () => ({ notifications: 'нет' }) })
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'r1')
    await allSettled(detail.setTab, { scope, params: { slot: 'a', tab: 'notif' } })
    await allSettled(docNotif.resendRequested, { scope, params: { docId: 'r1' } })
    await allSettled(docNotif.resendResult, { scope, params: { docId: 'r1', ok: true } })
    expect(calls).toMatchObject({ detail: ['r1', 'r1'], tabs: ['r1:notif', 'r1:notif'] })
    expect(scope.getState(detail.$slots).a?.tabView).toMatchObject({ state: 'ready', data: { rows: ['старая'] } })
    await allSettled(lifecycle.pageClosed, { scope })
  })

  it('resendConflict (409) — «Обновить» документа: деталь и активная вкладка заново', async () => {
    const { scope, calls } = page({ resend: async () => { throw conflict() } })
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'r1')
    await allSettled(detail.setTab, { scope, params: { slot: 'a', tab: 'notif' } })
    await allSettled(docNotif.resendRequested, { scope, params: { docId: 'r1', nid: 'n1', n: 1 } })
    await allSettled(docNotif.resendResult, { scope, params: { docId: 'r1', ok: true } })
    expect(calls).toMatchObject({ detail: ['r1', 'r1'], tabs: ['r1:notif', 'r1:notif'] })
    await allSettled(lifecycle.pageClosed, { scope })
  })
})

describe('страница rub-docs: Prompt аннулирования документа, ушедшего из слотов (R12)', () => {
  it('открытый Prompt снимается, когда документ ушёл из слотов; Prompt оставшегося — жив', async () => {
    const { scope } = page()
    await allSettled(lifecycle.pageOpened, { scope })
    await openDoc(scope, 'r1')
    await openDoc(scope, 'r2', true)
    await allSettled(docAnnul.annulRequested, { scope, params: 'r1' })
    await allSettled(docAnnul.annulRequested, { scope, params: 'r2' })
    await allSettled(detail.close, { scope, params: 'a' })
    expect(Object.keys(scope.getState(docAnnul.$prompt))).toEqual(['r2'])
    await openDoc(scope, 'r3')
    expect(scope.getState(docAnnul.$prompt)).toEqual({})
    await allSettled(lifecycle.pageClosed, { scope })
  })
})
