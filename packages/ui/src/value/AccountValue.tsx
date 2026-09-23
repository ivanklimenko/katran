import { shortAccount } from '../format/account'
import { CopyValue, type CopyValueProps } from './CopyValue'
import s from './Value.module.css'

export type AccountValueProps = Omit<CopyValueProps, 'display' | 'short' | 'tone'> & { full?: boolean }

/** Счёт: в гриде 8…3 с выделенным кодом валюты; full — целиком (деталка). */
export function AccountValue({ value, full, ...rest }: AccountValueProps) {
  const a = shortAccount(value)
  const head = <>{a.head.slice(0, 5)}<b className={s.ccy}>{a.ccy}</b>{a.head.slice(8)}</>
  const display = full || !a.short ? head : <>{head}…{a.tail}</>
  return <CopyValue value={value} display={display} short={!full && a.short} tone="mono" {...rest} />
}
