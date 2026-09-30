import type { CSSProperties, ReactNode } from 'react'
import { Disclosure, LinkValue, Tag, formatAmount, formatDate, formatDateTimeFull, type HeroCell, type SectionContent } from '@katran/ui'
import type { DetailDomain, DetailSummary } from '../../../shared/lib/detail'
import { STATUS_LABEL, STATUS_TONE } from '../../doc-status/@x/rub-doc'
import { TxBlock } from '../../posting/@x/rub-doc'
import type { RubDocDetail, RubEd107 } from '../model/detail'
import {
  AGENT_COLS, BUDGET_ROWS, COLLECT_ROWS, ED107_GROUPS, ED107_HEAD, PURPOSE_EXTRA_ROWS, RFIELDS, RUB_ACTIONS, RUB_DETAIL_TITLE,
  RUB_PARTY, RUB_PROFILES, RUB_TABS, rubSchemaOf,
} from '../model/profiles'
import type { RubDoc } from '../model/rubDoc'
import s from './detail.module.css'

/** Есть ли хоть одно непустое значение (эталон filled, index.html:1134). */
function filled(o: unknown): boolean {
  if (Array.isArray(o)) return o.length > 0
  if (o && typeof o === 'object') return Object.keys(o).some((k) => filled((o as Record<string, unknown>)[k]))
  return typeof o === 'string' ? o !== '' : o != null
}

const None = () => <span className={s.none}><span aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></span>
function RLabel({ k }: { k: string }) {
  const m = RFIELDS[k] ?? { label: k }
  return <>{m.no && <span className={s.no} data-k-tip={`${m.no} · ${m.label}`}>{m.no}</span>}{m.label}</>
}
function RVal({ k, v, mono }: { k: string; v: string; mono?: boolean | undefined }) {
  if (!v) return <None />
  return <span className={(mono ?? RFIELDS[k]?.mono) ? s.valMono : s.val}>{v}</span>
}

/** Строки «реквизит — значение» секции; «|» — разделитель групп (эталон rubSectionHtml kv). */
function Kv({ rows, data }: { rows: readonly string[]; data: Record<string, string> }) {
  return (
    <div className={s.kv}>
      {rows.map((k, i) => (k === '|'
        ? <div key={`sep${i}`} className={s.kvSep} aria-hidden="true" />
        : (
          <div key={k} className={[s.kvRow, data[k] ? '' : s.null].filter(Boolean).join(' ')}>
            <span className={s.kvName}><RLabel k={k} /></span>
            <RVal k={k} v={data[k] ?? ''} />
          </div>
        )))}
    </div>
  )
}

function Agents({ d }: { d: RubDocDetail }) {
  return (
    <table className={s.agents}>
      <thead><tr>{AGENT_COLS.map(([title]) => <th key={title} scope="col">{title}</th>)}</tr></thead>
      <tbody>
        {d.agents.map((a, i) => (
          <tr key={i}>{AGENT_COLS.map(([, key]) => <td key={key}><RVal k={key} v={a[key]} mono={key !== 'name'} /></td>)}</tr>
        ))}
      </tbody>
    </table>
  )
}

/** ED107: шапка из четырёх реквизитов и подгруппы узлов ЭС; пустое значение — бледная строка (эталон rubSectionHtml ed107). */
function Ed107({ e }: { e: RubEd107 }) {
  return (
    <div className={s.ed}>
      <div className={s.kvs}>
        {ED107_HEAD.map(([k, label]) => (
          <span key={k} className={s.kvsItem}>
            <span className={s.lbl}>{label}</span>
            {e[k] ? <span className={s.val}>{k.endsWith('Date') ? formatDate(e[k]) : e[k]}</span> : <None />}
          </span>
        ))}
      </div>
      {ED107_GROUPS.map((g) => {
        const cnt = g.rows.filter((r) => e.v[`${g.node}/${r}`]).length
        return (
          <Disclosure key={g.id} title={g.title} level="sub" defaultOpen aside={<span className={s.cnt}>{cnt} / {g.rows.length}</span>}>
            {g.rows.map((r) => {
              const path = `${g.node}/${r}`
              const v = e.v[path] ?? ''
              return (
                <div key={path} className={[s.kvRow, v ? '' : s.null].filter(Boolean).join(' ')}>
                  <span className={[s.kvName, s.mono].join(' ')}>ed:{path}</span>
                  <RVal k={path} v={v} mono={r === 'BIC' || /Acc|Account/.test(r)} />
                </div>
              )
            })}
          </Disclosure>
        )
      })}
    </div>
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
    <div className={s.msgs}>
      <div className={s.col}>
        <div className={s.colTitle}>Сценарий</div>
        <span className={s.lbl}>Код</span><span className={[s.valMono, s.cut].join(' ')} data-k-tip={d.scenario}>{d.scenario}</span>
        <span className={s.lbl}>S → R</span><span className={[s.valMono, s.cut].join(' ')}>{d.sysFrom}<span className={s.ar}>→</span>{d.sysTo}</span>
      </div>
      <div className={s.col}>
        <div className={s.colTitle}>Системы</div>
        <span className={s.lbl}>Initiator</span><span className={[s.valMono, s.cut].join(' ')}>{d.initiator}</span>
        <span className={s.lbl}>Source</span><span className={[s.valMono, s.cut].join(' ')}>{d.source}</span>
        <span className={s.lbl}>Destination</span><span className={[s.valMono, s.cut].join(' ')}>{d.destination}</span>
      </div>
      <div className={s.col}>
        <div className={s.colTitle}>Идентификаторы</div>
        <span className={s.lbl}>Ссылки</span>
        <span className={s.links}>
          <LinkValue name="txId" value={d.txId || undefined} />
          <LinkValue name="docRef" value={d.docRef || undefined} />
          <LinkValue name="УИП" value={d.purposeExtra.uip || undefined} />
        </span>
      </div>
    </div>
  )
}

/** Таблица «отправитель | получатель»: строки фиксированы, пустые с обеих сторон — бледные (эталон rubPartyHtml, index.html:1127). */
function Party({ d }: { d: RubDocDetail }) {
  return (
    <div className={s.partyWrap}>
      <div className={s.fh}><h3 className={s.fhTitle}>Отправитель / Получатель</h3><span className={s.lbl}>отправитель слева · получатель справа</span></div>
      <table className={s.party} aria-label="Отправитель и получатель">
        <colgroup><col style={{ width: 'var(--k-dt-label-s)' } as CSSProperties} /><col /><col /></colgroup>
        <thead><tr><th scope="col"><span className={s.sr}>Реквизит</span></th><th scope="col">Отправитель</th><th scope="col">Получатель</th></tr></thead>
        <tbody>
          {RUB_PARTY.map((k, i) => {
            const a = d.party.s[k], b = d.party.r[k]
            return (
              <tr key={k} data-empty={!a && !b ? '' : undefined} data-part={i === 0 ? 'party-row' : undefined} className={!a && !b ? s.null : undefined}>
                <th scope="row" className={s.kvName}>{RFIELDS[k]?.label ?? k}</th>
                <td><RVal k={k} v={a} /></td>
                <td><RVal k={k} v={b} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Purpose({ d }: { d: RubDocDetail }) {
  return (
    <div className={[s.rtxt, d.purpose ? '' : s.null].filter(Boolean).join(' ')}>
      <span className={s.rtxtLbl}>{RFIELDS.purpose?.label}</span>
      {d.purpose ? <span className={s.val}>{d.purpose}</span> : <None />}
    </div>
  )
}

/** Ячейки сводки (эталон rubHeroHtml, index.html:1114). */
export function rubHero(d: RubDocDetail, id: string): HeroCell {
  switch (id) {
    case 'num': return { label: 'Номер документа · от', value: <>№ {d.docNumber} <span className={s.heroSub}>от {formatDate(d.numDate)}</span></> }
    // у платёжного ордера кода операции нет (В-Д3) — прочерк
    case 'op': return { label: 'Операция', value: <>{d.opCode ? <span className={s.valMono}>{d.opCode}</span> : <None />} <span className={s.heroSub}>{d.opName}</span></> }
    case 'queue': return {
      label: 'Очерёдность · приоритет',
      value: <>{d.queue}{d.prio === 1 ? <span className={s.prio}><Tag tone="warn">СРОЧНО</Tag></span> : <span className={s.noPrio}>неприоритетный</span>}</>,
    }
    case 'sum': return { label: 'Сумма', align: 'right', value: <span className={s.amt}>{formatAmount(d.amount)}<small className={s.ccy}>RUB</small></span> }
    default: return { label: id, value: '—' }
  }
}

/** Блоки-слоты профиля: scen, tx, party, purpose. «Проверить баланс» у транзакций — не переносится (detail-drift Д15). */
export function rubBlock(d: RubDocDetail, id: string): ReactNode {
  if (id === 'scen') return <Scenario d={d} />
  if (id === 'tx') return <TxBlock txs={d.txs} txId={d.txId} txAt={d.txAt} />
  if (id === 'party') return <Party d={d} />
  if (id === 'purpose') return <Purpose d={d} />
  return null
}

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
