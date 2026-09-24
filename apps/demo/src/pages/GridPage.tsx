import { useEffect, useState } from 'react'
import { createFiltersModel, createGridModel, localStoragePersist, useFilters, useGrid } from '@katran/effector'
import { AccountValue, BulkBar, Button, Checkbox, CopyValue, Counter, DataGrid, FilterPanel, LinkValue, StatusDot, StatusLane, Tag, formatAmount, formatDateTimeShort, useKatran, type LaneItem, type RecordLayout } from '@katran/ui'
import { docsFilterMeta, makeDocs, STATUS_LABEL, STATUS_TONE, type Doc, type Status } from '../data/docs'
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

/** Фрагмент раскладки для показа на странице — держать в синхроне с docsLayout.spans (текст блока spans: дословно, без отступа объекта). */
const SPANS_SNIPPET = `spans: [[
  { id: 'reason', from: 'status', to: 'created', render: (d) => (d.reason ? <CopyValue value={d.reason} tone="ink2" tabIndex={T} /> : null) },
  { id: 'purpose', from: 'f50', to: 'f59', render: (d) => (d.purpose ? <><span className={s.srTag}>70</span> <CopyValue value={d.purpose} tone="ink2" tabIndex={T} /></> : null) },
]],`

const docs = makeDocs()
const { searchFx, facetsFx } = createFakeBackend(docs, docsLayout)
/** Один стор условий: лейн, панель и грид читают и пишут $conditions (лейн — EQ по status). */
const filters = createFiltersModel({ meta: docsFilterMeta, laneField: 'status' })
const grid = createGridModel<Doc>({
  id: 'demo-docs',
  columns: docsLayout.columns.map((c) => ({ id: c.id, width: c.width })),
  pageSize: 20,
  $filter: filters.$conditions,
  fetchFx: searchFx,
  facets: { field: 'status', fetchFx: facetsFx },
  persist: localStoragePersist('katran-demo'),
  rowKey: docsLayout.rowKey,
})
/** Порядок и подписи лейна — из словаря приложения; счётчики — из фасетов: до первого ответа чисел нет, потом отсутствующий статус — 0. */
const STATUSES = Object.keys(STATUS_LABEL) as Status[]

export function GridPage() {
  const g = useGrid(grid)
  const f = useFilters(filters)
  const { announce } = useKatran()
  const [opened, setOpened] = useState<string | null>(null)
  const [hlSpans, setHlSpans] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Фасеты ещё не приходили — лейн без чисел, а не с нулями; флаг не сбрасывается, дальше пустой ответ — это нули.
  const [counted, setCounted] = useState(false)
  if (!counted && g.facets.length > 0) setCounted(true)
  useEffect(() => { grid.refresh() }, [])
  const lane: LaneItem[] = STATUSES.map((st) => ({ value: st, label: STATUS_LABEL[st], tone: STATUS_TONE[st], count: counted ? (g.facets.find((x) => String(x.value) === st)?.count ?? 0) : undefined }))
  // действия полосы — демонстрационные: только объявляют, сколько выбрано
  const bulk = (what: string) => {
    const n = g.selection.mode === 'all' ? g.total - g.selection.except.length : g.selection.ids.length
    announce(`${what}: выбрано ${n}`)
  }
  return (
    <div className={[s.gridPage, hlSpans ? s.hlSpans : ''].filter(Boolean).join(' ')}>
      <div className={s.gridHead}>
        <h1 className={s.h1}>Валютные документы{' '}<span className={s.h1Counter}><Counter value={g.total} /></span></h1>
        <p className={s.note}>87 валютных документов на фейковом бэкенде с задержкой 0,25–0,65 с. Запись не кликабельна — деталку открывает кнопка; двойной клик — второй документ рядом. Tab попадает в сетку один раз, дальше — стрелки; Enter на ячейке — копировать/открыть.</p>
        <details className={s.explain}>
          <summary className={s.explainSummary}>Сквозные строки записи: как это управляется</summary>
          <div className={s.explainBody}>
            <p className={s.explainText}>
              Запись — это <code>tbody</code>: первая строка — ячейки колонок, следующие — сквозные строки из сегментов.
              Сегмент задаётся диапазоном <code>from</code>/<code>to</code> по <code>id</code> колонок и функцией <code>render</code> — числа <code>colspan</code> в раскладке нет.
              Скрытые колонки сжимают сегмент: <code>resolveSpans</code> пересчитывает <code>colSpan</code> по видимому составу и порядку — скройте колонку 52 в меню состава, и назначение сузится.
              Если <code>render</code> вернул <code>null</code>, сегмент — бледная подложка без содержимого; <code>lines</code> задаёт кламп сегмента. Правила — спека, разделы 6.1–6.3.
            </p>
            <Checkbox label="Подсветить сквозные сегменты" checked={hlSpans} onChange={(e) => setHlSpans(e.target.checked)} />
            <pre className={s.code}>{SPANS_SNIPPET}</pre>
          </div>
        </details>
        {opened && <p className={s.note} role="status">{opened}</p>}
        <div className={s.lane}><StatusLane label="Статусы" items={lane} value={f.lane} onChange={f.setLane} /></div>
        <div className={s.filters}>
          <FilterPanel meta={docsFilterMeta} conditions={f.conditions} draft={f.draft} dirty={f.dirty} open={filtersOpen} onOpenChange={setFiltersOpen}
            onEdit={f.edit} onDiscard={f.discard} onApply={f.apply} onRevert={f.revert} onReset={f.reset} onRemove={f.remove} />
        </div>
      </div>
      <DataGrid
        {...g}
        label="Валютные документы"
        layout={docsLayout}
        pageSizes={[20, 50]}
        emptyAction={{ label: 'Сбросить фильтр', onClick: () => f.reset() }}
        onOpen={(d, { secondary }) => { const msg = `Открыт документ ${d.docNumber}${secondary ? ' — второй drawer рядом' : ''}`; setOpened(msg); announce(msg) }}
        toolbar={
          <BulkBar selection={g.selection} total={g.total} onClear={g.onClearSelection} onSelectAll={g.onSelectAll}>
            <Button size="s" onClick={() => bulk('Экспорт')}>Экспортировать</Button>
            <Button size="s" onClick={() => bulk('Отложить')}>Отложить</Button>
          </BulkBar>
        }
      />
    </div>
  )
}
