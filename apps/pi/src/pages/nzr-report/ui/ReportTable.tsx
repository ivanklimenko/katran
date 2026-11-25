import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useUnit } from 'effector-react'
import {
  Button, Checkbox, ColumnHeader, ColumnsMenu, CopyValue, StatusDot,
  fillSegments, formatAmount, resolveSpans, visibleColumns, type ColumnDef, type SpanDef, type Sort as GridSort,
} from '@katran/ui'
import { STATUS_GLYPH, STATUS_LABEL, STATUS_TONE } from '../../../entities/doc-status'
import { SwiftTextFields, SwiftTextFieldStyles, swiftTooltip } from '../../../entities/fx-doc'
import { $columns, columnsChanged, widthChanged, widthReset, widthsReset } from '../model/columns'
import { SWIFT, localDate, type NzrDocumentRow, type ReportRow, type Sort } from '../model/report'
import { CellCaption, CellLines, Monospace, Table, TableScroll } from './styles'

const swiftLabels = ['Приказодатель', 'Банк отправителя', 'Банк получателя', 'Банк-бенефициар', 'Бенефициар']
const SELECT_WIDTH = 32
const EXPAND_WIDTH = 56

function SwiftCell({ doc, tag }: { doc: NzrDocumentRow; tag: string }) {
  const field = doc.fields[tag]
  const main = field?.acc ?? field?.lines[field.lines.length - 1]
  if (!field || !main) return <span>—</span>
  const caption = field.acc || field.lines.length > 1 ? field.lines[0] : ''
  const tooltip = swiftTooltip(tag, field)
  return (
    <CellLines>
      <CopyValue value={main} tooltip={tooltip} display={field.opt ? `${field.opt} · ${main}` : main} />
      {caption && <CellCaption data-k-tip={tooltip}>{caption}</CellCaption>}
    </CellLines>
  )
}

export function DocumentStatus({ status }: { status: NzrDocumentRow['status'] }) {
  return <StatusDot tone={STATUS_TONE[status]} letter={STATUS_GLYPH[status]} label={`${STATUS_LABEL[status]} · ${status}`} />
}

function DocumentCell({ doc, onOpen }: { doc: NzrDocumentRow; onOpen: (id: string) => void }) {
  return (
    <CellLines>
      <DocumentStatus status={doc.status} />
      <Button id={`nzr-open-${doc.id}`} size="s" aria-label={`Открыть документ ${doc.docNumber}`} onClick={() => onOpen(doc.id)}>№ {doc.docNumber}</Button>
      <CopyValue value={doc.id} display="UUID" short />
    </CellLines>
  )
}

type ReportTableProps = {
  rows: ReportRow[]; selected: Set<string>; expanded: Set<string>; sort: Sort; page: number
  onSelect: (ids: string[], checked: boolean) => void
  onExpand: (ids: string[], checked: boolean) => void
  onOpen: (id: string) => void
  onSort: (field: Sort['field']) => void
  empty: { title: string; action: string; onAction: () => void }
}

const days = (age: number) => age === 0 ? 'Сегодня' : `${age} ${age === 1 ? 'день' : age <= 4 ? 'дня' : 'дней'} на НЗР`
type Cell = { doc: NzrDocumentRow; placement?: ReportRow; onOpen: ReportTableProps['onOpen'] }

const preferenceColumns: ColumnDef<Cell>[] = [
  { id: 'document', title: 'Документ', subtitle: 'Статус · UUID', width: 90, fullHeight: true, render: ({ doc, onOpen }) => <DocumentCell doc={doc} onOpen={onOpen} /> },
  { id: 'date', title: 'Постановка', subtitle: 'Срок ожидания', width: 130, fullHeight: true, sort: [{ id: 'date', label: 'Дата постановки', type: 'date' }], render: ({ doc, placement }) => (
    <>
      <Monospace>{localDate(doc.numDate)}</Monospace>
      {placement ? <>
        <CellCaption>{placement.remaining === 0 ? `Списано ${localDate(placement.lastWrite)}` : placement.written > 0 ? 'Частично списано' : 'Не списано'}</CellCaption>
        {placement.remaining > 0 && <CellCaption>{days(placement.age)}</CellCaption>}
      </> : <CellCaption>{STATUS_LABEL[doc.status]}</CellCaption>}
    </>
  ) },
  { id: 'amount', title: 'Сумма', subtitle: 'Валюта', width: 120, fullHeight: true, align: 'right', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }], render: ({ doc, placement }) => (
    <>
      {formatAmount(doc.amount)}<CellCaption>{doc.currency}</CellCaption>
      {placement && placement.written > 0 && placement.remaining > 0 && <CellCaption>Ост. {formatAmount(placement.remaining)}</CellCaption>}
    </>
  ) },
  { id: 'reason', title: 'Причина постановки', width: 160, fullHeight: true, render: ({ placement }) => placement?.placementReason ?? 'Списание' },
  { id: 'product', title: 'Продукт', width: 95, fullHeight: true, render: ({ placement }) => placement ? <>
    {placement.product}<CellCaption title={placement.account}>НЗР · {placement.account.slice(-4)}</CellCaption>
  </> : '—' },
  { id: 'type', title: 'Тип', width: 70, fullHeight: true, render: ({ doc }) => doc.type },
  { id: 'direction', title: 'Направление', width: 115, fullHeight: true, render: ({ doc }) => <>
    {doc.direction}<CellCaption title={doc.dirTxt}>{doc.parent === null ? doc.dirTxt : 'списание с НЗР'}</CellCaption>
  </> },
  ...SWIFT.map((tag, index): ColumnDef<Cell> => ({
    id: tag, title: tag, subtitle: swiftLabels[index], menuTitle: `${tag} · ${swiftLabels[index]}`, width: index === 0 || index === 4 ? 150 : 140,
    render: ({ doc }) => <SwiftCell doc={doc} tag={tag} />,
  })),
  { id: 'route', title: 'Маршрут', subtitle: 'Счёт · получатель', width: 156, fullHeight: true, render: ({ doc }) => <>
    <CopyValue value={doc.routeAcc} /><CellCaption data-k-tip={`${doc.routeType} · ${doc.routeRecv}`} data-k-tip-if="truncated">{doc.routeType} · {doc.routeRecv}</CellCaption>
  </> },
]

const swiftSpan: SpanDef<Cell> = {
  id: 'swift-text', from: '50', to: '59', render: ({ doc }) => <SwiftTextFields fields={doc.fields} />,
}

function RecordRows({ cells, lead, columns, support }: {
  cells: Cell; lead: ReactNode; columns: ColumnDef<Cell>[]; support: ReturnType<typeof fillSegments<Cell>>
}) {
  return (
    <>
      <tr>
        {lead}
        {columns.map((column) => (
          <td key={column.id} rowSpan={support.length && column.fullHeight ? 2 : undefined} data-number={column.align === 'right' || undefined}>
            {column.render(cells)}
          </td>
        ))}
      </tr>
      {support.length > 0 && <tr>{support.map((segment, i) => (
        'def' in segment
          ? <td key={segment.def.id} colSpan={segment.colSpan}>{segment.def.render(cells)}</td>
          : <td key={i} colSpan={segment.colSpan} aria-hidden="true" />
      ))}</tr>}
    </>
  )
}

export function ReportTable({ rows, selected, expanded, sort, page, onSelect, onExpand, onOpen, onSort, empty }: ReportTableProps) {
  const scroll = useRef<HTMLDivElement>(null)
  const menuAnchor = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const { preferences, change, resize, resetWidth, resetWidths } = useUnit({
    preferences: $columns, change: columnsChanged, resize: widthChanged, resetWidth: widthReset, resetWidths: widthsReset,
  })
  const columns = visibleColumns(preferences.order, preferences.hidden, preferenceColumns)
  const tall = new Set(columns.filter((column) => column.fullHeight).map((column) => column.id))
  const [span] = resolveSpans([swiftSpan as SpanDef<unknown>], columns.map((column) => column.id), preferenceColumns.map((column) => column.id), tall)
  const support = span ? fillSegments([{ ...span, def: swiftSpan }], columns.map((column) => tall.has(column.id))) : []
  const totalCols = columns.length + 2
  const widthOf = (column: ColumnDef<Cell>) => preferences.widths[column.id] ?? column.width ?? 100
  const scaled = (width: number) => `calc(${width}px * var(--k-density))`
  const tableWidth = SELECT_WIDTH + EXPAND_WIDTH + columns.reduce((width, col) => width + widthOf(col), 0)
  const gridSort: GridSort = sort.field === 'age' ? [] : [{ key: sort.field, dir: sort.ascending ? 'asc' : 'desc' }]
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0
  }, [page])
  const pageChecked = rows.filter((row) => selected.has(row.id)).length
  return (
    <>
      <SwiftTextFieldStyles />
      <div><Button size="s" ref={menuAnchor} pressed={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>Состав колонок</Button></div>
      <ColumnsMenu open={menuOpen} anchor={menuAnchor} onClose={() => setMenuOpen(false)} columns={preferenceColumns}
        order={preferences.order} hidden={preferences.hidden} onChange={change} />
      <TableScroll data-report ref={scroll}>
        <Table data-report style={{ width: scaled(tableWidth) }} aria-label="Документы постановки на НЗР и дочерние документы">
          <colgroup>
            <col style={{ width: scaled(SELECT_WIDTH) }} /><col style={{ width: scaled(EXPAND_WIDTH) }} />
            {columns.map((column) => <col key={column.id} style={{ width: scaled(widthOf(column)) }} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" data-select-column>
                <Checkbox aria-label="Выбрать все постановки на странице" disabled={!rows.length}
                  checked={rows.length > 0 && pageChecked === rows.length} indeterminate={pageChecked > 0 && pageChecked < rows.length}
                  onChange={(e) => onSelect(rows.map((row) => row.id), e.target.checked)} />
              </th>
              <th scope="col" data-expand-column aria-label="Связи" />
              {columns.map((column) => <ColumnHeader key={column.id} column={column} width={widthOf(column)} sort={gridSort} tabIndex={0}
                onSort={(next) => { const field = next[0]?.key; if (field === 'date' || field === 'amount') onSort(field) }}
                onResize={(width) => resize({ id: column.id, width })}
                onResetWidth={() => resetWidth(column.id)} onResetWidths={resetWidths} />)}
            </tr>
          </thead>
          {rows.map((row) => (
            <ReportGroup key={row.id} row={row} selected={selected.has(row.id)} expanded={expanded.has(row.id)}
              columns={columns} support={support} onSelect={onSelect} onExpand={onExpand} onOpen={onOpen} />
          ))}
          {!rows.length && <tbody><tr><td colSpan={totalCols} data-empty><p>{empty.title}</p><Button onClick={empty.onAction}>{empty.action}</Button></td></tr></tbody>}
        </Table>
      </TableScroll>
    </>
  )
}

function ReportGroup({ row, selected, expanded, columns, support, onSelect, onExpand, onOpen }: {
  row: ReportRow; selected: boolean; expanded: boolean; columns: ColumnDef<Cell>[]
  support: ReturnType<typeof fillSegments<Cell>>
} & Pick<ReportTableProps, 'onSelect' | 'onExpand' | 'onOpen'>) {
  const childCount = row.visibleChildren.length
  const groupId = `nzr-children-${row.id}`
  const recordSpan = support.length ? 2 : undefined
  return (
    <>
      <tbody data-selected={selected || undefined}>
        <RecordRows cells={{ doc: row, placement: row, onOpen }} columns={columns} support={support} lead={<>
          <td rowSpan={recordSpan} data-select-column><Checkbox aria-label={`Выбрать постановку ${row.docNumber}`} checked={selected}
            onChange={(e) => onSelect([row.id], e.target.checked)} /></td>
          <td rowSpan={recordSpan} data-expand-column>{childCount > 0 ? (
            <Button size="s" aria-expanded={expanded} aria-controls={groupId}
              aria-label={`${expanded ? 'Свернуть' : 'Показать'} дочерние документы постановки ${row.docNumber}`}
              onClick={() => onExpand([row.id], !expanded)}>{expanded ? '▾' : '▸'} {childCount}</Button>
          ) : '—'}</td>
        </>} />
      </tbody>
      {childCount > 0 && <tbody id={groupId} hidden={!expanded} data-child>
        {expanded && <>
          <tr><th scope="rowgroup" colSpan={columns.length + 2}>Дочерние документы · {childCount}
            <CellCaption>К постановке № {row.docNumber} · Успешно списано {formatAmount(row.written)} из {formatAmount(row.amount)} {row.currency}</CellCaption>
          </th></tr>
          {row.visibleChildren.map((doc) => (
            <RecordRows key={doc.id} cells={{ doc, onOpen }} columns={columns} support={support}
              lead={<><td rowSpan={recordSpan} /><td rowSpan={recordSpan} aria-hidden="true">↳</td></>} />
          ))}
        </>}
      </tbody>}
    </>
  )
}
