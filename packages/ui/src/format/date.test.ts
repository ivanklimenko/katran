import { formatDate, formatDateTimeFull, formatDateTimeShort } from './date'

describe('даты', () => {
  const iso = '2026-09-22T07:33:22'
  it('короткая — день.месяц время', () => expect(formatDateTimeShort(iso)).toBe('22.09 07:33:22'))
  it('полная — с годом', () => expect(formatDateTimeFull(iso)).toBe('22.09.2026 07:33:22'))
  it('только дата', () => expect(formatDate(iso)).toBe('22.09.2026'))
  it('невалидная строка — пусто', () => expect(formatDate('нет')).toBe(''))
})
