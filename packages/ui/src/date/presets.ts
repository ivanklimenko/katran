import { addDays, addMonths, endOfMonth, startOfMonth, type IsoDay } from './dateStr'

/** Пресет периода — целые дни относительно «сегодня» (спека §3.4). */
export type DatePreset = { id: string; label: string; range: (today: IsoDay) => { from: IsoDay; to: IsoDay } }

export const PRESET_TODAY: DatePreset = { id: 'today', label: 'Сегодня', range: (t) => ({ from: t, to: t }) }
export const PRESET_YESTERDAY: DatePreset = { id: 'yesterday', label: 'Вчера', range: (t) => ({ from: addDays(t, -1), to: addDays(t, -1) }) }
export const PRESET_LAST3: DatePreset = { id: 'last3', label: '3 дня', range: (t) => ({ from: addDays(t, -2), to: t }) }
export const PRESET_LAST7: DatePreset = { id: 'last7', label: '7 дней', range: (t) => ({ from: addDays(t, -6), to: t }) }
export const PRESET_LAST30: DatePreset = { id: 'last30', label: '30 дней', range: (t) => ({ from: addDays(t, -29), to: t }) }
export const PRESET_THIS_MONTH: DatePreset = { id: 'thisMonth', label: 'Текущий месяц', range: (t) => ({ from: startOfMonth(t), to: t }) }
export const PRESET_LAST_MONTH: DatePreset = {
  id: 'lastMonth', label: 'Прошлый месяц',
  range: (t) => { const p = addMonths(startOfMonth(t), -1); return { from: p, to: endOfMonth(p) } },
}

/** Горячие кнопки под полем периода по умолчанию. */
export const QUICK_PRESETS: DatePreset[] = [PRESET_TODAY, PRESET_YESTERDAY, PRESET_LAST3, PRESET_LAST7]
/** Список пресетов в поповере периода по умолчанию. */
export const DEFAULT_PRESETS: DatePreset[] = [PRESET_TODAY, PRESET_YESTERDAY, PRESET_LAST3, PRESET_LAST7, PRESET_LAST30, PRESET_THIS_MONTH, PRESET_LAST_MONTH]

/** Период совпадает с пресетом на этот «сегодня» (значения — дни без времени). */
export function presetMatches(p: DatePreset, today: IsoDay, value: { from: string; to: string }): boolean {
  const r = p.range(today)
  return value.from === r.from && value.to === r.to
}
