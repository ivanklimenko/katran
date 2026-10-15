import type { ReactNode } from 'react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { Disclosure, EditMark, Tag, formatAmount, formatDate, formatDateTimeFull, type HeroCell } from '@katran/ui'
import type { DetailDomain, DetailLookups, DetailSummary, EditContext } from '../../../shared/lib/detail'
import { STATUS_LABEL, STATUS_TONE } from '../../doc-status/@x/fx-doc'
import { LookupLink, TxBlock } from '../../posting/@x/fx-doc'
import { groupAccount } from '../model/account'
import type { FxDocDetail } from '../model/detail'
import type { FxDoc } from '../model/fxDoc'
import { FX_ACTIONS, FX_DETAIL_TITLE, FX_FIELDS, FX_OPTION_LABELS, FX_PROFILES, FX_TABS, fxSchemaOf, swiftPresent } from '../model/swift'
import { Sr } from '../../../shared/ui'
import { AccountRow, RefOutRow, RouteEdited, ValueDateCell, fxFormEdit, routeEditTip } from './edit'
import { RatesView } from './RatesView'

/* Блоки «Общих данных» валюты (эталон .msgs/.hero/.amt/.ln, index.html:131–175) */
const Msgs = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1.15fr;
  border: 1px solid ${k.line};
  border-radius: ${k.rS};
`

/* колонка; data-edit-col — колонка с правкой: карандаши и ↺ строк видны при наведении на неё (edit.tsx) */
const Col = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0 ${k.sp2};
  align-content: start;
  min-width: 0;
  padding: ${k.sp1} ${k.sp2};

  & + & {
    border-left: 1px solid ${k.line};
  }
`

const ColTitle = styled.div`
  grid-column: 1 / -1;
  font: 500 ${k.fs3} / ${k.lh3} ${k.sans};
  letter-spacing: 0.03em;
  color: ${k.muted};
`

const Lbl = styled.span`
  font-size: ${k.fs2};
  color: ${k.muted};
`

/* значение моноширинно; data-cut — в одну строку с многоточием; data-warn — изменено правкой
   (план 2c; эталон .txtrow.edited .mono, .accrow.edited .mono) */
const MonoText = styled.span`
  font: ${k.fs1} / ${k.lh1} ${k.mono};
  letter-spacing: -0.01em;
  color: ${k.val};

  &:where([data-cut]) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &[data-warn] {
    color: ${k.warn};
  }
`

const NoneText = styled.span`
  color: ${k.faint};
`

const Ar = styled.span`
  margin: 0 ${k.sp1};
  color: ${k.faint};
`

const HeroSub = styled.span`
  font-weight: 500;
`

const Amt = styled.span`
  font: 600 ${k.fsSum} / 1 ${k.sans};
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

const Ccy = styled.small`
  margin-left: ${k.sp1};
  font-size: ${k.fs1};
  font-weight: 600;
  color: ${k.val};
`

const Same = styled.span`
  margin-left: ${k.sp1};
  font-size: ${k.fs2};
  color: ${k.ok};
`

const RouteLine = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 0 ${k.sp2};
  min-width: 0;
  white-space: nowrap;
`

const RouteText = styled.span`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${k.val};
`

/** Значение моноширинным; warn — изменённое правкой (план 2c). */
function Mono({ v, warn = false }: { v: string | null; warn?: boolean | undefined }) {
  return v
    ? <MonoText data-cut="" data-warn={warn ? '' : undefined}>{v}</MonoText>
    : <NoneText><span aria-hidden="true">—</span><Sr>не заполнено</Sr></NoneText>
}
function Pair({ from, to }: { from: string | null; to: string | null }) {
  if (!from || !to) return <Mono v={null} />
  return <MonoText data-cut="">{from}<Ar>→</Ar>{to}</MonoText>
}

/** Сообщения и счета (эталон B.msgs, index.html:1357): входящее, исходящее, Дт/Кт; с правкой (edit) — 20 исх и счета правятся на месте. */
export function FxMessages({ d, edit = null }: { d: FxDocDetail; edit?: EditContext | null | undefined }) {
  const editCol = edit ? '' : undefined
  return (
    <Msgs>
      <Col>
        <ColTitle>Входящее SWIFT</ColTitle>
        <Lbl>S → R</Lbl><Pair from={d.inSender} to={d.inReceiver} />
        <Lbl>20 вх</Lbl><Mono v={d.fields['20']?.lines[0] ?? null} />
      </Col>
      <Col data-edit-col={editCol}>
        <ColTitle>Исходящее SWIFT</ColTitle>
        <Lbl>S → R</Lbl><Pair from={d.outSender} to={d.outReceiver} />
        <Lbl>20 исх</Lbl>
        {edit ? <RefOutRow d={d} edit={edit} value={(warn) => <Mono v={d.refOut} warn={warn} />} /> : <Mono v={d.refOut} />}
      </Col>
      <Col data-edit-col={editCol}>
        <ColTitle>Счета</ColTitle>
        <Lbl>Дт</Lbl>
        {edit ? <AccountRow d={d} edit={edit} side="dt" value={(warn) => <Mono v={groupAccount(d.accDt)} warn={warn} />} /> : <Mono v={groupAccount(d.accDt)} />}
        <Lbl>Кт</Lbl>
        {edit ? <AccountRow d={d} edit={edit} side="kt" value={(warn) => <Mono v={groupAccount(d.accKt)} warn={warn} />} /> : <Mono v={groupAccount(d.accKt)} />}
      </Col>
    </Msgs>
  )
}

/** Маршрут (эталон B.route, index.html:1361): тип, счёт → получатель в заголовке, правило в теле; раскрыт. С правкой — метка пересчёта. */
export function FxRoute({ d, edit = null }: { d: FxDocDetail; edit?: EditContext | null | undefined }) {
  const tip = edit ? routeEditTip(d) : null
  const block = (
    <Disclosure
      title="Маршрут"
      defaultOpen
      aside={(
        <RouteLine>
          {tip && <EditMark tip={tip} />}
          <Tag>{d.routeType}</Tag>
          <Lbl>Счёт</Lbl><MonoText data-k-tip={d.routeDesc}>{d.routeAcc}</MonoText>
          <Ar>→</Ar>
          <Lbl>Receiver</Lbl><MonoText>{d.routeRecv}</MonoText>
        </RouteLine>
      )}
    >
      <RouteText data-k-tip={d.routeText}>{d.routeText}</RouteText>
    </Disclosure>
  )
  return tip ? <RouteEdited>{block}</RouteEdited> : block
}

const fieldTip = (tag: string) => `${tag} · ${FX_FIELDS[tag]?.label ?? ''}`
const line = (d: FxDocDetail, tag: string) => d.fields[tag]?.lines[0] ?? ''

/**
 * Ячейки сводки (эталон heroHtml, index.html:1037); с правкой (edit) — дата валютирования правится; со справочными
 * запросами (lookups.rates) — кнопка-ссылка «Курс» рядом с суммой 32A (спека 2e §4 п. 6), без них ссылки нет (демо кита).
 */
export function fxHero(d: FxDocDetail, id: string, edit: EditContext | null = null, lookups: DetailLookups | null = null): HeroCell {
  switch (id) {
    case '20':
      return { label: '20 · № / от', tip: fieldTip('20'), value: <><MonoText>{line(d, '20') || '—'}</MonoText> <HeroSub>№ {d.docNumber} от {formatDate(d.numDate)}</HeroSub></> }
    case '21':
      return { label: '21', tip: fieldTip('21'), value: <MonoText>{line(d, '21') || '—'}</MonoText> }
    case '71A':
      return { label: '71A', tip: fieldTip('71A'), value: line(d, '71A') || '—' }
    case 'vd': {
      const [vin, vout, vdt, vkt] = d.valueDates
      const same = vin === vout && vin === vdt && vin === vkt
      const check = same && <Same role="img" aria-label="Вх, Исх, по Дт и по Кт совпадают">✓</Same>
      return {
        label: 'Валютирование',
        tip: `Вх: ${formatDate(vin)} · Исх: ${formatDate(vout)} · по Дт: ${formatDate(vdt)} · по Кт: ${formatDate(vkt)}`,
        value: edit ? <ValueDateCell d={d} edit={edit} same={check} /> : <>{formatDate(vin)}{check}</>,
      }
    }
    case '32A': {
      const rates = lookups?.rates
      return {
        label: '32A · сумма',
        tip: fieldTip('32A'),
        align: 'right',
        value: (
          <>
            <Amt>{formatAmount(d.amount)}<Ccy>{d.currency}</Ccy></Amt>
            {rates && <LookupLink label="Курс" framed view={rates}><RatesView view={rates} ccy={d.currency} /></LookupLink>}
          </>
        ),
      }
    }
    default:
      return { label: id, value: '—' }
  }
}

/** Блоки-слоты профиля: msgs, route, tx; edit — правка документа (null — только просмотр, как в 2b); lookups.balances — «Проверить баланс». */
export function fxBlock(d: FxDocDetail, id: string, edit: EditContext | null = null, lookups: DetailLookups | null = null): ReactNode {
  if (id === 'msgs') return <FxMessages d={d} edit={edit} />
  if (id === 'route') return <FxRoute d={d} edit={edit} />
  if (id === 'tx') return <TxBlock txs={d.txs} txId={d.txId} txAt={d.txAt} balances={lookups?.balances} />
  return null
}

/** Подпись статуса документа («Обработан») — плашки и подсказки аннулирования, итог «пока в статусе «…»» (спека 2e §3.3). */
export const statusLabelOf = (d: FxDoc): string => STATUS_LABEL[d.status]

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
  formEdit: fxFormEdit,
}
