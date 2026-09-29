import { ApiError } from '../../../shared/api'
import { parseFxDoc } from './fxDoc.mapper'

const row = {
  id: 'u1', docNumber: 812345, refIn: 'REF1', refOut: null, uetr: 'x-1',
  created: '2026-09-23T10:52:11', vdDt: '2026-09-23', vdKt: '2026-09-23',
  type: 'MT103', direction: 'IN', dirTxt: 'Входящий от ЦБ', amount: 1500.5, currency: 'USD',
  f50name: 'ООО «Ромашка»', f50acc: '40702840000000000001', purpose: null, f52: 'VKRBRU8KXXX', f57: 'NRDIRUMMXXX',
  f59name: 'АО «Прибой»', f59acc: '40702840000000000002', status: 'ERROR', reason: 'Превышен лимит',
  sender: 'VKRBRU8KXXX', receiver: 'NRDIRUMMXXX', provS: 'LORO', provR: 'NOSTRO',
  lock: null,
  inactive: null,
  f50opt: 'F', f59opt: 'F',
  f52name: 'VOSTOCHNY KREDIT BANK KHABAROVSK BR', f57name: 'NORDINVEST BANK MOSCOW',
  f58: null, f58name: null,
  outSender: 'NRDIRUMMXXX', outReceiver: 'VKRBRU8KXXX',
  routeType: 'LORO', routeRecv: 'MRDNGB2LXXX', routeAcc: '3011081007751234567',
}

const rowLocked = {
  ...row,
  id: 'u2', status: 'IN_PROGRESS', reason: null,
  lock: { who: 'Иванова М. П.', since: '2026-09-23T09:00:00' },
}

describe('parseFxDoc', () => {
  it('строка контракта → FxDoc', () => { expect(parseFxDoc(row, 'content[0]')).toEqual(row) })
  it('строка с блокировкой → FxDoc', () => { expect(parseFxDoc(rowLocked, 'content[0]')).toEqual(rowLocked) })
  it('недопустимый статус и не та форма — contractError с путём', () => {
    expect(() => parseFxDoc({ ...row, status: 'NEW' }, 'content[3]')).toThrow('content[3].status: недопустимое значение «NEW»')
    expect(() => parseFxDoc({ ...row, amount: '1 500' }, 'content[0]')).toThrow(ApiError)
  })
  it('lock не та форма — contractError с путём', () => {
    expect(() => parseFxDoc({ ...row, lock: { who: 'X' } }, 'content[0]')).toThrow('content[0].lock.since: ожидалась строка')
  })
})
