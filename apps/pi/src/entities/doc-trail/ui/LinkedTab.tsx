import { CopyValue, KeyValueList, MiniTable, StatusBadge, Tag, Timestamp, formatAmount, formatDate, type KeyValueItem, type MiniColumn } from '@katran/ui'
import type { TabContext } from '../../../shared/lib/detail'
import { toneOf } from '../model/tone'
import type { LinkedDoc, LinkedParty, LinkedPosting } from '../model/types'
import type { TrailTabProps } from './lib'
import { LinkButton, Nil } from './parts'
import s from './trail.module.css'

type PairRow = { key: string; label: string; mono: boolean; a: string | null; b: string | null }

/** Сумма бека — десятичная строка без группировки ('1249965.00', маппер Task 7) → formatAmount кита; не число — как есть. */
const amountText = (v: string | null): string | null => {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? formatAmount(n) : v
}

const POSTING: { key: keyof LinkedPosting; label: string; mono: boolean }[] = [
  { key: 'account', label: 'Счёт', mono: true }, { key: 'amount', label: 'Сумма', mono: false },
  { key: 'currency', label: 'Валюта', mono: false }, { key: 'register', label: 'Регистр', mono: false },
]
const PARTY: { key: keyof LinkedParty; label: string; mono: boolean }[] = [
  { key: 'name', label: 'Наимен.', mono: false }, { key: 'account', label: 'Счёт', mono: true }, { key: 'extra', label: 'Доп.', mono: false },
]

const pairCell = (v: string | null, mono: boolean) => (v
  ? <span className={[s.cut, mono ? s.monoVal : s.val].join(' ')} data-k-tip={v} data-k-tip-if="truncated">{v}</span>
  : <Nil />)

/** Мини-таблица 64 / 1fr / 1fr (эталон .two-t .tt): Дт/Кт или отправитель/получатель. */
function PairTable({ label, heads, rows }: { label: string; heads: [string, string]; rows: PairRow[] }) {
  const columns: MiniColumn<PairRow>[] = [
    { id: 'label', header: '', width: 64, render: (r) => <span className={s.lbl}>{r.label}</span> },
    { id: 'a', header: heads[0], render: (r) => pairCell(r.a, r.mono) },
    { id: 'b', header: heads[1], render: (r) => pairCell(r.b, r.mono) },
  ]
  return <MiniTable label={label} columns={columns} rows={rows} rowKey={(r) => r.key} empty="—" />
}

function LinkedBody({ doc, ctx }: { doc: LinkedDoc; ctx: TabContext }) {
  const items: KeyValueItem[] = [
    {
      key: 'id', label: 'ID', wide: true,
      value: (
        <span className={s.idLine}>
          <LinkButton mono label={`Открыть ${doc.type} ${doc.docId} в соседней панели`} onClick={() => ctx.openDocument(doc.docId)}>{doc.docId}</LinkButton>
          <CopyValue value={doc.docId} tone="muted" display={<><span aria-hidden="true">⧉</span><span className={s.sr}>Скопировать ID</span></>} />
        </span>
      ),
    },
    { key: 'processed', label: 'Обработка', value: doc.processed ? <Timestamp iso={doc.processed} /> : null },
    { key: 'posted', label: 'Проводка', value: doc.posted ? formatDate(doc.posted) : null },
    { key: 'kind', label: 'Вид', value: doc.kind ? <Tag>{doc.kind}</Tag> : null },
    {
      key: 'purpose', label: 'Назначение',
      value: doc.purpose ? <span className={s.cut} data-k-tip={doc.purpose} data-k-tip-if="truncated">{doc.purpose}</span> : null,
    },
  ]
  return (
    <div className={s.linkedBody}>
      <KeyValueList columns={2} labelWidth={80} items={items} />
      <div className={s.twoT}>
        <PairTable
          label={`Проводки ${doc.docId}`}
          heads={['Дт', 'Кт']}
          rows={POSTING.map((p) => {
            const fmt = p.key === 'amount' ? amountText : (v: string | null) => v
            return { key: p.key, label: p.label, mono: p.mono, a: fmt(doc.debit[p.key]), b: fmt(doc.credit[p.key]) }
          })}
        />
        <PairTable
          label={`Отправитель и получатель ${doc.docId}`}
          heads={['Отправитель', 'Получатель']}
          rows={PARTY.map((p) => ({ key: p.key, label: p.label, mono: p.mono, a: doc.from[p.key], b: doc.to[p.key] }))}
        />
      </div>
    </div>
  )
}

/**
 * Вкладка «Связанные документы» (эталон linkedHtml, index.html:1193): строка — дата, тип, связь, назначение, статус;
 * раскрытие — карточка и две мини-таблицы. ID открывает документ в соседней панели (B). По умолчанию раскрыта первая запись (mkui).
 */
export function LinkedTab({ data, ctx }: TrailTabProps<LinkedDoc[]>) {
  const first = data[0]
  const columns: MiniColumn<LinkedDoc>[] = [
    // дата, тип и связь — по содержимому строки (эталон .ld — flex с зазором): без пустот фиксированных ширин
    { id: 'date', header: '', width: 'auto', render: (d) => <span className={s.date}>{d.date}</span> },
    { id: 'type', header: '', width: 'auto', render: (d) => <Tag tone="mt">{d.type}</Tag> },
    { id: 'relation', header: '', width: 'auto', render: (d) => <Tag>{d.relation}</Tag> },
    {
      id: 'purpose', header: '',
      render: (d) => (d.purpose ? <span className={[s.cut, s.muted].join(' ')} data-k-tip={d.purpose} data-k-tip-if="truncated">{d.purpose}</span> : <Nil />),
    },
    { id: 'status', header: '', width: 90, align: 'end', render: (d) => <StatusBadge tone={toneOf(d.status)}>{d.status}</StatusBadge> },
  ]
  return (
    <MiniTable
      label="Связанные документы"
      columns={columns}
      rows={data}
      rowKey={(d) => d.docId}
      rowLabel={(d) => `${d.date} · ${d.type}`}
      empty="Связанных документов нет"
      renderExpanded={(d) => <LinkedBody doc={d} ctx={ctx} />}
      expanded={ctx.expanded ?? (first ? [first.docId] : [])}
      onExpandedChange={ctx.setExpanded}
    />
  )
}
