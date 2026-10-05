import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useStableId } from '../compat/useStableId'
import s from './MiniTable.module.css'

export type MiniColumn<T> = {
  id: string
  /** '' — колонка без заголовка (служебная): в строке шапки — пустая ячейка, не columnheader. */
  header: string
  /** Ширина в px при плотности 1; нет — minmax(0, 1fr). */
  width?: number | undefined
  render: (row: T, index: number) => ReactNode
  mono?: boolean | undefined
  align?: 'start' | 'end' | undefined
}

export type MiniTableProps<T> = {
  /** Доступное имя таблицы. */
  label: string
  columns: MiniColumn<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  /** Текст пустого состояния (эталон .tt .empty). */
  empty: string
  /** Первая колонка «№» (22 px, моно, приглушённо). */
  numbered?: boolean | undefined
  /** Раскрываемые строки (эталон .ld / .tk): кнопка-шеврон с aria-expanded, клик по строке, панель под строкой. */
  renderExpanded?: ((row: T) => ReactNode) | undefined
  /** Текст строки для имени переключателя: «Раскрыть {rowLabel}» / «Свернуть {rowLabel}»; без него — «Раскрыть строку N». */
  rowLabel?: ((row: T, index: number) => string) | undefined
  /** Управляемый режим — ключи rowKey раскрытых строк. */
  expanded?: string[] | undefined
  defaultExpanded?: string[] | undefined
  onExpandedChange?: ((keys: string[]) => void) | undefined
  /** Полоса над таблицей (эталон .tbar): счётчик слева, кнопки справа. */
  toolbar?: ReactNode | undefined
}

const track = (width: number | undefined) => (width === undefined ? 'minmax(0, 1fr)' : `calc(${width}px * var(--k-density))`)

// Клик по интерактивному внутри строки (ссылка, кнопка, поле) строку не раскрывает — у него своё действие
const INTERACTIVE = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])'

/**
 * Компактная таблица вкладок деталки (эталон .tt, index.html:299–342): строка 24, шапка 22, раскрываемая строка 26.
 * Разметка — CSS grid с ролями table/row/columnheader/cell: у раскрываемой строки панель — отдельная строка на всю ширину,
 * а ширины колонок одни для шапки и тела (шаблон в --k-cols, ширины умножаются на плотность, как у ColumnHeader).
 * Раскрываемая строка — не кнопка целиком (внутри свои ссылки и кнопки, axe nested-interactive): переключатель — кнопка-шеврон
 * в последней ячейке; клик мышью по свободному месту строки — тоже переключает. Новый ключ дописывается в конец набора.
 */
export function MiniTable<T>(props: MiniTableProps<T>) {
  const { label, columns, rows, rowKey, empty, numbered, renderExpanded, rowLabel, expanded, defaultExpanded, onExpandedChange, toolbar } = props
  const base = useStableId()
  const [inner, setInner] = useState<string[]>(() => defaultExpanded ?? [])
  const open = expanded ?? inner
  const toggle = (key: string) => {
    const next = open.includes(key) ? open.filter((k) => k !== key) : [...open, key]
    if (expanded === undefined) setInner(next)
    onExpandedChange?.(next)
  }

  // Клик по строке (мышь) — делегированием с тела таблицы: строка — role="row", обработчик на ней самой
  // сделал бы её интерактивным элементом без фокуса; клавиатура и скринридер работают с кнопкой-шевроном.
  // Тело — callback-ref в состоянии: при пустом первом рендере тела нет, и эффект должен перезапуститься, когда строки придут
  const [body, setBody] = useState<HTMLDivElement | null>(null)
  const toggleRef = useRef(toggle)
  useEffect(() => { toggleRef.current = toggle })
  const expandable = renderExpanded !== undefined
  useEffect(() => {
    const el = body
    if (!el || !expandable) return
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      const row = target?.closest<HTMLElement>('[data-k-xrow]')
      // только свои строки: во вложенной таблице панели строки — её собственные
      if (!row || row.parentElement !== el) return
      const hit = target?.closest(INTERACTIVE)
      if (hit && row.contains(hit)) return
      // выделение текста мышью — не раскрытие
      if (String(window.getSelection() ?? '') !== '') return
      toggleRef.current(row.dataset.kXrow ?? '')
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [body, expandable])

  const bar = toolbar !== undefined ? <div className={s.bar}>{toolbar}</div> : null
  if (rows.length === 0) {
    return (
      <div className={s.root}>
        {bar}
        <div className={s.frame}><p className={s.empty}>{empty}</p></div>
      </div>
    )
  }

  const template = [numbered ? 'var(--k-tt-num)' : null, ...columns.map((c) => track(c.width)), expandable ? 'var(--k-tt-chev)' : null]
    .filter((x): x is string => x !== null)
    .join(' ')
  const cellClass = (c: MiniColumn<T>) => [s.cell, c.mono ? s.mono : ''].filter(Boolean).join(' ')
  const hasHead = columns.some((c) => c.header !== '')

  return (
    <div className={s.root}>
      {bar}
      <div role="table" aria-label={label} className={[s.frame, s.table].join(' ')} style={{ '--k-cols': template } as CSSProperties}>
        {hasHead && (
          <div role="rowgroup">
            <div role="row" className={[s.row, s.head].join(' ')}>
              {numbered && <div role="columnheader" className={s.num}><span className={s.sr}>№</span></div>}
              {columns.map((c) => c.header === ''
                ? <div key={c.id} role="cell" className={s.cell} />
                : <div key={c.id} role="columnheader" className={s.cell} data-align={c.align}>{c.header}</div>)}
              {expandable && <div role="cell" className={s.cell} />}
            </div>
          </div>
        )}
        <div role="rowgroup" ref={setBody} className={s.body}>
          {rows.map((row, i) => {
            const key = rowKey(row, i)
            const isOpen = expandable && open.includes(key)
            const id = `${base}-${i}`
            return (
              <Fragment key={key}>
                <div role="row" className={[s.row, expandable ? s.xrow : '', isOpen ? s.open : ''].filter(Boolean).join(' ')} data-k-xrow={expandable ? key : undefined}>
                  {numbered && <div role="cell" className={s.num}>{i + 1}</div>}
                  {columns.map((c) => (
                    <div key={c.id} role="cell" className={cellClass(c)} data-align={c.align}>{c.render(row, i)}</div>
                  ))}
                  {expandable && (
                    <div role="cell" className={s.cell}>
                      {/* имя — действие и строка: кнопок в таблице столько же, сколько строк, и имена различимы */}
                      <button type="button" className={s.toggle} aria-expanded={isOpen} aria-controls={`${id}-p`} onClick={() => toggle(key)}>
                        <span className={s.sr}>{`${isOpen ? 'Свернуть' : 'Раскрыть'} ${rowLabel ? rowLabel(row, i) : `строку ${i + 1}`}`}</span>
                        <span className={s.chev} aria-hidden="true">▼</span>
                      </button>
                    </div>
                  )}
                </div>
                {expandable && (
                  <div role="row" hidden={!isOpen}>
                    <div role="cell" id={`${id}-p`} className={s.panel}>{isOpen ? renderExpanded(row) : null}</div>
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
      </div>
    </div>
  )
}
