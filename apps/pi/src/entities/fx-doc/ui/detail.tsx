import type { ReactNode } from 'react'
import { Disclosure, Tag, formatAmount, formatDate, formatDateTimeFull, type HeroCell } from '@katran/ui'
import type { DetailDomain, DetailSummary } from '../../../shared/lib/detail'
import { STATUS_LABEL, STATUS_TONE } from '../../doc-status/@x/fx-doc'
import { TxBlock } from '../../posting/@x/fx-doc'
import type { FxDocDetail } from '../model/detail'
import type { FxDoc } from '../model/fxDoc'
import { FX_ACTIONS, FX_DETAIL_TITLE, FX_FIELDS, FX_OPTION_LABELS, FX_PROFILES, FX_TABS, fxSchemaOf, swiftPresent } from '../model/swift'
import s from './detail.module.css'

/** Счёт группами 5-3-1-4-7 (эталон accFmt, index.html:1302). */
const groupAccount = (a: string) => (a.length === 20 ? `${a.slice(0, 5)} ${a.slice(5, 8)} ${a.slice(8, 9)} ${a.slice(9, 13)} ${a.slice(13)}` : a)

function Mono({ v }: { v: string | null }) {
  return v
    ? <span className={[s.mono, s.cut].join(' ')}>{v}</span>
    : <span className={s.none}><span aria-hidden="true">—</span><span className={s.sr}>нет значения</span></span>
}
function Pair({ from, to }: { from: string | null; to: string | null }) {
  if (!from || !to) return <Mono v={null} />
  return <span className={[s.mono, s.cut].join(' ')}>{from}<span className={s.ar}>→</span>{to}</span>
}

/** Сообщения и счета (эталон B.msgs, index.html:1357): входящее, исходящее, Дт/Кт. Правка 20 исх и счетов — 2c. */
export function FxMessages({ d }: { d: FxDocDetail }) {
  return (
    <div className={s.msgs}>
      <div className={s.col}>
        <div className={s.colTitle}>Входящее SWIFT</div>
        <span className={s.lbl}>S → R</span><Pair from={d.inSender} to={d.inReceiver} />
        <span className={s.lbl}>20 вх</span><Mono v={d.fields['20']?.lines[0] ?? null} />
      </div>
      <div className={s.col}>
        <div className={s.colTitle}>Исходящее SWIFT</div>
        <span className={s.lbl}>S → R</span><Pair from={d.outSender} to={d.outReceiver} />
        <span className={s.lbl}>20 исх</span><Mono v={d.refOut} />
      </div>
      <div className={s.col}>
        <div className={s.colTitle}>Счета</div>
        <span className={s.lbl}>Дт</span><Mono v={groupAccount(d.accDt)} />
        <span className={s.lbl}>Кт</span><Mono v={groupAccount(d.accKt)} />
      </div>
    </div>
  )
}

/** Маршрут (эталон B.route, index.html:1361): тип, счёт → получатель в заголовке, правило в теле; раскрыт. */
export function FxRoute({ d }: { d: FxDocDetail }) {
  return (
    <Disclosure
      title="Маршрут"
      defaultOpen
      aside={(
        <span className={s.routeLine}>
          <Tag>{d.routeType}</Tag>
          <span className={s.lbl}>Счёт</span><span className={s.mono} data-k-tip={d.routeDesc}>{d.routeAcc}</span>
          <span className={s.ar}>→</span>
          <span className={s.lbl}>Receiver</span><span className={s.mono}>{d.routeRecv}</span>
        </span>
      )}
    >
      <span className={s.routeText} data-k-tip={d.routeText}>{d.routeText}</span>
    </Disclosure>
  )
}

const fieldTip = (tag: string) => `${tag} · ${FX_FIELDS[tag]?.label ?? ''}`
const line = (d: FxDocDetail, tag: string) => d.fields[tag]?.lines[0] ?? ''

/** Ячейки сводки (эталон heroHtml, index.html:1037). Правка даты валютирования и «Курс» — 2c/2d. */
export function fxHero(d: FxDocDetail, id: string): HeroCell {
  switch (id) {
    case '20':
      return { label: '20 · № / от', tip: fieldTip('20'), value: <><span className={s.mono}>{line(d, '20') || '—'}</span> <span className={s.heroSub}>№ {d.docNumber} от {formatDate(d.numDate)}</span></> }
    case '21':
      return { label: '21', tip: fieldTip('21'), value: <span className={s.mono}>{line(d, '21') || '—'}</span> }
    case '71A':
      return { label: '71A', tip: fieldTip('71A'), value: line(d, '71A') || '—' }
    case 'vd': {
      const [vin, vout, vdt, vkt] = d.valueDates
      const same = vin === vout && vin === vdt && vin === vkt
      return {
        label: 'Валютирование',
        tip: `Вх: ${formatDate(vin)} · Исх: ${formatDate(vout)} · по Дт: ${formatDate(vdt)} · по Кт: ${formatDate(vkt)}`,
        value: <>{formatDate(vin)}{same && <span className={s.same} role="img" aria-label="Вх, Исх, по Дт и по Кт совпадают">✓</span>}</>,
      }
    }
    case '32A':
      return { label: '32A · сумма', tip: fieldTip('32A'), align: 'right', value: <span className={s.amt}>{formatAmount(d.amount)}<small className={s.ccy}>{d.currency}</small></span> }
    default:
      return { label: id, value: '—' }
  }
}

/** Блоки-слоты профиля: msgs, route, tx. */
export function fxBlock(d: FxDocDetail, id: string): ReactNode {
  if (id === 'msgs') return <FxMessages d={d} />
  if (id === 'route') return <FxRoute d={d} />
  if (id === 'tx') return <TxBlock txs={d.txs} txId={d.txId} txAt={d.txAt} />
  return null
}

/** Шапка и лейн из строки реестра — до загрузки детали и при ошибке (спека 2a §4.3). */
export function fxRowSummary(row: FxDoc): DetailSummary {
  return {
    label: `${FX_DETAIL_TITLE} № ${row.docNumber}`,
    uuid: row.id,
    created: formatDateTimeFull(row.created),
    type: row.type,
    status: { tone: STATUS_TONE[row.status], label: STATUS_LABEL[row.status] },
    kind: `${FX_PROFILES[row.type].title} · ${row.dirTxt}`,
    tabsOff: [],
  }
}
export const fxDocSummary = (d: FxDocDetail): DetailSummary => ({ ...fxRowSummary(d), tabsOff: d.tabsOff })

/** Всё доменное для widgets/doc-detail (спека 2a §4.3). */
export const fxDocDetailDomain: DetailDomain<FxDocDetail, FxDoc> = {
  title: FX_DETAIL_TITLE,
  tabs: FX_TABS,
  actions: FX_ACTIONS,
  fields: FX_FIELDS,
  optionLabels: FX_OPTION_LABELS,
  present: swiftPresent,
  schemaOf: fxSchemaOf,
  value: (d, tag) => d.fields[tag] ?? null,
  summary: fxDocSummary,
  rowSummary: fxRowSummary,
  renderHero: fxHero,
  renderBlock: fxBlock,
}
