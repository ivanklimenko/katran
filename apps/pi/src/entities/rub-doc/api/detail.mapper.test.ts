import { ApiError } from '../../../shared/api'
import { RUB_DETAIL_EXAMPLE as ex } from './detail.example'
import { parseRubDocDetail } from './detail.mapper'

describe('parseRubDocDetail (пример pi-api.md)', () => {
  it('ответ контракта → RubDocDetail: строка реестра, стороны, секции, проводки', () => {
    const d = parseRubDocDetail(ex, 'ответ')
    expect(d).toMatchObject({ id: 'r1', docNumber: '3741', type: 'PAYDOCRU', opCode: '01', scenario: 'SC_NCB_IN_CREDIT', tabsOff: ['stream', 'mpu'] })
    expect(d.party.r.bankInfo).toBe('Филиал в г. Хупево')
    expect(d.agents).toHaveLength(2)
    expect(d.ed107.v['OrderingBank/SWBIC']).toBe('DUZFRUY9')
    expect(d.budget.b101).toBe('')
    expect(d.txs[0]?.currency).toBe('RUB')
  })
  it('битая форма — contractError с путём', () => {
    const noKpp: Record<string, string> = { ...ex.party.s }
    delete noKpp.kpp
    expect(() => parseRubDocDetail({ ...ex, party: { ...ex.party, s: noKpp } }, 'ответ')).toThrow('ответ.party.s.kpp: ожидалась строка')
    expect(() => parseRubDocDetail({ ...ex, agents: {} }, 'ответ')).toThrow('ответ.agents: ожидался массив')
    expect(() => parseRubDocDetail({ ...ex, ed107: { ...ex.ed107, v: { 'OrderingBank/BIC': 45131779 } } }, 'ответ')).toThrow('ответ.ed107.v.OrderingBank/BIC: ожидалась строка')
    expect(() => parseRubDocDetail({ ...ex, prio: 2 }, 'ответ')).toThrow(ApiError)
  })
})

describe('canAnnul и annul детали', () => {
  it('пример: canAnnul true, annul null', () => {
    expect(parseRubDocDetail(ex, 'ответ')).toMatchObject({ canAnnul: true, annul: null })
  })
  it('деталь без canAnnul и annul (примеры 2d) → false и null', () => {
    const old: Record<string, unknown> = { ...ex }
    delete old.canAnnul
    delete old.annul
    expect(parseRubDocDetail(old, 'ответ')).toMatchObject({ canAnnul: false, annul: null })
  })
  it('annul разбирается; битые поля — ошибка с путём', () => {
    const annul = { status: 'done', who: 'Кузнецов Д. А.', when: '2026-10-07T09:15:00', reason: 'Дубликат', by: null, at: null, rejectReason: null, canConfirm: false }
    expect(parseRubDocDetail({ ...ex, canAnnul: false, annul }, 'ответ').annul).toEqual(annul)
    expect(() => parseRubDocDetail({ ...ex, canAnnul: 1 }, 'ответ')).toThrow('ответ.canAnnul: ожидалось true или false')
    expect(() => parseRubDocDetail({ ...ex, annul: { ...annul, canConfirm: undefined } }, 'ответ')).toThrow('ответ.annul.canConfirm')
  })
})

