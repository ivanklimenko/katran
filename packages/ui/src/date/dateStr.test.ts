import {
  addDays, addMonths, compareDates, dayOf, daysInMonth, endOfMonth, formatDateText, isComplete, isoDayEnd, isoDayStart,
  isoMinuteEnd, isoMinuteStart, isValidDay, isValidMinute, maskDateText, monthGrid, parseDateText, startOfMonth, timeOf,
  todayLocal, weekday, withTime, datePartOf,
} from './dateStr'

const ZONES = ['UTC', 'Europe/Moscow', 'America/New_York']

describe('календарь', () => {
  it('валидность дня и минуты', () => {
    expect(isValidDay('2024-02-29')).toBe(true)
    expect(isValidDay('2026-02-29')).toBe(false)
    expect(isValidDay('2026-02-31')).toBe(false)
    expect(isValidDay('2026-13-01')).toBe(false)
    expect(isValidDay('2026-9-1')).toBe(false)
    expect(isValidMinute('2026-09-01T23:59')).toBe(true)
    expect(isValidMinute('2026-09-01T24:00')).toBe(false)
    expect(isValidMinute('2026-09-01T23:60')).toBe(false)
    expect(daysInMonth(1900, 2)).toBe(28)
    expect(daysInMonth(2000, 2)).toBe(29)
  })
  it('арифметика дней и месяцев', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-09-30', 365)).toBe('2027-09-30')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15')
    expect(startOfMonth('2026-09-17')).toBe('2026-09-01')
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(dayOf('2026-09-01T18:30')).toBe('2026-09-01')
    expect(timeOf('2026-09-01T18:30')).toBe('18:30')
    expect(timeOf('2026-09-01')).toBe('')
  })
  it('день недели с понедельника и сетка месяца', () => {
    expect(weekday('1970-01-01')).toBe(4)
    expect(weekday('2026-09-28')).toBe(1)
    expect(weekday('2026-09-27')).toBe(7)
    const g = monthGrid('2026-09-15')
    expect(g).toHaveLength(42)
    expect(g[0]).toBe('2026-08-31')
    expect(g[1]).toBe('2026-09-01')
    expect(g[41]).toBe('2026-10-11')
  })
  it('сравнение строк дат', () => {
    expect(compareDates('2026-09-01', '2026-09-02')).toBe(-1)
    expect(compareDates('2026-09-01T10:00', '2026-09-01T09:59')).toBe(1)
    expect(compareDates('2026-09-01', '2026-09-01')).toBe(0)
  })
  it('сегодня — по локальным часам', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 23, 23, 30))
    expect(todayLocal()).toBe('2026-09-23')
    vi.useRealTimers()
  })
})

describe('формат-шаблон', () => {
  it('время дописывается и снимается', () => {
    expect(withTime('DD.MM.YYYY', true)).toBe('DD.MM.YYYY HH:mm')
    expect(withTime('DD.MM.YYYY HH:mm', true)).toBe('DD.MM.YYYY HH:mm')
    expect(withTime('DD.MM.YYYY HH:mm', false)).toBe('DD.MM.YYYY')
    expect(datePartOf('YYYY-MM-DD HH:mm')).toBe('YYYY-MM-DD')
  })
  it('маска ставит разделители по мере ввода и отбрасывает лишнее', () => {
    expect(maskDateText('0', 'DD.MM.YYYY')).toBe('0')
    expect(maskDateText('01', 'DD.MM.YYYY')).toBe('01')
    expect(maskDateText('010', 'DD.MM.YYYY')).toBe('01.0')
    expect(maskDateText('01.09.2026', 'DD.MM.YYYY')).toBe('01.09.2026')
    expect(maskDateText('0109202699', 'DD.MM.YYYY')).toBe('01.09.2026')
    expect(maskDateText('2026x09', 'YYYY-MM-DD')).toBe('2026-09')
    expect(maskDateText('010920261830', 'DD.MM.YYYY HH:mm')).toBe('01.09.2026 18:30')
    expect(maskDateText('01092026', 'DD.MM.YYYY HH:mm')).toBe('01.09.2026')
    expect(maskDateText('', 'DD.MM.YYYY')).toBe('')
  })
  it('полнота: дата обязательна, время — только целиком', () => {
    expect(isComplete('01.09.202', 'DD.MM.YYYY')).toBe(false)
    expect(isComplete('01.09.2026', 'DD.MM.YYYY')).toBe(true)
    expect(isComplete('01.09.2026', 'DD.MM.YYYY HH:mm')).toBe(true)
    expect(isComplete('01.09.2026 1', 'DD.MM.YYYY HH:mm')).toBe(false)
    expect(isComplete('01.09.2026 18:30', 'DD.MM.YYYY HH:mm')).toBe(true)
  })
  it('разбор по шаблону', () => {
    expect(parseDateText('01.09.2026', 'DD.MM.YYYY')).toBe('2026-09-01')
    expect(parseDateText('2026-09-01', 'YYYY-MM-DD')).toBe('2026-09-01')
    expect(parseDateText('01/09/2026', 'DD/MM/YYYY')).toBe('2026-09-01')
    expect(parseDateText('01.09.2026 18:30', 'DD.MM.YYYY HH:mm')).toBe('2026-09-01T18:30')
    expect(parseDateText('01.09.2026', 'DD.MM.YYYY HH:mm')).toBe('2026-09-01')
    expect(parseDateText('31.02.2026', 'DD.MM.YYYY')).toBeNull()
    expect(parseDateText('01.09.2026 24:00', 'DD.MM.YYYY HH:mm')).toBeNull()
    expect(parseDateText('01.09.202', 'DD.MM.YYYY')).toBeNull()
  })
  it('вывод по шаблону; день без времени по шаблону со временем — без времени', () => {
    expect(formatDateText('2026-09-01', 'DD.MM.YYYY')).toBe('01.09.2026')
    expect(formatDateText('2026-09-01', 'YYYY-MM-DD')).toBe('2026-09-01')
    expect(formatDateText('2026-09-01T18:30', 'DD.MM.YYYY HH:mm')).toBe('01.09.2026 18:30')
    expect(formatDateText('2026-09-01', 'DD.MM.YYYY HH:mm')).toBe('01.09.2026')
    expect(formatDateText('2026-09-01T18:30', 'DD.MM.YYYY')).toBe('01.09.2026')
  })
})

describe.each(ZONES)('границы со смещением зоны, TZ=%s', (tz) => {
  beforeEach(() => { vi.stubEnv('TZ', tz) })
  afterEach(() => { vi.unstubAllEnvs() })
  it('день и минута не сдвигаются, смещение — на эту минуту', () => {
    expect(isoDayStart('2026-09-01').slice(0, 19)).toBe('2026-09-01T00:00:00')
    expect(isoDayEnd('2026-09-01').slice(0, 19)).toBe('2026-09-01T23:59:59')
    expect(isoMinuteStart('2026-09-01T18:30').slice(0, 19)).toBe('2026-09-01T18:30:00')
    expect(isoMinuteEnd('2026-09-01T18:30').slice(0, 19)).toBe('2026-09-01T18:30:59')
    expect(isoDayStart('2026-09-01')).toMatch(/[+-]\d\d:\d\d$/)
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(formatDateText('2026-09-01', 'DD.MM.YYYY')).toBe('01.09.2026')
  })
})

describe('переход на летнее время (America/New_York, 08.03.2026)', () => {
  beforeEach(() => { vi.stubEnv('TZ', 'America/New_York') })
  afterEach(() => { vi.unstubAllEnvs() })
  it('смещение берётся на минуту границы, а не на полночь', () => {
    expect(isoDayStart('2026-03-08')).toBe('2026-03-08T00:00:00-05:00')
    expect(isoDayEnd('2026-03-08')).toBe('2026-03-08T23:59:59-04:00')
  })
})
