import { arr, contractError, obj, oneOf, str, strOrNull, type Obj } from '../../../shared/api'
import type { InternalPayment, InternalPaymentParty, Mt202Instruction, SwiftValue } from '../model/detail'
import type { FxDoc } from '../model/fxDoc'
import { swiftFieldPath } from '../model/mapping'

const INSTRUCTION_TYPES = ['MT103', 'MT202', 'InternalPAYDOCVAL'] as const
const ROUTE_DIRECTIONS = { INCOMING: 'IN', OUTGOING: 'OUT', TRANSIT: 'TRANSIT', OTHER: 'OTHER' } as const
const ROUTE_GROUPS = ['INCOMING', 'OUTGOING', 'TRANSIT', 'OTHER'] as const

const optionalObject = (value: unknown, path: string): Obj => value == null ? {} : obj(value, path)
const optionalArray = (value: unknown, path: string): unknown[] => value == null ? [] : arr(value, path)
const text = (value: Obj, key: string, path: string): string => strOrNull(value, key, path) ?? ''
const lines = (value: string): string[] => value ? value.split(/\r\n|\n|\r/) : []
const nonEmptyPaths = (path: string, values: Record<string, string>): string[] =>
  Object.keys(values).filter((key) => values[key]).map((key) => `${path}.${key}`)

function decimal(value: Obj, key: string, path: string): number {
  const raw = str(value, key, path)
  const number = Number(raw)
  if (!/^-?\d+(?:\.\d+)?$/.test(raw) || !Number.isFinite(number)) {
    throw contractError(`${path}.${key}: ожидалась десятичная строка`)
  }
  return number
}

function readTransferParty(value: Obj, tag: string, path: string): InternalPaymentParty {
  const partPath = `${path}.${tag}Part`
  const part = optionalObject(value[`${tag}Part`], partPath)
  const party = optionalObject(part[tag], `${partPath}.${tag}`)
  const bank = optionalObject(part[`${tag}Agent`], `${partPath}.${tag}Agent`)
  return {
    name: strOrNull(party, 'name', `${partPath}.${tag}`),
    account: strOrNull(party, 'accountNumber', `${partPath}.${tag}`),
    bankName: strOrNull(bank, 'bankName', `${partPath}.${tag}Agent`),
    bankBic: strOrNull(bank, 'swiftCode', `${partPath}.${tag}Agent`),
  }
}

function readBank(value: unknown, path: string) {
  const bank = optionalObject(value, path)
  return { path, name: text(bank, 'bankName', path), bic: text(bank, 'swiftCode', path), account: text(bank, 'bankAccount', path) }
}

function readMt202Banks(transfer: Obj, path: string) {
  const payer = optionalObject(transfer.payerPart, `${path}.payerPart`)
  const payee = optionalObject(transfer.payeePart, `${path}.payeePart`)
  return {
    '52': readBank(payer.payerAgent, `${path}.payerPart.payerAgent`),
    '53': readBank(transfer.instructingReimbursementAgent, `${path}.instructingReimbursementAgent`),
    '57': readBank(payee.payeeAgent, `${path}.payeePart.payeeAgent`),
    '58': readBank(transfer.beneficiaryPart, `${path}.beneficiaryPart`),
  }
}

/** OpenSearch _source валютной инструкции. Плоские DTO продолжают разбираться по своему контракту. */
export function readFxInstruction(raw: Obj, path: string) {
  const section = raw.documentSection
  if (section === undefined) return undefined
  // В плоском DTO произвольная секция аудита не участвует в маппинге.
  if (raw.type !== undefined) {
    if (!(INSTRUCTION_TYPES as readonly unknown[]).includes(raw.type)) return undefined
    if (typeof section !== 'object' || section === null || !('swiftHeader' in section) || !('remittanceInformation' in section)) return undefined
    const header = section.swiftHeader
    if (typeof header !== 'object' || header === null || !('messageType' in header) || header.messageType !== raw.type) return undefined
  }
  const base = `${path}.documentSection`
  const document = obj(section, base)
  const header = obj(document.swiftHeader, `${base}.swiftHeader`)
  const type = oneOf(header, 'messageType', INSTRUCTION_TYPES, `${base}.swiftHeader`)
  const remittance = obj(document.remittanceInformation, `${base}.remittanceInformation`)
  const swift = optionalObject(document.swift, `${base}.swift`)
  const incoming = optionalObject(swift.incomingSwiftMessage, `${base}.swift.incomingSwiftMessage`)
  const outgoing = optionalObject(swift.outgoingSwiftMessage, `${base}.swift.outgoingSwiftMessage`)
  const hasIncoming = Object.keys(incoming).length > 0
  const swiftBody = {
    message: hasIncoming ? incoming : outgoing,
    path: `${base}.swift.${hasIncoming ? 'incomingSwiftMessage' : 'outgoingSwiftMessage'}`,
  }
  const transferPath = `${base}.transferTransactionInformation`
  const transfer = optionalObject(document.transferTransactionInformation, transferPath)
  const payer = readTransferParty(transfer, 'payer', transferPath)
  const payee = readTransferParty(transfer, 'payee', transferPath)
  const accounting = optionalObject(document.accountingData, `${base}.accountingData`)
  const mt202Banks = type === 'MT202' ? readMt202Banks(transfer, transferPath) : undefined
  return { document, header, type, remittance, incoming, outgoing, swiftBody, payer, payee, accounting, mt202Banks, base }
}

type Instruction = NonNullable<ReturnType<typeof readFxInstruction>>

function messageEndpoints(message: Obj, path: string) {
  const header = optionalObject(message.swiftHeader, `${path}.swiftHeader`)
  return {
    sender: strOrNull(message, 'originator', path) ?? strOrNull(header, 'sender', `${path}.swiftHeader`),
    receiver: strOrNull(message, 'destination', path) ?? strOrNull(header, 'receiver', `${path}.swiftHeader`),
    uetr: strOrNull(header, '121', `${path}.swiftHeader`),
  }
}

function partyValue(account: string, body: string[], opt = ''): SwiftValue {
  const clearing = account.startsWith('//')
  const acc = clearing ? '' : account.replace(/^\//, '')
  return { ...(opt ? { opt } : {}), ...(acc ? { acc } : {}), lines: clearing ? [account, ...body] : body }
}

function swiftParty(message: Obj, tag: string, path: string) {
  const key = `field${tag}A`
  const fieldPath = `${path}.${key}`
  const field = optionalObject(message[key], fieldPath)
  const option = text(field, 'fieldOption', fieldPath)
  const opt = option.startsWith(tag) ? option.slice(tag.length) : option
  const name = text(field, 'name', fieldPath)
  const bic = text(field, 'swiftCode', fieldPath)
  const account = text(field, 'account', fieldPath)
  const additionalInfo = text(field, 'additionalInfo', fieldPath)
  const value = partyValue(account, [...lines(name), ...lines(additionalInfo), ...lines(bic)], opt)
  const paths = nonEmptyPaths(fieldPath, { fieldOption: opt, account, name, additionalInfo, swiftCode: bic })
  return { value, name, bic, paths }
}

function hasSwiftValue(field: SwiftValue): boolean {
  return Boolean(field.acc || field.lines.length)
}

function mt202WireParty(i: Instruction, tag: string) {
  const incoming = swiftParty(i.incoming, tag, `${i.base}.swift.incomingSwiftMessage`)
  return hasSwiftValue(incoming.value) ? incoming : swiftParty(i.outgoing, tag, `${i.base}.swift.outgoingSwiftMessage`)
}

function decimalPair(raw: unknown, path: string): string {
  const value = obj(raw, path)
  const amount = str(value, 'amount', path)
  const currency = str(value, 'currency', path)
  decimal(value, 'amount', path)
  return `${currency} ${amount.replace('.', ',')}`
}

type RecordSource = (key: string, ...sources: string[]) => void

function swiftFields(instruction: Instruction, recordSource: RecordSource): Record<string, SwiftValue> {
  const { incoming, outgoing, base, type, swiftBody: { message, path } } = instruction
  const inPath = `${base}.swift.incomingSwiftMessage`
  const outPath = `${base}.swift.outgoingSwiftMessage`
  const fields: Record<string, SwiftValue> = {}
  const reference = lines(text(incoming, 'field20', inPath))
  if (reference.length) {
    fields['20'] = { lines: reference }
    recordSource(swiftFieldPath('20'), `${inPath}.field20`)
  }
  const textTags = type === 'MT202' ? ['21', '72'] : ['21', '36', '70', '71A', '72', '77B']
  for (const tag of textTags) {
    const key = `field${tag}`
    const incomingValue = type === 'MT202' ? text(incoming, key, inPath) : ''
    const source = type === 'MT202' ? (incomingValue ? inPath : outPath) : path
    const value = lines(type === 'MT202' ? incomingValue || text(outgoing, key, outPath) : text(message, key, path))
    if (value.length) {
      fields[tag] = { lines: value }
      recordSource(swiftFieldPath(tag), `${source}.${key}`)
    }
  }
  const parties = type === 'MT202' ? ['52', '53', '54', '56', '57', '58'] : ['50', '52', '53', '54', '55', '56', '57', '59']
  for (const tag of parties) {
    const field = type === 'MT202' ? mt202WireParty(instruction, tag) : swiftParty(message, tag, path)
    if (hasSwiftValue(field.value)) {
      fields[tag] = field.value
      recordSource(swiftFieldPath(tag), ...field.paths)
    }
  }
  if (type === 'MT202') return fields
  if (message.field33B != null) fields['33B'] = { lines: [decimalPair(message.field33B, `${path}.field33B`)] }
  const charges = optionalArray(message.field71F, `${path}.field71F`)
  if (charges.length) fields['71F'] = { lines: charges.map((charge, i) => decimalPair(charge, `${path}.field71F[${i}]`)) }
  if (message.field71G != null) fields['71G'] = { lines: [decimalPair(message.field71G, `${path}.field71G`)] }
  for (const tag of ['33B', '71G']) {
    if (fields[tag]) recordSource(swiftFieldPath(tag), `${path}.field${tag}.amount`, `${path}.field${tag}.currency`)
  }
  if (charges.length) recordSource(swiftFieldPath('71F'), ...charges.flatMap((_, i) => [
    `${path}.field71F[${i}].amount`, `${path}.field71F[${i}].currency`,
  ]))
  return fields
}

function mt202BankSummary(i: Instruction, tag: '52' | '57' | '58') {
  const wire = mt202WireParty(i, tag)
  return hasSwiftValue(wire.value) ? wire : i.mt202Banks?.[tag]
}

function mt202OutgoingReference(i: Instruction): string | null {
  const path = `${i.base}.mainEntityInfo`
  const main = optionalObject(i.document.mainEntityInfo, path)
  const messageType = strOrNull(main, 'messageTypeOut', path)
  return messageType && messageType !== 'MT202' ? null : strOrNull(main, 'docReferenceOut', path)
}

function projectMt202Instruction(i: Instruction, recordSource: RecordSource): Mt202Instruction {
  const { document, header, remittance, mt202Banks, base } = i
  const fallbackFields: Record<string, SwiftValue> = {}
  for (const [tag, bank] of Object.entries(mt202Banks ?? {})) {
    const value = partyValue(bank.account, [...lines(bank.name), ...lines(bank.bic)])
    if (hasSwiftValue(value)) {
      fallbackFields[tag] = value
      recordSource(swiftFieldPath(tag, true), ...nonEmptyPaths(bank.path, {
        bankAccount: bank.account, bankName: bank.name, swiftCode: bank.bic,
      }))
    }
  }
  const instructions = lines(text(remittance, 'senderToReceiverInformation', `${base}.remittanceInformation`))
  if (instructions.length) {
    fallbackFields['72'] = { lines: instructions }
    recordSource(swiftFieldPath('72', true), `${base}.remittanceInformation.senderToReceiverInformation`)
  }
  return {
    reference: strOrNull(header, 'docReference', `${base}.swiftHeader`),
    outgoingReference: mt202OutgoingReference(i),
    initialReference: strOrNull(header, 'initialDocRef', `${base}.swiftHeader`),
    valueDate: text(document, 'valueDate', base),
    fallbackFields,
  }
}

/** Общая проекция строки для search и detail. Нормализованные поля хоста имеют приоритет. */
export function projectFxInstructionRow(raw: Obj, i: Instruction, path: string): Obj {
  const { document, remittance, base, type, incoming, outgoing, swiftBody: body, payer, payee } = i
  const remittancePath = `${base}.remittanceInformation`
  let docNumber = raw.docNumber
  if (docNumber === undefined) {
    const value = str(remittance, 'docNum', remittancePath)
    docNumber = Number(value)
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(docNumber)) {
      throw contractError(`${remittancePath}.docNum: ожидался целочисленный номер`)
    }
  }
  const inPath = `${base}.swift.incomingSwiftMessage`
  const outPath = `${base}.swift.outgoingSwiftMessage`
  const from = messageEndpoints(incoming, inPath)
  const to = messageEndpoints(outgoing, outPath)
  const payerBank = optionalObject(body.message.field52A, `${body.path}.field52A`)
  const payeeBank = optionalObject(body.message.field57A, `${body.path}.field57A`)
  const ordering = type === 'MT202' ? mt202BankSummary(i, '52') : undefined
  const receiving = type === 'MT202' ? mt202BankSummary(i, '57') : undefined
  const beneficiary = type === 'MT202' ? mt202BankSummary(i, '58') : undefined
  const routePath = `${path}.lastRouteDirection`
  const route = raw.direction === undefined || raw.dirTxt === undefined ? obj(raw.lastRouteDirection, routePath) : {}
  return {
    docNumber,
    refIn: strOrNull(incoming, 'field20', inPath),
    refOut: strOrNull(outgoing, 'field20', outPath),
    uetr: from.uetr ?? strOrNull(outgoing, 'uetr', outPath) ?? to.uetr ?? '',
    created: raw.created ?? str(document, 'creationDateTime', base),
    vdDt: text(document, 'transactionDebitDate', base), vdKt: '',
    type,
    direction: raw.direction === undefined ? ROUTE_DIRECTIONS[oneOf(route, 'group', ROUTE_GROUPS, routePath)] : raw.direction,
    dirTxt: raw.dirTxt === undefined ? str(route, 'name', routePath) : raw.dirTxt,
    amount: raw.amount ?? decimal(document, 'amount', base), currency: raw.currency ?? str(document, 'currency', base),
    f50name: payer.name ?? '', f50acc: payer.account ?? '', f50opt: type === 'MT103' ? swiftParty(body.message, '50', body.path).value.opt ?? '' : '',
    f59name: payee.name ?? '', f59acc: payee.account ?? '', f59opt: type === 'MT103' ? swiftParty(body.message, '59', body.path).value.opt ?? '' : '',
    f52: ordering?.bic ?? text(payerBank, 'swiftCode', `${body.path}.field52A`),
    f52name: ordering?.name ?? payer.bankName ?? text(payerBank, 'name', `${body.path}.field52A`),
    f57: receiving?.bic ?? text(payeeBank, 'swiftCode', `${body.path}.field57A`),
    f57name: receiving?.name ?? payee.bankName ?? text(payeeBank, 'name', `${body.path}.field57A`),
    f58: beneficiary?.bic || null, f58name: beneficiary?.name || null,
    purpose: strOrNull(remittance, 'purpose', remittancePath),
    senderToReceiverInformation: strOrNull(body.message, 'field72', body.path)
      ?? strOrNull(remittance, 'senderToReceiverInformation', remittancePath),
    status: raw.status ?? str(document, 'status', base), reason: null,
    sender: from.sender ?? '', receiver: from.receiver ?? '', outSender: to.sender ?? '', outReceiver: to.receiver ?? '',
    provS: '', provR: '', routeType: null, routeRecv: '', routeAcc: '',
    ...raw,
  }
}

const postingKeys = { dir: 'direction', st: 'status', acc: 'account', reg: 'registerType', amount: 'amount', currency: 'currency' }

function projectTransactions(raw: Obj, path: string, recordSource: RecordSource) {
  const base = `${path}.paymentTransactionSections`
  const entries = optionalArray(raw.paymentTransactionSections, base)
  const sections = entries.map((value, i) => obj(value, `${base}[${i}]`))
  const only = sections.length === 1 ? sections[0] : undefined
  if (only) {
    recordSource('$.txId', `${base}[0].transactionId`)
    recordSource('$.txAt', `${base}[0].createDateTransaction`)
  }
  recordSource('$.txs', base)
  let index = 0
  return {
    txId: only ? text(only, 'transactionId', `${base}[0]`) : '',
    txAt: only ? text(only, 'createDateTransaction', `${base}[0]`) : '',
    txs: raw.txs ?? sections.flatMap((section, i) => {
      const operationsPath = `${base}[${i}].transactionOperations`
      return optionalArray(section.transactionOperations, operationsPath).map((raw, j) => {
        const path = `${operationsPath}[${j}]`
        const operation = obj(raw, path)
        for (const [key, source] of Object.entries(postingKeys)) recordSource(`$.txs[${index}].${key}`, `${path}.${source}`)
        index++
        return {
          dir: str(operation, 'direction', path), st: strOrNull(operation, 'status', path),
          acc: str(operation, 'account', path), reg: str(operation, 'registerType', path),
          time: null, amount: decimal(operation, 'amount', path), currency: str(operation, 'currency', path),
        }
      })
    }),
  }
}

export function projectFxInstructionDetail(raw: Obj, i: Instruction, row: FxDoc, path: string) {
  const { document, header, remittance, incoming, outgoing, payer, payee, accounting, base } = i
  const inPath = `${base}.swift.incomingSwiftMessage`
  const outPath = `${base}.swift.outgoingSwiftMessage`
  const { sender, receiver } = messageEndpoints(incoming, inPath)
  const isInternal = row.type === 'InternalPAYDOCVAL'
  const internalPayment: InternalPayment | undefined = isInternal && raw.internalPayment === undefined ? {
    reference: strOrNull(header, 'docReference', `${base}.swiftHeader`),
    initialReference: strOrNull(header, 'initialDocRef', `${base}.swiftHeader`),
    valueDate: text(document, 'valueDate', base),
    payer,
    payee,
  } : undefined
  const valueDate = (message: Obj, path: string) => text(optionalObject(message.field32A, `${path}.field32A`), 'valueDate', `${path}.field32A`)
  const paths: Record<string, string[]> = {}
  const recordSource: RecordSource = (key, ...sources) => { paths[key] = sources.map((source) => `$${source.slice(path.length)}`) }
  const scalarPaths = {
    docNumber: `${base}.remittanceInformation.docNum`,
    numDate: `${base}.remittanceInformation.docDate`,
    amount: `${base}.amount`,
    currency: `${base}.currency`,
    created: `${base}.creationDateTime`,
    status: `${base}.status`,
    type: `${base}.swiftHeader.messageType`,
    direction: `${path}.lastRouteDirection.group`,
    dirTxt: `${path}.lastRouteDirection.name`,
    refOut: `${outPath}.field20`,
    inSender: incoming.originator != null ? `${inPath}.originator` : `${inPath}.swiftHeader.sender`,
    inReceiver: incoming.destination != null ? `${inPath}.destination` : `${inPath}.swiftHeader.receiver`,
    outSender: outgoing.originator != null ? `${outPath}.originator` : `${outPath}.swiftHeader.sender`,
    outReceiver: outgoing.destination != null ? `${outPath}.destination` : `${outPath}.swiftHeader.receiver`,
    accDt: `${base}.accountingData.debitAccount`,
    accKt: `${base}.accountingData.creditAccount`,
    purpose: `${base}.remittanceInformation.purpose`,
  }
  for (const [key, source] of Object.entries(scalarPaths)) recordSource(`$.${key}`, source)
  if (!isInternal) {
    recordSource('$.valueDates[0]', `${inPath}.field32A.valueDate`)
    recordSource('$.valueDates[1]', `${outPath}.field32A.valueDate`)
  }
  recordSource('$.valueDates[2]', raw.vdDt === undefined ? `${base}.transactionDebitDate` : `${path}.vdDt`)
  if (raw.vdKt !== undefined) recordSource('$.valueDates[3]', `${path}.vdKt`)

  if (isInternal) {
    recordSource('$.internalPayment.reference', `${base}.swiftHeader.docReference`)
    recordSource('$.internalPayment.initialReference', `${base}.swiftHeader.initialDocRef`)
    recordSource('$.internalPayment.valueDate', `${base}.valueDate`)
    for (const role of ['payer', 'payee']) {
      const part = `${base}.transferTransactionInformation.${role}Part`
      recordSource(`$.internalPayment.${role}.name`, `${part}.${role}.name`)
      recordSource(`$.internalPayment.${role}.account`, `${part}.${role}.accountNumber`)
      recordSource(`$.internalPayment.${role}.bankName`, `${part}.${role}Agent.bankName`)
      recordSource(`$.internalPayment.${role}.bankBic`, `${part}.${role}Agent.swiftCode`)
    }
  }
  if (i.type === 'MT202') {
    recordSource('$.mt202Instruction.reference', `${base}.swiftHeader.docReference`)
    recordSource('$.mt202Instruction.initialReference', `${base}.swiftHeader.initialDocRef`)
    recordSource('$.mt202Instruction.outgoingReference', `${base}.mainEntityInfo.docReferenceOut`)
    recordSource('$.mt202Instruction.valueDate', `${base}.valueDate`)
  }
  const detail = {
    numDate: raw.numDate ?? str(remittance, 'docDate', `${base}.remittanceInformation`),
    valueDates: raw.valueDates ?? [isInternal ? '' : valueDate(incoming, inPath), isInternal ? '' : valueDate(outgoing, outPath), row.vdDt, row.vdKt],
    fields: raw.fields ?? (isInternal ? {} : swiftFields(i, recordSource)),
    inSender: isInternal ? null : sender,
    inReceiver: isInternal ? null : receiver,
    accDt: text(accounting, 'debitAccount', `${base}.accountingData`),
    accKt: text(accounting, 'creditAccount', `${base}.accountingData`),
    routeDesc: '', routeText: '',
    ...projectTransactions(raw, path, recordSource),
    tabsOff: isInternal ? ['extra', 'source'] : [],
    internalPayment,
    ...(i.type === 'MT202' && raw.mt202Instruction === undefined ? { mt202Instruction: projectMt202Instruction(i, recordSource) } : {}),
    ...raw,
  }
  return { detail, mappingSources: { paths, responseKeys: Object.keys(raw) } }
}
