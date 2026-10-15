import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { k } from '@katran/tokens'
import { useStableId } from '../compat/useStableId'
import { styled } from '../styled'

export type MiniColumn<T> = {
  id: string
  /** '' — колонка без заголовка (служебная): в строке шапки — пустая ячейка, не columnheader. */
  header: string
  /**
   * Ширина в px при плотности 1; нет — minmax(0, 1fr).
   * 'auto' — по содержимому своей строки: строки — отдельные сетки, между строками колонки не выравниваются;
   * для таблиц без шапки, как .ld/.tk эталона.
   */
  width?: number | 'auto' | undefined
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
  className?: string | undefined
}

/* компактная таблица вкладок деталки (эталон .tt/.tbar/.ld/.tk, index.html:299–342).
   Модификаторы — атрибутами: шапка — data-head, раскрываемая строка — data-k-xrow (уже нужен делегированию клика),
   раскрытая — data-open, моно-ячейка — data-mono; под :where() — специфичность прежних классов (.head, .xrow, .open, .mono) */
const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${k.sp2};
  min-width: 0;
`

/* полоса над таблицей (.tbar): первый элемент — подпись-счётчик, остальное прижато вправо */
const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: ${k.ttGap};
  min-height: ${k.ttRowX};

  & > :first-child {
    margin-right: auto;
  }
`

const Frame = styled.div`
  border: 1px solid ${k.line};
  border-radius: ${k.rS};
  background: ${k.paper};
  overflow: hidden;
`

const Table = styled(Frame)`
  font: ${k.fs1} / ${k.lh1} ${k.sans};
  color: ${k.ink};
`

const Row = styled.div`
  display: grid;
  box-sizing: border-box;
  grid-template-columns: var(--k-cols);
  gap: 0 ${k.ttGap};
  align-items: center;
  min-height: ${k.ttRow};
  padding: 0 ${k.ttGap};
  border-bottom: 1px solid ${k.line2};

  &:where([data-head]) {
    min-height: ${k.ttHead};
    background: ${k.sunk};
    font: 600 ${k.fs3} / ${k.lh3} ${k.sans};
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${k.muted};
  }

  &:where([data-k-xrow]) {
    min-height: ${k.ttRowX};
    cursor: pointer;
  }
`

const Cell = styled.div`
  min-width: 0;

  &[data-align='end'] {
    text-align: end;
  }

  &:where([data-mono]) {
    font-family: ${k.mono};
  }
`

const Num = styled.div`
  min-width: 0;
  font: ${k.fs2} / ${k.lh2} ${k.mono};
  color: ${k.faint};
  text-align: end;
`

const Toggle = styled.button`
  display: grid;
  place-items: center;
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: ${k.rS};
  background: none;
  color: ${k.faint};
  font: ${k.fs3} / ${k.lh3} ${k.sans};
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 0;
  }
`

const Chev = styled.span`
  display: inline-block;

  ${Row}:where([data-open]) & {
    transform: rotate(180deg);
  }
`

/* панель раскрытой строки (эталон .ldb): на всю ширину, подложка sunk */
const Panel = styled.div`
  padding: ${k.ttPanelPt} ${k.ttGap} ${k.sp2};
  border-bottom: 1px solid ${k.line2};
  background: ${k.sunk};
`

/* Тело таблицы: правила строк и панелей по их месту в теле. Специфичность прежняя — Body > Row:hover (0,3,0),
   последняя строка (0,3,0), свёрнутая раскрываемая перед панелью (0,4,0), панель последней строки (0,3,0) — выше
   правил самих Row и Panel (0,1,0), поэтому группа тела может стоять после них. */
const Body = styled.div`
  & > ${Row}:hover {
    background: ${k.hover};
  }

  /* у последней строки нижней границы нет — её даёт рамка таблицы (эталон .tt .tr:last-child, .au>*:last-child);
     у раскрываемых последний элемент тела — строка панели: свёрнутая строка перед ней — последняя видимая */
  & > ${Row}:last-child,
  & > ${Row}:where([data-k-xrow]):nth-last-child(2):not([data-open]),
  & > :last-child > ${Panel} {
    border-bottom: 0;
  }
`

const Empty = styled.p`
  margin: 0;
  padding: ${k.ttEmpty} ${k.ttGap};
  font: ${k.fs1} / ${k.lh1} ${k.sans};
  color: ${k.muted};
  text-align: center;
`

/* только для скринридера — как Sr форм */
const Sr = styled.span`
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`

const track = (width: number | 'auto' | undefined) =>
  width === undefined ? 'minmax(0, 1fr)' : width === 'auto' ? 'auto' : `calc(${width}px * var(--k-density))`

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
  const { label, columns, rows, rowKey, empty, numbered, renderExpanded, rowLabel, expanded, defaultExpanded, onExpandedChange, toolbar, className } = props
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

  const bar = toolbar !== undefined ? <Bar>{toolbar}</Bar> : null
  if (rows.length === 0) {
    return (
      <Root className={className}>
        {bar}
        <Frame><Empty>{empty}</Empty></Frame>
      </Root>
    )
  }

  const template = [numbered ? 'var(--k-tt-num)' : null, ...columns.map((c) => track(c.width)), expandable ? 'var(--k-tt-chev)' : null]
    .filter((x): x is string => x !== null)
    .join(' ')
  const hasHead = columns.some((c) => c.header !== '')

  return (
    <Root className={className}>
      {bar}
      <Table role="table" aria-label={label} style={{ '--k-cols': template } as CSSProperties}>
        {hasHead && (
          <div role="rowgroup">
            <Row role="row" data-head="">
              {numbered && <Num role="columnheader"><Sr>№</Sr></Num>}
              {columns.map((c) => c.header === ''
                ? <Cell key={c.id} role="cell" />
                : <Cell key={c.id} role="columnheader" data-align={c.align}>{c.header}</Cell>)}
              {expandable && <Cell role="cell" />}
            </Row>
          </div>
        )}
        <Body role="rowgroup" ref={setBody}>
          {rows.map((row, i) => {
            const key = rowKey(row, i)
            const isOpen = expandable && open.includes(key)
            const id = `${base}-${i}`
            return (
              <Fragment key={key}>
                <Row role="row" data-k-xrow={expandable ? key : undefined} data-open={isOpen ? '' : undefined}>
                  {numbered && <Num role="cell">{i + 1}</Num>}
                  {columns.map((c) => (
                    <Cell key={c.id} role="cell" data-align={c.align} data-mono={c.mono ? '' : undefined}>{c.render(row, i)}</Cell>
                  ))}
                  {expandable && (
                    <Cell role="cell">
                      {/* имя — действие и строка: кнопок в таблице столько же, сколько строк, и имена различимы */}
                      <Toggle type="button" aria-expanded={isOpen} aria-controls={`${id}-p`} onClick={() => toggle(key)}>
                        <Sr>{`${isOpen ? 'Свернуть' : 'Раскрыть'} ${rowLabel ? rowLabel(row, i) : `строку ${i + 1}`}`}</Sr>
                        <Chev aria-hidden="true">▼</Chev>
                      </Toggle>
                    </Cell>
                  )}
                </Row>
                {expandable && (
                  <div role="row" hidden={!isOpen}>
                    <Panel role="cell" id={`${id}-p`}>{isOpen ? renderExpanded(row) : null}</Panel>
                  </div>
                )}
              </Fragment>
            )
          })}
        </Body>
      </Table>
    </Root>
  )
}
