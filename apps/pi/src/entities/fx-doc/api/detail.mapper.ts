import { contractError, obj, str, strArr, strOrNull } from '../../../shared/api'
import { parseTxs } from '../../posting/@x/fx-doc'
import type { FxDocDetail, SwiftValue } from '../model/detail'
import { parseFxDoc } from './fxDoc.mapper'

function parseSwiftValue(raw: unknown, path: string): SwiftValue {
  const o = obj(raw, path)
  const opt = strOrNull(o, 'opt', path)
  const acc = strOrNull(o, 'acc', path)
  // пустая буква опции (59 допускает '') и пустой счёт — как отсутствие
  return { lines: strArr(o.lines, `${path}.lines`), ...(opt ? { opt } : {}), ...(acc ? { acc } : {}) }
}

function parseFields(raw: unknown, path: string): Record<string, SwiftValue> {
  const o = obj(raw, path)
  const out: Record<string, SwiftValue> = {}
  for (const tag of Object.keys(o)) out[tag] = parseSwiftValue(o[tag], `${path}.${tag}`)
  return out
}

/** Ответ GET /grids/fx-docs/documents/{id} → FxDocDetail. Если бек называет поля иначе — правится только этот файл. */
export function parseFxDocDetail(raw: unknown, path: string): FxDocDetail {
  const o = obj(raw, path)
  const vd = strArr(o.valueDates, `${path}.valueDates`)
  if (vd.length !== 4) throw contractError(`${path}.valueDates: ожидалось 4 даты (вх, исх, по Дт, по Кт)`)
  return {
    ...parseFxDoc(o, path),
    numDate: str(o, 'numDate', path),
    valueDates: [vd[0]!, vd[1]!, vd[2]!, vd[3]!],
    fields: parseFields(o.fields, `${path}.fields`),
    inSender: strOrNull(o, 'inSender', path),
    inReceiver: strOrNull(o, 'inReceiver', path),
    accDt: str(o, 'accDt', path),
    accKt: str(o, 'accKt', path),
    routeDesc: str(o, 'routeDesc', path),
    routeText: str(o, 'routeText', path),
    txId: str(o, 'txId', path),
    txAt: str(o, 'txAt', path),
    txs: parseTxs(o.txs, `${path}.txs`),
    tabsOff: strArr(o.tabsOff, `${path}.tabsOff`),
  }
}
