import type { Scalar } from '@katran/effector'
import { contractError } from './problem'

/** Проверка формы ответа без зависимостей: каждый гард бросает contractError с путём поля. */
export type Obj = Record<string, unknown>

export function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw contractError(`${path}: ожидался объект`)
  return v as Obj
}
export function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw contractError(`${path}: ожидался массив`)
  return v
}
export function strArr(v: unknown, path: string): string[] {
  return arr(v, path).map((x, i) => {
    if (typeof x !== 'string') throw contractError(`${path}[${i}]: ожидалась строка`)
    return x
  })
}
export function str(o: Obj, k: string, path: string): string {
  const v = o[k]
  if (typeof v !== 'string') throw contractError(`${path}.${k}: ожидалась строка`)
  return v
}
export function strOrNull(o: Obj, k: string, path: string): string | null {
  const v = o[k]
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw contractError(`${path}.${k}: ожидалась строка или null`)
  return v
}
export function num(o: Obj, k: string, path: string): number {
  const v = o[k]
  if (typeof v !== 'number' || Number.isNaN(v)) throw contractError(`${path}.${k}: ожидалось число`)
  return v
}
export function bool(o: Obj, k: string, path: string, fallback = false): boolean {
  const v = o[k]
  if (v === undefined) return fallback
  if (typeof v !== 'boolean') throw contractError(`${path}.${k}: ожидалось true или false`)
  return v
}
export function oneOf<T extends string>(o: Obj, k: string, values: readonly T[], path: string): T {
  const v = str(o, k, path)
  if (!(values as readonly string[]).includes(v)) throw contractError(`${path}.${k}: недопустимое значение «${v}»`)
  return v as T
}
export function scalar(v: unknown, path: string): Scalar {
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v
  throw contractError(`${path}: ожидалось скалярное значение`)
}
