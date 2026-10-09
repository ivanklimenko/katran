import { parseAnnul, parseCanAnnul } from './annul'
import { ApiError } from './problem'

const pending = { status: 'pending', who: 'Кузнецов Д. А.', when: '2026-10-07T09:15:00', reason: 'Дубликат платежа', by: null, at: null, rejectReason: null, canConfirm: true }

describe('parseAnnul', () => {
  it('null и отсутствие ключа — null (аннулирования не было)', () => {
    expect(parseAnnul(null, 'ответ.annul')).toBeNull()
    expect(parseAnnul(undefined, 'ответ.annul')).toBeNull()
  })
  it('pending без второй руки: by, at, rejectReason — null, canConfirm — как есть', () => {
    expect(parseAnnul(pending, 'ответ.annul')).toEqual(pending)
  })
  it('done через утверждение и rejected с причиной разбираются', () => {
    const done = { ...pending, status: 'done', by: 'Смирнова Е. В.', at: '2026-10-07T09:40:00', canConfirm: false }
    expect(parseAnnul(done, 'ответ.annul')).toEqual(done)
    const rej = { ...done, status: 'rejected', rejectReason: 'Платёж уже исполнен' }
    expect(parseAnnul(rej, 'ответ.annul')?.rejectReason).toBe('Платёж уже исполнен')
  })
  it('чужой статус — ошибка с путём ответ.annul.status', () => {
    expect(() => parseAnnul({ ...pending, status: 'cancelled' }, 'ответ.annul')).toThrow('ответ.annul.status: недопустимое значение «cancelled»')
  })
  it('нет ключа canConfirm — ошибка с путём (ключи обязательны)', () => {
    const rest: Record<string, unknown> = { ...pending }
    delete rest.canConfirm
    expect(() => parseAnnul(rest, 'ответ.annul')).toThrow('ответ.annul.canConfirm: ожидалось true или false')
    expect(() => parseAnnul(rest, 'ответ.annul')).toThrow(ApiError)
  })
  it('не объект и не строка в who — ошибка с путём', () => {
    expect(() => parseAnnul('x', 'ответ.annul')).toThrow('ответ.annul: ожидался объект')
    expect(() => parseAnnul({ ...pending, who: 5 }, 'ответ.annul')).toThrow('ответ.annul.who: ожидалась строка')
  })
})

describe('parseCanAnnul', () => {
  it('нет ключа — false; boolean — как есть; не boolean — ошибка ответ.canAnnul', () => {
    expect(parseCanAnnul({}, 'ответ')).toBe(false)
    expect(parseCanAnnul({ canAnnul: true }, 'ответ')).toBe(true)
    expect(() => parseCanAnnul({ canAnnul: 'yes' }, 'ответ')).toThrow('ответ.canAnnul: ожидалось true или false')
  })
})
