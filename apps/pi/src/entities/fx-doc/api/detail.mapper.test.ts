import { ApiError } from '../../../shared/api'
import { currentOf, fieldTarget, isChanged, originalOf, sameEditValue } from '../model/edit'
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
  const hist1 = {
    who: 'Кузнецов Д. А.', when: '2026-09-22T09:15:00', was: { opt: 'A', lines: ['A1'] }, now: { opt: 'A', lines: ['X'] },
    note: 'BIC филиала по справочнику', status: 'confirmed', by: 'Смирнова Е. В.', at: '2026-09-22T09:40:00',
  }
  const histRoute = { who: 'система', when: '2026-09-22T10:00:00', was: 'NOSTRO 1 → A', now: 'LORO 2 → B', status: 'confirmed', by: 'система', at: '2026-09-22T10:00:00' }
  it('edits: цели, история, статусы; нет поля — {}; чужой статус — contractError', () => {
    const d = parseFxDocDetail({ ...ex, edits: { 'field:57': { now: { opt: 'A', lines: ['X'] }, hist: [hist1] }, route: { now: null, hist: [histRoute] } } }, 'ответ')
    expect(d.edits['field:57']?.hist[0]).toEqual({ who: 'Кузнецов Д. А.', when: '2026-09-22T09:15:00', was: { opt: 'A', lines: ['A1'] }, now: { opt: 'A', lines: ['X'] }, note: 'BIC филиала по справочнику', status: 'confirmed', by: 'Смирнова Е. В.', at: '2026-09-22T09:40:00' })
    expect(d.edits['field:57']?.now).toEqual({ opt: 'A', lines: ['X'] })
    // маршрут: now = null, значения истории — строки; note/by/at без значения — null
    expect(d.edits.route).toEqual({ now: null, hist: [{ ...histRoute, note: null }] })
    expect(parseFxDocDetail({ ...ex, edits: undefined }, 'ответ').edits).toEqual({})
    expect(() => parseFxDocDetail({ ...ex, edits: { refOut: { now: 'A', hist: [{ ...hist1, status: 'done' }] } } }, 'ответ')).toThrow(/edits\.refOut\.hist\[0\]\.status/)
    expect(() => parseFxDocDetail({ ...ex, edits: { refOut: { now: 'A', hist: 'x' } } }, 'ответ')).toThrow('ответ.edits.refOut.hist: ожидался массив')
    expect(() => parseFxDocDetail({ ...ex, edits: { 'field:57': { now: { lines: 'X' }, hist: [] } } }, 'ответ')).toThrow('ответ.edits.field:57.now.lines: ожидался массив')
    expect(() => parseFxDocDetail({ ...ex, edits: { refOut: { now: 'A', hist: [{ ...hist1, was: 5 }] } } }, 'ответ')).toThrow('ответ.edits.refOut.hist[0].was: ожидался объект')
  })
  it('пример pi-api: правка поля 57 — две записи, now = fields[57], поле изменено', () => {
    const d = parseFxDocDetail(ex, 'ответ')
    const e = d.edits[fieldTarget('57')]!
    expect(e.hist.map((h) => [h.who, h.status])).toEqual([['Кузнецов Д. А.', 'confirmed'], ['Иванова М. П.', 'pending']])
    expect(e.now).toEqual(d.fields['57'])
    expect(isChanged(d, 'field:57')).toBe(true)
    expect(Object.keys(d.edits)).toEqual(['field:57'])
  })
  it('currentOf / originalOf / isChanged: правка, откат с историей, без правки', () => {
    const base = parseFxDocDetail({ ...ex, edits: {} }, 'ответ')
    // без правки: исходное = текущее, пустое поле — { lines: [] }
    expect(currentOf(base, 'field:52')).toEqual({ opt: 'A', lines: ['NORDINVEST BANK MOSCOW', 'NRDIRUMMXXX'] })
    expect(currentOf(base, 'field:55')).toEqual({ lines: [] })
    expect(currentOf(base, 'field:B.57')).toEqual({ lines: [] })
    expect(currentOf(base, 'refOut')).toBe('')
    expect(currentOf(base, 'accDt')).toBe('30110840700000001842')
    expect(currentOf(base, 'accKt')).toBe('40817840100050017762')
    expect(currentOf(base, 'valueDate')).toBe('2026-09-23')
    expect(originalOf(base, 'refOut')).toBe('')
    expect(isChanged(base, 'refOut')).toBe(false)
    // правка 20 исх: исходное — was первой записи
    const entry = { who: 'Вы', when: '2026-09-23T11:00:00', was: '', now: 'OUT1', note: null, status: 'pending' as const, by: null, at: null }
    const edited = { ...base, refOut: 'OUT1', edits: { refOut: { now: 'OUT1', hist: [entry] } } }
    expect(currentOf(edited, 'refOut')).toBe('OUT1')
    expect(originalOf(edited, 'refOut')).toBe('')
    expect(isChanged(edited, 'refOut')).toBe(true)
    // откат: текущее снова исходное, история остаётся — isChanged false
    const reverted = { ...edited, refOut: '', edits: { refOut: { now: '', hist: [entry, { ...entry, was: 'OUT1', now: '' }] } } }
    expect(reverted.edits.refOut.hist).toHaveLength(2)
    expect(isChanged(reverted, 'refOut')).toBe(false)
    // дата валютирования — первая из четырёх
    expect(currentOf({ ...base, valueDates: ['2026-09-25', '2026-09-23', '2026-09-23', '2026-09-23'] }, 'valueDate')).toBe('2026-09-25')
  })
  it('sameEditValue: строки — как есть; объекты — по opt, acc (пустое = нет) и строкам', () => {
    expect(sameEditValue('A', 'A')).toBe(true)
    expect(sameEditValue('A', 'B')).toBe(false)
    expect(sameEditValue('', { lines: [] })).toBe(false)
    expect(sameEditValue({ opt: 'A', lines: ['X'] }, { lines: ['X'], opt: 'A' })).toBe(true)
    expect(sameEditValue({ opt: '', acc: undefined, lines: [] }, { lines: [] })).toBe(true)
    expect(sameEditValue({ opt: 'A', lines: ['X'] }, { opt: 'D', lines: ['X'] })).toBe(false)
    expect(sameEditValue({ acc: '1', lines: ['X'] }, { acc: '2', lines: ['X'] })).toBe(false)
    expect(sameEditValue({ lines: ['X'] }, { lines: ['X', ''] })).toBe(false)
    expect(sameEditValue({ lines: ['X'] }, { lines: ['Y'] })).toBe(false)
  })
})
