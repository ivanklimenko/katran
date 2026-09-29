import { num, obj, oneOf, str, strOrNull, type Obj } from '../../../shared/api'
import { STATUSES } from '../../doc-status/@x/fx-doc'
import { CURRENCIES, DIRECTIONS, FX_TYPES, ROUTE_TYPES, type FxDoc } from '../model/fxDoc'

/** lock/inactive — вложенные объекты или null (R4): null/undefined → null, иначе объект со строковыми полями. */
function lockOrNull(o: Obj, k: string, path: string): { who: string; since: string } | null {
  const v = o[k]
  if (v === null || v === undefined) return null
  const lo = obj(v, `${path}.${k}`)
  return { who: str(lo, 'who', `${path}.${k}`), since: str(lo, 'since', `${path}.${k}`) }
}
function inactiveOrNull(o: Obj, k: string, path: string): { why: string } | null {
  const v = o[k]
  if (v === null || v === undefined) return null
  const io = obj(v, `${path}.${k}`)
  return { why: str(io, 'why', `${path}.${k}`) }
}

/** Строка бека → FxDoc. Если бек называет поля иначе — правится только этот файл. */
export function parseFxDoc(raw: unknown, path: string): FxDoc {
  const o = obj(raw, path)
  return {
    id: str(o, 'id', path), docNumber: num(o, 'docNumber', path), refIn: strOrNull(o, 'refIn', path), refOut: strOrNull(o, 'refOut', path), uetr: str(o, 'uetr', path),
    created: str(o, 'created', path), vdDt: str(o, 'vdDt', path), vdKt: str(o, 'vdKt', path),
    type: oneOf(o, 'type', FX_TYPES, path),
    direction: oneOf(o, 'direction', DIRECTIONS, path), dirTxt: str(o, 'dirTxt', path),
    amount: num(o, 'amount', path), currency: oneOf(o, 'currency', CURRENCIES, path),
    f50name: str(o, 'f50name', path), f50acc: str(o, 'f50acc', path), purpose: strOrNull(o, 'purpose', path),
    f52: str(o, 'f52', path), f57: str(o, 'f57', path), f59name: str(o, 'f59name', path), f59acc: str(o, 'f59acc', path),
    status: oneOf(o, 'status', STATUSES, path), reason: strOrNull(o, 'reason', path),
    sender: str(o, 'sender', path), receiver: str(o, 'receiver', path), provS: str(o, 'provS', path), provR: str(o, 'provR', path),
    lock: lockOrNull(o, 'lock', path), inactive: inactiveOrNull(o, 'inactive', path),
    f50opt: str(o, 'f50opt', path), f59opt: str(o, 'f59opt', path),
    f52name: str(o, 'f52name', path), f57name: str(o, 'f57name', path),
    f58: strOrNull(o, 'f58', path), f58name: strOrNull(o, 'f58name', path),
    outSender: str(o, 'outSender', path), outReceiver: str(o, 'outReceiver', path),
    routeType: oneOf(o, 'routeType', ROUTE_TYPES, path), routeRecv: str(o, 'routeRecv', path), routeAcc: str(o, 'routeAcc', path),
  }
}
