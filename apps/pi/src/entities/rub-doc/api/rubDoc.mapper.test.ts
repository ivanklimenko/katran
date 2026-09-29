import { ApiError } from '../../../shared/api'
import { parseRubDoc } from './rubDoc.mapper'

const row = {
  id: 'r1', docNumber: '2900', uuid: '00e-1', txId: 'TX1', docRef: 'DR1', created: '2026-09-22T07:00:00', changed: '2026-09-22T08:13:00',
  type: 'PAYDOCRU', edCode: 'ED101', direction: 'IN', dirTxt: 'входящий от ЦБ на клиента', amount: 54.05, queue: 5, prio: 0,
  fromName: 'АО «МЕФЯ ФОТЕ»', fromAcc: '40702810547442693048', fromInn: '1265428092', fromKpp: '409490573', fromBic: '049757384', fromBank: 'АО «МУЛАПЯ БАНК»',
  toName: 'АО «ЗАГЕЛУ МЯТА»', toAcc: '40702810296328313510', toInn: '8298199680', toKpp: '464601040', toBic: '042242532', toBank: 'ФИЛИАЛ № 8771 БАНКА «ТЯПЯ» (ПАО)',
  initiator: 'NCB.NCB_IN', source: 'UFX', destination: 'RTL', purpose: 'Оплата по счёту', status: 'DONE', reason: null,
  lock: null,
  inactive: null,
}

const rowLocked = {
  ...row,
  id: 'r2', status: 'IN_PROGRESS', reason: null,
  lock: { who: 'Иванова М. П.', since: '2026-09-23T09:00:00' },
}

describe('parseRubDoc', () => {
  it('строка контракта → RubDoc', () => { expect(parseRubDoc(row, 'content[0]')).toEqual(row) })
  it('строка с блокировкой → RubDoc', () => { expect(parseRubDoc(rowLocked, 'content[0]')).toEqual(rowLocked) })
  it('код ЭС вне ED101/ED104/ED105 — ошибка контракта', () => {
    expect(() => parseRubDoc({ ...row, edCode: 'ED999' }, 'content[0]')).toThrow('content[0].edCode: недопустимое значение «ED999»')
  })
  it('lock не та форма — contractError с путём', () => {
    expect(() => parseRubDoc({ ...row, lock: { who: 'X' } }, 'content[0]')).toThrow('content[0].lock.since: ожидалась строка')
  })
  it('недопустимый статус — ApiError', () => {
    expect(() => parseRubDoc({ ...row, status: 'NEW' }, 'content[3]')).toThrow(ApiError)
  })
})
