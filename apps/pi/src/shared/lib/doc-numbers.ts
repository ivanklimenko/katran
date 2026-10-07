import { createEffect, sample, type Store } from 'effector'
import type { PageLifecycle } from './lifecycle'

type Numbered = { id: string; docNumber: string | number }
type Slots = { a: { data: Numbered | null } | null; b: { data: Numbered | null } | null }

/**
 * Номер документа экрана для запасного имени файла (план 2d §3.6): из строки реестра, иначе из детали в слотах, иначе null.
 * Модель действий зовёт fallbackName как простую функцию, вне стора, поэтому номера копятся эффектами в словарях модели
 * (не в сторе скоупа); уход с экрана их чистит.
 */
export function createDocNumbers(cfg: { rows: Store<Numbered[]>; slots: Store<Slots>; lifecycle: PageLifecycle }): (id: string) => string | null {
  const fromRows = new Map<string, string>()
  const fromDetail = new Map<string, string>()
  const remember = (to: Map<string, string>) => createEffect((docs: Numbered[]) => { docs.forEach((d) => to.set(d.id, String(d.docNumber))) })
  const rowsFx = remember(fromRows)
  const detailFx = remember(fromDetail)
  const forgetFx = createEffect(() => { fromRows.clear(); fromDetail.clear() })
  sample({ clock: cfg.rows.updates, target: rowsFx })
  sample({ clock: cfg.slots.updates, fn: ({ a, b }) => [a?.data, b?.data].flatMap((d) => (d ? [d] : [])), target: detailFx })
  sample({ clock: cfg.lifecycle.pageClosed, target: forgetFx })
  return (id) => fromRows.get(id) ?? fromDetail.get(id) ?? null
}
