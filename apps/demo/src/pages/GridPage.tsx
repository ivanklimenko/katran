import { useEffect, useState } from 'react'
import { createEvent, createStore } from 'effector'
import { createGridModel, localStoragePersist, useGrid, type Filter } from '@katran/effector'
import { AccountValue, CopyValue, DataGrid, LinkValue, StatusDot, Tag, formatAmount, formatDateTimeShort, useKatran, type RecordLayout } from '@katran/ui'
import { makeDocs, STATUS_LABEL, STATUS_TONE, type Doc } from '../data/docs'
import { createFakeBackend } from '../data/fakeBackend'
import s from './Page.module.css'

const T = -1 // интерактив внутри ячеек — вне таб-порядка, до него доходят через Enter на ячейке

export const docsLayout: RecordLayout<Doc> = {
  rowKey: (d) => d.id,
  columns: [
    { id: 'status', menuTitle: 'Статус', width: 44, sort: [{ id: 'status', label: 'Статус' }, { id: 'reason', label: 'Причина статуса' }],
      render: (d) => <StatusDot tone={STATUS_TONE[d.status]} label={STATUS_LABEL[d.status]} /> },
    { id: 'id', title: 'ID', subtitle: '№ · 20 вх / исх', width: 120, lines: 2,
      sort: [{ id: 'docNumber', label: 'Номер документа', type: 'number' }, { id: 'refIn', label: '20 вх' }, { id: 'refOut', label: '20 исх' }],
      render: (d) => <><CopyValue value={String(d.docNumber)} tabIndex={T} /><div><LinkValue name="uuid" value={d.id} tabIndex={T} /> <LinkValue name="refIn" value={d.refIn ?? undefined} tabIndex={T} /> <LinkValue name="refOut" value={d.refOut ?? undefined} tabIndex={T} /></div></> },
    { id: 'created', title: 'Дата / Время', width: 110, lines: 2, sort: [{ id: 'created', label: 'Дата документа', type: 'date' }, { id: 'valueDate', label: 'Валютирование', type: 'date' }],
      render: (d) => <><CopyValue value={formatDateTimeShort(d.created)} tone="ink" tabIndex={T} /><div><CopyValue value={d.valueDate} tone="ink2" tabIndex={T} /></div></> },
    { id: 'type', title: 'Тип', width: 90, sort: [{ id: 'type', label: 'Тип сообщения' }], render: (d) => <CopyValue value={d.type} tone="mono" tabIndex={T} /> },
    { id: 'direction', title: 'Направление', width: 150, lines: 2, sort: [{ id: 'direction', label: 'Группа → название', order: ['IN', 'OUT', 'TRANSIT', 'OTHER'], then: 'dirTxt' }, { id: 'dirTxt', label: 'Название' }],
      render: (d) => <><CopyValue value={d.direction} tone="mono" tabIndex={T} /><div><CopyValue value={d.dirTxt} tone="ink2" tabIndex={T} /></div></> },
    { id: 'amount', title: '32', subtitle: 'сумма', width: 120, lines: 2, align: 'right', sort: [{ id: 'amount', label: 'Сумма', type: 'number' }, { id: 'currency', label: 'Валюта' }],
      render: (d) => <><CopyValue value={formatAmount(d.amount)} tone="ink" tabIndex={T} /><div><CopyValue value={d.currency} tone="ink2" tabIndex={T} /></div></> },
    { id: 'f50', title: '50', subtitle: 'приказодатель', width: 170, lines: 2, sort: [{ id: 'f50name', label: 'Наименование' }, { id: 'f50acc', label: 'Счёт' }],
      render: (d) => <><CopyValue value={d.f50name} tabIndex={T} /><div><AccountValue value={d.f50acc} tabIndex={T} /></div></> },
    { id: 'f52', title: '52', width: 110, sort: [{ id: 'f52', label: 'BIC 52' }], render: (d) => <CopyValue value={d.f52} tone="mono" tabIndex={T} /> },
    { id: 'f57', title: '57', width: 110, sort: [{ id: 'f57', label: 'BIC 57' }], render: (d) => <CopyValue value={d.f57} tone="mono" tabIndex={T} /> },
    { id: 'f59', title: '59', subtitle: 'бенефициар', width: 170, lines: 2, sort: [{ id: 'f59name', label: 'Наименование' }, { id: 'f59acc', label: 'Счёт' }],
      render: (d) => <><CopyValue value={d.f59name} tabIndex={T} /><div><AccountValue value={d.f59acc} tabIndex={T} /></div></> },
    { id: 'sr', title: 'S / R in', width: 120, lines: 2, sort: [{ id: 'sender', label: 'S in' }, { id: 'receiver', label: 'R in' }],
      render: (d) => <><span className={s.srTag}>S:</span> <CopyValue value={d.sender} tone="mono" tabIndex={T} /><div><span className={s.srTag}>R:</span> <CopyValue value={d.receiver} tone="mono" tabIndex={T} /></div></> },
    { id: 'prov', title: 'Провайдеры', width: 110, sort: [{ id: 'provS', label: 'Провайдер отправителя' }, { id: 'provR', label: 'Провайдер получателя' }],
      render: (d) => <><Tag>{d.provS}</Tag> <Tag>{d.provR}</Tag></> },
  ],
  spans: [[
    { id: 'reason', from: 'status', to: 'created', render: (d) => (d.reason ? <CopyValue value={d.reason} tone="ink2" tabIndex={T} /> : null) },
    { id: 'purpose', from: 'f50', to: 'f59', render: (d) => (d.purpose ? <><span className={s.srTag}>70</span> <CopyValue value={d.purpose} tone="ink2" tabIndex={T} /></> : null) },
  ]],
}

const docs = makeDocs()
const fetchFx = createFakeBackend(docs, docsLayout)
export const resetFilter = createEvent()
export const $filter = createStore<Filter>([]).reset(resetFilter)
const grid = createGridModel<Doc>({
  id: 'demo-docs',
  columns: docsLayout.columns.map((c) => ({ id: c.id, width: c.width })),
  pageSize: 20,
  $filter,
  fetchFx,
  persist: localStoragePersist('katran-demo'),
  rowKey: docsLayout.rowKey,
})

export function GridPage() {
  const g = useGrid(grid)
  const { announce } = useKatran()
  const [opened, setOpened] = useState<string | null>(null)
  useEffect(() => { grid.refresh() }, [])
  return (
    <div className={s.gridPage}>
      <div className={s.gridHead}>
        <h1 className={s.h1}>Реестр</h1>
        <p className={s.note}>87 валютных документов на фейковом бэкенде с задержкой 0,25–0,65 с. Запись не кликабельна — деталку открывает кнопка; двойной клик — второй документ рядом. Tab попадает в сетку один раз, дальше — стрелки; Enter на ячейке — копировать/открыть.</p>
        {opened && <p className={s.note} role="status">{opened}</p>}
      </div>
      <DataGrid
        {...g}
        label="Валютные документы"
        layout={docsLayout}
        pageSizes={[20, 50]}
        emptyAction={{ label: 'Сбросить фильтр', onClick: () => resetFilter() }}
        onOpen={(d, { secondary }) => { const msg = `Открыт документ ${d.docNumber}${secondary ? ' — второй drawer рядом' : ''}`; setOpened(msg); announce(msg) }}
      />
    </div>
  )
}
