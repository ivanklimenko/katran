import { formatDate, formatDateTimeFull, formatDateTimeShort } from './date'

describe('даты', () => {
  const iso = '2026-09-22T07:33:22'
  it('короткая — день.месяц время', () => expect(formatDateTimeShort(iso)).toBe('22.09 07:33:22'))
  it('полная — с годом', () => expect(formatDateTimeFull(iso)).toBe('22.09.2026 07:33:22'))
  it('только дата', () => expect(formatDate(iso)).toBe('22.09.2026'))
  it('невалидная строка — пусто', () => expect(formatDate('нет')).toBe(''))
  it('дата без времени вне диапазона месяца и дня — пусто', () => {
    expect(formatDate('2026-13-45')).toBe('')
    expect(formatDate('2026-00-10')).toBe('')
    expect(formatDate('2026-09-00')).toBe('')
    expect(formatDate('2026-09-32')).toBe('')
    expect(formatDate('2026-12-31')).toBe('31.12.2026')
    expect(formatDate('2026-01-01')).toBe('01.01.2026')
  })
  it('дата без времени не сдвигается часовым поясом', () => {
    // vi.stubEnv, а не process.env напрямую: пакет собирается под браузер, типов Node в его
    // tsconfig нет — stubEnv меняет process.env.TZ рантайм-Node vitest без ссылки на process в исходниках.
    vi.stubEnv('TZ', 'America/New_York')
    try {
      expect(formatDate('2026-09-23')).toBe('23.09.2026')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
