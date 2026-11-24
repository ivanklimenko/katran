import { arr, bool, contractError, obj, oneOf, parseAnnul, parseCanAnnul, str, strArr, strOrNull, type EditValue, type Obj } from '../../../shared/api'
import { parseTxs } from '../../posting/@x/fx-doc'
import type { FxDocDetail, InternalPayment, InternalPaymentParty, Mt202Instruction, SwiftValue } from '../model/detail'
import type { FxEdit, FxHistEntry } from '../model/edit'
import { fxMappingMode } from '../model/mapping'
import { parseFxRow } from './fxDoc.mapper'
import { projectFxInstructionDetail, readFxInstruction } from './instruction.mapper'

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
    status: oneOf(o, 'status', ['pending', 'confirmed', 'rejected'] as const, path),
    by: strOrNull(o, 'by', path),
    at: strOrNull(o, 'at', path),
    reason: strOrNull(o, 'reason', path),
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
      canConfirm: bool(e, 'canConfirm', p),
      hist: arr(e.hist, `${p}.hist`).map((h, i) => parseHistEntry(h, `${p}.hist[${i}]`)),
    }
  }
  return out
}

function parseInternalParty(raw: unknown, path: string): InternalPaymentParty {
  const o = obj(raw, path)
  return {
    name: strOrNull(o, 'name', path), account: strOrNull(o, 'account', path),
    bankName: strOrNull(o, 'bankName', path), bankBic: strOrNull(o, 'bankBic', path),
  }
}

function parseInternalPayment(raw: unknown, path: string): InternalPayment {
  const o = obj(raw, path)
  return {
    reference: strOrNull(o, 'reference', path), initialReference: strOrNull(o, 'initialReference', path),
    valueDate: str(o, 'valueDate', path),
    payer: parseInternalParty(o.payer, `${path}.payer`), payee: parseInternalParty(o.payee, `${path}.payee`),
  }
}

function parseMt202Instruction(raw: unknown, path: string): Mt202Instruction {
  const o = obj(raw, path)
  return {
    reference: strOrNull(o, 'reference', path),
    outgoingReference: strOrNull(o, 'outgoingReference', path),
    initialReference: strOrNull(o, 'initialReference', path),
    valueDate: str(o, 'valueDate', path),
    fallbackFields: parseFields(o.fallbackFields, `${path}.fallbackFields`),
  }
}

/** Ответ GET /grids/fx-docs/documents/{id}: плоский DTO или валютная инструкция с documentSection. */
export function parseFxDocDetail(raw: unknown, path: string): FxDocDetail {
  const response = obj(raw, path)
  const instruction = readFxInstruction(response, path)
  // Для обеих форм строка детали проходит тот же парсер, что и search.
  const row = parseFxRow(response, path, instruction)
  const projection = instruction ? projectFxInstructionDetail(response, instruction, row, path) : undefined
  const o: Obj = projection?.detail ?? response
  const isInternal = row.type === 'InternalPAYDOCVAL'
  const tabsOff = strArr(o.tabsOff, `${path}.tabsOff`)
  const vd = strArr(o.valueDates, `${path}.valueDates`)
  if (vd.length !== 4) throw contractError(`${path}.valueDates: ожидалось 4 даты (вх, исх, по Дт, по Кт)`)
  return {
    ...row,
    ...(fxMappingMode() ? { mappingResponse: response } : {}),
    ...(projection ? { mappingSources: projection.mappingSources } : {}),
    ...(isInternal ? { internalPayment: parseInternalPayment(o.internalPayment, `${path}.internalPayment`) } : {}),
    ...(row.type === 'MT202' && o.mt202Instruction != null ? { mt202Instruction: parseMt202Instruction(o.mt202Instruction, `${path}.mt202Instruction`) } : {}),
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
    tabsOff: isInternal ? [...new Set([...tabsOff, 'extra'])] : tabsOff,
    canAnnul: parseCanAnnul(o, path),
    annul: parseAnnul(o.annul, `${path}.annul`),
    edits: parseEdits(o.edits, `${path}.edits`),
  }
}
