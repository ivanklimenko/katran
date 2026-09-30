import type { ReactNode } from 'react'
import { Disclosure, LinkValue, StatusDot, formatAmount, formatDateTimeFull, formatDateTimeShort, type StatusTone } from '@katran/ui'
import type { Tx, TxDir, TxState } from '../model/posting'
import s from './posting.module.css'

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
  /** Сверх заголовка — между сводкой и txId (у рубля на эталоне «Проверить баланс», в 2a не переносится). */
  aside?: ReactNode | undefined
}

/** Блок «Транзакции» (эталон txBlockHtml, index.html:1023): число, сводка по состояниям, txId и время; строки проводок. */
export function TxBlock({ txs, txId, txAt, defaultOpen = false, aside }: TxBlockProps) {
  const counts = ORDER.map((st) => ({ st, n: txs.filter((t) => t.st === st).length })).filter((x) => x.n > 0)
  return (
    <Disclosure
      title="Транзакции"
      count={txs.length}
      defaultOpen={defaultOpen}
      aside={(
        <>
          <span className={s.summary}>
            {counts.map(({ st, n }) => <span key={st} className={s.sumItem}><StatusDot tone={TONE[st]} size="s" label={st} />{n}</span>)}
          </span>
          {aside}
          <span className={s.ids}><LinkValue name="txId" value={txId} /><span className={s.at}>{formatDateTimeFull(txAt)}</span></span>
        </>
      )}
    >
      <div className={s.rows}>
        {txs.map((t, i) => (
          <div key={i} className={s.row}>
            <span className={s.dir}><Arrow dir={t.dir} />{t.dir}</span>
            <span className={s.acc}>{t.acc}</span>
            <span className={s.sum}>{formatAmount(t.amount)}<small className={s.ccy}>{t.currency}</small></span>
            <span className={s.st}><StatusDot tone={TONE[t.st]} size="s" />{t.st}</span>
            <span className={s.reg} data-k-tip={`Тип регистра: ${t.reg}`}>{t.reg}</span>
            <span className={s.time} data-k-tip={t.time ?? undefined}>{t.time ? formatDateTimeShort(t.time) : '—'}</span>
          </div>
        ))}
      </div>
    </Disclosure>
  )
}
