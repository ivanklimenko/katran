/** Нелокальные вкладки рублёвого реестра — набор GET …/tabs/{tab} (RUB_TABS без main, спека 2b §3.1). */
export const RUB_TRAIL_TABS = ['statuses', 'compliance', 'linked', 'tasks', 'notif', 'ed244', 'stream', 'mpu', 'audit'] as const
export type RubTrailTab = (typeof RUB_TRAIL_TABS)[number]

/** Ответы вкладок документа. Заглушка маршрута: данные — Task 7 (сигнатура станет (row, i, rows)). */
export function rubDocTrail(): Record<RubTrailTab, unknown> {
  return Object.fromEntries(RUB_TRAIL_TABS.map((t) => [t, {}])) as Record<RubTrailTab, unknown>
}
