import styled from 'styled-components'
import { k } from '@katran/tokens'
import { AccountValue, CopyValue, FieldTag, LinkValue, StatusDot, SwiftField, Tag, formatAmount, formatDate, formatDateTimeFull, type RecordLayout } from '@katran/ui'
import { STATUS_GLYPH, STATUS_LABEL, STATUS_TONE } from '../../doc-status/@x/fx-doc'
import type { Direction, FxDoc } from '../model/fxDoc'

/* «S:» / «R:» — служебная подпись роли, не данные (спека 5b §2, R15) */
const SrTag = styled.span`
  display: inline-block;
  width: ${k.sp4};
  color: ${k.faint};
  font: 400 ${k.fs2} / ${k.lh2} ${k.sans};
`

/* Переопределения CopyValue в ячейках — styled(CopyValue) с && (прежний двойной класс, (0,2,0)): выше правил значения кита (0,1,0) */

/* шрифт значения без смены цвета — цвет уже задаёт тон CopyValue (val/ink/ink2) */
const Mono = styled(CopyValue)`
  && {
    font-family: ${k.mono};
  }
`

/* номер документа в ID — 600 (спека 5b §2, R17) */
const Num = styled(CopyValue)`
  && {
    font-weight: 600;
  }
`

/* код направления — mono 600 fs-3 (спека 5b §3, R11); цвет — тон CopyValue */
const DirRow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp1};
`

const DirCode = styled(CopyValue)`
  && {
    font: 600 ${k.fs3} / 1 ${k.mono};
  }
`

const DirIco = styled.svg`
  width: ${k.fs1};
  height: ${k.fs1};
  flex: none;
`

const DirGlyph = styled.span`
  font: ${k.fs1} / 1 ${k.sans};
`

/* назначение 70 — прописными с разрядкой (спека 5b §3, R9); цвет — тон CopyValue (ink2) */
const PurposeText = styled(CopyValue)`
  && {
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
`

/* Кт валютирования, если отличается от Дт (спека 5b §3, R10): цвет warn поверх тона muted CopyValue */
const KtWarn = styled(CopyValue)`
  && {
    color: ${k.warn};
  }
`

const T = -1 // интерактив внутри ячеек — вне таб-порядка, до него доходят через Enter на ячейке

/** Иконка группы направления (эталон `dirIco`): ↓ IN и ↗ OUT — свои svg, ⇄ TRANSIT и ◦ OTHER — текстом. */
function DirIcon({ dir }: { dir: Direction }) {
  if (dir === 'TRANSIT') return <DirGlyph aria-hidden="true">⇄</DirGlyph>
  if (dir === 'OTHER') return <DirGlyph aria-hidden="true">◦</DirGlyph>
  const d = dir === 'IN' ? 'M6 1.5v8.2M6 9.7L2.6 6.3M6 9.7l3.4-3.4' : 'M2.3 8.7L8.7 2.3M8.7 2.3H3.4M8.7 2.3v5.3'
  return (
    <DirIco viewBox="0 0 12 12" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </DirIco>
  )
}

export const fxDocLayout: RecordLayout<FxDoc> = {
  rowKey: (d) => d.id,
  columns: [
    { id: 'status', menuTitle: 'Статус', width: 60, sort: [{ id: 'status', label: 'Статус' }, { id: 'reason', label: 'Причина статуса' }],
      render: (d) => <StatusDot size="l" tone={STATUS_TONE[d.status]} letter={STATUS_GLYPH[d.status]} label={STATUS_LABEL[d.status]} /> },
    { id: 'id', title: 'ID', subtitle: '№ · 20 вх / исх', width: 106, lines: 2,
      sort: [{ id: 'docNumber', label: 'Номер документа', type: 'number' }, { id: 'refIn', label: '20 вх' }, { id: 'refOut', label: '20 исх' }],
      render: (d) => <><Num value={String(d.docNumber)} tone="ink" tabIndex={T} /><div><LinkValue name="uuid" value={d.id} tabIndex={T} /> <LinkValue name="refIn" value={d.refIn ?? undefined} tabIndex={T} /> <LinkValue name="refOut" value={d.refOut ?? undefined} tabIndex={T} /></div></> },
    { id: 'created', title: 'Дата / Время', width: 132, lines: 3, fullHeight: true,
      sort: [{ id: 'created', label: 'Дата документа', type: 'date' }, { id: 'vdDt', label: 'Валютирование Дт', type: 'date' }, { id: 'vdKt', label: 'Валютирование Кт', type: 'date' }],
      render: (d) => {
        const [date, time] = formatDateTimeFull(d.created).split(' ')
        const Kt = d.vdKt !== d.vdDt ? KtWarn : CopyValue
        return <>
          <CopyValue value={date ?? ''} tone="ink" tabIndex={T} /> <CopyValue value={time ?? ''} tone="muted" size="s" tabIndex={T} />
          <div>Дт <CopyValue value={formatDate(d.vdDt)} tone="muted" size="s" tabIndex={T} /></div>
          <div>Кт <Kt value={formatDate(d.vdKt)} tone="muted" size="s" tabIndex={T} /></div>
        </>
      },
      split: {
        label: 'Валютирование отдельной колонкой',
        render: (d) => <CopyValue value={formatDateTimeFull(d.created)} tone="ink" tabIndex={T} />,
        parts: [{ id: 'valueDates', title: 'Валютирование', width: 110, lines: 2, fullHeight: true,
          sort: [{ id: 'vdDt', label: 'Валютирование Дт', type: 'date' }, { id: 'vdKt', label: 'Валютирование Кт', type: 'date' }],
          render: (d) => { const Kt = d.vdKt !== d.vdDt ? KtWarn : CopyValue; return <>Дт <CopyValue value={formatDate(d.vdDt)} tone="muted" size="s" tabIndex={T} /><div>Кт <Kt value={formatDate(d.vdKt)} tone="muted" size="s" tabIndex={T} /></div></> } }],
      } },
    { id: 'type', title: 'Тип', width: 71, fullHeight: true, sort: [{ id: 'type', label: 'Тип сообщения' }], render: (d) => <Tag tone="mt">{d.type}</Tag> },
    { id: 'direction', title: 'Направление', width: 127, lines: 2, fullHeight: true, sort: [{ id: 'direction', label: 'Группа → название', order: ['IN', 'OUT', 'TRANSIT', 'OTHER'], then: 'dirTxt' }, { id: 'dirTxt', label: 'Название' }],
      render: (d) => <><DirRow><DirIcon dir={d.direction} /><DirCode value={d.direction} tone="ink" tabIndex={T} /></DirRow><div><CopyValue value={d.dirTxt} tone="muted" size="s" maxWidth={105} tabIndex={T} /></div></> },
    { id: 'amount', title: '32', subtitle: 'сумма', width: 102, lines: 2, align: 'right', fullHeight: true, sort: [{ id: 'amount', label: 'Сумма', type: 'number' }, { id: 'currency', label: 'Валюта' }],
      render: (d) => <><CopyValue value={formatAmount(d.amount)} tone="ink" tabIndex={T} /><div><CopyValue value={d.currency} tone="muted" size="s" tabIndex={T} /></div></>,
      split: {
        label: 'Валюта отдельной колонкой',
        render: (d) => <CopyValue value={formatAmount(d.amount)} tone="ink" tabIndex={T} />,
        parts: [{ id: 'currency', title: 'Валюта', width: 76, fullHeight: true, sort: [{ id: 'currency', label: 'Валюта' }], render: (d) => <Tag>{d.currency}</Tag> }],
      } },
    { id: 'f50', title: '50', subtitle: 'приказодатель · 70', width: 157, lines: 2,
      sort: [{ id: 'f50name', label: 'Наименование' }, { id: 'f50acc', label: 'Счёт' }, { id: 'purpose', label: 'Назначение (70)' }],
      render: (d) => <SwiftField opt={d.f50opt} main={d.f50acc} caption={d.f50name} maxWidth={130} tabIndex={T} /> },
    { id: 'f52', title: '52', width: 137, lines: 2, sort: [{ id: 'f52', label: 'BIC 52' }],
      render: (d) => <SwiftField opt="A" main={d.f52} caption={d.f52name} tabIndex={T} /> },
    { id: 'f57', title: '57', width: 137, lines: 2, sort: [{ id: 'f57', label: 'BIC 57' }],
      render: (d) => <SwiftField opt="A" main={d.f57} caption={d.f57name} tabIndex={T} /> },
    { id: 'f58', title: '58', width: 137, lines: 2, sort: [{ id: 'f58', label: 'BIC 58' }],
      render: (d) => <SwiftField opt="A" main={d.f58 ?? ''} caption={d.f58name ?? undefined} tabIndex={T} /> },
    { id: 'f59', title: '59', width: 157, lines: 2, sort: [{ id: 'f59name', label: 'Наименование' }, { id: 'f59acc', label: 'Счёт' }],
      render: (d) => <SwiftField opt={d.f59opt} main={d.f59acc} caption={d.f59name} maxWidth={130} tabIndex={T} /> },
    { id: 'route', title: 'Маршрут', width: 110, lines: 3, fullHeight: true,
      sort: [{ id: 'routeType', label: 'Тип маршрута' }, { id: 'routeRecv', label: 'Receiver' }],
      render: (d) => <><Tag>{d.routeType}</Tag><div><Mono value={d.routeRecv} tone="ink2" tabIndex={T} /></div><div><AccountValue value={d.routeAcc} tabIndex={T} /></div></> },
    { id: 'sr', title: 'S / R in', width: 113, lines: 2, fullHeight: true, sort: [{ id: 'sender', label: 'S in' }, { id: 'receiver', label: 'R in' }],
      render: (d) => <><SrTag>S:</SrTag><Mono value={d.sender} tone="ink" tabIndex={T} /><div><SrTag>R:</SrTag><Mono value={d.receiver} tone="ink" tabIndex={T} /></div></> },
    { id: 'srOut', title: 'S / R out', width: 113, lines: 2, fullHeight: true, sort: [{ id: 'outSender', label: 'S out' }, { id: 'outReceiver', label: 'R out' }],
      render: (d) => <><SrTag>S:</SrTag><Mono value={d.outSender} tone="ink" tabIndex={T} /><div><SrTag>R:</SrTag><Mono value={d.outReceiver} tone="ink" tabIndex={T} /></div></> },
    { id: 'prov', title: 'Провайдеры', width: 122, lines: 2, fullHeight: true, sort: [{ id: 'provS', label: 'Провайдер отправителя' }, { id: 'provR', label: 'Провайдер получателя' }],
      render: (d) => <><Tag tone="warn">{d.provS}</Tag><div><Tag tone="ok">{d.provR}</Tag></div></> },
  ],
  spans: [[
    { id: 'reason', from: 'status', to: 'id', render: (d) => (d.reason ? <><StatusDot size="s" tone={STATUS_TONE[d.status]} /> <CopyValue value={d.reason} tone="ink2" size="s" tabIndex={T} /></> : null) },
    { id: 'purpose', from: 'f50', to: 'f59', render: (d) => (d.purpose ? <><FieldTag tag="70" title="70 · Детали платежа" /> <PurposeText value={d.purpose} tone="ink2" size="s" tabIndex={T} /></> : null) },
  ]],
}
