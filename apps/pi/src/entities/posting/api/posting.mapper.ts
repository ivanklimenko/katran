import { arr, num, obj, oneOf, str, strOrNull } from '../../../shared/api'
import { TX_DIRS, TX_STATES, type Tx } from '../model/posting'

/** Проводка бека → Tx. Если бек называет поля иначе — правится только этот файл. */
export function parseTx(raw: unknown, path: string): Tx {
  const o = obj(raw, path)
  return {
    dir: oneOf(o, 'dir', TX_DIRS, path), st: oneOf(o, 'st', TX_STATES, path),
    acc: str(o, 'acc', path), reg: str(o, 'reg', path), time: strOrNull(o, 'time', path),
    amount: num(o, 'amount', path), currency: str(o, 'currency', path),
  }
}

export const parseTxs = (v: unknown, path: string): Tx[] => arr(v, path).map((x, i) => parseTx(x, `${path}[${i}]`))
