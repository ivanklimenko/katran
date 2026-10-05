import type { KeyboardEvent, RefObject } from 'react'

// Остановки Tab внутри поповера. Дни календаря с tabIndex=-1 — не остановки (роуминг стрелками), поэтому без них.
const STOPS = 'input:not([disabled]), button:not([disabled]):not([tabindex="-1"])'

/**
 * Tab с последней остановки поповера (Shift+Tab — с первой): фокус на `target` — кнопку, открывшую поповер, — и закрыть.
 * preventDefault не нужен: браузер продолжает Tab уже от `target` к соседнему полю. Портал лежит в конце документа,
 * без этого Tab увёл бы фокус за пределы страницы (на хосте — за пределы приложения), а поповер остался бы открытым.
 * Фокус переносится до закрытия: очистка Popover возвращает фокус, только если он остался на body (React 17).
 * Вешается на `<div role="presentation" onKeyDown>` — обёртку содержимого поповера.
 */
export function exitOnEdgeTab(e: KeyboardEvent<HTMLElement>, target: RefObject<HTMLElement | null>, close: () => void): void {
  if (e.key !== 'Tab') return
  const stops = e.currentTarget.querySelectorAll<HTMLElement>(STOPS)
  if (stops.length === 0 || e.target !== (e.shiftKey ? stops[0] : stops[stops.length - 1])) return
  target.current?.focus()
  close()
}
