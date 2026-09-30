import { DEFAULT_PRESETS, PRESET_LAST3, PRESET_LAST7, PRESET_LAST_MONTH, PRESET_THIS_MONTH, PRESET_YESTERDAY, QUICK_PRESETS, presetMatches } from './presets'

describe('пресеты периода', () => {
  const t = '2026-03-02'
  it('считают сегодняшний день и предыдущие', () => {
    expect(PRESET_YESTERDAY.range(t)).toEqual({ from: '2026-03-01', to: '2026-03-01' })
    expect(PRESET_LAST3.range(t)).toEqual({ from: '2026-02-28', to: '2026-03-02' })
    expect(PRESET_LAST7.range(t)).toEqual({ from: '2026-02-24', to: '2026-03-02' })
    expect(PRESET_THIS_MONTH.range(t)).toEqual({ from: '2026-03-01', to: '2026-03-02' })
    expect(PRESET_LAST_MONTH.range(t)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })
  it('состав списков по умолчанию', () => {
    expect(QUICK_PRESETS.map((p) => p.label)).toEqual(['Сегодня', 'Вчера', '3 дня', '7 дней'])
    expect(DEFAULT_PRESETS.map((p) => p.id)).toEqual(['today', 'yesterday', 'last3', 'last7', 'last30', 'thisMonth', 'lastMonth'])
  })
  it('совпадение значения с пресетом', () => {
    expect(presetMatches(PRESET_LAST3, t, { from: '2026-02-28', to: '2026-03-02' })).toBe(true)
    expect(presetMatches(PRESET_LAST3, t, { from: '2026-02-28', to: '' })).toBe(false)
  })
})
