import { KeyValueList, MiniTable, StatusBadge, Timestamp, type KeyValueItem, type MiniColumn } from '@katran/ui'
import { toneOf } from '../model/tone'
import type { Compliance } from '../model/types'
import type { TrailTabProps } from './lib'
import { TrailEmpty } from './parts'
import s from './trail.module.css'

/** Подпись 230 px — эталон .cp-kv .xr (index.html:362). */
const LABEL_W = 230

type HistRow = Compliance['history'][number]
const HIST: MiniColumn<HistRow>[] = [
  { id: 'at', header: 'Время попадания', width: 150, render: (h) => <Timestamp iso={h.at} /> },
  { id: 'system', header: 'Система контроля', mono: true, render: (h) => h.system },
  { id: 'department', header: 'Код подразделения', render: (h) => h.department },
]

const decision = (v: string | null) => (v ? <StatusBadge tone={toneOf(v)}>{v}</StatusBadge> : null)
/** Отметки времени — ISO без зоны (маппер Task 7); Timestamp кита: «ДД.ММ ЧЧ:ММ:СС», полное — тултипом. */
const time = (v: string | null) => (v ? <Timestamp iso={v} /> : null)
const yesNo = (v: boolean | null) => (v === null ? null : v ? 'Да' : 'Нет')

/**
 * Вкладка «Комплаенс» (эталон complianceHtml, index.html:1261): запись (ID платёжной инструкции — id открытого документа
 * из контекста), отрицательная нотификация, мониторинг (ИС4021), подразделение (ОПС3308) с историей попадания.
 */
export function ComplianceTab({ data, ctx }: TrailTabProps<Compliance | null>) {
  if (!data) return <TrailEmpty text="Комплаенс-проверок нет" />
  const { record: r, negative: n, monitoring: m, department: d } = data
  const record: KeyValueItem[] = [
    { key: 'id', label: 'ID записи', value: r.id, mono: true },
    { key: 'docId', label: 'ID платёжной инструкции', value: ctx.docId, mono: true },
    { key: 'start', label: 'Начало обработки', value: time(r.start) },
    { key: 'end', label: 'Окончание обработки', value: time(r.end) },
    { key: 'nzr', label: 'Признак постановки на НЗР', value: yesNo(r.nzr) },
  ]
  const negative: KeyValueItem[] = [
    { key: 'decision', label: 'Переданное решение', value: n.decision },
    { key: 'direction', label: 'Направление проверки', value: n.direction },
    { key: 'comment', label: 'Комментарий', value: n.comment },
  ]
  const monitoring: KeyValueItem[] = [
    { key: 'start', label: 'Начало', value: time(m.start) },
    { key: 'end', label: 'Окончание', value: time(m.end) },
    { key: 'decision', label: 'Решение мониторинга', value: decision(m.decision) },
    { key: 'txId', label: 'Идентификатор транзакции', value: m.txId, mono: true },
    { key: 'requestAt', label: 'Создание запроса', value: time(m.requestAt) },
    { key: 'clientId', label: 'Идентификатор клиента', value: m.clientId, mono: true },
  ]
  const department: KeyValueItem[] = [
    { key: 'start', label: 'Начало', value: time(d.start) },
    { key: 'end', label: 'Окончание', value: time(d.end) },
    { key: 'decision', label: 'Решение комплаенс', value: decision(d.decision) },
  ]
  return (
    <div className={s.stack}>
      <KeyValueList items={record} labelWidth={LABEL_W} />
      <KeyValueList title="Отрицательная нотификация в источник" items={negative} labelWidth={LABEL_W} />
      <KeyValueList title="Контроль в системе мониторинга (ИС4021)" items={monitoring} labelWidth={LABEL_W} />
      <div>
        <KeyValueList title="Контроль подразделения комплаенс (ОПС3308)" items={department} labelWidth={LABEL_W} />
        {data.history.length > 0 && (
          <div className={s.nested}>
            <MiniTable
              label="История попадания в подразделение комплаенс"
              columns={HIST}
              rows={data.history}
              rowKey={(h, i) => `${i}:${h.at}`}
              empty="Истории нет"
            />
          </div>
        )}
      </div>
    </div>
  )
}
