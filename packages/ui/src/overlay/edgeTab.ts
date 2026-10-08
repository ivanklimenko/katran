import type { KeyboardEvent, RefObject } from 'react'

// Остановки Tab внутри поповера. Дни календаря с tabIndex=-1 — не остановки (роуминг стрелками), поэтому без них.
const STOPS = 'input:not([disabled]), button:not([disabled]):not([tabindex="-1"])'

/**
 * Tab с последней остановки поповера (Shift+Tab — с первой): фокус на `target` — кнопку, открывшую поповер, — и закрыть.
 * preventDefault не нужен: браузер продолжает Tab уже от `target` к соседнему полю. Портал лежит в конце документа,
 * без этого Tab увёл бы фокус за пределы страницы (на хосте — за пределы приложения), а поповер остался бы открытым.
 * Фокус переносится до закрытия: очистка Popover возвращает фокус, только если он остался на body (React 17).
 * Вешается на `<div role="presentation" onKeyDown>` — обёртку содержимого поповера.
 * Фокус на держателе — элементе, внутри которого все остановки (фокусируемое содержимое с tabIndex -1, как у поповеров
 * справочных запросов), — край с обеих сторон для Shift+Tab (раньше остановок), для Tab — только когда остановок нет
 * (иначе браузер идёт к первой из них).
 */
export function exitOnEdgeTab(e: KeyboardEvent<HTMLElement>, target: RefObject<HTMLElement | null>, close: () => void): void {
  if (e.key !== 'Tab' || !(e.target instanceof HTMLElement)) return
  const at = e.target
  const stops = Array.prototype.slice.call(e.currentTarget.querySelectorAll<HTMLElement>(STOPS)) as HTMLElement[]
  const holder = stops.every((stop) => stop !== at && at.contains(stop))
  const edge = holder
    ? e.shiftKey || stops.length === 0
    : at === (e.shiftKey ? stops[0] : stops[stops.length - 1])
  if (!edge) return
  target.current?.focus()
  close()
}
