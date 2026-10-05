/** Нелокальные вкладки валютного реестра — набор GET …/tabs/{tab} (FX_TABS без main и extra, спека 2b §3.1). */
export const FX_TRAIL_TABS = ['statuses', 'compliance', 'linked', 'tasks', 'notif', 'source', 'stream', 'mpu', 'audit'] as const
export type FxTrailTab = (typeof FX_TRAIL_TABS)[number]

/** Ответы вкладок документа. Заглушка маршрута: данные по эталону — Task 7 (сигнатура станет (row, i, rows)). */
export function fxDocTrail(): Record<FxTrailTab, unknown> {
  return Object.fromEntries(FX_TRAIL_TABS.map((t) => [t, {}])) as Record<FxTrailTab, unknown>
}
