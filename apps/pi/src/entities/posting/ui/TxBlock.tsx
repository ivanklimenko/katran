import type { ReactNode } from 'react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { Disclosure, LinkValue, StatusDot, formatAmount, formatDateTimeFull, formatDateTimeShort, type StatusTone } from '@katran/ui'
import type { Balances } from '../../../shared/api'
import type { LookupView } from '../../../shared/lib/detail'
import type { Tx, TxDir, TxState } from '../model/posting'
import { BalancesView } from './BalancesView'
import { LookupLink } from './LookupLink'

/* Блок «Транзакции» (эталон .tx/.txs, index.html:176–186) */
const Summary = styled.span`
  display: inline-flex;
  gap: ${k.sp1};
`

const SumItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp1};
  font: 600 ${k.fs3} / 1 ${k.mono};
  color: ${k.ink2};
`

const Ids = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: ${k.sp2};
  margin-left: auto;
`

const At = styled.span`
  font-size: ${k.fs2};
  color: ${k.muted};
`

const Rows = styled.div`
  margin: 0 calc(-1 * ${k.sp2});
`

const Row = styled.div`
  display: grid;
  grid-template-columns: ${k.dtDir} ${k.dtAcc} ${k.dtSum} ${k.dtSt} minmax(0, 1fr) ${k.dtTime};
  gap: 0 ${k.sp2};
  align-items: center;
  min-height: ${k.hField};
  padding: 0 ${k.sp2};
  border-top: 1px solid ${k.line2};
  white-space: nowrap;

  & > * {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`

const Dir = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp1};
  font: 600 ${k.fs3} / 1 ${k.mono};
  color: ${k.ink2};

  & svg {
    flex: none;
    width: ${k.fs1};
    height: ${k.fs1};
  }
`

const Acc = styled.span`
  font: ${k.fs2} / ${k.lh2} ${k.mono};
  color: ${k.val};
`

const Sum = styled.span`
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
`

const Ccy = styled.small`
  margin-left: ${k.sp1};
  font-size: ${k.fs2};
  font-weight: 600;
  color: ${k.val};
`

const St = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp1};
  font: 600 ${k.fs3} / 1 ${k.sans};
  color: ${k.ink2};
`

const Reg = styled.span`
  font-size: ${k.fs2};
  color: ${k.muted};
`

const Time = styled.span`
  font: ${k.fs2} / ${k.lh2} ${k.mono};
  font-variant-numeric: tabular-nums;
  color: ${k.ink2};
`

const TONE: Record<TxState, StatusTone> = { EXECUTED: 'ok', PENDING: 'warn', CANCELED: 'bad' }
const ORDER: TxState[] = ['EXECUTED', 'PENDING', 'CANCELED']

const Arrow = ({ dir }: { dir: TxDir }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d={dir === 'DEBIT' ? 'M8 3v10M4 9l4 4 4-4' : 'M8 13V3M4 7l4-4 4 4'} />
  </svg>
)

export type TxBlockProps = {
  txs: Tx[]
  txId: string
  txAt: string
  /** Эталон: блок свёрнут (mkui(true), grid.html:2154). */
  defaultOpen?: boolean | undefined
  /** Сверх заголовка — между сводкой и txId. */
  aside?: ReactNode | undefined
  /**
   * Остатки по счетам проводок (спека 2e §4 п. 7): есть — кнопка-ссылка «Проверить баланс» после сводки (оба реестра;
   * на эталоне только у рубля, сверка Д79). Ссылка — в aside Disclosure, вне кнопки заголовка: блок не сворачивает.
   */
  balances?: LookupView<Balances> | undefined
}

/** Блок «Транзакции» (эталон txBlockHtml, index.html:1023): число, сводка по состояниям, txId и время; строки проводок. */
export function TxBlock({ txs, txId, txAt, defaultOpen = false, aside, balances }: TxBlockProps) {
  const counts = ORDER.map((st) => ({ st, n: txs.filter((t) => t.st === st).length })).filter((x) => x.n > 0)
  return (
    <Disclosure
      title="Транзакции"
      count={txs.length}
      defaultOpen={defaultOpen}
      aside={(
        <>
          <Summary>
            {counts.map(({ st, n }) => <SumItem key={st}><StatusDot tone={TONE[st]} size="s" label={st} />{n}</SumItem>)}
          </Summary>
          {balances && <LookupLink label="Проверить баланс" view={balances}><BalancesView view={balances} /></LookupLink>}
          {aside}
          <Ids><LinkValue name="txId" value={txId} /><At>{formatDateTimeFull(txAt)}</At></Ids>
        </>
      )}
    >
      <Rows>
        {txs.map((t, i) => (
          <Row key={i}>
            <Dir><Arrow dir={t.dir} />{t.dir}</Dir>
            <Acc>{t.acc}</Acc>
            <Sum>{formatAmount(t.amount)}<Ccy>{t.currency}</Ccy></Sum>
            <St><StatusDot tone={TONE[t.st]} size="s" />{t.st}</St>
            <Reg data-k-tip={`Тип регистра: ${t.reg}`}>{t.reg}</Reg>
            <Time data-k-tip={t.time ?? undefined}>{t.time ? formatDateTimeShort(t.time) : '—'}</Time>
          </Row>
        ))}
      </Rows>
    </Disclosure>
  )
}
