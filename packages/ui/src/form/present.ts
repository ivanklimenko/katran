import type { FieldValue } from './types'

/** Вид значения в строке поля: главное (первая строка), второе справа (счёт, код), полный текст раскрытия. */
export type FieldView = { main: string; second: string; full: string[] }
/** Правила вида задаёт приложение (у валюты — BIC и нумерация строк SWIFT); кит их не знает. */
export type FieldPresenter = (tag: string, v: FieldValue) => FieldView

export const defaultPresent: FieldPresenter = (_tag, v) => ({
  main: v.lines[0] ?? '',
  second: v.acc ?? '',
  full: v.acc ? [`/${v.acc}`, ...v.lines] : v.lines,
})

/** Пустое поле — ни строк, ни счёта (эталон isNull, index.html:935). */
export const isEmptyValue = (v: FieldValue | null): boolean => v === null || (v.lines.length === 0 && !v.acc)
