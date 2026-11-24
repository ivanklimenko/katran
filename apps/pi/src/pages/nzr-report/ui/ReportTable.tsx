import { useLayoutEffect, useRef } from 'react'
import { Button, Checkbox, CopyValue, StatusDot, formatAmount } from '@katran/ui'
import { STATUS_GLYPH, STATUS_LABEL, STATUS_TONE } from '../../../entities/doc-status'
import { SWIFT, localDate, type NzrDocumentRow, type ReportRow, type Sort } from '../model/report'
import { CellCaption, CellLines, Monospace, Purpose, Table, TableScroll } from './styles'

const swiftLabels = ['Приказодатель', 'Банк отправителя', 'Банк получателя', 'Банк-бенефициар', 'Бенефициар']

function SwiftCells({ doc }: { doc: NzrDocumentRow }) {
  return <>{SWIFT.map((tag) => {
    const field = doc.fields[tag]
    const main = field?.acc ?? (field && field.lines[field.lines.length - 1])
    const caption = field && (field.acc || field.lines.length > 1) ? field.lines[0] : ''
    return (
      <td key={tag}>
        {main ? <CellLines>
          <CopyValue value={main} display={field?.opt ? `${field.opt} · ${main}` : main} />
          {caption && <CellCaption title={caption}>{caption}</CellCaption>}
        </CellLines> : '—'}
      </td>
    )
  })}</>
}

function Purposes({ doc }: { doc: NzrDocumentRow }) {
  return (
    <tr><td colSpan={5}><Purpose>
      {['70', '72'].map((tag) => {
        const lines = doc.fields[tag]?.lines.join(' ') ?? ''
        return <span key={tag} title={lines}><strong>{tag}</strong> {lines}</span>
      })}
    </Purpose></td></tr>
  )
}

export function DocumentStatus({ status }: { status: NzrDocumentRow['status'] }) {
  return <StatusDot tone={STATUS_TONE[status]} letter={STATUS_GLYPH[status]} label={`${STATUS_LABEL[status]} · ${status}`} />
}

function DocumentCell({ doc, onOpen }: { doc: NzrDocumentRow; onOpen: (id: string) => void }) {
  return (
    <td rowSpan={2}>
      <CellLines>
        <DocumentStatus status={doc.status} />
        <Button id={`nzr-open-${doc.id}`} size="s" aria-label={`Открыть документ ${doc.docNumber}`} onClick={() => onOpen(doc.id)}>
          № {doc.docNumber}
        </Button>
        <CopyValue value={doc.id} display="UUID" short />
      </CellLines>
    </td>
  )
}

function DocumentEnd({ doc }: { doc: NzrDocumentRow }) {
  return <>
    <td rowSpan={2}>{doc.type}</td>
    <td rowSpan={2}>{doc.direction}<CellCaption title={doc.dirTxt}>{doc.parent === null ? doc.dirTxt : 'списание с НЗР'}</CellCaption></td>
    <SwiftCells doc={doc} />
    <td rowSpan={2}><CopyValue value={doc.routeAcc} /><CellCaption>{doc.routeType} · {doc.routeRecv}</CellCaption></td>
  </>
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

function PlacementRows({ row, selected, expanded, onSelect, onExpand, onOpen }: Pick<ReportTableProps, 'onSelect' | 'onExpand' | 'onOpen'> & {
  row: ReportRow; selected: boolean; expanded: boolean
}) {
  const childCount = row.visibleChildren.length
  const groupId = `nzr-children-${row.id}`
  return (
    <>
      <tbody data-selected={selected || undefined}>
        <tr>
          <td rowSpan={2} data-select-column><Checkbox aria-label={`Выбрать постановку ${row.docNumber}`} checked={selected}
            onChange={(e) => onSelect([row.id], e.target.checked)} /></td>
          <td rowSpan={2} data-expand-column>{childCount > 0 ? (
            <Button size="s" aria-expanded={expanded} aria-controls={groupId}
              aria-label={`${expanded ? 'Свернуть' : 'Показать'} дочерние документы постановки ${row.docNumber}`}
              onClick={() => onExpand([row.id], !expanded)}>{expanded ? '▾' : '▸'} {childCount}</Button>
          ) : '—'}</td>
          <DocumentCell doc={row} onOpen={onOpen} />
          <td rowSpan={2}>
            <Monospace>{localDate(row.numDate)}</Monospace>
            <CellCaption>{row.remaining === 0 ? `Списано ${localDate(row.lastWrite)}` : row.written > 0 ? 'Частично списано' : 'Не списано'}</CellCaption>
            {row.remaining > 0 && <CellCaption>{days(row.age)}</CellCaption>}
          </td>
          <td rowSpan={2} data-number>
            {formatAmount(row.amount)}<CellCaption>{row.currency}</CellCaption>
            {row.written > 0 && row.remaining > 0 && <CellCaption>Ост. {formatAmount(row.remaining)}</CellCaption>}
          </td>
          <td rowSpan={2}>{row.placementReason}</td>
          <td rowSpan={2}>{row.product}<CellCaption title={row.account}>НЗР · {row.account.slice(-4)}</CellCaption></td>
          <DocumentEnd doc={row} />
        </tr>
        <Purposes doc={row} />
      </tbody>
      {childCount > 0 && <tbody id={groupId} hidden={!expanded} data-child>
        {expanded && <>
          <tr>
            <th colSpan={7} scope="rowgroup">Дочерние документы · {childCount}<CellCaption>К постановке № {row.docNumber}</CellCaption></th>
            <td colSpan={8}>Успешно списано {formatAmount(row.written)} из {formatAmount(row.amount)} {row.currency}</td>
          </tr>
          {row.visibleChildren.map((child) => <ChildRows key={child.id} child={child} onOpen={onOpen} />)}
        </>}
      </tbody>}
    </>
  )
}

function ChildRows({ child, onOpen }: { child: NzrDocumentRow; onOpen: ReportTableProps['onOpen'] }) {
  return <>
    <tr>
      <td rowSpan={2} /><td rowSpan={2} aria-hidden="true">↳</td>
      <DocumentCell doc={child} onOpen={onOpen} />
      <td rowSpan={2}><Monospace>{localDate(child.numDate)}</Monospace><CellCaption>{STATUS_LABEL[child.status]}</CellCaption></td>
      <td rowSpan={2} data-number>{formatAmount(child.amount)}<CellCaption>{child.currency}</CellCaption></td>
      <td rowSpan={2}>Списание</td><td rowSpan={2}>—</td>
      <DocumentEnd doc={child} />
    </tr>
    <Purposes doc={child} />
  </>
}

export function ReportTable({ rows, selected, expanded, sort, page, onSelect, onExpand, onOpen, onSort, empty }: ReportTableProps) {
  const scroll = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0
  }, [page])
  const pageChecked = rows.filter((row) => selected.has(row.id)).length
  const ariaSort = (field: Sort['field']) => sort.field === field ? (sort.ascending ? 'ascending' : 'descending') : undefined
  const arrow = (field: Sort['field']) => sort.field === field ? (sort.ascending ? '↑' : '↓') : '↕'
  return (
    <TableScroll data-report ref={scroll}>
      <Table data-report aria-label="Документы постановки на НЗР и дочерние документы">
        <thead>
          <tr>
            <th scope="col" data-select-column>
              <Checkbox aria-label="Выбрать все постановки на странице" disabled={!rows.length}
                checked={rows.length > 0 && pageChecked === rows.length} indeterminate={pageChecked > 0 && pageChecked < rows.length}
                onChange={(e) => onSelect(rows.map((row) => row.id), e.target.checked)} />
            </th>
            <th scope="col" data-expand-column aria-label="Связи" />
            <th scope="col">Документ<CellCaption>Статус · UUID</CellCaption></th>
            <th scope="col" aria-sort={ariaSort('date')}>
              <Button size="s" onClick={() => onSort('date')}>Постановка {arrow('date')}</Button>
              <CellCaption>Срок ожидания</CellCaption>
            </th>
            <th scope="col" data-number aria-sort={ariaSort('amount')}>
              <Button size="s" onClick={() => onSort('amount')}>Сумма {arrow('amount')}</Button>
              <CellCaption>Валюта</CellCaption>
            </th>
            <th scope="col">Причина постановки</th><th scope="col">Продукт</th><th scope="col">Тип</th><th scope="col">Направление</th>
            {SWIFT.map((tag, index) => <th key={tag} scope="col">{tag}<CellCaption>{swiftLabels[index]}</CellCaption></th>)}
            <th scope="col">Маршрут<CellCaption>Счёт · получатель</CellCaption></th>
          </tr>
        </thead>
        {rows.map((row) => <PlacementRows key={row.id} row={row} selected={selected.has(row.id)} expanded={expanded.has(row.id)}
          onSelect={onSelect} onExpand={onExpand} onOpen={onOpen} />)}
        {!rows.length && <tbody><tr><td colSpan={15} data-empty><p>{empty.title}</p>
          <Button onClick={empty.onAction}>{empty.action}</Button>
        </td></tr></tbody>}
      </Table>
    </TableScroll>
  )
}
