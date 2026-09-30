import { ApiError } from '../../../shared/api'
import { FX_DETAIL_EXAMPLE as ex } from './detail.example'
import { parseFxDocDetail } from './detail.mapper'

describe('parseFxDocDetail (пример pi-api.md)', () => {
  it('ответ контракта → FxDocDetail: строка реестра, поля, даты, блоки', () => {
    const d = parseFxDocDetail(ex, 'ответ')
    expect(d).toMatchObject({ id: 'u1', docNumber: 812345, type: 'MT103', status: 'ERROR', amount: 1500.5, numDate: '2026-09-23', accDt: '30110840700000001842', inSender: 'NRDIRUMMXXX', tabsOff: ['mpu'] })
    expect(d.valueDates).toEqual(['2026-09-23', '2026-09-23', '2026-09-23', '2026-09-23'])
    expect(d.fields['50']).toEqual(ex.fields['50'])
    expect(d.fields['55']).toEqual({ lines: [] })
    expect(d.txs).toHaveLength(3)
    expect(d.txs[2]).toMatchObject({ st: 'PENDING', time: null })
  })
  it('пустая буква опции — поля opt нет (59 допускает опцию без буквы)', () => {
    const d = parseFxDocDetail({ ...ex, fields: { '59': { opt: '', lines: ['X'] } } }, 'ответ')
    expect(d.fields['59']).toEqual({ lines: ['X'] })
  })
  it('битая форма — contractError с путём', () => {
    expect(() => parseFxDocDetail({ ...ex, fields: { '50': { lines: 'LAVRENTIEV' } } }, 'ответ')).toThrow('ответ.fields.50.lines: ожидался массив')
    expect(() => parseFxDocDetail({ ...ex, valueDates: ['2026-09-23'] }, 'ответ')).toThrow('ответ.valueDates: ожидалось 4 даты')
    expect(() => parseFxDocDetail({ ...ex, txs: [{ ...ex.txs[0], st: 'DONE' }] }, 'ответ')).toThrow('ответ.txs[0].st: недопустимое значение «DONE»')
    expect(() => parseFxDocDetail({ ...ex, amount: '1 500' }, 'ответ')).toThrow(ApiError)
  })
})
