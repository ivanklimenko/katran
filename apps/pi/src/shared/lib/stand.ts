/**
 * Регуляторы стенда в адресе для замеров (срез styled, Task 0; описание — в шапке app/fake/params.ts):
 * ?docs=N — размер набора фейка, ?size=N — начальный размер страницы реестра, ?noauto — без автооткрытия первой записи.
 * Здесь, в shared, — чтобы читать их могли и фейк (app), и модели страниц, и виджет реестра (слои FSD — только вниз).
 * Значение читается при каждом вызове: null — параметра нет, '' — параметр без значения (?noauto).
 */
export type StandParam = 'docs' | 'size' | 'noauto'

export const standParam = (name: StandParam): string | null => new URLSearchParams(location.search).get(name)
