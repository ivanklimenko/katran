import type { ReactNode } from 'react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { Disclosure, EditMark, KeyValueList, Tag, formatAmount, formatDate, formatDateTimeFull, type HeroCell, type KeyValueItem } from '@katran/ui'
import type { DetailDomain, DetailLookups, DetailSummary, EditContext } from '../../../shared/lib/detail'
import { STATUS_LABEL, STATUS_TONE } from '../../doc-status/@x/fx-doc'
import { LookupLink, TxBlock } from '../../posting/@x/fx-doc'
import { groupAccount } from '../model/account'
import type { FxDocDetail, InternalPaymentParty } from '../model/detail'
import type { FxDoc } from '../model/fxDoc'
import { fxFieldTip, fxMappingMode, fxSourceTip, swiftFieldPath } from '../model/mapping'
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
function Mono({ v, warn = false, tip }: { v: string | null; warn?: boolean | undefined; tip?: string | undefined }) {
  return v
    ? <MonoText data-cut="" data-warn={warn ? '' : undefined} data-k-tip={tip}>{v}</MonoText>
    : <NoneText data-k-tip={tip}><span aria-hidden="true">—</span><Sr>не заполнено</Sr></NoneText>
}

function sourceValue(value: ReactNode, tip: string | undefined): ReactNode {
  return tip ? <span data-k-tip={tip}>{value}</span> : value
}

function Pair({ d, outgoing = false }: { d: FxDocDetail; outgoing?: boolean }) {
  const [from, to] = outgoing ? [d.outSender, d.outReceiver] : [d.inSender, d.inReceiver]
  const [fromKey, toKey] = outgoing ? ['$.outSender', '$.outReceiver'] : ['$.inSender', '$.inReceiver']
  if (!from && !to) return <Mono v={null} tip={fxSourceTip(d, fromKey, toKey)} />
  return <MonoText data-cut="">{from && sourceValue(from, fxSourceTip(d, fromKey))}<Ar>→</Ar>{to && sourceValue(to, fxSourceTip(d, toKey))}</MonoText>
}

/** Сообщения и счета (эталон B.msgs, index.html:1357): входящее, исходящее, Дт/Кт; с правкой (edit) — 20 исх и счета правятся на месте. */
export function FxMessages({ d, edit = null }: { d: FxDocDetail; edit?: EditContext | null | undefined }) {
  const editCol = edit ? '' : undefined
  const outgoingInstructionRef = d.refOut ? null : d.mt202Instruction?.outgoingReference
  return (
    <Msgs>
      <Col>
        <ColTitle>Входящее SWIFT</ColTitle>
        <Lbl>S → R</Lbl><Pair d={d} />
        <Lbl>20 вх</Lbl><Mono v={d.fields['20']?.lines[0] ?? null} tip={fxFieldTip(d, '20')} />
      </Col>
      <Col data-edit-col={editCol}>
        <ColTitle>Исходящее SWIFT</ColTitle>
        <Lbl>S → R</Lbl><Pair d={d} outgoing />
        <Lbl>{outgoingInstructionRef ? 'Референс исходящей инструкции' : '20 исх'}</Lbl>
        {edit && !outgoingInstructionRef
          ? <RefOutRow d={d} edit={edit} value={(warn) => <Mono v={d.refOut} warn={warn} />} />
          : <Mono v={outgoingInstructionRef ?? d.refOut} tip={fxSourceTip(d, outgoingInstructionRef ? '$.mt202Instruction.outgoingReference' : '$.refOut')} />}
      </Col>
      <Col data-edit-col={editCol}>
        <ColTitle>Счета</ColTitle>
        <Lbl>Дт</Lbl>
        {edit ? <AccountRow d={d} edit={edit} side="dt" value={(warn) => <Mono v={groupAccount(d.accDt)} warn={warn} />} /> : <Mono v={groupAccount(d.accDt)} tip={fxSourceTip(d, '$.accDt')} />}
        <Lbl>Кт</Lbl>
        {edit ? <AccountRow d={d} edit={edit} side="kt" value={(warn) => <Mono v={groupAccount(d.accKt)} warn={warn} />} /> : <Mono v={groupAccount(d.accKt)} tip={fxSourceTip(d, '$.accKt')} />}
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
          {d.routeType && <Tag>{sourceValue(d.routeType, fxSourceTip(d, '$.routeType'))}</Tag>}
          <Lbl>Счёт</Lbl><MonoText data-k-tip={fxSourceTip(d, '$.routeAcc', ...(d.routeDesc ? ['$.routeDesc'] : [])) ?? d.routeDesc}>{d.routeAcc}</MonoText>
          <Ar>→</Ar>
          <Lbl>Receiver</Lbl><MonoText data-k-tip={fxSourceTip(d, '$.routeRecv')}>{d.routeRecv}</MonoText>
        </RouteLine>
      )}
    >
      <RouteText data-k-tip={fxSourceTip(d, '$.routeText') ?? d.routeText}>{d.routeText}</RouteText>
    </Disclosure>
  )
  return tip ? <RouteEdited>{block}</RouteEdited> : block
}

function paymentItems(d: FxDocDetail, role: 'payer' | 'payee', party: InternalPaymentParty): KeyValueItem[] {
  return [
    { key: 'name', label: 'Наименование', value: party.name },
    { key: 'account', label: 'Счёт', value: party.account, mono: true },
    { key: 'bankName', label: 'Банк', value: party.bankName },
    { key: 'bankBic', label: 'BIC', value: party.bankBic, mono: true },
  ].flatMap((item) => {
    if (!item.value) return []
    const hint = fxSourceTip(d, `$.internalPayment.${role}.${item.key}`)
    return [{ ...item, hint, value: sourceValue(item.value, hint) }]
  })
}

function InternalPaymentBlock({ d }: { d: FxDocDetail }) {
  const payment = d.internalPayment
  if (!payment) return null
  const reference: KeyValueItem[] = [
    ...(payment.reference ? [{ key: 'ref', label: 'Референс документа', value: sourceValue(payment.reference, fxSourceTip(d, '$.internalPayment.reference')), mono: true }] : []),
    ...(payment.initialReference ? [{ key: 'initialRef', label: 'Исходный референс', value: sourceValue(payment.initialReference, fxSourceTip(d, '$.internalPayment.initialReference')), mono: true }] : []),
  ]
  const payer = paymentItems(d, 'payer', payment.payer)
  const payee = paymentItems(d, 'payee', payment.payee)
  return (
    <>
      {reference.length > 0 && <KeyValueList title="Референсы" labelWidth={160} items={reference} />}
      {payer.length > 0 && <KeyValueList title="Плательщик" labelWidth={110} items={payer} />}
      {payee.length > 0 && <KeyValueList title="Получатель" labelWidth={110} items={payee} />}
      {d.purpose && <KeyValueList title="Назначение платежа" labelWidth={110} items={[{ key: 'purpose', label: 'Назначение', value: sourceValue(d.purpose, fxSourceTip(d, '$.purpose')) }]} />}
    </>
  )
}

const fieldTip = (tag: string) => `${tag} · ${FX_FIELDS[tag]?.label ?? ''}`
const line = (d: FxDocDetail, tag: string) => d.fields[tag]?.lines[0] ?? ''

/**
 * Ячейки сводки (эталон heroHtml, index.html:1037); с правкой (edit) — дата валютирования правится; со справочными
 * запросами (lookups.rates) — кнопка-ссылка «Курс» рядом с суммой 32A (спека 2e §4 п. 6), без них ссылки нет (демо кита).
 */
export function fxHero(d: FxDocDetail, id: string, edit: EditContext | null = null, lookups: DetailLookups | null = null): HeroCell {
  switch (id) {
    case 'internalNumber':
      return { label: 'Номер документа · от', valueTip: fxSourceTip(d, '$.docNumber', '$.numDate'), value: <>№ {d.docNumber} <HeroSub>от {formatDate(d.numDate)}</HeroSub></> }
    case 'internalDate':
      return { label: 'Дата валютирования', valueTip: fxSourceTip(d, '$.internalPayment.valueDate'), value: formatDate(d.internalPayment?.valueDate ?? '') || '—' }
    case 'internalAmount':
      return { label: 'Сумма', align: 'right', valueTip: fxSourceTip(d, '$.amount', '$.currency'), value: <Amt>{formatAmount(d.amount)}<Ccy>{d.currency}</Ccy></Amt> }
    case '20': {
      const incoming = line(d, '20')
      const showInstruction = d.mt202Instruction && !incoming
      const outgoing = showInstruction ? d.refOut : null
      const reference = incoming || outgoing || (showInstruction ? d.mt202Instruction?.reference : null)
      const label = outgoing ? '20 исх · № / от' : showInstruction ? 'Референс инструкции · № / от' : '20 · № / от'
      const referencePath = outgoing ? '$.refOut' : showInstruction ? '$.mt202Instruction.reference' : swiftFieldPath('20')
      return {
        label,
        valueTip: fxSourceTip(d, referencePath, '$.docNumber', '$.numDate'),
        tip: showInstruction && !outgoing ? 'Референс платёжной инструкции' : fieldTip('20'),
        value: <><MonoText>{reference || '—'}</MonoText> <HeroSub>№ {d.docNumber} от {formatDate(d.numDate)}</HeroSub></>,
      }
    }
    case '21': {
      const related = line(d, '21')
      const initial = d.mt202Instruction?.initialReference
      if (!related && initial) return { label: 'Исходный референс', valueTip: fxSourceTip(d, '$.mt202Instruction.initialReference'), value: <MonoText>{initial}</MonoText> }
      return { label: '21', valueTip: fxFieldTip(d, '21'), tip: fieldTip('21'), value: <MonoText>{related || '—'}</MonoText> }
    }
    case '71A':
      return { label: '71A', valueTip: fxFieldTip(d, '71A'), tip: fieldTip('71A'), value: line(d, '71A') || '—' }
    case 'vd': {
      const [vin, vout, vdt, vkt] = d.valueDates
      const instruction = d.mt202Instruction
      const displayedDate = vin || (instruction ? vout || instruction.valueDate : '')
      const datePath = !vin && instruction ? (vout ? '$.valueDates[1]' : '$.mt202Instruction.valueDate') : '$.valueDates[0]'
      const instructionTip = instruction?.valueDate ? ` · Инструкция: ${formatDate(instruction.valueDate) || '—'}` : ''
      const same = Boolean(vin) && vin === vout && vin === vdt && vin === vkt
      const check = same && <Same role="img" aria-label="Вх, Исх, по Дт и по Кт совпадают">✓</Same>
      return {
        label: 'Валютирование',
        valueTip: fxSourceTip(d, datePath),
        tip: `Вх: ${formatDate(vin) || '—'} · Исх: ${formatDate(vout) || '—'} · по Дт: ${formatDate(vdt) || '—'} · по Кт: ${formatDate(vkt) || '—'}${instructionTip}`,
        value: edit && (!instruction || vin) ? <ValueDateCell d={d} edit={edit} same={check} /> : <>{formatDate(displayedDate) || '—'}{check}</>,
      }
    }
    case '32A': {
      const rates = lookups?.rates
      return {
        label: '32A · сумма',
        valueTip: fxSourceTip(d, '$.amount', '$.currency'),
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
  if (id === 'internal') return <InternalPaymentBlock d={d} />
  if (id === 'route') return d.routeType || d.routeAcc || d.routeRecv || d.routeText ? <FxRoute d={d} edit={edit} /> : null
  if (id === 'tx' && (d.type !== 'InternalPAYDOCVAL' || d.txs.length > 0)) return <TxBlock txs={d.txs} txId={d.txId} txAt={d.txAt} balances={lookups?.balances}
    sourceTip={fxMappingMode() ? (...keys) => fxSourceTip(d, ...keys) : undefined} />
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
export const fxDocSummary = (d: FxDocDetail): DetailSummary => ({
  ...fxRowSummary(d),
  tabsOff: d.tabsOff,
  ...(fxMappingMode() ? {
    sourceTips: {
      id: fxSourceTip(d, '$.id'),
      created: fxSourceTip(d, '$.created'),
      type: fxSourceTip(d, '$.type'),
      status: fxSourceTip(d, '$.status'),
      kind: fxSourceTip(d, '$.type', '$.dirTxt', '$.direction'),
    },
  } : {}),
})

/** Всё доменное для widgets/doc-detail (спека 2a §4.3). */
export const fxDocDetailDomain: DetailDomain<FxDocDetail, FxDoc> = {
  title: FX_DETAIL_TITLE,
  tabs: FX_TABS,
  actions: FX_ACTIONS,
  fields: FX_FIELDS,
  optionLabels: FX_OPTION_LABELS,
  present: swiftPresent,
  schemaOf: fxSchemaOf,
  value: (d, tag) => d.fields[tag] ?? d.mt202Instruction?.fallbackFields[tag] ?? null,
  fieldTip: fxFieldTip,
  summary: fxDocSummary,
  rowSummary: fxRowSummary,
  renderHero: fxHero,
  renderBlock: fxBlock,
  formEdit: fxFormEdit,
}
