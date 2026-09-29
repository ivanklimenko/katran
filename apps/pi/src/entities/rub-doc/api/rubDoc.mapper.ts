import { contractError, num, obj, oneOf, str, strOrNull, type Obj } from '../../../shared/api'
import { STATUSES } from '../../doc-status/@x/rub-doc'
import { ED_CODES, RUB_DIRECTIONS, RUB_TYPES, type RubDoc } from '../model/rubDoc'

/** lock/inactive — вложенные объекты или null (как у FxDoc, R4/В-Р2): null/undefined → null, иначе объект со строковыми полями. */
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

/** Строка бека → RubDoc. Если бек называет поля иначе — правится только этот файл. */
export function parseRubDoc(raw: unknown, path: string): RubDoc {
  const o = obj(raw, path)
  const s = (k: string) => str(o, k, path)
  const prio = num(o, 'prio', path)
  if (prio !== 0 && prio !== 1) throw contractError(`${path}.prio: ожидалось 0 или 1`)
  return {
    id: s('id'), docNumber: s('docNumber'), uuid: s('uuid'), txId: s('txId'), docRef: s('docRef'),
    created: s('created'), changed: s('changed'),
    type: oneOf(o, 'type', RUB_TYPES, path), edCode: oneOf(o, 'edCode', ED_CODES, path),
    direction: oneOf(o, 'direction', RUB_DIRECTIONS, path), dirTxt: s('dirTxt'),
    amount: num(o, 'amount', path), queue: num(o, 'queue', path), prio,
    fromName: s('fromName'), fromAcc: s('fromAcc'), fromInn: s('fromInn'), fromKpp: s('fromKpp'), fromBic: s('fromBic'), fromBank: s('fromBank'),
    toName: s('toName'), toAcc: s('toAcc'), toInn: s('toInn'), toKpp: s('toKpp'), toBic: s('toBic'), toBank: s('toBank'),
    initiator: s('initiator'), source: s('source'), destination: s('destination'),
    purpose: s('purpose'), status: oneOf(o, 'status', STATUSES, path), reason: strOrNull(o, 'reason', path),
    lock: lockOrNull(o, 'lock', path), inactive: inactiveOrNull(o, 'inactive', path),
  }
}
