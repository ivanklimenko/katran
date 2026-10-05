import { formatDuration, formatTimestamp, timestampDiff } from './time'

describe('formatTimestamp', () => {
  it('ISO без зоны с миллисекундами (форма бека) — дата без года, время, доли отдельно, полная форма с годом', () => {
    expect(formatTimestamp('2026-09-22T07:31:45.241')).toEqual({ date: '22.09', time: '07:31:45', ms: '241', full: '22.09.2026 07:31:45.241' })
  })
  it('ISO без зоны без миллисекунд — ms пустой, full без хвоста', () => {
    expect(formatTimestamp('2026-09-22T07:33:21')).toEqual({ date: '22.09', time: '07:33:21', ms: '', full: '22.09.2026 07:33:21' })
  })
  it('разделитель — пробел (как в моках эталона)', () => {
    expect(formatTimestamp('2026-09-22 07:31:45.241')?.full).toBe('22.09.2026 07:31:45.241')
  })
  it('доли секунды — ровно три знака: короче — дополняются нулями, длиннее — отбрасываются', () => {
    expect(formatTimestamp('2026-09-22T07:31:45.5')?.ms).toBe('500')
    expect(formatTimestamp('2026-09-22T07:31:45.051765')?.ms).toBe('051')
  })
  it('настенное время: часовой пояс браузера цифры не сдвигает', () => {
    vi.stubEnv('TZ', 'America/New_York')
    try {
      expect(formatTimestamp('2026-09-22T00:10:00.000')?.full).toBe('22.09.2026 00:10:00.000')
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it('хвост зоны допускается и не пересчитывается — берутся цифры строки', () => {
    vi.stubEnv('TZ', 'Europe/Moscow')
    try {
      expect(formatTimestamp('2026-09-22T04:35:02.121Z')).toEqual({ date: '22.09', time: '04:35:02', ms: '121', full: '22.09.2026 04:35:02.121' })
      expect(formatTimestamp('2026-09-22T22:00:00+03:00')?.full).toBe('22.09.2026 22:00:00')
      expect(formatTimestamp('2026-09-22T22:00:00-0500')?.full).toBe('22.09.2026 22:00:00')
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it('не ISO — null: пусто, прочерк, только дата, русская запись, месяц/час/минута вне диапазона, мусор вокруг', () => {
    for (const s of ['', '—', '2026-09-22', '22.09.2026 07:31:45', '2026-13-01T10:00:00', '2026-09-22T24:00:00', '2026-09-22T07:60:00', 'x2026-09-22T07:31:45', '2026-09-22T07:31:45.241 МСК']) {
      expect(formatTimestamp(s)).toBeNull()
    }
  })
})

describe('timestampDiff', () => {
  it('разница в миллисекундах между метками без зоны', () => {
    expect(timestampDiff('2026-09-22T07:31:45.241', '2026-09-22T07:31:45.642')).toBe(401)
    expect(timestampDiff('2026-09-22T07:31:48.141', '2026-09-22T07:33:20.383')).toBe(92_242)
    expect(timestampDiff('2026-09-22T07:31:59', '2026-09-22T07:32:00.250')).toBe(1250)
  })
  it('через полночь; с хвостом зоны — по цифрам строк, как formatTimestamp', () => {
    expect(timestampDiff('2026-09-22T23:59:59.500', '2026-09-23T00:00:00.500')).toBe(1000)
    expect(timestampDiff('2026-09-22T04:35:02.121Z', '2026-09-22T04:35:47.308Z')).toBe(45_187)
    expect(timestampDiff('2026-09-22T07:00:00+03:00', '2026-09-22T07:00:01Z')).toBe(1000)
  })
  it('обратный порядок — отрицательное; неразобранная метка — null', () => {
    expect(timestampDiff('2026-09-22T07:31:46', '2026-09-22T07:31:45')).toBe(-1000)
    expect(timestampDiff('', '2026-09-22T07:31:45')).toBeNull()
    expect(timestampDiff('2026-09-22T07:31:45', 'нет')).toBeNull()
  })
})

describe('formatDuration', () => {
  it('до секунды — миллисекунды целым', () => {
    expect(formatDuration(0)).toBe('0 мс')
    expect(formatDuration(401)).toBe('401 мс')
    expect(formatDuration(999)).toBe('999 мс')
    expect(formatDuration(999.4)).toBe('999 мс')
  })
  it('до минуты — секунды с одним знаком через запятую, без округления вверх', () => {
    expect(formatDuration(999.6)).toBe('1,0 с')
    expect(formatDuration(1000)).toBe('1,0 с')
    expect(formatDuration(4249)).toBe('4,2 с')
    expect(formatDuration(59_900)).toBe('59,9 с')
    expect(formatDuration(59_999)).toBe('59,9 с')
  })
  it('до часа — минуты и секунды, ноль секунд не пишется', () => {
    expect(formatDuration(60_000)).toBe('1 мин')
    expect(formatDuration(92_242)).toBe('1 мин 32 с')
    expect(formatDuration(185_000)).toBe('3 мин 5 с')
    expect(formatDuration(3_599_000)).toBe('59 мин 59 с')
    expect(formatDuration(3_599_999)).toBe('59 мин 59 с')
  })
  it('от часа — часы и минуты, ноль минут не пишется; сутки не выделяются', () => {
    expect(formatDuration(3_600_000)).toBe('1 ч')
    expect(formatDuration(7_800_000)).toBe('2 ч 10 мин')
    expect(formatDuration(93_780_000)).toBe('26 ч 3 мин')
  })
  it('отрицательное, NaN, бесконечность — пусто', () => {
    expect(formatDuration(-1)).toBe('')
    expect(formatDuration(Number.NaN)).toBe('')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('')
  })
})
