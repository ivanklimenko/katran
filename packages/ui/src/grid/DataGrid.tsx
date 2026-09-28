import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { sizes } from '@katran/tokens'
import { IconButton } from '../button'
import { formatDateTimeMinutes } from '../format'
import { Checkbox } from '../input'
import { Pagination } from '../pagination'
import { EmptyState, ErrorState, ProgressBar, useLoadingGate } from '../state'
import { ColumnHeader } from './ColumnHeader'
import { ColumnsMenu } from './ColumnsMenu'
import { GridRecord, type CellProps, type SpanCell } from './GridRecord'
import { GridSkeleton } from './GridSkeleton'
import { expandColumns, resolveSpans, visibleColumns } from './resolveSpans'
import { isSelected, pageState } from './selection'
import { SortChips } from './SortChips'
import { useGridKeyboard } from './useGridKeyboard'
import s from './Grid.module.css'
import type { ColumnsState, GridViewState, RecordLayout, RowState, Selection, SpanDef, Sort } from './types'

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
  onResetWidths?: (() => void) | undefined
  onResetWidth?: ((id: string) => void) | undefined
  order: string[]
  hidden: string[]
  onColumns: (s: ColumnsState) => void
  /** id хостов в режиме «раздельно» (спека 5a §4). */
  split?: string[] | undefined
  onSplit?: ((p: { id: string; on: boolean }) => void) | undefined
  selection?: Selection | undefined
  onSelect?: ((p: { id: string; on: boolean }) => void) | undefined
  onSelectPage?: ((p: { ids: string[]; on: boolean }) => void) | undefined
  state: GridViewState
  error?: string | null | undefined
  onRetry?: (() => void) | undefined
  emptyTitle?: string | undefined
  /** Пояснение под заголовком пустого состояния. */
  emptyText?: string | undefined
  emptyAction?: { label: string; onClick: () => void } | undefined
  /** Второй клик по кнопке (e.detail ≥ 2) или Shift+клик — secondary: второй drawer рядом; state — RowState записи (спека 5a §6). */
  onOpen?: ((row: Row, opts: { secondary: boolean; state: RowState }) => void) | undefined
  skeletonRows?: number | undefined
  /** Слот над пагинацией в футере — полоса массовых действий экрана. */
  toolbar?: ReactNode | undefined
  /** Заблокирована/неактивна (спека 5a §6, B1); неактивные исключаются из выделения. */
  rowState?: ((row: Row) => RowState) | undefined
  /** Подсказка кнопки открытия для обычной (не locked/inactive) записи. */
  openHint?: string | undefined
}

const DEFAULT_WIDTH = 120
// ширина служебной колонки — из токена grid-lead (тот же, что --k-grid-lead в CSS): JS считает по ней ширину таблицы
const LEAD_WIDTH = sizes['grid-lead']

const Cols = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M6 3v10M10 3v10" /></svg>
const Open = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M6 8h4M8 6v4" /></svg>
const Lock = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3.5" y="7" width="9" height="6" rx="1" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>

export function DataGrid<Row>(p: DataGridProps<Row>) {
  const { layout, rows, page, pageSize, selection, state } = p
  const propsSplit = p.split
  const split = useMemo(() => propsSplit ?? [], [propsSplit])
  const visible = useMemo(() => expandColumns(visibleColumns(p.order, p.hidden, layout.columns), split), [p.order, p.hidden, layout.columns, split])
  const fullOrder = useMemo(() => expandColumns(visibleColumns(p.order, [], layout.columns), split).map((c) => c.id), [p.order, layout.columns, split])
  const visibleIds = useMemo(() => visible.map((c) => c.id), [visible])
  const tallIds = useMemo(() => new Set(visible.filter((c) => c.fullHeight).map((c) => c.id)), [visible])
  const spanRows = useMemo<SpanCell<Row>[][]>(
    () => (layout.spans ?? [])
      .map((line) => {
        // типы сегментов инвариантны по строке; функции нужен только id/from/to
        const resolved = resolveSpans(line as unknown as SpanDef<unknown>[], visibleIds, fullOrder, tallIds)
        return resolved.map((r) => ({ def: line.find((d) => d.id === r.id)!, colStart: r.colStart, colSpan: r.colSpan }))
      })
      // строка без сегментов (колонки скрыты или все под ней высокие) — одни aria-hidden заглушки:
      // для AT это row без ячеек, для стрелок — тупик; её нет, и perRecord/aria-rowindex/скелетон считаются без неё
      .filter((segs) => segs.length > 0),
    [layout.spans, visibleIds, fullOrder, tallIds],
  )
  const perRecord = 1 + spanRows.length
  const widthOf = (id: string, fallback: number | undefined) => p.widths[id] ?? fallback ?? DEFAULT_WIDTH
  const tableWidth = LEAD_WIDTH + visible.reduce((sum, c) => sum + widthOf(c.id, c.width), 0)

  const [colsOpen, setColsOpen] = useState(false)
  const colsBtn = useRef<HTMLButtonElement>(null)

  const stateOf = (row: Row): RowState => p.rowState?.(row) ?? null
  // Неактивные записи не выделяются: ни чекбоксом строки, ни чекбоксом «на странице».
  const selectable = rows.filter((r) => stateOf(r)?.kind !== 'inactive').map(layout.rowKey)
  const pageSel = selection ? pageState(selection, selectable) : 'none'
  // Скелетон — по воротам, а не по state: ворота держат его минимум sk-min после ответа (спека 6.3),
  // и всё это время данные/пустое/ошибка не показываются, чтобы не было мелькания.
  const showSkeleton = useLoadingGate(state === 'loading')
  const showRows = !showSkeleton && state !== 'loading' && state !== 'error'
  const dim = state === 'refreshing'
  const empty = !showSkeleton && state === 'ready' && rows.length === 0
  const failed = !showSkeleton && state === 'error'
  const kb = useGridKeyboard({
    resetToken: `${page}:${rows.length}:${visibleIds.join(',')}:${showRows}`,
    fallback: showRows && rows.length > 0 ? '2:0' : '1:0',
  })
  // Ключи клавиатурного слоя — свой индекс внутри страницы (шапка 1, записи с 2), не aria-rowindex:
  // тот абсолютный и зависит от номера страницы.
  const cp = (localIndex: number): CellProps => (r, c) => kb.cellProps(localIndex, r, c)
  // aria-rowcount — по всей выборке; строка empty/error занимает индекс 2 и тоже должна в него входить.
  const rowCount = Math.max(1 + p.total * perRecord, empty || failed ? 2 : 1)

  return (
    <div className={s.root}>
      <SortChips sort={p.sort} columns={layout.columns} onSort={p.onSort} />
      <div className={s.wrap}>
        {dim && <div className={s.progress}><ProgressBar label="Обновление данных" /></div>}
        <table
          role="grid"
          aria-label={p.label}
          aria-rowcount={rowCount}
          aria-colcount={1 + visible.length}
          aria-busy={state === 'loading' || state === 'refreshing' || showSkeleton || undefined}
          aria-multiselectable={selection ? true : undefined}
          data-dim={dim || undefined}
          className={[s.table, dim ? s.dim : ''].filter(Boolean).join(' ')}
          style={{ width: `calc(${tableWidth}px * var(--k-density))` } as CSSProperties}
        >
          <thead>
            <tr role="row" aria-rowindex={1}>
              <th role="columnheader" scope="col" className={s.th} style={{ width: 'var(--k-grid-lead)' } as CSSProperties} {...cp(1)(0, 0)}>
                <div className={s.leadHead}>
                  {selection && p.onSelectPage && (
                    <Checkbox tabIndex={-1} aria-label="Выбрать все на странице" checked={pageSel === 'all'} indeterminate={pageSel === 'some'} disabled={selectable.length === 0}
                      onChange={() => p.onSelectPage!({ ids: selectable, on: pageSel !== 'all' })} />
                  )}
                  <IconButton ref={colsBtn} tabIndex={-1} size="s" label="Состав колонок" pressed={colsOpen} onClick={() => setColsOpen(true)}><Cols /></IconButton>
                </div>
                <ColumnsMenu open={colsOpen} anchor={colsBtn} onClose={() => setColsOpen(false)} columns={layout.columns} order={p.order} hidden={p.hidden} onChange={p.onColumns} split={p.split} onSplit={p.onSplit} />
              </th>
              {visible.map((c, i) => (
                <ColumnHeader key={c.id} column={c} sort={p.sort} onSort={p.onSort} width={widthOf(c.id, c.width)}
                  onResize={(c.resizable ?? true) ? (w) => p.onResize({ id: c.id, width: w }) : undefined}
                  onResetWidths={p.onResetWidths} onResetWidth={p.onResetWidth ? () => p.onResetWidth!(c.id) : undefined}
                  cellProps={cp(1)(0, i + 1)} />
              ))}
            </tr>
          </thead>

          {showSkeleton && <GridSkeleton visible={visible} spanRows={spanRows} rows={p.skeletonRows ?? 8} />}

          {showRows && rows.map((row, i) => {
            const id = layout.rowKey(row)
            const ord = (page - 1) * pageSize + i + 1
            const localIndex = 2 + i * perRecord
            const rowIndex = 2 + (ord - 1) * perRecord   // абсолютный: 2 + ((page − 1) × pageSize + i) × perRecord
            const st = stateOf(row)
            // неактивная не показывается выбранной даже в режиме «все» или при своём id в списке (спека 5a §6)
            const sel = selection ? isSelected(selection, id) && st?.kind !== 'inactive' : undefined
            const openLabel = st?.kind === 'locked' ? `Заблокирована: ${st.who}, с ${formatDateTimeMinutes(st.since)} · открыть только для просмотра` : `Открыть запись ${ord}`
            const openTip = st?.kind === 'locked' ? openLabel : st?.kind === 'inactive' ? `${st.why} · открыть` : p.openHint
            const lead = (
              <>
                {selection && p.onSelect && (
                  <Checkbox tabIndex={-1} aria-label={st?.kind === 'inactive' ? `Выбрать запись ${ord} — ${st.why}` : `Выбрать запись ${ord}`} checked={sel}
                    disabled={st?.kind === 'inactive'} data-k-tip={st?.kind === 'inactive' ? `${st.why} · выбрать нельзя` : undefined}
                    onChange={(e) => p.onSelect!({ id, on: e.target.checked })} />
                )}
                {p.onOpen && (
                  <IconButton tabIndex={-1} size="s" className={st?.kind === 'locked' ? s.openLocked : undefined} label={openLabel} data-k-tip={openTip}
                    onClick={(e) => p.onOpen!(row, { secondary: e.detail >= 2 || e.shiftKey, state: st })}>
                    {st?.kind === 'locked' ? <Lock /> : <Open />}
                  </IconButton>
                )}
                <span className={s.ord}>{ord}</span>
              </>
            )
            return (
              <GridRecord key={id} row={row} rowKey={id} visible={visible} spanRows={spanRows} lead={lead}
                selected={sel} rowIndex={rowIndex} cellProps={cp(localIndex)} state={st} />
            )
          })}

          {empty && (
            <tbody><tr role="row" aria-rowindex={2} className={s.stateRow}><td role="gridcell" colSpan={1 + visible.length}>
              <EmptyState title={p.emptyTitle ?? 'По заданным условиям записей нет'} text={p.emptyText} action={p.emptyAction} />
            </td></tr></tbody>
          )}
          {failed && (
            <tbody><tr role="row" aria-rowindex={2} className={s.stateRow}><td role="gridcell" colSpan={1 + visible.length}>
              <ErrorState title="Не удалось загрузить данные" text={p.error ?? undefined} retry={p.onRetry} />
            </td></tr></tbody>
          )}
        </table>
      </div>
      <div className={s.foot}>
        {/* как слот действий BulkBar: пустым считаются только null/undefined/false, валидные falsy (0, '') рендерятся */}
        {p.toolbar != null && p.toolbar !== false && <div className={s.toolbar}>{p.toolbar}</div>}
        <Pagination page={page} pageSize={pageSize} total={p.total} onPage={p.onPage} pageSizes={p.pageSizes} onPageSize={p.onPageSize} />
      </div>
    </div>
  )
}
