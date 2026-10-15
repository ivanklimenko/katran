import type { CSSProperties, ReactNode } from 'react'
import styled, { css } from 'styled-components'
import { k } from '@katran/tokens'
import { Disclosure, LinkValue, Tag, formatAmount, formatDate, formatDateTimeFull, type HeroCell, type SectionContent } from '@katran/ui'
import type { DetailDomain, DetailLookups, DetailSummary, EditContext } from '../../../shared/lib/detail'
import { STATUS_LABEL, STATUS_TONE } from '../../doc-status/@x/rub-doc'
import { TxBlock } from '../../posting/@x/rub-doc'
import type { RubDocDetail, RubEd107 } from '../model/detail'
import {
  AGENT_COLS, BUDGET_ROWS, COLLECT_ROWS, ED107_GROUPS, ED107_HEAD, PURPOSE_EXTRA_ROWS, RFIELDS, RUB_ACTIONS, RUB_DETAIL_TITLE,
  RUB_PARTY, RUB_PROFILES, RUB_TABS, rubSchemaOf,
} from '../model/profiles'
import type { RubDoc } from '../model/rubDoc'
import { Sr } from '../../../shared/ui'

/* Блоки «Общих данных» рубля (эталон .msgs/.rp/.rph/.rpr/.rtxt/.rsec/.kvs, index.html:161–165, 343–345, 479–500).
   data-null — строка или блок без значения: подпись бледная, рамка блока пунктиром. */
const Msgs = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1.15fr;
  border: 1px solid ${k.line};
  border-radius: ${k.rS};
`

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

const Val = styled.span`
  overflow-wrap: anywhere;
  color: ${k.val};
`

/* значение моноширинно; data-cut — в одну строку с многоточием */
const ValMono = styled.span`
  font: ${k.fs1} / ${k.lh1} ${k.mono};
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
  color: ${k.val};

  &:where([data-cut]) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const Ar = styled.span`
  margin: 0 ${k.sp1};
  color: ${k.faint};
`

const Links = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0 ${k.sp2};
`

const NoneText = styled.span`
  color: ${k.faint};
`

const HeroSub = styled.span`
  font-weight: 500;
`

const Prio = styled.span`
  margin-left: ${k.sp2};
`

const NoPrio = styled.span`
  margin-left: ${k.sp2};
  font-size: ${k.fs2};
  font-weight: 400;
  color: ${k.muted};
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

const PartyWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${k.sp1};
`

const Fh = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${k.sp2};
`

const FhTitle = styled.h3`
  margin: 0;
  font: 600 ${k.fs2} / ${k.lh2} ${k.sans};
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: ${k.ink2};
`

/* таблица сторон и агентов: строка 23 (эталон .rpr), шапка прописными на sunk */
const sideTable = css`
  width: 100%;
  border: 1px solid ${k.line};
  border-collapse: collapse;
  border-radius: ${k.rS};
  table-layout: fixed;

  & th,
  & td {
    height: ${k.partyRow};
    padding: 0 ${k.sp2};
    border-bottom: 1px solid ${k.line2};
    text-align: left;
    vertical-align: baseline;
  }

  & thead th {
    background: ${k.sunk};
    font: 600 ${k.fs3} / ${k.lh3} ${k.sans};
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${k.muted};
  }
`

const PartyTable = styled.table`
  ${sideTable}
`

const AgentsTable = styled.table`
  ${sideTable}

  & td {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  & th:first-child {
    width: 40%;
  }

  & th:nth-child(2) {
    width: ${k.dtBic};
  }
`

/* подпись строки; data-mono — путь узла ED107 моноширинно; у пустой строки (data-null) — бледная.
   Тот же компонент — заголовок строки таблицы сторон (as="th") */
const KvName = styled.span`
  font-size: ${k.fs2};
  font-weight: 400;
  color: ${k.muted};

  &:where([data-mono]) {
    font-family: ${k.mono};
  }

  [data-null] & {
    color: ${k.faint};
  }
`

const Rtxt = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0 ${k.sp3};
  align-items: baseline;
  padding: ${k.sp1} ${k.sp2};
  border: 1px solid ${k.line};
  border-radius: ${k.rS};

  &[data-null] {
    border-style: dashed;
  }
`

const RtxtLbl = styled.span`
  font: 600 ${k.fs3} / ${k.lh3} ${k.sans};
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
  color: ${k.ink2};
`

/* строки секции: подпись 250 (эталон .rsec .xr) */
const KvList = styled.div`
  display: flex;
  flex-direction: column;
`

const KvRow = styled.div`
  display: grid;
  grid-template-columns: ${k.dtLabelL} minmax(0, 1fr);
  gap: 0 ${k.sp3};
  align-items: baseline;
  min-height: ${k.partyRow};
  border-bottom: 1px solid ${k.line2};

  &:last-child {
    border-bottom: 0;
  }
`

const KvSep = styled.div`
  height: ${k.sp2};
  border-bottom: 1px solid ${k.line};
`

const No = styled.span`
  margin-right: ${k.sp1};
  font: 600 ${k.fs1} / 1 ${k.mono};
  color: ${k.ink};
  cursor: help;
`

const Ed = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${k.sp1};
`

const Kvs = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 ${k.sp3};
`

const KvsItem = styled.span`
  display: flex;
  align-items: baseline;
  gap: ${k.sp2};
  min-width: 0;
`

const Cnt = styled.span`
  margin-left: auto;
  font: 500 ${k.fs3} / 1 ${k.mono};
  color: ${k.faint};
`

/** Есть ли хоть одно непустое значение (эталон filled, index.html:1134). */
function filled(o: unknown): boolean {
  if (Array.isArray(o)) return o.length > 0
  if (o && typeof o === 'object') return Object.keys(o).some((name) => filled((o as Record<string, unknown>)[name]))
  return typeof o === 'string' ? o !== '' : o != null
}

const None = () => <NoneText><span aria-hidden="true">—</span><Sr>не заполнено</Sr></NoneText>
function RLabel({ field }: { field: string }) {
  const m = RFIELDS[field] ?? { label: field }
  return <>{m.no && <No data-k-tip={`${m.no} · ${m.label}`}>{m.no}</No>}{m.label}</>
}
function RVal({ field, v, mono }: { field: string; v: string; mono?: boolean | undefined }) {
  if (!v) return <None />
  return (mono ?? RFIELDS[field]?.mono) ? <ValMono>{v}</ValMono> : <Val>{v}</Val>
}

/** Строки «реквизит — значение» секции; «|» — разделитель групп (эталон rubSectionHtml kv). */
function Kv({ rows, data }: { rows: readonly string[]; data: Record<string, string> }) {
  return (
    <KvList>
      {rows.map((name, i) => (name === '|'
        ? <KvSep key={`sep${i}`} aria-hidden="true" />
        : (
          <KvRow key={name} data-null={data[name] ? undefined : ''}>
            <KvName><RLabel field={name} /></KvName>
            <RVal field={name} v={data[name] ?? ''} />
          </KvRow>
        )))}
    </KvList>
  )
}

function Agents({ d }: { d: RubDocDetail }) {
  return (
    <AgentsTable>
      <thead><tr>{AGENT_COLS.map(([title]) => <th key={title} scope="col">{title}</th>)}</tr></thead>
      <tbody>
        {d.agents.map((a, i) => (
          <tr key={i}>{AGENT_COLS.map(([, key]) => <td key={key}><RVal field={key} v={a[key]} mono={key !== 'name'} /></td>)}</tr>
        ))}
      </tbody>
    </AgentsTable>
  )
}

/** ED107: шапка из четырёх реквизитов и подгруппы узлов ЭС; пустое значение — бледная строка (эталон rubSectionHtml ed107). */
function Ed107({ e }: { e: RubEd107 }) {
  return (
    <Ed>
      <Kvs>
        {ED107_HEAD.map(([name, label]) => (
          <KvsItem key={name}>
            <Lbl>{label}</Lbl>
            {e[name] ? <Val>{name.endsWith('Date') ? formatDate(e[name]) : e[name]}</Val> : <None />}
          </KvsItem>
        ))}
      </Kvs>
      {ED107_GROUPS.map((g) => {
        const cnt = g.rows.filter((r) => e.v[`${g.node}/${r}`]).length
        return (
          <Disclosure key={g.id} title={g.title} level="sub" defaultOpen aside={<Cnt>{cnt} / {g.rows.length}</Cnt>}>
            {g.rows.map((r) => {
              const path = `${g.node}/${r}`
              const v = e.v[path] ?? ''
              return (
                <KvRow key={path} data-null={v ? undefined : ''}>
                  <KvName data-mono="">ed:{path}</KvName>
                  <RVal field={path} v={v} mono={r === 'BIC' || /Acc|Account/.test(r)} />
                </KvRow>
              )
            })}
          </Disclosure>
        )
      })}
    </Ed>
  )
}

/** Секции «Дополнительных блоков» (эталон RSECTIONS): null — без данных, заголовок бледный, не раскрывается. */
export function rubSection(d: RubDocDetail, id: string): SectionContent {
  switch (id) {
    case 'purposeExtra': return filled(d.purposeExtra) ? { body: <Kv rows={PURPOSE_EXTRA_ROWS} data={d.purposeExtra} /> } : null
    case 'agents': return d.agents.length > 0 ? { count: d.agents.length, body: <Agents d={d} /> } : null
    case 'budget': return filled(d.budget) ? { body: <Kv rows={BUDGET_ROWS} data={d.budget} /> } : null
    case 'ed107': return filled(d.ed107) ? { body: <Ed107 e={d.ed107} /> } : null
    case 'collect': return filled(d.collect) ? { body: <Kv rows={COLLECT_ROWS} data={d.collect} /> } : null
    default: return null
  }
}

/** Сценарий, системы, идентификаторы — аналог «Маршрута» валюты (эталон rubScenHtml, index.html:1121). */
function Scenario({ d }: { d: RubDocDetail }) {
  return (
    <Msgs>
      <Col>
        <ColTitle>Сценарий</ColTitle>
        <Lbl>Код</Lbl><ValMono data-cut="" data-k-tip={d.scenario}>{d.scenario}</ValMono>
        <Lbl>S → R</Lbl><ValMono data-cut="">{d.sysFrom}<Ar>→</Ar>{d.sysTo}</ValMono>
      </Col>
      <Col>
        <ColTitle>Системы</ColTitle>
        <Lbl>Initiator</Lbl><ValMono data-cut="">{d.initiator}</ValMono>
        <Lbl>Source</Lbl><ValMono data-cut="">{d.source}</ValMono>
        <Lbl>Destination</Lbl><ValMono data-cut="">{d.destination}</ValMono>
      </Col>
      <Col>
        <ColTitle>Идентификаторы</ColTitle>
        <Lbl>Ссылки</Lbl>
        <Links>
          <LinkValue name="txId" value={d.txId || undefined} />
          <LinkValue name="docRef" value={d.docRef || undefined} />
          <LinkValue name="УИП" value={d.purposeExtra.uip || undefined} />
        </Links>
      </Col>
    </Msgs>
  )
}

/** Таблица «отправитель | получатель»: строки фиксированы, пустые с обеих сторон — бледные (эталон rubPartyHtml, index.html:1127). */
function Party({ d }: { d: RubDocDetail }) {
  return (
    <PartyWrap>
      <Fh><FhTitle>Отправитель / Получатель</FhTitle><Lbl>отправитель слева · получатель справа</Lbl></Fh>
      <PartyTable aria-label="Отправитель и получатель">
        <colgroup><col style={{ width: 'var(--k-dt-label-s)' } as CSSProperties} /><col /><col /></colgroup>
        <thead><tr><th scope="col"><Sr>Реквизит</Sr></th><th scope="col">Отправитель</th><th scope="col">Получатель</th></tr></thead>
        <tbody>
          {RUB_PARTY.map((name, i) => {
            const a = d.party.s[name], b = d.party.r[name]
            return (
              <tr key={name} data-empty={!a && !b ? '' : undefined} data-null={!a && !b ? '' : undefined} data-part={i === 0 ? 'party-row' : undefined}>
                <KvName as="th" scope="row">{RFIELDS[name]?.label ?? name}</KvName>
                <td><RVal field={name} v={a} /></td>
                <td><RVal field={name} v={b} /></td>
              </tr>
            )
          })}
        </tbody>
      </PartyTable>
    </PartyWrap>
  )
}

function Purpose({ d }: { d: RubDocDetail }) {
  return (
    <Rtxt data-null={d.purpose ? undefined : ''}>
      <RtxtLbl>{RFIELDS.purpose?.label}</RtxtLbl>
      {d.purpose ? <Val>{d.purpose}</Val> : <None />}
    </Rtxt>
  )
}

/** Ячейки сводки (эталон rubHeroHtml, index.html:1114). */
export function rubHero(d: RubDocDetail, id: string): HeroCell {
  switch (id) {
    case 'num': return { label: 'Номер документа · от', value: <>№ {d.docNumber} <HeroSub>от {formatDate(d.numDate)}</HeroSub></> }
    // у платёжного ордера кода операции нет (В-Д3) — прочерк
    case 'op': return { label: 'Операция', value: <>{d.opCode ? <ValMono>{d.opCode}</ValMono> : <None />} <HeroSub>{d.opName}</HeroSub></> }
    case 'queue': return {
      label: 'Очерёдность · приоритет',
      value: <>{d.queue}{d.prio === 1 ? <Prio><Tag tone="warn">СРОЧНО</Tag></Prio> : <NoPrio>неприоритетный</NoPrio>}</>,
    }
    case 'sum': return { label: 'Сумма', align: 'right', value: <Amt>{formatAmount(d.amount)}<Ccy>RUB</Ccy></Amt> }
    default: return { label: id, value: '—' }
  }
}

/**
 * Блоки-слоты профиля: scen, tx, party, purpose. Правки у рубля нет — третий параметр не используется; lookups.balances —
 * «Проверить баланс» в блоке транзакций (спека 2e §4 п. 7, сверка Д79).
 */
export function rubBlock(d: RubDocDetail, id: string, _edit?: EditContext | null, lookups: DetailLookups | null = null): ReactNode {
  if (id === 'scen') return <Scenario d={d} />
  if (id === 'tx') return <TxBlock txs={d.txs} txId={d.txId} txAt={d.txAt} balances={lookups?.balances} />
  if (id === 'party') return <Party d={d} />
  if (id === 'purpose') return <Purpose d={d} />
  return null
}

/** Подпись статуса документа («Обработан») — плашки и подсказки аннулирования, итог «пока в статусе «…»» (спека 2e §3.3). */
export const statusLabelOf = (d: RubDoc): string => STATUS_LABEL[d.status]

export function rubRowSummary(row: RubDoc): DetailSummary {
  return {
    label: `${RUB_DETAIL_TITLE} № ${row.docNumber}`,
    uuid: row.uuid,
    created: formatDateTimeFull(row.created),
    type: row.type,
    status: { tone: STATUS_TONE[row.status], label: STATUS_LABEL[row.status] },
    kind: `${RUB_PROFILES[row.type].title} · ${row.dirTxt}`,
    tabsOff: [],
  }
}
export const rubDocSummary = (d: RubDocDetail): DetailSummary => ({ ...rubRowSummary(d), tabsOff: d.tabsOff })

/** Всё доменное для widgets/doc-detail. Полей SWIFT у рубля нет — реестр полей пуст, всё в блоках и секциях. */
export const rubDocDetailDomain: DetailDomain<RubDocDetail, RubDoc> = {
  title: RUB_DETAIL_TITLE,
  tabs: RUB_TABS,
  actions: RUB_ACTIONS,
  fields: {},
  schemaOf: rubSchemaOf,
  value: () => null,
  summary: rubDocSummary,
  rowSummary: rubRowSummary,
  renderHero: rubHero,
  renderBlock: rubBlock,
  renderSection: rubSection,
}
