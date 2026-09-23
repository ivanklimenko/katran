import { useState, type HTMLAttributes, type KeyboardEvent } from 'react'

export type UseGridKeyboardOptions = {
  /** Меняется → активная ячейка возвращается в fallback (страница, число строк, состав колонок). */
  resetToken: string
  /** '2:0' при наличии строк, '1:0' — только шапка. */
  fallback: string
}

// role="slider" — ручка ресайза колонки: отдельный от контента виджет (drag/стрелки на себе),
// в набор интерактивных элементов ячейки для Enter не входит.
const INTERACTIVE = 'button:not([disabled]):not([role="slider"]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])'
// Для Tab/Shift+Tab внутри ячейки — полный набор, включая ручку ресайза: она недостижима
// снаружи (tabIndex={-1} на самой ручке), доступна только так.
const INTERACTIVE_ALL = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[role="slider"]:not([disabled])'

const key = (rowIndex: number, c: number) => `${rowIndex}:${c}`
const parse = (k: string) => k.split(':').map(Number) as [number, number]

function cellsOf(row: Element): HTMLElement[] {
  return Array.from(row.children).filter((el): el is HTMLElement => el.hasAttribute('data-cell'))
}

/** Ближайшая ячейка строки с колонкой ≤ c (в строке сегментов колонок меньше). */
function pickCell(row: Element, c: number): HTMLElement | undefined {
  const cells = cellsOf(row)
  let best: HTMLElement | undefined
  for (const cell of cells) {
    const [, cc] = parse(cell.dataset.cell!)
    if (cc <= c && (!best || cc > parse(best.dataset.cell!)[1])) best = cell
  }
  return best ?? cells[0]
}

/**
 * WAI-ARIA grid: один таб-стоп, стрелки по ячейкам (спека 6.3). Навигация считается по DOM
 * (строки — все <tr> таблицы, ячейки — элементы с data-cell), поэтому сквозные строки участвуют естественно.
 * Внутри ячейки Tab/Shift+Tab ходят по её интерактивным элементам (APG), Escape — назад в ячейку.
 */
export function useGridKeyboard({ resetToken, fallback }: UseGridKeyboardOptions) {
  const [active, setActive] = useState(fallback)
  const [prevToken, setPrevToken] = useState(resetToken)
  if (resetToken !== prevToken) {
    setPrevToken(resetToken)
    setActive(fallback)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTableCellElement>) => {
    const cell = e.currentTarget
    const inside = e.target !== cell
    if (inside) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cell.focus() }
      else if (e.key === 'Tab') {
        const items = Array.from(cell.querySelectorAll<HTMLElement>(INTERACTIVE_ALL))
        if (items.length < 2) return              // один элемент — пусть Tab уводит из грида как обычно
        const i = items.indexOf(e.target as HTMLElement)
        const next = items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length]
        if (next) { e.preventDefault(); e.stopPropagation(); next.focus() }
      }
      return
    }
    const table = cell.closest('table')
    if (!table) return
    const row = cell.parentElement!
    const rows = Array.from(table.querySelectorAll('tr'))
    const ri = rows.indexOf(row as HTMLTableRowElement)
    const cells = cellsOf(row)
    const ci = cells.indexOf(cell)
    const [, c] = parse(cell.dataset.cell!)
    let target: HTMLElement | undefined
    switch (e.key) {
      case 'ArrowRight': target = cells[ci + 1]; break
      case 'ArrowLeft': target = cells[ci - 1]; break
      case 'Home': target = cells[0]; break
      case 'End': target = cells[cells.length - 1]; break
      case 'ArrowDown': target = rows[ri + 1] ? pickCell(rows[ri + 1]!, c) : undefined; break
      case 'ArrowUp': target = rows[ri - 1] ? pickCell(rows[ri - 1]!, c) : undefined; break
      case 'Enter': {
        const items = Array.from(cell.querySelectorAll<HTMLElement>(INTERACTIVE))
        if (items.length === 0) return
        e.preventDefault()
        items[0]!.focus()
        if (items.length === 1) items[0]!.click()
        return
      }
      default: return
    }
    e.preventDefault()
    if (target) { target.focus(); setActive(target.dataset.cell!) }
  }

  const cellProps = (rowIndex: number, r: number, c: number): HTMLAttributes<HTMLTableCellElement> => {
    const k = key(rowIndex + r, c)
    return {
      tabIndex: k === active ? 0 : -1,
      'data-cell': k,
      onFocus: (e) => { if (e.target === e.currentTarget) setActive(k) },
      onKeyDown,
    } as HTMLAttributes<HTMLTableCellElement>
  }

  return { active, cellProps }
}
