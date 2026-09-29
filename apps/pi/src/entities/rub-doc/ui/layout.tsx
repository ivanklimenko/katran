import { AccountValue, CopyValue, LinkValue, StatusDot, Tag, formatAmount, formatDateTimeMinutes, formatDayMonthMinutes, type RecordLayout } from '@katran/ui'
import { STATUS_LABEL, STATUS_TONE } from '../../doc-status/@x/rub-doc'
import type { RubDirection, RubDoc } from '../model/rubDoc'
import s from './cells.module.css'

const T = -1 // интерактив внутри ячеек — вне таб-порядка, до него доходят через Enter на ячейке

/**
 * Иконка группы направления (эталон `dirIco`, R17): ↓ IN и ↗ OUT — свои svg, ⇄ TRANSIT и ◦ OTHER —
 * текстом. Копия компонента fx-doc/ui/layout.tsx — сущности не импортируют ui друг друга, только через
 * @x, а @x нет для компонентов представления.
 */
function DirIcon({ dir }: { dir: RubDirection }) {
  if (dir === 'TRANSIT') return <span className={s.dirGlyph} aria-hidden="true">⇄</span>
  if (dir === 'OTHER') return <span className={s.dirGlyph} aria-hidden="true">◦</span>
  const d = dir === 'IN' ? 'M6 1.5v8.2M6 9.7L2.6 6.3M6 9.7l3.4-3.4' : 'M2.3 8.7L8.7 2.3M8.7 2.3H3.4M8.7 2.3v5.3'
  return (
    <svg className={s.dirIco} viewBox="0 0 12 12" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Счёт и наименование участника (Отправитель/Получатель): счёт 8…3 (Р15), наименование — приглушённая вторая строка (Р8). */
const party = (acc: string, name: string) => <><AccountValue value={acc} tail={3} tabIndex={T} /><div><CopyValue value={name} tone="muted" size="s" tabIndex={T} /></div></>
/** БИК и наименование банка: БИК — моно без синего тона (Р8), наименование — приглушённая вторая строка. */
const bank = (bic: string, name: string) => <><CopyValue value={bic} tone="ink" className={s.mono} tabIndex={T} /><div><CopyValue value={name} tone="muted" size="s" tabIndex={T} /></div></>

export const rubDocLayout: RecordLayout<RubDoc> = {
  rowKey: (d) => d.id,
  columns: [
    { id: 'status', menuTitle: 'Статус', width: 60, sort: [{ id: 'status', label: 'Статус' }, { id: 'reason', label: 'Причина статуса' }],
      // без letter (точка эталона без глифа), но size="l" — той же величины 16 px, что у валютного (Р9)
      render: (d) => <StatusDot size="l" tone={STATUS_TONE[d.status]} label={STATUS_LABEL[d.status]} /> },
    { id: 'id', title: 'ID', subtitle: '№ · uuid / txId / docRef', width: 166, lines: 2,
      // сортировка ID — как на стенде (COLS): номер документа + docReference; docNumber — строковое поле
      // (наше содержимое content[] хранит его строкой), поэтому строковая сортировка, не type: 'number'
      sort: [{ id: 'docNumber', label: 'Номер документа' }, { id: 'docRef', label: 'docReference' }],
      // номер документа — tone="ink" (не по умолчанию "val", Р8) + жирным, как у валютного (R17)
      render: (d) => <><CopyValue value={d.docNumber} tone="ink" className={s.num} tabIndex={T} /><div><LinkValue name="uuid" value={d.uuid} tabIndex={T} /> <LinkValue name="txId" value={d.txId} tabIndex={T} /> <LinkValue name="docRef" value={d.docRef || undefined} tabIndex={T} /></div></> },
    { id: 'created', title: 'Дата / Время', subtitle: 'создан · изменён', width: 134, lines: 2, fullHeight: true,
      sort: [{ id: 'created', label: 'Дата создания', type: 'date' }, { id: 'changed', label: 'Дата изменения', type: 'date' }],
      // формат эталона (В-Р1): главная строка с годом без секунд, «Изм.» — день.месяц без года без секунд
      render: (d) => <><CopyValue value={formatDateTimeMinutes(d.created)} tone="ink" tabIndex={T} /><div><span className={s.srTag}>Изм.</span> <CopyValue value={formatDayMonthMinutes(d.changed)} tone="muted" size="s" tabIndex={T} /></div></> },
    { id: 'type', title: 'Тип', width: 71, fullHeight: true, lines: 2, sort: [{ id: 'type', label: 'Тип документа' }, { id: 'edCode', label: 'Код ЭС' }],
      render: (d) => <><Tag tone="mt">{d.type}</Tag><div><CopyValue value={d.edCode} tone="ink" className={s.mono} tabIndex={T} /></div></> },
    { id: 'direction', title: 'Направление', width: 127, lines: 2, fullHeight: true, sort: [{ id: 'direction', label: 'Группа → название', order: ['IN', 'OUT', 'TRANSIT', 'OTHER'], then: 'dirTxt' }, { id: 'dirTxt', label: 'Название' }],
      // иконка + код направления — как у валютного (R17, эталон dirIco)
      render: (d) => <><span className={s.dirRow}><DirIcon dir={d.direction} /><CopyValue value={d.direction} tone="ink" className={s.dirCode} tabIndex={T} /></span><div><CopyValue value={d.dirTxt} tone="muted" size="s" maxWidth={105} tabIndex={T} /></div></> },
    { id: 'amount', title: 'Сумма', subtitle: 'RUB', width: 89, lines: 2, align: 'right', fullHeight: true, sort: [{ id: 'amount', label: 'Сумма', type: 'number' }],
      // вторая строка «RUB» в записи — как на стенде (единственная валюта реестра, но показана в самой ячейке, не только в подзаголовке шапки, R17)
      render: (d) => <><CopyValue value={formatAmount(d.amount)} tone="ink" tabIndex={T} /><div><CopyValue value="RUB" tone="muted" size="s" tabIndex={T} /></div></> },
    { id: 'from', title: 'Отправитель', subtitle: 'счёт · наименование', width: 162, lines: 2,
      sort: [{ id: 'fromName', label: 'Наименование' }, { id: 'fromAcc', label: 'Счёт' }, { id: 'fromInn', label: 'ИНН' }, { id: 'purpose', label: 'Назначение платежа' }],
      render: (d) => party(d.fromAcc, d.fromName) },
    { id: 'to', title: 'Получатель', subtitle: 'счёт · наименование', width: 162, lines: 2,
      sort: [{ id: 'toName', label: 'Наименование' }, { id: 'toAcc', label: 'Счёт' }, { id: 'toInn', label: 'ИНН' }],
      render: (d) => party(d.toAcc, d.toName) },
    { id: 'fromBank', title: 'Банк отправителя', subtitle: 'БИК · наименование', width: 166, lines: 2, sort: [{ id: 'fromBic', label: 'БИК' }, { id: 'fromBank', label: 'Наименование банка' }], render: (d) => bank(d.fromBic, d.fromBank) },
    { id: 'toBank', title: 'Банк получателя', subtitle: 'БИК · наименование', width: 162, lines: 2, sort: [{ id: 'toBic', label: 'БИК' }, { id: 'toBank', label: 'Наименование банка' }], render: (d) => bank(d.toBic, d.toBank) },
    { id: 'systems', title: 'Системы', subtitle: 'I · S · D', width: 115, lines: 3, fullHeight: true,
      sort: [{ id: 'initiator', label: 'Initiator' }, { id: 'source', label: 'Source' }, { id: 'destination', label: 'Destination' }],
      render: (d) => <>{([['I', d.initiator], ['S', d.source], ['D', d.destination]] as const).map(([k, v]) => <div key={k}><span className={s.srTag}>{k}:</span><CopyValue value={v} tone="ink" className={s.mono} tabIndex={T} /></div>)}</> },
    { id: 'queue', title: 'Очерёдн.', subtitle: 'приоритет', width: 101, lines: 2, fullHeight: true,
      sort: [{ id: 'queue', label: 'Очерёдность', type: 'number' }, { id: 'prio', label: 'Приоритет', type: 'number' }],
      render: (d) => <><CopyValue value={String(d.queue)} tone="ink" className={s.mono} tabIndex={T} /><div>{d.prio === 1 ? <Tag tone="warn">СРОЧНО</Tag> : <CopyValue value="неприоритетный" tone="muted" size="s" tabIndex={T} />}</div></> },
  ],
  spans: [[
    { id: 'reason', from: 'status', to: 'id', render: (d) => (d.reason ? <><StatusDot size="s" tone={STATUS_TONE[d.status]} /> <CopyValue value={d.reason} tone="ink2" size="s" tabIndex={T} /></> : null) },
    { id: 'purpose', from: 'from', to: 'toBank', render: (d) => <><span className={s.srTag} title="Назначение платежа">НАЗН.</span> <CopyValue value={d.purpose} tone="ink2" tabIndex={T} /></> },
  ]],
}
