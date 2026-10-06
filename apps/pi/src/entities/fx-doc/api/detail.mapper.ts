import { arr, contractError, obj, oneOf, str, strArr, strOrNull, type EditValue } from '../../../shared/api'
import { parseTxs } from '../../posting/@x/fx-doc'
import type { FxDocDetail, SwiftValue } from '../model/detail'
import type { FxEdit, FxHistEntry } from '../model/edit'
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

/** Значение правки: строка (20 исх, счета, дата, маршрут) или значение поля SWIFT. */
function parseEditValue(raw: unknown, path: string): EditValue {
  return typeof raw === 'string' ? raw : parseSwiftValue(raw, path)
}

function parseHistEntry(raw: unknown, path: string): FxHistEntry {
  const o = obj(raw, path)
  return {
    who: str(o, 'who', path),
    when: str(o, 'when', path),
    was: parseEditValue(o.was, `${path}.was`),
    now: parseEditValue(o.now, `${path}.now`),
    note: strOrNull(o, 'note', path),
    status: oneOf(o, 'status', ['pending', 'confirmed'] as const, path),
    by: strOrNull(o, 'by', path),
    at: strOrNull(o, 'at', path),
  }
}

/** edits ответа: { [цель]: { now, hist } }; поля нет — правок нет. */
function parseEdits(raw: unknown, path: string): Record<string, FxEdit> {
  if (raw === undefined || raw === null) return {}
  const o = obj(raw, path)
  const out: Record<string, FxEdit> = {}
  for (const target of Object.keys(o)) {
    const p = `${path}.${target}`
    const e = obj(o[target], p)
    out[target] = {
      now: e.now === null || e.now === undefined ? null : parseEditValue(e.now, `${p}.now`),
      hist: arr(e.hist, `${p}.hist`).map((h, i) => parseHistEntry(h, `${p}.hist[${i}]`)),
    }
  }
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
    edits: parseEdits(o.edits, `${path}.edits`),
  }
}
