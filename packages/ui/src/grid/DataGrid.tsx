import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { IconButton } from '../button'
import { Checkbox } from '../input'
import { Pagination } from '../pagination'
import { EmptyState, ErrorState, ProgressBar, useLoadingGate } from '../state'
import { ColumnHeader } from './ColumnHeader'
import { ColumnsMenu } from './ColumnsMenu'
import { GridRecord, type CellProps, type SpanCell } from './GridRecord'
import { GridSkeleton } from './GridSkeleton'
import { resolveSpans, visibleColumns } from './resolveSpans'
import { isSelected, pageState } from './selection'
import s from './Grid.module.css'
import type { ColumnsState, GridViewState, RecordLayout, Selection, SpanDef, Sort } from './types'

export type DataGridProps<Row> = {
  /** Доступное имя сетки. */
  label: string
  layout: RecordLayout<Row>
  rows: Row[]
  total: number
  page: number
  pageSize: number
  onPage: (n: number) => void
  pageSizes?: number[] | undefined
  onPageSize?: ((n: number) => void) | undefined
  sort: Sort
  onSort: (s: Sort) => void
  widths: Record<string, number>
  onResize: (p: { id: string; width: number }) => void
  order: string[]
  hidden: string[]
  onColumns: (s: ColumnsState) => void
  selection?: Selection | undefined
  onSelect?: ((p: { id: string; on: boolean }) => void) | undefined
  onSelectPage?: ((p: { ids: string[]; on: boolean }) => void) | undefined
  state: GridViewState
  error?: string | null | undefined
  onRetry?: (() => void) | undefined
  emptyTitle?: string | undefined
  emptyAction?: { label: string; onClick: () => void } | undefined
  /** Второй клик по кнопке (e.detail ≥ 2) — secondary: второй drawer рядом. */
  onOpen?: ((row: Row, opts: { secondary: boolean }) => void) | undefined
  skeletonRows?: number | undefined
  /** Клавиатурный слой (Task 11). */
  cellProps?: ((rowIndex: number, r: number, c: number) => React.HTMLAttributes<HTMLTableCellElement>) | undefined
}

const DEFAULT_WIDTH = 120
const LEAD_WIDTH = 84

const Cols = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M6 3v10M10 3v10" /></svg>
const Open = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M6 8h4M8 6v4" /></svg>

export function DataGrid<Row>(p: DataGridProps<Row>) {
  const { layout, rows, page, pageSize, selection, state } = p
  const visible = useMemo(() => visibleColumns(p.order, p.hidden, layout.columns), [p.order, p.hidden, layout.columns])
  const fullOrder = useMemo(() => visibleColumns(p.order, [], layout.columns).map((c) => c.id), [p.order, layout.columns])
  const visibleIds = useMemo(() => visible.map((c) => c.id), [visible])
  const spanRows = useMemo<SpanCell<Row>[][]>(
    () => (layout.spans ?? []).map((line) => {
      // типы сегментов инвариантны по строке; функции нужен только id/from/to
      const resolved = resolveSpans(line as unknown as SpanDef<unknown>[], visibleIds, fullOrder)
      return resolved.map((r) => ({ def: line.find((d) => d.id === r.id)!, colStart: r.colStart, colSpan: r.colSpan }))
    }),
    [layout.spans, visibleIds, fullOrder],
  )
  const perRecord = 1 + spanRows.length
  const widthOf = (id: string, fallback: number | undefined) => p.widths[id] ?? fallback ?? DEFAULT_WIDTH
  const tableWidth = LEAD_WIDTH + visible.reduce((sum, c) => sum + widthOf(c.id, c.width), 0)

  const [colsOpen, setColsOpen] = useState(false)
  const colsBtn = useRef<HTMLButtonElement>(null)

  const ids = rows.map(layout.rowKey)
  const pageSel = selection ? pageState(selection, ids) : 'none'
  const showSkeleton = useLoadingGate(state === 'loading')
  const dim = state === 'refreshing'
  const empty = state === 'ready' && rows.length === 0
  const cp = (rowIndex: number): CellProps | undefined => (p.cellProps ? (r, c) => p.cellProps!(rowIndex, r, c) : undefined)

  return (
    <div className={s.root}>
      <div className={s.wrap}>
        {dim && <div className={s.progress}><ProgressBar label="Обновление данных" /></div>}
        <table
          role="grid"
          aria-label={p.label}
          aria-rowcount={1 + p.total * perRecord}
          aria-colcount={1 + visible.length}
          data-dim={dim || undefined}
          className={[s.table, dim ? s.dim : ''].filter(Boolean).join(' ')}
          style={{ width: `calc(${tableWidth}px * var(--k-density))` } as CSSProperties}
        >
          <thead>
            <tr role="row" aria-rowindex={1}>
              <th role="columnheader" scope="col" className={s.th} style={{ width: `calc(${LEAD_WIDTH}px * var(--k-density))` } as CSSProperties} {...cp(1)?.(0, 0)}>
                <div className={s.leadHead}>
                  {selection && p.onSelectPage && (
                    <Checkbox tabIndex={-1} aria-label="Выбрать все на странице" checked={pageSel === 'all'} indeterminate={pageSel === 'some'} disabled={ids.length === 0}
                      onChange={() => p.onSelectPage!({ ids, on: pageSel !== 'all' })} />
                  )}
                  <IconButton ref={colsBtn} tabIndex={-1} size="s" label="Состав колонок" pressed={colsOpen} onClick={() => setColsOpen(true)}><Cols /></IconButton>
                </div>
                <ColumnsMenu open={colsOpen} anchor={colsBtn} onClose={() => setColsOpen(false)} columns={layout.columns} order={p.order} hidden={p.hidden} onChange={p.onColumns} />
              </th>
              {visible.map((c, i) => (
                <ColumnHeader key={c.id} column={c} sort={p.sort} onSort={p.onSort} width={widthOf(c.id, c.width)}
                  onResize={(c.resizable ?? true) ? (w) => p.onResize({ id: c.id, width: w }) : undefined} cellProps={cp(1)?.(0, i + 1)} />
              ))}
            </tr>
          </thead>

          {state === 'loading' && showSkeleton && <GridSkeleton visible={visible} spanRows={spanRows} rows={p.skeletonRows ?? 8} rowIndexStart={2} />}

          {state !== 'loading' && state !== 'error' && rows.map((row, i) => {
            const id = layout.rowKey(row)
            const ord = (page - 1) * pageSize + i + 1
            const rowIndex = 2 + i * perRecord
            const lead = (
              <>
                {selection && p.onSelect && (
                  <Checkbox tabIndex={-1} aria-label={`Выбрать запись ${ord}`} checked={isSelected(selection, id)} onChange={(e) => p.onSelect!({ id, on: e.target.checked })} />
                )}
                {p.onOpen && (
                  <IconButton tabIndex={-1} size="s" label={`Открыть запись ${ord}`} onClick={(e) => p.onOpen!(row, { secondary: e.detail >= 2 })}><Open /></IconButton>
                )}
                <span className={s.ord}>{ord}</span>
              </>
            )
            return (
              <GridRecord key={id} row={row} rowKey={id} visible={visible} spanRows={spanRows} lead={lead}
                selected={selection ? isSelected(selection, id) : undefined} rowIndex={rowIndex} cellProps={cp(rowIndex)} />
            )
          })}

          {empty && (
            <tbody><tr role="row" className={s.stateRow}><td role="gridcell" colSpan={1 + visible.length}>
              <EmptyState title={p.emptyTitle ?? 'По заданным условиям записей нет'} action={p.emptyAction} />
            </td></tr></tbody>
          )}
          {state === 'error' && (
            <tbody><tr role="row" className={s.stateRow}><td role="gridcell" colSpan={1 + visible.length}>
              <ErrorState title="Не удалось загрузить данные" text={p.error ?? undefined} retry={p.onRetry} />
            </td></tr></tbody>
          )}
        </table>
      </div>
      <div className={s.foot}>
        <Pagination page={page} pageSize={pageSize} total={p.total} onPage={p.onPage} pageSizes={p.pageSizes} onPageSize={p.onPageSize} />
      </div>
    </div>
  )
}
