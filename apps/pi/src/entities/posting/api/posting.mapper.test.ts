import { ApiError } from '../../../shared/api'
import { parseTx, parseTxs } from './posting.mapper'

const tx = { dir: 'DEBIT', st: 'EXECUTED', acc: '30110840700000001842', reg: '00000_NostroUSD', time: '2026-09-22T07:33:22.730Z', amount: 1250000, currency: 'USD' }

describe('parseTx', () => {
  it('проводка контракта → Tx; time null — ещё не проведена', () => {
    expect(parseTx(tx, 'txs[0]')).toEqual(tx)
    expect(parseTx({ ...tx, st: 'PENDING', time: null }, 'txs[1]').time).toBeNull()
  })
  it('недопустимое состояние и не та форма — contractError с путём', () => {
    expect(() => parseTx({ ...tx, st: 'DONE' }, 'txs[2]')).toThrow('txs[2].st: недопустимое значение «DONE»')
    expect(() => parseTxs({}, 'txs')).toThrow(ApiError)
    expect(() => parseTxs([tx, { ...tx, amount: '1' }], 'txs')).toThrow('txs[1].amount: ожидалось число')
  })
})
